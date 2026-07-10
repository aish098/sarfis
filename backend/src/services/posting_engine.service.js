const db = require('../config/db');
const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');
const inventoryModel = require('../models/inventory.model');
const VendorModel = require('../models/vendor.model');
const distModel = require('../models/distribution.model');
const PeriodValidationService = require('./period_validation.service');

class PostingEngineService {
  /**
   * Resolves default accounting settings for a company, with auto-fallback to COA codes
   */
  static async getAccountingSettings(companyId, trx) {
    const query = db('company_accounting_settings').where({ company_id: companyId });
    if (trx) query.transacting(trx);
    let settings = await query.first();

    if (!settings) {
      // Find accounts by standard US COA codes as fallback
      const accounts = await (trx ? db('accounts').transacting(trx) : db('accounts'))
        .where({ company_id: companyId });

      const findIdByCode = (prefix) => {
        const found = accounts.find(a => a.code.startsWith(prefix));
        return found ? found.id : null;
      };

      settings = {
        company_id: companyId,
        default_sales_account_id: findIdByCode('4') || findIdByCode('4010') || null, // Revenue/Income
        default_ap_account_id: findIdByCode('2') || findIdByCode('2000') || null,    // Liabilities/AP
        default_ar_account_id: findIdByCode('12') || findIdByCode('1200') || null,   // AR
        default_inventory_account_id: findIdByCode('13') || findIdByCode('1300') || null, // Inventory Asset
        default_cogs_account_id: findIdByCode('5') || findIdByCode('5010') || null,   // COGS/Expense
        default_cash_account_id: findIdByCode('10') || findIdByCode('1010') || null,  // Cash
        default_bad_debt_account_id: findIdByCode('5030') || findIdByCode('503') || null, // Bad Debt Expense
        tax_rate: 0.00
      };

      // Create settings record for future calls
      const insertQuery = db('company_accounting_settings');
      if (trx) insertQuery.transacting(trx);
      await insertQuery.insert(settings).onConflict('company_id').merge();
    }

    return settings;
  }

  /**
   * Asserts whether a transaction date falls into a locked/closed accounting period
   */
  static async assertPeriodOpen(companyId, date, trx) {
    await PeriodValidationService.validateDate(companyId, date, trx);
  }

  /**
   * Validates debits = credits of journal lines to prevent out-of-balance entries
   */
  static validateJournalBalance(lines) {
    let totalDebit = 0;
    let totalCredit = 0;
    
    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error('Debit and Credit entries cannot be negative.');
      }
      totalDebit += parseFloat(line.debit || 0);
      totalCredit += parseFloat(line.credit || 0);
    }

    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      throw new Error(`Unbalanced Entry: Total Debits ($${totalDebit.toFixed(2)}) must equal Total Credits ($${totalCredit.toFixed(2)}).`);
    }
  }

  /**
   * Core posting processor for business vouchers
   */
  static async postTransaction({ type, companyId, payload, userId, voucherId }, externalTrx) {
    if (!companyId) throw new Error('Company context is required for transaction posting.');

    const executePosting = async (trx) => {
      const txDate = payload.date || new Date();
      
      // 1. Enforce accounting period lock check
      await this.assertPeriodOpen(companyId, txDate, trx);

      // Fetch company mappings
      const settings = await this.getAccountingSettings(companyId, trx);

      // 1b. Validate entity relationship status and credit policy limits via RiskService
      const RiskService = require('./risk.service');
      const validationResult = await RiskService.validateTransaction(companyId, type, { ...payload, voucherId }, trx);
      if (!validationResult.allowed) {
        throw new Error(validationResult.message);
      }

      let journalEntryId = null;
      let totalAmount = 0;
      let lines = [];
      let description = '';

      // 2. Route transaction types
      switch (type.toUpperCase()) {
        case 'PURCHASE': {
          const { vendorId, warehouseId, items } = payload;
          if (!vendorId) throw new Error('Vendor is required for Purchase Voucher.');
          if (!warehouseId) throw new Error('Warehouse is required for Purchase Voucher.');
          if (!items || items.length === 0) throw new Error('Voucher must contain at least one item.');

          const vendor = await VendorModel.getById(vendorId, companyId);
          if (!vendor) throw new Error('Vendor not found.');

          description = `Purchase Voucher: Supplier ${vendor.name}`;
          
          let totalCost = 0;
          const inventoryAccount = settings.default_inventory_account_id;
          const apAccount = payload.ap_account_id || settings.default_ap_account_id;

          if (!inventoryAccount || !apAccount) {
            throw new Error('Default Inventory Asset or Accounts Payable mappings are missing for this company.');
          }

          // Process items for WAC calculation and inventory upsert
          for (const item of items) {
            const product = await inventoryModel.getProductById(item.productId, companyId);
            if (!product) throw new Error(`Product ID ${item.productId} not found.`);

            const qty = parseFloat(item.quantity);
            const unitCost = parseFloat(item.unitCost);
            const itemTotal = qty * unitCost;
            totalCost += itemTotal;

            // --- Weighted Average Cost (WAC) Calculation ---
            // Sum of current inventory across all warehouses for the product
            const stockSummary = await trx('inventory')
              .where('product_id', item.productId)
              .sum('quantity as total_qty')
              .first();
            
            const q_curr = parseFloat(stockSummary?.total_qty || 0);
            const c_curr = parseFloat(product.cost_price || 0);
            const q_new = qty;
            const c_new = unitCost;

            let newWAC = c_new;
            if (q_curr + q_new > 0) {
              newWAC = ((q_curr * c_curr) + (q_new * c_new)) / (q_curr + q_new);
            }

            // Update product WAC cost price
            await trx('products')
              .where({ id: item.productId, company_id: companyId })
              .update({ cost_price: newWAC, updated_at: trx.fn.now() });

            // Upsert stock in warehouse
            const newQty = await inventoryModel.upsertInventory(trx, item.productId, warehouseId, qty);

            // Record stock log
            await inventoryModel.insertStockLog(trx, {
              product_id: item.productId,
              warehouse_id: warehouseId,
              type: 'PURCHASE',
              quantity_change: qty,
              quantity_after: newQty,
              unit_cost: unitCost,
              reference_id: voucherId || null,
              reference_type: 'voucher',
              notes: payload.notes || 'Purchase posted',
              created_by: userId
            });
          }

          totalAmount = totalCost;

          // Double Entry lines: Dr Inventory, Cr AP
          lines = [
            { accountId: inventoryAccount, debit: totalCost, credit: 0 },
            { accountId: apAccount, debit: 0, credit: totalCost }
          ];

          // Update vendor payable balance
          await VendorModel.updateBalance(vendorId, companyId, totalCost, trx);
          break;
        }

        case 'SALES': {
          const { clientId, warehouseId, items } = payload;
          if (!clientId) throw new Error('Customer (Client) is required for Sales Invoice.');
          if (!warehouseId) throw new Error('Warehouse is required for Sales Invoice.');
          if (!items || items.length === 0) throw new Error('Invoice must contain at least one item.');

          const client = await distModel.getClientById(clientId, companyId);
          if (!client) throw new Error('Customer not found.');

          description = `Sales Invoice Voucher: Customer ${client.name}`;

          let totalRevenue = 0;
          let totalCOGS = 0;

          const arAccount = payload.ar_account_id || settings.default_ar_account_id;
          const salesAccount = settings.default_sales_account_id;
          const inventoryAccount = settings.default_inventory_account_id;
          const cogsAccount = settings.default_cogs_account_id;

          if (!arAccount || !salesAccount || !inventoryAccount || !cogsAccount) {
            throw new Error('Default AR, Revenue, Inventory, or COGS mappings are missing for this company.');
          }

          const cogsLines = [];

          // Process items for COGS, stock validation, and stock reductions
          for (const item of items) {
            const product = await inventoryModel.getProductById(item.productId, companyId);
            if (!product) throw new Error(`Product ID ${item.productId} not found.`);

            const qty = parseFloat(item.quantity);
            const unitPrice = parseFloat(item.unitPrice);
            const unitCost = parseFloat(product.cost_price || 0); // Using product WAC cost

            const lineRevenue = qty * unitPrice;
            const lineCOGS = qty * unitCost;

            totalRevenue += lineRevenue;
            totalCOGS += lineCOGS;

            // Stock availability check
            const stock = await trx('inventory')
              .where({ product_id: item.productId, warehouse_id: warehouseId })
              .first();
            
            const available = parseFloat(stock?.quantity || 0);
            if (available < qty) {
              throw new Error(`Insufficient stock for product '${product.name}' in selected warehouse. Available: ${available}, Required: ${qty}`);
            }

            // Deduct inventory
            const newQty = await inventoryModel.upsertInventory(trx, item.productId, warehouseId, -qty);

            // Record stock log
            await inventoryModel.insertStockLog(trx, {
              product_id: item.productId,
              warehouse_id: warehouseId,
              type: 'SALE',
              quantity_change: -qty,
              quantity_after: newQty,
              unit_cost: unitCost,
              reference_id: voucherId || null,
              reference_type: 'voucher',
              notes: payload.notes || 'Sales Invoice posted',
              created_by: userId
            });

            // Dr COGS, Cr Inventory lines (accrued per item)
            cogsLines.push(
              { accountId: cogsAccount, debit: lineCOGS, credit: 0 },
              { accountId: inventoryAccount, debit: 0, credit: lineCOGS }
            );
          }

          totalAmount = totalRevenue;

          // Standard balanced double entries
          // Dr AR       (totalRevenue)
          //   Cr Revenue   (totalRevenue)
          // Dr COGS     (totalCOGS)
          //   Cr Inventory (totalCOGS)
          lines = [
            { accountId: arAccount, debit: totalRevenue, credit: 0 },
            { accountId: salesAccount, debit: 0, credit: totalRevenue },
            ...cogsLines
          ];

          // Update customer AR balance
          await distModel.updateClientBalance(trx, clientId, totalRevenue);
          break;
        }

        case 'RECEIPT': {
          const { clientId, cashAccountId, amount } = payload;
          if (!clientId) throw new Error('Customer (Client) is required for Receipt Voucher.');
          if (!amount || parseFloat(amount) <= 0) throw new Error('Receipt amount must be positive.');

          const client = await distModel.getClientById(clientId, companyId);
          if (!client) throw new Error('Customer not found.');

          const cashAccount = cashAccountId || settings.default_cash_account_id;
          const arAccount = payload.ar_account_id || settings.default_ar_account_id;

          if (!cashAccount || !arAccount) {
            throw new Error('Default Cash/Bank or Accounts Receivable mappings are missing.');
          }

          const amt = parseFloat(amount);
          description = `Cash Receipt Voucher: Customer ${client.name}`;
          totalAmount = amt;

          // Double entries: Dr Cash, Cr AR
          lines = [
            { accountId: cashAccount, debit: amt, credit: 0 },
            { accountId: arAccount, debit: 0, credit: amt }
          ];

          // Reduce customer outstanding AR balance
          await distModel.updateClientBalance(trx, clientId, -amt);
          break;
        }

        case 'PAYMENT': {
          const { vendorId, cashAccountId, amount } = payload;
          if (!vendorId) throw new Error('Vendor is required for Payment Voucher.');
          if (!amount || parseFloat(amount) <= 0) throw new Error('Payment amount must be positive.');

          const vendor = await VendorModel.getById(vendorId, companyId);
          if (!vendor) throw new Error('Vendor not found.');

          const cashAccount = cashAccountId || settings.default_cash_account_id;
          const apAccount = payload.ap_account_id || settings.default_ap_account_id;

          if (!cashAccount || !apAccount) {
            throw new Error('Default Cash/Bank or Accounts Payable mappings are missing.');
          }

          const amt = parseFloat(amount);
          description = `Payment Voucher: Paid Supplier ${vendor.name}`;
          totalAmount = amt;

          // Double entries: Dr AP, Cr Cash
          lines = [
            { accountId: apAccount, debit: amt, credit: 0 },
            { accountId: cashAccount, debit: 0, credit: amt }
          ];

          // Reduce vendor outstanding AP balance
          await VendorModel.updateBalance(vendorId, companyId, -amt, trx);
          break;
        }

        case 'BAD_DEBT_WRITE_OFF': {
          const { clientId, amount, notes } = payload;
          if (!clientId) throw new Error('Client is required for bad debt write-off.');
          if (!amount || parseFloat(amount) <= 0) throw new Error('Write-off amount must be positive.');

          const client = await distModel.getClientById(clientId, companyId);
          if (!client) throw new Error('Customer not found.');

          const arAccount = payload.ar_account_id || settings.default_ar_account_id;
          const badDebtAccount = settings.default_bad_debt_account_id;

          if (!arAccount || !badDebtAccount) {
            throw new Error('Default Accounts Receivable or Bad Debt Expense mappings are missing for this company.');
          }

          const amt = parseFloat(amount);
          description = `Bad Debt Write-Off: Customer ${client.name} - ${notes || ''}`;
          totalAmount = amt;

          // Double entry: Dr Bad Debt Expense, Cr AR
          lines = [
            { accountId: badDebtAccount, debit: amt, credit: 0 },
            { accountId: arAccount, debit: 0, credit: amt }
          ];

          // Reduce customer outstanding balance via posting engine (single source of truth)
          await distModel.updateClientBalance(trx, clientId, -amt);
          break;
        }

        case 'INVENTORY_ADJUSTMENT': {
          const { productId, warehouseId, quantity, amount } = payload;
          if (!productId) throw new Error('Product ID is required for Inventory Adjustment.');
          if (!warehouseId) throw new Error('Warehouse ID is required for Inventory Adjustment.');
          if (!quantity) throw new Error('Quantity is required for Inventory Adjustment.');

          const product = await inventoryModel.getProductById(productId, companyId);
          if (!product) throw new Error('Product not found.');

          const inventoryAccount = settings.default_inventory_account_id;
          if (!inventoryAccount) {
            throw new Error('Default Inventory Asset account mapping is missing for this company.');
          }

          // Dynamically find shrinkage/adjustment expense account
          const shrinkageAccount = await trx('accounts')
            .where({ company_id: companyId, name: 'Inventory Shrinkage Expense' })
            .first();
          const expenseAccount = shrinkageAccount ? shrinkageAccount.id : settings.default_cogs_account_id;

          if (!expenseAccount) {
            throw new Error('Inventory Shrinkage Expense or Default COGS account is missing.');
          }

          const qty = parseFloat(quantity);
          const amt = parseFloat(amount || (Math.abs(qty) * parseFloat(product.cost_price || 0)));

          description = `Inventory Adjustment: ${product.name} (${qty > 0 ? '+' : ''}${qty}) - ${payload.notes || 'Adjustment'}`;
          totalAmount = amt;

          if (qty < 0) {
            // Reduction (Shrinkage): Dr Expense, Cr Inventory
            lines = [
              { accountId: expenseAccount, debit: amt, credit: 0 },
              { accountId: inventoryAccount, debit: 0, credit: amt }
            ];
          } else {
            // Addition: Dr Inventory, Cr Expense
            lines = [
              { accountId: inventoryAccount, debit: amt, credit: 0 },
              { accountId: expenseAccount, debit: 0, credit: amt }
            ];
          }
          break;
        }

        case 'JOURNAL': {
          if (!payload.lines || payload.lines.length < 2) {
            throw new Error('Journal Voucher must contain at least two double-entry lines.');
          }

          description = payload.description || 'Journal Voucher Entry';
          lines = payload.lines.map(l => ({
            accountId: l.accountId,
            debit: parseFloat(l.debit || 0),
            credit: parseFloat(l.credit || 0)
          }));

          this.validateJournalBalance(lines);
          totalAmount = lines.reduce((acc, l) => acc + l.debit, 0);
          break;
        }

        default:
          throw new Error(`Unsupported posting transaction type: ${type}`);
      }

      // Resolve classifications from voucher payload
      const dept = payload.department || null;
      const proj = payload.project || null;
      const br = payload.branch || null;

      const mappedLines = lines.map(l => ({
        ...l,
        department: l.department || dept,
        project: l.project || proj,
        branch: l.branch || br
      }));

      // Validate Budget availability
      const BudgetService = require('./budget.service');
      const budgetCheck = await BudgetService.checkTransactionBudget(companyId, 'VOUCHER', voucherId || 0, mappedLines, trx);
      if (budgetCheck.isExceeded) {
        const blockBreaches = budgetCheck.breaches.filter(b => b.controlLevel === 'BLOCK');
        if (blockBreaches.length > 0) {
          // Bypass block check if this specific document has been override-approved by a workflow instance
          const approvedInst = await trx('workflow_instances as wi')
            .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
            .where({
              'wi.company_id': companyId,
              'wd.document_type_code': 'VOUCHER',
              'wi.document_id': voucherId || 0,
              'wi.status': 'APPROVED'
            })
            .first();

          if (!approvedInst) {
            throw new Error(`Budget Exceeded: Account '${blockBreaches[0].accountCode} - ${blockBreaches[0].accountName}' exceeds budget allocation. CFO budget override approval required.`);
          }
        }
      }

      // 3. Write Journal Entry Header using standard SCAFIS structures
      const entryId = await JournalModel.createEntry({
        companyId,
        entryDate: txDate,
        description,
        status: 'POSTED',
        userId
      }, trx);

      journalEntryId = entryId;

      // 4. Write Journal Lines and update cached account balances
      for (const line of mappedLines) {
        await JournalModel.createLine({
          entryId,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          department: line.department,
          project: line.project,
          branch: line.branch
        }, trx);

        // Update static account balance cache safely
        await AccountModel.updateBalance(line.accountId, companyId, line.debit, line.credit, trx);
      }

      // Commit actual budget spend
      await BudgetService.commitActualSpend('VOUCHER', voucherId || 0, companyId, txDate, mappedLines, trx);

      // 5. Add Transaction Audit Log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        voucher_id: voucherId || null,
        action: 'POST',
        user_id: userId,
        description: `Posted ${type.toUpperCase()} transaction of $${totalAmount.toFixed(2)}. Journal Entry #${entryId} created.`
      });

      // 5b. Trigger auto-capitalization pipeline if Purchase Voucher contains asset items
      if (type.toUpperCase() === 'PURCHASE' && voucherId) {
        const FixedAssetsService = require('./fixed_assets.service');
        await FixedAssetsService.processVoucherCapitalization(voucherId, companyId, userId, trx);
      }

      return { journalEntryId, totalAmount };
    };

    if (externalTrx) {
      return await executePosting(externalTrx);
    } else {
      return await db.transaction(executePosting);
    }
  }
}

module.exports = PostingEngineService;
