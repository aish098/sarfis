const db = require('../config/db');
const RiskService = require('./risk.service');
const inventoryModel = require('../models/inventory.model');

// Helper to generate SO numbers: SO-YYYY-XXXXX
const generateSoNumber = async (companyId, trx) => {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const lastOrder = await trx('sales_orders')
    .where('company_id', companyId)
    .where('so_number', 'like', `${prefix}%`)
    .orderBy('so_number', 'desc')
    .first();
  let num = 1;
  if (lastOrder) {
    const parts = lastOrder.so_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      num = lastNum + 1;
    }
  }
  return `${prefix}${String(num).padStart(5, '0')}`;
};

exports.getSalesOrders = async (companyId, filters = {}) => {
  let query = db('sales_orders as so')
    .join('clients as c', 'so.client_id', 'c.id')
    .join('warehouses as w', 'so.warehouse_id', 'w.id')
    .leftJoin('users as u', 'so.created_by', 'u.id')
    .where('so.company_id', companyId)
    .select(
      'so.id as id', // Explicit alias to avoid Knex SQLite join gotcha
      'so.so_number',
      'so.delivery_date',
      'so.status',
      'so.total_amount',
      'so.notes',
      'so.created_at',
      'c.name as client_name',
      'w.name as warehouse_name',
      'u.name as creator_name'
    );

  if (filters.status && filters.status !== 'ALL') {
    query = query.where('so.status', filters.status);
  }
  if (filters.search) {
    const search = `%${filters.search}%`;
    query = query.where(function() {
      this.where('so.so_number', 'like', search)
          .orWhere('c.name', 'like', search)
          .orWhere('so.notes', 'like', search);
    });
  }

  return await query.orderBy('so.created_at', 'desc');
};

exports.getSalesOrderById = async (id, companyId, trx = db) => {
  const order = await trx('sales_orders as so')
    .join('clients as c', 'so.client_id', 'c.id')
    .join('warehouses as w', 'so.warehouse_id', 'w.id')
    .leftJoin('users as u', 'so.created_by', 'u.id')
    .where({ 'so.id': id, 'so.company_id': companyId })
    .select(
      'so.id as id',
      'so.so_number',
      'so.client_id',
      'so.warehouse_id',
      'so.delivery_date',
      'so.status',
      'so.total_amount',
      'so.notes',
      'so.created_at',
      'c.name as client_name',
      'w.name as warehouse_name',
      'u.name as creator_name'
    )
    .first();

  if (!order) return null;

  const items = await trx('sales_order_items as soi')
    .join('products as p', 'soi.product_id', 'p.id')
    .where('soi.sales_order_id', id)
    .select(
      'soi.*',
      'p.name as product_name',
      'p.sku as product_sku',
      'p.shelf_location'
    );

  // Fetch ALL deliveries for this order (so we can see multiple partial dispatches)
  const deliveriesList = await trx('deliveries as d')
    .leftJoin('users as u', 'd.created_by', 'u.id')
    .where({ 'd.sales_order_id': id })
    .select(
      'd.id',
      'd.delivery_number',
      'd.status',
      'd.created_at',
      'd.driver_name',
      'd.vehicle_number',
      'd.courier_name',
      'd.tracking_number',
      'd.dispatch_time',
      'd.arrival_time',
      'd.receiver_name',
      'd.receiver_signature',
      'd.remarks',
      'u.name as creator_name'
    );

  // Fetch linked invoice if any
  const relatedVoucher = await trx('vouchers as v')
    .leftJoin('users as u', 'v.created_by', 'u.id')
    .where({ 'v.sales_order_id': id, 'v.deleted_at': null })
    .select('v.id', 'v.voucher_number', 'v.status', 'v.created_at', 'u.name as creator_name')
    .first();

  const timeline = await trx('transaction_audit_logs as tal')
    .leftJoin('users as u', 'tal.user_id', 'u.id')
    .where('tal.company_id', companyId)
    .where('tal.description', 'like', `%${order.so_number}%`)
    .select('tal.id', 'tal.action', 'tal.description', 'tal.created_at', 'u.name as user_name')
    .orderBy('tal.created_at', 'asc');

  let totalOrdered = 0;
  let totalDispatched = 0;
  for (const item of items) {
    totalOrdered += parseFloat(item.quantity || 0);
    totalDispatched += parseFloat(item.quantity_dispatched || 0);
  }
  const totalRemaining = totalOrdered - totalDispatched;
  const completionRate = totalOrdered > 0 ? Math.round((totalDispatched / totalOrdered) * 100) : 0;

  return {
    ...order,
    items,
    relatedDelivery: deliveriesList[0] || null, // Keep for backward compatibility
    deliveriesList,
    relatedVoucher,
    timeline,
    total_ordered: totalOrdered,
    total_dispatched: totalDispatched,
    total_remaining: totalRemaining,
    completion_rate: completionRate
  };
};

exports.createSalesOrder = async ({ companyId, clientId, warehouseId, deliveryDate, notes, items, userId }) => {
  if (!clientId) throw new Error('Customer is required.');
  if (!warehouseId) throw new Error('Warehouse is required.');
  if (!items || items.length === 0) throw new Error('Order must contain at least one item.');

  return await db.transaction(async (trx) => {
    const soNumber = await generateSoNumber(companyId, trx);
    
    let totalAmount = 0;
    const itemRecords = [];

    for (const item of items) {
      const product = await trx('products').where({ id: item.productId, company_id: companyId }).first();
      if (!product) throw new Error(`Product not found: ${item.productId}`);

      const qty = parseFloat(item.quantity);
      const price = item.unitPrice !== undefined ? parseFloat(item.unitPrice) : parseFloat(product.unit_price || 0);
      const discount = parseFloat(item.discount || 0);
      const lineTotal = (qty * price) - discount;
      totalAmount += lineTotal;

      itemRecords.push({
        product_id: item.productId,
        quantity: qty,
        unit_price: price,
        discount,
        line_total: lineTotal,
        notes: item.notes || null
      });
    }

    const [order] = await trx('sales_orders')
      .insert({
        company_id: companyId,
        so_number: soNumber,
        client_id: clientId,
        warehouse_id: warehouseId,
        delivery_date: deliveryDate || new Date(),
        status: 'DRAFT',
        total_amount: totalAmount,
        notes: notes || null,
        created_by: userId
      })
      .returning('*');

    await trx('sales_order_items').insert(
      itemRecords.map(item => ({
        ...item,
        sales_order_id: order.id
      }))
    );

    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'CREATE',
      user_id: userId,
      description: `Created Sales Order Draft ${soNumber} for customer ID ${clientId}.`
    });

    return order;
  });
};

exports.confirmSalesOrder = async (id, companyId, userId) => {
  return await db.transaction(async (trx) => {
    const order = await trx('sales_orders').where({ id, company_id: companyId }).first();
    if (!order) throw new Error('Sales Order not found.');
    if (order.status !== 'DRAFT') throw new Error('Only draft Sales Orders can be confirmed.');

    // Enforce Customer Credit policy via RiskService
    const riskCheck = await RiskService.validateTransaction(companyId, 'SALES', { clientId: order.client_id, amount: order.total_amount }, trx);
    if (!riskCheck.allowed) {
      throw new Error(riskCheck.message);
    }

    await trx('sales_orders').where({ id }).update({
      status: 'CONFIRMED',
      updated_at: trx.fn.now()
    });

    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'CONFIRM',
      user_id: userId,
      description: `Confirmed Sales Order ${order.so_number}. Status updated to CONFIRMED.`
    });

    return await exports.getSalesOrderById(id, companyId, trx);
  });
};

exports.updateStatus = async (id, companyId, newStatus, userId, dispatchPayload = {}) => {
  const VALID_STATUSES = ['DRAFT', 'CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED', 'CANCELLED'];
  if (!VALID_STATUSES.includes(newStatus) && newStatus !== 'DISPATCHED') {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  return await db.transaction(async (trx) => {
    const order = await trx('sales_orders').where({ id, company_id: companyId }).first();
    if (!order) throw new Error('Sales Order not found.');

    // Prevent updates on terminal statuses unless moving to Cancelled (from non-delivered states)
    if (['DELIVERED', 'CLOSED', 'CANCELLED'].includes(order.status) && newStatus !== 'CANCELLED' && newStatus !== 'DELIVERED') {
      throw new Error(`Cannot change status of a ${order.status} Sales Order.`);
    }

    const items = await trx('sales_order_items').where({ sales_order_id: id });

    // Handle Dispatch logic (creating read-only delivery order)
    if (newStatus === 'DISPATCHED' || (newStatus === 'DELIVERED' && dispatchPayload.dispatchItems)) {
      if (order.status !== 'READY_FOR_DISPATCH' && order.status !== 'PACKED' && order.status !== 'PARTIALLY_DELIVERED') {
        throw new Error('Order must be packed, ready for dispatch, or partially delivered before dispatching.');
      }

      const dispatchItems = dispatchPayload.dispatchItems || items.map(item => ({
        productId: item.product_id,
        quantityToDispatch: parseFloat(item.quantity) - parseFloat(item.quantity_dispatched || 0)
      }));

      const deliveryItems = [];
      let totalDeliveryAmount = 0;

      // 1. Process items for dispatch and check stock
      for (const dispatchItem of dispatchItems) {
        const item = items.find(i => String(i.product_id) === String(dispatchItem.productId));
        if (!item) continue;

        const qtyToDispatch = parseFloat(dispatchItem.quantityToDispatch || 0);
        if (qtyToDispatch <= 0) continue;

        const remaining = parseFloat(item.quantity) - parseFloat(item.quantity_dispatched || 0);
        if (qtyToDispatch > remaining) {
          throw new Error(`Cannot dispatch ${qtyToDispatch} units of product ID ${item.product_id}. Only ${remaining} units remaining.`);
        }

        // Check stock availability
        const stock = await trx('inventory')
          .where({ product_id: item.product_id, warehouse_id: order.warehouse_id })
          .first();
        const qtyAvailable = parseFloat(stock?.quantity || 0);
        if (qtyAvailable < qtyToDispatch) {
          const prod = await trx('products').where('id', item.product_id).first();
          throw new Error(`Insufficient stock for ${prod?.name}. Available: ${qtyAvailable}, Required: ${qtyToDispatch}`);
        }

        // Deduct stock from warehouse
        const newQty = await inventoryModel.upsertInventory(trx, item.product_id, order.warehouse_id, -qtyToDispatch);
        
        // Log stock log
        await inventoryModel.insertStockLog(trx, {
          product_id: item.product_id,
          warehouse_id: order.warehouse_id,
          type: 'SALE',
          quantity_change: -qtyToDispatch,
          quantity_after: newQty,
          reference_id: id,
          reference_type: 'delivery',
          notes: `Dispatched ${qtyToDispatch} units for Sales Order ${order.so_number}`,
          created_by: userId
        });

        // Increment quantity_dispatched
        await trx('sales_order_items')
          .where({ id: item.id })
          .update({
            quantity_dispatched: parseFloat(item.quantity_dispatched || 0) + qtyToDispatch
          });

        const lineTotal = qtyToDispatch * parseFloat(item.unit_price) - (parseFloat(item.discount || 0) * (qtyToDispatch / parseFloat(item.quantity)));
        totalDeliveryAmount += lineTotal;

        deliveryItems.push({
          product_id: item.product_id,
          quantity: qtyToDispatch,
          unit_price: item.unit_price,
          unit_cost: item.unit_price * 0.7
        });
      }

      if (deliveryItems.length === 0) {
        throw new Error('No items selected for dispatch.');
      }

      // Generate Delivery Note number
      const lastDelivery = await trx('deliveries')
        .where('company_id', companyId)
        .orderBy('delivery_number', 'desc')
        .first();
      let delNum = 1;
      if (lastDelivery) {
        const parts = lastDelivery.delivery_number.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) delNum = lastNum + 1;
      }
      const deliveryNumber = `DO-${new Date().getFullYear()}-${String(delNum).padStart(5, '0')}`;

      // Insert delivery record
      const [delivery] = await trx('deliveries').insert({
        company_id: companyId,
        client_id: order.client_id,
        warehouse_id: order.warehouse_id,
        delivery_number: deliveryNumber,
        delivery_date: new Date(),
        status: 'DISPATCHED',
        total_amount: totalDeliveryAmount,
        total_cost: deliveryItems.reduce((s, i) => s + (i.quantity * i.unit_cost), 0),
        notes: dispatchPayload.remarks || `Automatically generated from Sales Order ${order.so_number}.`,
        created_by: userId,
        sales_order_id: id,
        driver_name: dispatchPayload.driverName || null,
        vehicle_number: dispatchPayload.vehicleNumber || null,
        courier_name: dispatchPayload.courierName || null,
        tracking_number: dispatchPayload.trackingNumber || null,
        receiver_name: dispatchPayload.receiverName || null,
        receiver_signature: dispatchPayload.receiverSignature || null,
        dispatch_time: new Date(),
        remarks: dispatchPayload.remarks || null
      }).returning('*');

      // Insert delivery items
      await trx('delivery_items').insert(
        deliveryItems.map(item => ({
          ...item,
          delivery_id: delivery.id
        }))
      );

      // Log dispatch timeline audit event
      const unitsCount = deliveryItems.reduce((s, i) => s + parseFloat(i.quantity), 0);
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'DISPATCH',
        user_id: userId,
        description: `Dispatched shipment ${deliveryNumber} containing ${unitsCount} units for Sales Order ${order.so_number}.`
      });

      // Check if all items are fully dispatched now
      const updatedItems = await trx('sales_order_items').where({ sales_order_id: id });
      const fullyDispatched = updatedItems.every(i => parseFloat(i.quantity_dispatched) >= parseFloat(i.quantity));
      newStatus = fullyDispatched ? 'DELIVERED' : 'PARTIALLY_DELIVERED';
    }

    // Handle manual Deliver status confirmation (e.g. marking DO delivered)
    if (newStatus === 'DELIVERED' && (!dispatchPayload || !dispatchPayload.dispatchItems)) {
      // Update linked delivery status to DELIVERED
      await trx('deliveries').where({ sales_order_id: id, status: 'DISPATCHED' }).update({
        status: 'DELIVERED',
        arrival_time: new Date(),
        updated_at: trx.fn.now()
      });
    }

    // Update Sales Order status
    await trx('sales_orders').where({ id }).update({
      status: newStatus,
      updated_at: trx.fn.now()
    });

    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'STATUS_CHANGE',
      user_id: userId,
      description: `Sales Order ${order.so_number} status updated to ${newStatus}.`
    });

    return await exports.getSalesOrderById(id, companyId, trx);
  });
};

exports.convertToVoucher = async (id, companyId, userId) => {
  return await db.transaction(async (trx) => {
    const order = await exports.getSalesOrderById(id, companyId, trx);
    if (!order) throw new Error('Sales Order not found.');
    if (order.status !== 'DELIVERED') throw new Error('Only delivered Sales Orders can be invoiced.');
    if (order.relatedVoucher) throw new Error('Sales Order has already been invoiced.');

    // Fetch details settings to get Default AR account
    const settings = await trx('company_accounting_settings').where({ company_id: companyId }).first();
    const arAccountId = settings?.default_ar_account_id;
    if (!arAccountId) throw new Error('Default Accounts Receivable account mapping is missing.');

    // Format Voucher items payload
    const payloadItems = order.items.map(item => ({
      productId: item.product_id,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unit_price),
      discount: parseFloat(item.discount || 0)
    }));

    const lastVoucher = await trx('vouchers')
      .where({ company_id: companyId, type: 'SALES' })
      .orderBy('voucher_number', 'desc')
      .first();
    let vNum = 1;
    if (lastVoucher) {
      const parts = lastVoucher.voucher_number.split('-');
      const lastVal = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastVal)) vNum = lastVal + 1;
    }
    const voucherNumber = `SV-${String(vNum).padStart(5, '0')}`;

    // Create Draft Voucher
    const [voucher] = await trx('vouchers').insert({
      company_id: companyId,
      voucher_number: voucherNumber,
      type: 'SALES',
      date: new Date(),
      status: 'DRAFT',
      payload: {
        clientId: order.client_id,
        warehouseId: order.warehouse_id,
        ar_account_id: arAccountId,
        items: payloadItems,
        notes: `Invoiced from Sales Order ${order.so_number}.`
      },
      total_amount: order.total_amount,
      tax_amount: 0,
      created_by: userId,
      sales_order_id: id
    }).returning('*');

    // Link delivery to the voucher as well
    if (order.relatedDelivery) {
      await trx('deliveries').where({ id: order.relatedDelivery.id }).update({ voucher_id: voucher.id });
    }

    // Close the Sales Order status
    await trx('sales_orders').where({ id }).update({ status: 'CLOSED', updated_at: trx.fn.now() });

    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'CONVERT',
      user_id: userId,
      description: `Converted Sales Order ${order.so_number} to Sales Voucher ${voucherNumber}.`
    });

    return {
      voucherId: voucher.id,
      voucherNumber: voucher.voucher_number
    };
  });
};
