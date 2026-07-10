const db = require('../config/db');
const ReportModel = require('../models/report.model');
const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');

class ReportService {
  /**
   * Closes the accounting period by zeroing out temporary accounts (Income, Revenue, Expense)
   * and transferring the net balance to Retained Earnings.
   */
  static async closePeriod(companyId, endDate, description) {
    if (!endDate) throw new Error('endDate is required for closing.');

    return await db.transaction(async (trx) => {
      // 1. Get balances for all temporary accounts
      const tempAccounts = await ReportModel.getTemporaryAccountsBalances(companyId, endDate, trx);

      if (tempAccounts.length === 0) {
        throw new Error('No temporary accounts have transactions spanning this period.');
      }

      // 2. Find or create Retained Earnings account
      let reAccount = await ReportModel.findRetainedEarningsAccount(companyId, trx);
      let reAccountId;
      if (!reAccount) {
        const [newAcc] = await db('accounts')
          .insert({
            company_id: companyId,
            code: '3900',
            name: 'Retained Earnings',
            type: 'Equity',
            balance: 0
          })
          .returning('id')
          .transacting(trx);
        reAccountId = newAcc.id;
      } else {
        reAccountId = reAccount.id;
      }

      // 3. Create the Closing Journal Entry Header
      const entryId = await JournalModel.createEntry({
        companyId,
        entryDate: endDate,
        description: description || 'Year-End Closing Entry'
      }, trx);

      let totalNiCredit = 0; 
      let insertedLines = 0;
      
      // 4. Create closing lines for each temporary account
      for (let acc of tempAccounts) {
        const debit = parseFloat(acc.total_debit);
        const credit = parseFloat(acc.total_credit);
        const net_balance = credit - debit; 

        if (net_balance === 0) continue;

        let closeDebit = 0;
        let closeCredit = 0;

        // To zero out: if credit > debit (positive balance), we debit it.
        // If debit > credit (negative balance), we credit it.
        if (net_balance > 0) closeDebit = net_balance;
        else closeCredit = Math.abs(net_balance);

        if (closeDebit > 0 || closeCredit > 0) {
           await JournalModel.createLine({
             entryId,
             accountId: acc.id,
             debit: closeDebit,
             credit: closeCredit
           }, trx);

           // Update account static balance (should result in 0 net for these accounts if we were tracking it)
           await AccountModel.updateBalance(acc.id, companyId, closeCredit, closeDebit, trx);
           totalNiCredit += net_balance;
           insertedLines++;
        }
      }

      if (insertedLines === 0) {
         throw new Error('Temporary accounts are already at $0.00 zero balance. No closing needed.');
      }

      // 5. Create the offsetting line in Retained Earnings
      let reDebit = 0;
      let reCredit = 0;
      // Net Income (totalNiCredit > 0) means we credit Retained Earnings
      // Net Loss (totalNiCredit < 0) means we debit Retained Earnings
      if (totalNiCredit > 0) reCredit = totalNiCredit;
      else if (totalNiCredit < 0) reDebit = Math.abs(totalNiCredit);

      if (reDebit > 0 || reCredit > 0) {
         await JournalModel.createLine({
           entryId,
           accountId: reAccountId,
           debit: reDebit,
           credit: reCredit
         }, trx);
         await AccountModel.updateBalance(reAccountId, companyId, reCredit, reDebit, trx);
      }

      return { message: 'Period closed successfully.', netIncome: totalNiCredit };
    });
  }

  static async getAPAging(companyId) {
    const vendors = await db('vendors').where({ company_id: companyId, deleted_at: null });
    const agingReport = [];

    for (const vendor of vendors) {
      const purchases = await db('vouchers')
        .where({ company_id: companyId, type: 'PURCHASE', status: 'POSTED', is_reversed: false, deleted_at: null })
        .whereRaw("(payload->>'vendorId')::int = ?", [vendor.id])
        .orderBy('date', 'asc');

      const payments = await db('vouchers')
        .where({ company_id: companyId, type: 'PAYMENT', status: 'POSTED', is_reversed: false, deleted_at: null })
        .whereRaw("(payload->>'vendorId')::int = ?", [vendor.id]);

      const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

      let unallocatedPayment = totalPayments;
      let vendorOutstanding = 0;
      let bucket0_30 = 0;
      let bucket31_60 = 0;
      let bucket61_90 = 0;
      let bucket90_plus = 0;

      const now = new Date();

      for (const purchase of purchases) {
        const amt = parseFloat(purchase.total_amount || 0);
        let openAmt = amt;

        if (unallocatedPayment > 0) {
          if (unallocatedPayment >= amt) {
            unallocatedPayment -= amt;
            openAmt = 0;
          } else {
            openAmt = amt - unallocatedPayment;
            unallocatedPayment = 0;
          }
        }

        if (openAmt > 0) {
          vendorOutstanding += openAmt;
          const ageInDays = Math.ceil((now - new Date(purchase.date)) / (1000 * 60 * 60 * 24));
          if (ageInDays <= 30) {
            bucket0_30 += openAmt;
          } else if (ageInDays <= 60) {
            bucket31_60 += openAmt;
          } else if (ageInDays <= 90) {
            bucket61_90 += openAmt;
          } else {
            bucket90_plus += openAmt;
          }
        }
      }

      agingReport.push({
        vendorId: vendor.id,
        vendorName: vendor.name,
        currentBalance: parseFloat(vendor.current_balance || 0),
        calculatedOutstanding: vendorOutstanding,
        buckets: {
          '0-30': bucket0_30,
          '31-60': bucket31_60,
          '61-90': bucket61_90,
          '90+': bucket90_plus
        }
      });
    }

    return agingReport;
  }

  static async getARAging(companyId) {
    const clients = await db('clients').where({ company_id: companyId });
    const agingReport = [];

    for (const client of clients) {
      const salesVouchers = await db('vouchers')
        .where({ company_id: companyId, type: 'SALES', status: 'POSTED', is_reversed: false, deleted_at: null })
        .whereRaw("(payload->>'clientId')::int = ?", [client.id]);

      const deliveries = await db('deliveries')
        .where({ company_id: companyId, client_id: client.id })
        .whereIn('status', ['CONFIRMED', 'DELIVERED']);

      const invoices = [];
      salesVouchers.forEach(v => {
        invoices.push({
          id: `voucher-${v.id}`,
          date: v.date,
          amount: parseFloat(v.total_amount || 0)
        });
      });
      deliveries.forEach(d => {
        invoices.push({
          id: `delivery-${d.id}`,
          date: d.delivery_date,
          amount: parseFloat(d.total_amount || 0)
        });
      });

      invoices.sort((a, b) => new Date(a.date) - new Date(b.date));

      const receipts = await db('vouchers')
        .where({ company_id: companyId, type: 'RECEIPT', status: 'POSTED', is_reversed: false, deleted_at: null })
        .whereRaw("(payload->>'clientId')::int = ?", [client.id]);

      const totalReceipts = receipts.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);

      let unallocatedReceipt = totalReceipts;
      let clientOutstanding = 0;
      let bucket0_30 = 0;
      let bucket31_60 = 0;
      let bucket61_90 = 0;
      let bucket90_plus = 0;

      const now = new Date();

      for (const invoice of invoices) {
        const amt = invoice.amount;
        let openAmt = amt;

        if (unallocatedReceipt > 0) {
          if (unallocatedReceipt >= amt) {
            unallocatedReceipt -= amt;
            openAmt = 0;
          } else {
            openAmt = amt - unallocatedReceipt;
            unallocatedReceipt = 0;
          }
        }

        if (openAmt > 0) {
          clientOutstanding += openAmt;
          const ageInDays = Math.ceil((now - new Date(invoice.date)) / (1000 * 60 * 60 * 24));
          if (ageInDays <= 30) {
            bucket0_30 += openAmt;
          } else if (ageInDays <= 60) {
            bucket31_60 += openAmt;
          } else if (ageInDays <= 90) {
            bucket61_90 += openAmt;
          } else {
            bucket90_plus += openAmt;
          }
        }
      }

      agingReport.push({
        clientId: client.id,
        clientName: client.name,
        currentBalance: parseFloat(client.current_balance || 0),
        calculatedOutstanding: clientOutstanding,
        buckets: {
          '0-30': bucket0_30,
          '31-60': bucket31_60,
          '61-90': bucket61_90,
          '90+': bucket90_plus
        }
      });
    }

    return agingReport;
  }

  static async getVendorStatement(companyId, vendorId) {
    const vendor = await db('vendors').where({ id: vendorId, company_id: companyId }).first();
    if (!vendor) throw new Error('Vendor not found.');

    const purchases = await db('vouchers')
      .where({ company_id: companyId, type: 'PURCHASE', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'vendorId')::int = ?", [vendorId]);

    const payments = await db('vouchers')
      .where({ company_id: companyId, type: 'PAYMENT', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'vendorId')::int = ?", [vendorId]);

    const txs = [];
    purchases.forEach(p => {
      txs.push({
        date: p.date,
        reference: p.voucher_number,
        type: 'PURCHASE',
        debit: 0,
        credit: parseFloat(p.total_amount || 0)
      });
    });

    payments.forEach(p => {
      txs.push({
        date: p.date,
        reference: p.voucher_number,
        type: 'PAYMENT',
        debit: parseFloat(p.total_amount || 0),
        credit: 0
      });
    });

    txs.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const ledgerLines = txs.map(tx => {
      balance = balance + tx.credit - tx.debit;
      return {
        ...tx,
        runningBalance: balance
      };
    });

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      currentBalance: parseFloat(vendor.current_balance || 0),
      statement: ledgerLines
    };
  }

  static async getCustomerStatement(companyId, clientId) {
    const client = await db('clients').where({ id: clientId, company_id: companyId }).first();
    if (!client) throw new Error('Client not found.');

    const salesVouchers = await db('vouchers')
      .where({ company_id: companyId, type: 'SALES', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'clientId')::int = ?", [clientId]);

    const deliveries = await db('deliveries')
      .where({ company_id: companyId, client_id: clientId })
      .whereIn('status', ['CONFIRMED', 'DELIVERED']);

    const receipts = await db('vouchers')
      .where({ company_id: companyId, type: 'RECEIPT', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'clientId')::int = ?", [clientId]);

    const txs = [];
    salesVouchers.forEach(v => {
      txs.push({
        date: v.date,
        reference: v.voucher_number,
        type: 'SALES',
        debit: parseFloat(v.total_amount || 0),
        credit: 0
      });
    });

    deliveries.forEach(d => {
      txs.push({
        date: d.delivery_date,
        reference: d.delivery_number,
        type: 'DELIVERY',
        debit: parseFloat(d.total_amount || 0),
        credit: 0
      });
    });

    receipts.forEach(r => {
      txs.push({
        date: r.date,
        reference: r.voucher_number,
        type: 'RECEIPT',
        debit: 0,
        credit: parseFloat(r.total_amount || 0)
      });
    });

    txs.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const ledgerLines = txs.map(tx => {
      balance = balance + tx.debit - tx.credit;
      return {
        ...tx,
        runningBalance: balance
      };
    });

    return {
      clientId: client.id,
      clientName: client.name,
      currentBalance: parseFloat(client.current_balance || 0),
      statement: ledgerLines
    };
  }
}

module.exports = ReportService;
