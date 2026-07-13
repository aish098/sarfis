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
      'p.sku as product_sku'
    );

  // Fetch linked delivery if any
  const relatedDelivery = await trx('deliveries as d')
    .leftJoin('users as u', 'd.created_by', 'u.id')
    .where({ 'd.sales_order_id': id })
    .select('d.id', 'd.delivery_number', 'd.status', 'd.created_at', 'u.name as creator_name')
    .first();

  // Fetch linked invoice if any
  const relatedVoucher = await trx('vouchers as v')
    .leftJoin('users as u', 'v.created_by', 'u.id')
    .where({ 'v.sales_order_id': id, 'v.deleted_at': null })
    .select('v.id', 'v.voucher_number', 'v.status', 'v.created_at', 'u.name as creator_name')
    .first();

  return {
    ...order,
    items,
    relatedDelivery,
    relatedVoucher
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

exports.updateStatus = async (id, companyId, newStatus, userId) => {
  const VALID_STATUSES = ['DRAFT', 'CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED', 'CLOSED', 'CANCELLED'];
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  return await db.transaction(async (trx) => {
    const order = await trx('sales_orders').where({ id, company_id: companyId }).first();
    if (!order) throw new Error('Sales Order not found.');

    // Prevent updates on terminal statuses unless moving to Cancelled (from non-delivered states)
    if (['DELIVERED', 'CLOSED', 'CANCELLED'].includes(order.status) && newStatus !== 'CANCELLED') {
      throw new Error(`Cannot change status of a ${order.status} Sales Order.`);
    }

    const items = await trx('sales_order_items').where({ sales_order_id: id });

    // Handle Dispatch logic (creating read-only delivery order)
    if (newStatus === 'DISPATCHED') {
      if (order.status !== 'READY_FOR_DISPATCH' && order.status !== 'PACKED') {
        throw new Error('Order must be packed or ready for dispatch before dispatching.');
      }

      // Check stock availability
      for (const item of items) {
        const stock = await trx('inventory')
          .where({ product_id: item.product_id, warehouse_id: order.warehouse_id })
          .first();
        const qtyAvailable = parseFloat(stock?.quantity || 0);
        if (qtyAvailable < parseFloat(item.quantity)) {
          const prod = await trx('products').where('id', item.product_id).first();
          throw new Error(`Insufficient stock for ${prod?.name}. Available: ${qtyAvailable}, Required: ${item.quantity}`);
        }
      }

      // Automatically create a Delivery Note (status: DISPATCHED)
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

      // Deduct stock from warehouse
      for (const item of items) {
        const newQty = await inventoryModel.upsertInventory(trx, item.product_id, order.warehouse_id, -parseFloat(item.quantity));
        
        // Log stock log
        await inventoryModel.insertStockLog(trx, {
          product_id: item.product_id,
          warehouse_id: order.warehouse_id,
          type: 'SALE',
          quantity_change: -parseFloat(item.quantity),
          quantity_after: newQty,
          reference_id: id,
          reference_type: 'delivery',
          notes: `Dispatched Sales Order ${order.so_number}`,
          created_by: userId
        });
      }

      const totalCost = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price * 0.7)), 0); // Approximate COGS

      // Insert delivery record
      const [delivery] = await trx('deliveries').insert({
        company_id: companyId,
        client_id: order.client_id,
        warehouse_id: order.warehouse_id,
        delivery_number: deliveryNumber,
        delivery_date: new Date(),
        status: 'DISPATCHED',
        total_amount: order.total_amount,
        total_cost: totalCost,
        notes: `Automatically generated from Sales Order ${order.so_number}.`,
        created_by: userId,
        sales_order_id: id
      }).returning('*');

      // Insert delivery items
      await trx('delivery_items').insert(
        items.map(item => ({
          delivery_id: delivery.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_cost: item.unit_price * 0.7
        }))
      );
    }

    // Handle Deliver status
    if (newStatus === 'DELIVERED') {
      if (order.status !== 'DISPATCHED') {
        throw new Error('Order must be dispatched before marking as delivered.');
      }
      // Update linked delivery status to DELIVERED
      await trx('deliveries').where({ sales_order_id: id }).update({ status: 'DELIVERED', updated_at: trx.fn.now() });
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
