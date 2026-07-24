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
    const csvLines = [];
    csvLines.push(`ACCOUNTELLENCE ERP - ${type.replace(/_/g, ' ')} REPORT`);
    csvLines.push(`Generated At,${new Date().toISOString()}`);
    csvLines.push('');

    if (type === 'BALANCE_SHEET') {
      csvLines.push(`Total Assets,PKR ${(data.totalAssets || 0).toFixed(2)}`);
      csvLines.push(`Total Liabilities,PKR ${(data.totalLiabilities || 0).toFixed(2)}`);
      csvLines.push(`Total Equity,PKR ${(data.totalEquity || 0).toFixed(2)}`);
      csvLines.push('');
      csvLines.push('Account Code,Account Name,Category,Balance (PKR)');
      (data.items || []).forEach(i => {
        csvLines.push([i.code, `"${(i.name || '').replace(/"/g, '""')}"`, i.category, (i.balance || 0).toFixed(2)].join(','));
      });
    } else if (type === 'INCOME_STATEMENT') {
      csvLines.push(`Total Revenue,PKR ${(data.revenue || 0).toFixed(2)}`);
      csvLines.push(`Total Expenses,PKR ${(data.expenses || 0).toFixed(2)}`);
      csvLines.push(`Net Profit,PKR ${(data.netProfit || 0).toFixed(2)}`);
      csvLines.push('');
      csvLines.push('Account Code,Account Name,Category,Balance (PKR)');
      (data.items || []).forEach(i => {
        csvLines.push([i.code, `"${(i.name || '').replace(/"/g, '""')}"`, i.category, (i.balance || 0).toFixed(2)].join(','));
      });
    } else if (type === 'TRIAL_BALANCE') {
      csvLines.push('Account Code,Account Name,Category,Debit (PKR),Credit (PKR)');
      (Array.isArray(data) ? data : []).forEach(i => {
        csvLines.push([i.code, `"${(i.name || '').replace(/"/g, '""')}"`, i.category, (i.debit || 0).toFixed(2), (i.credit || 0).toFixed(2)].join(','));
      });
    } else {
      csvLines.push('Category,Amount (PKR)');
      (Array.isArray(data) ? data : []).forEach(i => {
        csvLines.push([i.category || i.type, (i.amount || i.magnitude || 0).toFixed(2)].join(','));
      });
    }

    return csvLines.join('\n');
  }

  static generatePDF(type, companyName, periodName, data) {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // 1. Header Banner
      doc.rect(40, 40, 515, 60).fill('#065f46'); // Emerald 800
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('ACCOUNTELLENCE ERP', 55, 52);
      doc.fontSize(11).font('Helvetica').text(`${type.replace(/_/g, ' ')} REPORT`, 55, 72);
      
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(companyName || 'Corporate Workspace', 350, 52, { align: 'right', width: 190 });
      doc.fontSize(9).font('Helvetica').text(`Period: ${periodName || 'Current'}`, 350, 68, { align: 'right', width: 190 });
      doc.fontSize(8).text(`Date: ${new Date().toLocaleDateString()}`, 350, 82, { align: 'right', width: 190 });

      let startY = 115;

      // 2. KPI Summary Cards
      if (type === 'BALANCE_SHEET') {
        const assets = (data.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const liabilities = (data.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const equity = (data.totalEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        doc.rect(40, startY, 160, 45).fillAndStroke('#ecfdf5', '#a7f3d0');
        doc.fillColor('#065f46').fontSize(8).font('Helvetica-Bold').text('TOTAL ASSETS', 50, startY + 8);
        doc.fillColor('#047857').fontSize(11).font('Helvetica-Bold').text(`PKR ${assets}`, 50, startY + 22);

        doc.rect(215, startY, 160, 45).fillAndStroke('#fef2f2', '#fecaca');
        doc.fillColor('#991b1b').fontSize(8).font('Helvetica-Bold').text('TOTAL LIABILITIES', 225, startY + 8);
        doc.fillColor('#b91c1c').fontSize(11).font('Helvetica-Bold').text(`PKR ${liabilities}`, 225, startY + 22);

        doc.rect(390, startY, 165, 45).fillAndStroke('#eff6ff', '#bfdbfe');
        doc.fillColor('#1e40af').fontSize(8).font('Helvetica-Bold').text('TOTAL EQUITY', 400, startY + 8);
        doc.fillColor('#1d4ed8').fontSize(11).font('Helvetica-Bold').text(`PKR ${equity}`, 400, startY + 22);

        startY += 60;
      } else if (type === 'INCOME_STATEMENT') {
        const revenue = (data.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const expenses = (data.expenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const netProfit = (data.netProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        doc.rect(40, startY, 160, 45).fillAndStroke('#ecfdf5', '#a7f3d0');
        doc.fillColor('#065f46').fontSize(8).font('Helvetica-Bold').text('TOTAL REVENUE', 50, startY + 8);
        doc.fillColor('#047857').fontSize(11).font('Helvetica-Bold').text(`PKR ${revenue}`, 50, startY + 22);

        doc.rect(215, startY, 160, 45).fillAndStroke('#fef2f2', '#fecaca');
        doc.fillColor('#991b1b').fontSize(8).font('Helvetica-Bold').text('TOTAL EXPENSES', 225, startY + 8);
        doc.fillColor('#b91c1c').fontSize(11).font('Helvetica-Bold').text(`PKR ${expenses}`, 225, startY + 22);

        doc.rect(390, startY, 165, 45).fillAndStroke('#f0fdf4', '#bbf7d0');
        doc.fillColor('#166534').fontSize(8).font('Helvetica-Bold').text('NET PROFIT', 400, startY + 8);
        doc.fillColor('#15803d').fontSize(11).font('Helvetica-Bold').text(`PKR ${netProfit}`, 400, startY + 22);

        startY += 60;
      }

      // 3. Table Header
      doc.rect(40, startY, 515, 22).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('CODE', 50, startY + 7, { width: 70 });
      doc.text('ACCOUNT NAME', 125, startY + 7, { width: 190 });
      doc.text('CATEGORY', 320, startY + 7, { width: 100 });
      doc.text('BALANCE (PKR)', 430, startY + 7, { width: 115, align: 'right' });

      startY += 22;

      // 4. Table Rows
      const items = data.items || (Array.isArray(data) ? data : []);
      items.forEach((item, index) => {
        if (startY > 740) {
          doc.addPage();
          startY = 40;

          doc.rect(40, startY, 515, 22).fill('#1e293b');
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
          doc.text('CODE', 50, startY + 7, { width: 70 });
          doc.text('ACCOUNT NAME', 125, startY + 7, { width: 190 });
          doc.text('CATEGORY', 320, startY + 7, { width: 100 });
          doc.text('BALANCE (PKR)', 430, startY + 7, { width: 115, align: 'right' });
          startY += 22;
        }

        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(40, startY, 515, 20).fillAndStroke(bg, '#f1f5f9');

        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
        doc.text(String(item.code || item.account_code || '—'), 50, startY + 6, { width: 70 });
        doc.font('Helvetica').text(String(item.name || item.account_name || item.category || '—'), 125, startY + 6, { width: 190 });
        doc.text(String(item.category || item.type || '—'), 320, startY + 6, { width: 100 });

        const balVal = typeof item.balance === 'number' ? item.balance : (item.amount || item.debit || 0);
        const formattedBal = balVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        doc.font('Helvetica-Bold').fillColor(balVal < 0 ? '#b91c1c' : '#0f172a');
        doc.text(`PKR ${formattedBal}`, 430, startY + 6, { width: 115, align: 'right' });

        startY += 20;
      });

      // Footer
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('ACCOUNTELLENCE ERP Financial Governance Module | Confidential Executive Document', 40, 770, { align: 'center', width: 515 });

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
