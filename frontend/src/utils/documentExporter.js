import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Standardized Unified PDF Exporter for ACCOUNTELLENCE ERP
 */
export function exportUnifiedPDF({
  title = 'FINANCIAL REPORT',
  subtitle = '',
  companyName = 'Corporate Workspace',
  period = 'Current Period',
  kpis = [],
  columns = [],
  rows = [],
  filename = 'financial_report.pdf'
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // 1. Header Banner
  doc.setFillColor(6, 95, 70); // Emerald 800 (#065f46)
  doc.rect(14, 12, 182, 22, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('ACCOUNTELLENCE ERP', 18, 21);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${title.toUpperCase()}${subtitle ? ` — ${subtitle}` : ''}`, 18, 28);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(companyName, 190, 20, { align: 'right' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Period: ${period}`, 190, 25, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 190, 29, { align: 'right' });

  let startY = 40;

  // 2. Optional KPI Summary Cards
  if (kpis && kpis.length > 0) {
    const cardWidth = (182 - (kpis.length - 1) * 4) / kpis.length;
    kpis.forEach((kpi, idx) => {
      const x = 14 + idx * (cardWidth + 4);
      
      let bgRgb = [248, 250, 252];
      let strokeRgb = [226, 232, 240];
      let textRgb = [30, 41, 59];
      let valRgb = [15, 23, 42];

      if (kpi.type === 'success' || kpi.color === 'emerald') {
        bgRgb = [236, 253, 245]; strokeRgb = [167, 243, 208]; textRgb = [6, 95, 70]; valRgb = [4, 120, 87];
      } else if (kpi.type === 'danger' || kpi.color === 'rose' || kpi.color === 'red') {
        bgRgb = [254, 242, 242]; strokeRgb = [254, 202, 202]; textRgb = [153, 27, 27]; valRgb = [185, 28, 28];
      } else if (kpi.type === 'info' || kpi.color === 'blue') {
        bgRgb = [239, 246, 255]; strokeRgb = [191, 219, 254]; textRgb = [30, 64, 175]; valRgb = [29, 78, 216];
      }

      doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
      doc.setDrawColor(strokeRgb[0], strokeRgb[1], strokeRgb[2]);
      doc.roundedRect(x, startY, cardWidth, 16, 2, 2, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(String(kpi.label).toUpperCase(), x + 4, startY + 5);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(valRgb[0], valRgb[1], valRgb[2]);
      doc.text(String(kpi.value), x + 4, startY + 12);
    });

    startY += 21;
  }

  // 3. Right Alignment Detection for Monetary / Numeric Columns
  const rightAlignIndexes = {};
  columns.forEach((col, i) => {
    const colName = (typeof col === 'string' ? col : col.header || '').toLowerCase();
    if (
      colName.includes('amount') ||
      colName.includes('debit') ||
      colName.includes('credit') ||
      colName.includes('balance') ||
      colName.includes('carrying') ||
      colName.includes('total') ||
      colName.includes('net') ||
      colName.includes('magnitude') ||
      colName.includes('pkr')
    ) {
      rightAlignIndexes[i] = { halign: 'right' };
    }
  });

  // 4. Structured autoTable Grid
  autoTable(doc, {
    startY,
    head: [columns.map(c => typeof c === 'string' ? c : c.header)],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59], // Dark Slate (#1e293b)
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Light Slate (#f8fafc)
    },
    columnStyles: rightAlignIndexes,
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `ACCOUNTELLENCE ERP Financial Governance Module | Confidential Executive Document | Page ${data.pageNumber} of ${pageCount}`,
        105,
        287,
        { align: 'center' }
      );
    }
  });

  doc.save(filename);
}

/**
 * Helper to sanitize cell values so Excel never displays garbled characters or `#####`
 */
function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();

  // Replace garbled em-dashes (— or –) with standard hyphen (-) or empty text
  if (str === '—' || str === '–' || str === 'â€“' || str === 'â€”') {
    return '-';
  }

  return str;
}

/**
 * Standardized Unified CSV / Excel Exporter for ACCOUNTELLENCE ERP
 * Uses SheetJS native XLSX workbook format to auto-adjust column widths
 * and prevent `#####` cell overflows or garbled UTF-8 characters.
 */
export function exportUnifiedCSV({
  title = 'FINANCIAL REPORT',
  companyName = 'Corporate Workspace',
  period = 'Current Period',
  kpis = [],
  columns = [],
  rows = [],
  filename = 'financial_report.xlsx'
}) {
  const headers = columns.map(c => typeof c === 'string' ? c : c.header);
  
  // Construct array of arrays for SheetJS
  const aoa = [];

  // Header Block
  aoa.push([`ACCOUNTELLENCE ERP - ${title.toUpperCase()} REPORT`]);
  aoa.push(['Company', companyName]);
  aoa.push(['Period', period]);
  aoa.push(['Generated At', new Date().toLocaleString()]);
  aoa.push([]);

  // KPI Block
  if (kpis && kpis.length > 0) {
    kpis.forEach(k => {
      aoa.push([k.label, k.value]);
    });
    aoa.push([]);
  }

  // Column Headers
  aoa.push(headers);

  // Data Rows
  rows.forEach(r => {
    const rowVals = Array.isArray(r) ? r : Object.values(r);
    const cleanRow = rowVals.map(v => sanitizeCellValue(v));
    aoa.push(cleanRow);
  });

  // Check if we should export as native XLSX or CSV
  const isXLSX = filename.toLowerCase().endsWith('.xlsx') || !filename.toLowerCase().endsWith('.csv');
  const targetFilename = isXLSX
    ? (filename.toLowerCase().endsWith('.xlsx') ? filename : filename.replace(/\.csv$/i, '.xlsx'))
    : filename;

  if (isXLSX) {
    // Generate native Excel XLSX file with auto-calculated column widths
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Calculate maximum length for each column to auto-fit cell widths
    const colWidths = [];
    aoa.forEach(row => {
      row.forEach((val, i) => {
        const len = String(val || '').length;
        colWidths[i] = Math.max(colWidths[i] || 12, len + 4);
      });
    });

    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w, 14), 50) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31).replace(/[\*\?:\/\\\[\]]/g, ''));
    XLSX.writeFile(wb, targetFilename);
  } else {
    // Generate CSV file with UTF-8 BOM (\uFEFF) to force Excel to open in UTF-8
    const csvLines = aoa.map(row => {
      return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    // \uFEFF is UTF-8 Byte Order Mark (BOM)
    const csvContent = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', targetFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
