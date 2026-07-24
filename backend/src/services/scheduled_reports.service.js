const db = require('../config/db');
const MailProvider = require('./mail/mail.provider');
const ReportModel = require('../models/report.model');
const PDFDocument = require('pdfkit');

class ScheduledReportsService {
  static async createSchedule(companyId, userId, payload) {
    const { report_type, frequency, format, emails, enabled = true } = payload;
    if (!report_type || !frequency || !format || !emails || !emails.length) {
      throw new Error('Missing required fields for scheduled report.');
    }

    return await db.transaction(async (trx) => {
      // Calculate initial next run
      const nextRun = this.calculateNextRun(frequency, new Date());

      const [schedule] = await trx('scheduled_reports')
        .insert({
          company_id: companyId,
          report_type,
          frequency,
          format,
          enabled,
          next_run: nextRun,
          created_by: userId
        })
        .returning('*');

      const recipientRows = emails.map(email => ({
        schedule_id: schedule.id,
        email: email.trim()
      }));

      await trx('report_recipients').insert(recipientRows);

      return {
        ...schedule,
        emails
      };
    });
  }

  static async getSchedules(companyId) {
    const schedules = await db('scheduled_reports')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');

    const result = [];
    for (const s of schedules) {
      const recipients = await db('report_recipients')
        .where({ schedule_id: s.id })
        .select('email');
      
      const history = await db('report_history')
        .where({ schedule_id: s.id })
        .orderBy('generated_at', 'desc')
        .limit(10);

      result.push({
        ...s,
        emails: recipients.map(r => r.email),
        history
      });
    }
    return result;
  }

  static async toggleSchedule(companyId, scheduleId, enabled) {
    const [schedule] = await db('scheduled_reports')
      .where({ id: scheduleId, company_id: companyId })
      .update({ enabled, updated_at: db.fn.now() })
      .returning('*');

    if (!schedule) throw new Error('Scheduled report not found.');
    return schedule;
  }

  static async deleteSchedule(companyId, scheduleId) {
    const rows = await db('scheduled_reports')
      .where({ id: scheduleId, company_id: companyId })
      .delete();

    if (!rows) throw new Error('Scheduled report not found.');
    return { message: 'Schedule deleted successfully' };
  }

  static calculateNextRun(frequency, fromDate) {
    const d = new Date(fromDate);
    if (frequency === 'DAILY') {
      d.setDate(d.getDate() + 1);
    } else if (frequency === 'WEEKLY') {
      d.setDate(d.getDate() + 7);
    } else if (frequency === 'MONTHLY') {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  }

  static async runPendingSchedules() {
    const now = new Date();
    const pending = await db('scheduled_reports')
      .where('enabled', true)
      .andWhere(function() {
        this.whereNull('next_run')
            .orWhere('next_run', '<=', now);
      });

    console.log(`[SCHEDULED REPORTS WORKER] Found ${pending.length} pending scheduled reports to run.`);

    for (const schedule of pending) {
      const startTime = Date.now();
      let status = 'SUCCESS';
      let error = null;
      let fileName = null;

      try {
        const company = await db('companies').where({ id: schedule.company_id }).first();
        const period = await db('accounting_periods')
          .where({ company_id: schedule.company_id, status: 'OPEN' })
          .orderBy('start_date', 'desc')
          .first();

        if (!period) throw new Error('No open accounting period found for report generation.');

        const recipients = await db('report_recipients')
          .where({ schedule_id: schedule.id })
          .select('email');

        if (!recipients.length) throw new Error('No recipients configured for this scheduled report.');

        // 1. Fetch data depending on report type
        let data;
        if (schedule.report_type === 'BALANCE_SHEET') {
          data = await ReportModel.getBalanceSheet(schedule.company_id, period.end_date);
        } else if (schedule.report_type === 'INCOME_STATEMENT') {
          data = await ReportModel.getIncomeStatement(schedule.company_id, period.start_date, period.end_date);
        } else if (schedule.report_type === 'CASH_FLOW') {
          data = await ReportModel.getCashFlow(schedule.company_id, period.start_date, period.end_date);
        } else if (schedule.report_type === 'TRIAL_BALANCE') {
          data = await ReportModel.getTrialBalance(schedule.company_id, period.start_date, period.end_date);
        } else if (schedule.report_type === 'EQUITY') {
          data = await ReportModel.getStatementOfChangesInEquity(schedule.company_id, period.start_date, period.end_date);
        } else {
          throw new Error(`Unknown report type: ${schedule.report_type}`);
        }

        // 2. Format content
        let attachmentContent;
        let mimeType;
        const fileExt = schedule.format.toLowerCase();
        fileName = `${schedule.report_type}_Report_${period.period_name.replace(/\s+/g, '_')}.${fileExt}`;

        if (schedule.format === 'PDF') {
          attachmentContent = await this.generatePDF(schedule.report_type, company.name, period.period_name, data);
          mimeType = 'application/pdf';
        } else {
          // CSV / EXCEL fallback (text CSV format)
          const csvText = this.generateCSV(schedule.report_type, data);
          attachmentContent = Buffer.from(csvText, 'utf-8');
          mimeType = schedule.format === 'EXCEL' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv';
        }

        // 3. Email statement
        const emailList = recipients.map(r => r.email).join(', ');
        await MailProvider.send({
          companyId: schedule.company_id,
          to: emailList,
          subject: `Scheduled Financial Statement: ${schedule.report_type} - ${period.period_name}`,
          html: `<p>Dear Executive Team,</p><p>Please find attached the scheduled financial report for <strong>${company.name}</strong>, covering the period <strong>${period.period_name}</strong>.</p><p>Best regards,<br/>ACCOUNTELLENCE ERP Automation</p>`,
          text: `Please find attached the scheduled report for ${company.name} (${period.period_name}).`,
          attachments: [
            {
              filename: fileName,
              content: attachmentContent,
              contentType: mimeType
            }
          ]
        });

      } catch (err) {
        status = 'FAILED';
        error = err.message;
        console.error(`[SCHEDULED REPORTS WORKER ERROR] Failed schedule #${schedule.id}:`, err);
      }

      // Log to history
      await db('report_history').insert({
        schedule_id: schedule.id,
        status,
        file_name: fileName,
        duration: Date.now() - startTime,
        error
      });

      // Update next run
      const nextRun = this.calculateNextRun(schedule.frequency, now);
      await db('scheduled_reports')
        .where({ id: schedule.id })
        .update({ next_run: nextRun });
    }
  }

  static generateCSV(type, data) {
    if (type === 'BALANCE_SHEET') {
      const headers = ['Code', 'Account Name', 'Category', 'Balance'];
      const rows = (data.items || []).map(i => [i.code, `"${i.name}"`, i.category, i.balance].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    if (type === 'INCOME_STATEMENT') {
      const headers = ['Code', 'Account Name', 'Category', 'Balance'];
      const rows = (data.items || []).map(i => [i.code, `"${i.name}"`, i.category, i.balance].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    if (type === 'CASH_FLOW') {
      const headers = ['Category', 'Amount'];
      const rows = data.map(i => [i.category || i.type, i.amount || i.magnitude].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    if (type === 'TRIAL_BALANCE') {
      const headers = ['Code', 'Account Name', 'Category', 'Debit', 'Credit'];
      const rows = data.map(i => [i.code, `"${i.name}"`, i.category, i.debit || 0, i.credit || 0].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    return 'No report data';
  }

  static generatePDF(type, companyName, periodName, data) {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.fontSize(20).text(`ACCOUNTELLENCE ERP - ${type.replace(/_/g, ' ')}`, { align: 'center' });
      doc.fontSize(10).text(`Company: ${companyName}`, { align: 'center' });
      doc.fontSize(10).text(`Period: ${periodName}`, { align: 'center' });
      doc.moveDown(2);

      if (type === 'BALANCE_SHEET') {
        doc.fontSize(12).text(`Total Assets: PKR ${(data.totalAssets || 0).toFixed(2)}`);
        doc.text(`Total Liabilities: PKR ${(data.totalLiabilities || 0).toFixed(2)}`);
        doc.text(`Total Equity: PKR ${(data.totalEquity || 0).toFixed(2)}`);
        doc.moveDown();
        (data.items || []).forEach(i => {
          doc.fontSize(9).text(`${i.code} - ${i.name} (${i.category}): PKR ${i.balance.toFixed(2)}`);
        });
      } else if (type === 'INCOME_STATEMENT') {
        doc.fontSize(12).text(`Total Revenue: PKR ${(data.revenue || 0).toFixed(2)}`);
        doc.text(`Total Expenses: PKR ${(data.expenses || 0).toFixed(2)}`);
        doc.fontSize(14).text(`Net Profit: PKR ${(data.netProfit || 0).toFixed(2)}`);
        doc.moveDown();
        (data.items || []).forEach(i => {
          doc.fontSize(9).text(`${i.code} - ${i.name} (${i.category}): PKR ${i.balance.toFixed(2)}`);
        });
      } else {
        doc.fontSize(12).text('Report statement details:');
        doc.moveDown();
        doc.fontSize(8).text(JSON.stringify(data, null, 2));
      }

      doc.end();
    });
  }

  static async generateReportBuffer(companyId, scheduleId) {
    const schedule = await db('scheduled_reports').where({ id: scheduleId, company_id: companyId }).first();
    if (!schedule) throw new Error('Scheduled report rule not found.');

    const company = await db('companies').where({ id: companyId }).first();
    let period = await db('accounting_periods')
      .where({ company_id: companyId, status: 'OPEN' })
      .orderBy('start_date', 'desc')
      .first();

    if (!period) {
      period = await db('accounting_periods')
        .where({ company_id: companyId })
        .orderBy('end_date', 'desc')
        .first() || { period_name: 'Current Period', start_date: new Date(new Date().getFullYear(), 0, 1), end_date: new Date() };
    }

    let data;
    if (schedule.report_type === 'BALANCE_SHEET') {
      data = await ReportModel.getBalanceSheet(companyId, period.end_date);
    } else if (schedule.report_type === 'INCOME_STATEMENT') {
      data = await ReportModel.getIncomeStatement(companyId, period.start_date, period.end_date);
    } else if (schedule.report_type === 'CASH_FLOW') {
      data = await ReportModel.getCashFlow(companyId, period.start_date, period.end_date);
    } else if (schedule.report_type === 'TRIAL_BALANCE') {
      data = await ReportModel.getTrialBalance(companyId, period.start_date, period.end_date);
    } else if (schedule.report_type === 'EQUITY') {
      data = await ReportModel.getStatementOfChangesInEquity(companyId, period.start_date, period.end_date);
    } else {
      data = await ReportModel.getBalanceSheet(companyId, new Date());
    }

    let attachmentContent;
    let mimeType;
    const fileExt = schedule.format.toLowerCase() === 'excel' ? 'csv' : schedule.format.toLowerCase();
    const fileName = `${schedule.report_type}_Report_${(period.period_name || 'Current').replace(/\s+/g, '_')}.${fileExt}`;

    if (schedule.format === 'PDF') {
      attachmentContent = await this.generatePDF(schedule.report_type, company?.name || 'ACCOUNTELLENCE', period.period_name || 'Current', data);
      mimeType = 'application/pdf';
    } else {
      const csvText = this.generateCSV(schedule.report_type, data);
      attachmentContent = Buffer.from(csvText, 'utf-8');
      mimeType = 'text/csv';
    }

    return { attachmentContent, mimeType, fileName };
  }
}

module.exports = ScheduledReportsService;
