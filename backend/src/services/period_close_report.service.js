const db = require('../config/db');
const PDFDocument = require('pdfkit');

class PeriodCloseReportService {
  /**
   * Generates a structural JSON report for BI/export usage.
   */
  static async generateCloseReportJSON(companyId, periodId, session, snapshot) {
    const period = await db('accounting_periods').where({ id: periodId, company_id: companyId }).first();
    const company = await db('companies').where({ id: companyId }).first();

    const signoffs = await db('period_close_signoffs as pcs')
      .join('users as u', 'pcs.user_id', 'u.id')
      .select('pcs.*', 'u.name as checker_name')
      .where({ 'pcs.session_id': session.id });

    const history = await db('period_close_history as pch')
      .join('users as u', 'pch.performed_by', 'u.id')
      .select('pch.*', 'u.name as performed_name')
      .where({ 'pch.period_id': periodId, 'pch.company_id': companyId })
      .orderBy('pch.performed_at', 'desc');

    return {
      reportType: "MONTH_END_CLOSE",
      generatedAt: new Date().toISOString(),
      company: {
        id: company.id,
        name: company.name
      },
      period: {
        id: period.id,
        name: period.period_name,
        startDate: period.start_date,
        endDate: period.end_date,
        status: period.status
      },
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.started_at,
        completedAt: session.completed_at
      },
      financials: {
        profit: snapshot ? parseFloat(snapshot.profit) : 0,
        assets: snapshot ? parseFloat(snapshot.assets) : 0,
        liabilities: snapshot ? parseFloat(snapshot.liabilities) : 0,
        equity: snapshot ? parseFloat(snapshot.equity) : 0,
        trialBalanceDifference: snapshot ? parseFloat(snapshot.trial_balance_difference) : 0,
        details: snapshot ? JSON.parse(snapshot.snapshot_json) : null
      },
      signoffs,
      auditTrail: history
    };
  }

  /**
   * Generates a clean PDF document streaming directly into the HTTP response.
   */
  static async generateCloseReportPDF(companyId, periodId, session, snapshot, res) {
    const data = await this.generateCloseReportJSON(companyId, periodId, session, snapshot);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Title
    doc.fontSize(20).text('SARFIS ERP - PERIOD CLOSE AUDIT REPORT', { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Metadata
    doc.fontSize(12).text(`Company: ${data.company.name}`);
    doc.text(`Accounting Period: ${data.period.name} (${data.period.startDate} to ${data.period.endDate})`);
    doc.text(`Lock Session ID: #${data.session.id} (Status: ${data.session.status})`);
    if (data.session.completedAt) {
      doc.text(`Completed At: ${new Date(data.session.completedAt).toLocaleString()}`);
    }
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Financial Metrics
    doc.fontSize(14).text('Closing Financial Snapshot', { underline: true });
    doc.fontSize(11);
    doc.moveDown(0.5);
    doc.text(`Total Assets: PKR ${data.financials.assets.toFixed(2)}`);
    doc.text(`Total Liabilities: PKR ${data.financials.liabilities.toFixed(2)}`);
    doc.text(`Total Equity: PKR ${data.financials.equity.toFixed(2)}`);
    doc.text(`Net Income / Profit: PKR ${data.financials.profit.toFixed(2)}`);
    doc.text(`Trial Balance Discrepancy: PKR ${data.financials.trialBalanceDifference.toFixed(2)}`);
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Signoffs
    doc.fontSize(14).text('Stakeholder Sign-offs', { underline: true });
    doc.fontSize(10);
    doc.moveDown(0.5);
    if (data.signoffs.length === 0) {
      doc.text('No user sign-offs recorded.');
    } else {
      for (const s of data.signoffs) {
        doc.text(`- [PASSED] ${s.step} verified by ${s.checker_name} on ${new Date(s.checked_at).toLocaleString()}`);
      }
    }
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Audit Trail
    doc.fontSize(14).text('Close Action Audit Trail', { underline: true });
    doc.fontSize(9);
    doc.moveDown(0.5);
    if (data.auditTrail.length === 0) {
      doc.text('No close actions recorded in history log.');
    } else {
      for (const h of data.auditTrail) {
        const reasonStr = h.reason ? ` (Reason: "${h.reason}")` : '';
        doc.text(`[${new Date(h.performed_at).toLocaleString()}] ${h.performed_name} ${h.action}ed this period${reasonStr}`);
      }
    }

    doc.end();
  }
}

module.exports = PeriodCloseReportService;
