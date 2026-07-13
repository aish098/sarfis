const db = require('../config/db');

class ProductInquiryService {
  static async getProductInquiryDetails(companyId, productId) {
    // 1. Load product core details
    const product = await db('products as p')
      .leftJoin('product_categories as pc', 'p.category_id', 'pc.id')
      .where({ 'p.id': productId, 'p.company_id': companyId })
      .select(
        'p.*',
        'pc.name as category_name',
        'pc.description as category_description'
      )
      .first();

    if (!product) {
      throw new Error('Product not found');
    }

    // 2. Fetch stock distribution across warehouses
    const warehouses = await db('inventory as i')
      .join('warehouses as w', 'i.warehouse_id', 'w.id')
      .where('i.product_id', productId)
      .select(
        'w.id as warehouse_id',
        'w.name as warehouse_name',
        'w.location',
        'i.quantity as on_hand'
      );

    // Resolve reserved quantities for each warehouse (based on confirmed but un-dispatched Sales Orders)
    const reservedRes = await db('sales_order_items as soi')
      .join('sales_orders as so', 'soi.sales_order_id', 'so.id')
      .where('soi.product_id', productId)
      .whereIn('so.status', ['CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH'])
      .select('so.warehouse_id')
      .sum('soi.quantity as qty')
      .groupBy('so.warehouse_id');

    const reservedMap = {};
    for (const r of reservedRes) {
      reservedMap[r.warehouse_id] = parseFloat(r.qty || 0);
    }

    const warehouseBalances = warehouses.map(wh => {
      const onHand = parseFloat(wh.on_hand || 0);
      const reserved = reservedMap[wh.warehouse_id] || 0;
      return {
        warehouseId: wh.warehouse_id,
        name: wh.warehouse_name,
        location: wh.location,
        onHand,
        reserved,
        available: Math.max(0, onHand - reserved),
        value: onHand * parseFloat(product.cost_price || 0)
      };
    });

    // 3. Fetch Stock Movement Logs (detailed audit trail)
    const logs = await db('stock_logs as sl')
      .join('warehouses as w', 'sl.warehouse_id', 'w.id')
      .leftJoin('users as u', 'sl.created_by', 'u.id')
      .where('sl.product_id', productId)
      .select(
        'sl.*',
        'w.name as warehouse_name',
        'u.name as user_name'
      )
      .orderBy('sl.created_at', 'desc')
      .limit(50);

    const movements = logs.map(l => ({
      id: l.id,
      date: l.created_at,
      type: l.type, // 'PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN'
      qtyChange: parseFloat(l.quantity_change),
      qtyAfter: parseFloat(l.quantity_after),
      unitCost: parseFloat(l.unit_cost || 0),
      warehouseName: l.warehouse_name,
      userName: l.user_name || 'System',
      notes: l.notes,
      referenceType: l.reference_type,
      referenceId: l.reference_id
    }));

    // 4. Calculate Ledger balance history
    let runningBalance = 0;
    const ledgerLogs = [...movements].reverse(); // oldest first to compute running balance
    const inventoryLedger = ledgerLogs.map(log => {
      const change = log.qtyChange;
      runningBalance = log.qtyAfter; // use logged qtyAfter to prevent offset anomalies
      return {
        date: log.date,
        type: log.type,
        reference: log.referenceType ? `${log.referenceType} #${log.referenceId || ''}` : 'Stock Log',
        warehouse: log.warehouseName,
        in: change > 0 ? change : null,
        out: change < 0 ? Math.abs(change) : null,
        balance: runningBalance,
        cost: log.unitCost,
        value: runningBalance * (log.unitCost || parseFloat(product.cost_price || 0))
      };
    }).reverse(); // display newest first

    // 5. Separate Purchases & Sales logs
    const purchasesList = movements.filter(m => m.type === 'PURCHASE');
    const salesList = movements.filter(m => m.type === 'SALE');

    const totalPurchasedQty = purchasesList.reduce((s, r) => s + Math.abs(r.qtyChange), 0);
    const totalSalesQty = salesList.reduce((s, r) => s + Math.abs(r.qtyChange), 0);

    // 6. Forecast & Velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesLast30Days = salesList
      .filter(s => new Date(s.date) >= thirtyDaysAgo)
      .reduce((s, r) => s + Math.abs(r.qtyChange), 0);

    const dailyVelocity = salesLast30Days / 30;
    const currentTotalQty = warehouseBalances.reduce((s, r) => s + r.onHand, 0);
    const daysToDepletion = dailyVelocity > 0 ? Math.round(currentTotalQty / dailyVelocity) : null;

    // 7. Valuation
    const totalInventoryValue = currentTotalQty * parseFloat(product.cost_price || 0);

    return {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        unitPrice: parseFloat(product.unit_price || 0),
        costPrice: parseFloat(product.cost_price || 0),
        unitOfMeasure: product.unit_of_measure || 'unit',
        reorderLevel: product.reorder_level || 0,
        category: product.category_name || 'Others',
        createdAt: product.created_at
      },
      warehouses: warehouseBalances,
      movements,
      inventoryLedger,
      purchaseSummary: {
        totalQty: totalPurchasedQty,
        history: purchasesList.slice(0, 10)
      },
      salesSummary: {
        totalQty: totalSalesQty,
        history: salesList.slice(0, 10)
      },
      valuation: {
        totalQty: currentTotalQty,
        avgCost: parseFloat(product.cost_price || 0),
        totalValue: totalInventoryValue
      },
      forecast: {
        salesLast30Days,
        dailyVelocity,
        daysToDepletion,
        status: currentTotalQty <= product.reorder_level ? 'REORDER_SUGGESTED' : 'HEALTHY'
      }
    };
  }
}

module.exports = ProductInquiryService;
