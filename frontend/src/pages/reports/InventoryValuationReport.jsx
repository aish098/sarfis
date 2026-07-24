import React, { useState, useMemo } from 'react';
import { 
  Building2, Folder, Package, Layers, Calendar, SlidersHorizontal,
  ChevronDown, ChevronRight, FileSpreadsheet, FileText, Download, HelpCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function InventoryValuationReport({ data, asOfDate, companyName }) {
  // Grouping drill-down states
  const [expandedWarehouses, setExpandedWarehouses] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedProducts, setExpandedProducts] = useState({});

  // Aging custom buckets
  const [b1, setB1] = useState(30);
  const [b2, setB2] = useState(90);
  const [b3, setB3] = useState(180);
  const [showAgingConfig, setShowAgingConfig] = useState(false);

  const parsedAsOf = useMemo(() => new Date(asOfDate || new Date()), [asOfDate]);

  // Hierarchical grouping
  const hierarchy = useMemo(() => {
    if (!data || !data.data) return [];
    
    const whMap = {};
    data.data.forEach(item => {
      const whId = item.warehouse_id;
      if (!whMap[whId]) {
        whMap[whId] = {
          id: whId,
          name: item.warehouse_name,
          value: 0,
          layersCount: 0,
          categories: {}
        };
      }
      
      const catId = item.category_id || 9999;
      const catName = item.category_name || 'Unspecified';
      if (!whMap[whId].categories[catId]) {
        whMap[whId].categories[catId] = {
          id: catId,
          name: catName,
          value: 0,
          layersCount: 0,
          products: {}
        };
      }

      const prodId = item.product_id;
      if (!whMap[whId].categories[catId].products[prodId]) {
        whMap[whId].categories[catId].products[prodId] = {
          id: prodId,
          name: item.product_name,
          sku: item.product_sku,
          value: 0,
          layers: []
        };
      }

      whMap[whId].value += item.layer_value;
      whMap[whId].layersCount++;

      whMap[whId].categories[catId].value += item.layer_value;
      whMap[whId].categories[catId].layersCount++;

      whMap[whId].categories[catId].products[prodId].value += item.layer_value;
      whMap[whId].categories[catId].products[prodId].layers.push(item);
    });

    return Object.values(whMap).map(wh => ({
      ...wh,
      categories: Object.values(wh.categories).map(cat => ({
        ...cat,
        products: Object.values(cat.products)
      }))
    }));
  }, [data]);

  // Aging calculation
  const agingData = useMemo(() => {
    if (!data || !data.data) return [];
    
    const buckets = [
      { name: `0–${b1} Days`, min: 0, max: b1, value: 0, qty: 0, items: [] },
      { name: `${b1 + 1}–${b2} Days`, min: b1 + 1, max: b2, value: 0, qty: 0, items: [] },
      { name: `${b2 + 1}–${b3} Days`, min: b2 + 1, max: b3, value: 0, qty: 0, items: [] },
      { name: `${b3}+ Days`, min: b3 + 1, max: Infinity, value: 0, qty: 0, items: [] }
    ];

    data.data.forEach(item => {
      const recDate = new Date(item.received_date);
      const diffTime = Math.max(0, parsedAsOf - recDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const bucket = buckets.find(b => diffDays >= b.min && diffDays <= b.max);
      if (bucket) {
        bucket.value += item.layer_value;
        bucket.qty += item.remaining_qty;
        bucket.items.push(item);
      }
    });

    return buckets;
  }, [data, b1, b2, b3, parsedAsOf]);

  const totalValuation = data?.summary?.totalValue || 0;

  // Toggle helpers
  const toggleWH = (id) => setExpandedWarehouses(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleCat = (whId, catId) => setExpandedCategories(prev => ({ ...prev, [`${whId}-${catId}`]: !prev[`${whId}-${catId}`] }));
  const toggleProd = (whId, catId, prodId) => setExpandedProducts(prev => ({ ...prev, [`${whId}-${catId}-${prodId}`]: !prev[`${whId}-${catId}-${prodId}`] }));

  // Export handlers
  const handleExportPDF = () => {
    if (!data || !data.data) return;
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVENTORY VALUATION REPORT", 14, 20);
    
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Company: ${companyName || 'ACCOUNTELLENCE'}`, 14, 26);
    doc.text(`Valuation Date: As of ${new Date(asOfDate).toLocaleDateString()}`, 14, 31);
    doc.text(`Costing Method: ${data.summary.costingMethod}`, 14, 36);

    const headers = [['Warehouse', 'Category', 'Product SKU', 'Product Name', 'Remaining Qty', 'Unit Cost', 'Carrying Value']];
    const tableData = data.data.map(l => [
      l.warehouse_name,
      l.category_name,
      l.product_sku,
      l.product_name,
      l.remaining_qty.toLocaleString(),
      `PKR ${l.unit_cost.toFixed(2)}`,
      `PKR ${l.layer_value.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 42,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 }
    });

    doc.save(`inventory_valuation_${asOfDate}.pdf`);
  };

  const handleExportExcel = () => {
    if (!data || !data.data) return;
    const sheetData = data.data.map(l => ({
      'Warehouse': l.warehouse_name,
      'Category': l.category_name,
      'Product SKU': l.product_sku,
      'Product Name': l.product_name,
      'Remaining Quantity': l.remaining_qty,
      'Unit Cost (PKR)': l.unit_cost,
      'Layer Value (PKR)': l.layer_value,
      'Received Date': new Date(l.received_date).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Valuation');
    XLSX.writeFile(wb, `inventory_valuation_${asOfDate}.xlsx`);
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      
      {/* Export & Title Action row */}
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <span className="text-[9.5px] uppercase tracking-wider text-slate-400 block font-black">Subsystem Report</span>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mt-0.5">Hierarchy & Aging Valuation</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
            <FileSpreadsheet size={14} className="text-emerald-600" /> Export Excel
          </button>
          <button onClick={handleExportPDF} className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
            <Download size={14} className="text-rose-600" /> Export PDF
          </button>
        </div>
      </div>

      {/* Summary KPI Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Inventory Carrying Value</span>
          <strong className="text-sm sm:text-base md:text-lg font-mono text-slate-800 mt-1 block break-all">
            PKR {totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Unique Product SKUs</span>
          <strong className="text-sm sm:text-base md:text-lg font-sans text-slate-800 mt-1 block">
            {data.summary.productsCount}
          </strong>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Active Valuation Layers</span>
          <strong className="text-sm sm:text-base md:text-lg font-sans text-slate-800 mt-1 block">
            {data.summary.activeLayersCount}
          </strong>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Active Costing Method</span>
          <strong className="text-sm sm:text-base md:text-lg font-sans text-emerald-600 mt-1 block font-black">
            {data.summary.costingMethod}
          </strong>
        </div>
      </div>

      {/* Drill-Down hierarchy panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h4 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider pb-2 border-b border-slate-50">
          Valuation Drill-Down (Warehouse ➔ Category ➔ Product ➔ Layers)
        </h4>

        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden shadow-xs">
          {hierarchy.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">No inventory balances on the specified date.</div>
          ) : (
            hierarchy.map(wh => {
              const whExpanded = !!expandedWarehouses[wh.id];
              return (
                <div key={wh.id} className="bg-white">
                  {/* Warehouse Header Row */}
                  <div 
                    onClick={() => toggleWH(wh.id)}
                    className="flex justify-between items-center p-3.5 hover:bg-slate-50/50 cursor-pointer font-semibold text-xs select-none"
                  >
                    <div className="flex items-center gap-2 text-slate-800">
                      {whExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      <Building2 size={14} className="text-emerald-600" />
                      <span>{wh.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px]">
                        {wh.layersCount} Layers
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-800">
                      PKR {wh.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Categories list */}
                  {whExpanded && (
                    <div className="pl-6 bg-slate-50/10 divide-y divide-slate-50">
                      {wh.categories.map(cat => {
                        const catKey = `${wh.id}-${cat.id}`;
                        const catExpanded = !!expandedCategories[catKey];
                        return (
                          <div key={cat.id}>
                            {/* Category Header Row */}
                            <div 
                              onClick={() => toggleCat(wh.id, cat.id)}
                              className="flex justify-between items-center p-2.5 hover:bg-slate-50 cursor-pointer font-semibold text-xs select-none"
                            >
                              <div className="flex items-center gap-2 text-slate-700">
                                {catExpanded ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                                <Folder size={13} className="text-blue-500" />
                                <span>{cat.name}</span>
                              </div>
                              <span className="font-mono text-slate-700">
                                PKR {cat.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* Products list */}
                            {catExpanded && (
                              <div className="pl-6 divide-y divide-slate-50/50">
                                {cat.products.map(prod => {
                                  const prodKey = `${wh.id}-${cat.id}-${prod.id}`;
                                  const prodExpanded = !!expandedProducts[prodKey];
                                  return (
                                    <div key={prod.id}>
                                      {/* Product Header Row */}
                                      <div 
                                        onClick={() => toggleProd(wh.id, cat.id, prod.id)}
                                        className="flex justify-between items-center p-2 hover:bg-slate-50 cursor-pointer font-semibold text-xs select-none"
                                      >
                                        <div className="flex items-center gap-2 text-slate-600">
                                          {prodExpanded ? <ChevronDown size={11} className="text-slate-400" /> : <ChevronRight size={11} className="text-slate-400" />}
                                          <Package size={12} className="text-slate-400" />
                                          <span>{prod.name}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">({prod.sku})</span>
                                        </div>
                                        <span className="font-mono text-slate-600">
                                          PKR {prod.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>

                                      {/* Layers list */}
                                      {prodExpanded && (
                                        <div className="pl-6 bg-slate-50/30 p-2 text-[11.5px]">
                                          <table className="w-full text-left border-collapse">
                                            <thead>
                                              <tr className="bg-slate-100/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                                                <th className="px-3 py-1">Layer ID</th>
                                                <th className="px-3 py-1">Source Doc</th>
                                                <th className="px-3 py-1 text-center">Acquired Date</th>
                                                <th className="px-3 py-1 text-right">Balance Qty</th>
                                                <th className="px-3 py-1 text-right">Unit Cost</th>
                                                <th className="px-3 py-1 text-right font-bold">Valuation</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 font-mono text-[10.5px] text-slate-500">
                                              {prod.layers.map((l, lIdx) => (
                                                <tr key={l.layer_id || lIdx}>
                                                  <td className="px-3 py-1 font-bold text-slate-700">#{l.layer_id}</td>
                                                  <td className="px-3 py-1 font-sans">{l.source_document || 'N/A'}</td>
                                                  <td className="px-3 py-1 text-center font-sans">
                                                    {new Date(l.received_date).toLocaleDateString()}
                                                  </td>
                                                  <td className="px-3 py-1 text-right">{l.remaining_qty.toLocaleString()}</td>
                                                  <td className="px-3 py-1 text-right text-emerald-600">PKR {l.unit_cost.toLocaleString()}</td>
                                                  <td className="px-3 py-1 text-right font-bold text-slate-700">PKR {l.layer_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dynamic Aging Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
          <h4 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">
            Inventory Layer Aging Analysis
          </h4>
          <button 
            onClick={() => setShowAgingConfig(!showAgingConfig)}
            className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
          >
            <SlidersHorizontal size={13} /> Customize Buckets
          </button>
        </div>

        {showAgingConfig && (
          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3 animate-in slide-in-from-top duration-200">
            <h5 className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Configure Aging Bucket Limits (Days)</h5>
            <div className="grid grid-cols-3 gap-3 max-w-sm">
              <div>
                <label className="text-[9.5px] text-slate-400 uppercase font-bold block mb-1">Bucket 1 Max</label>
                <input 
                  type="number" 
                  value={b1} 
                  onChange={e => setB1(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-500" 
                />
              </div>
              <div>
                <label className="text-[9.5px] text-slate-400 uppercase font-bold block mb-1">Bucket 2 Max</label>
                <input 
                  type="number" 
                  value={b2} 
                  onChange={e => setB2(Math.max(b1 + 1, parseInt(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-500" 
                />
              </div>
              <div>
                <label className="text-[9.5px] text-slate-400 uppercase font-bold block mb-1">Bucket 3 Max</label>
                <input 
                  type="number" 
                  value={b3} 
                  onChange={e => setB3(Math.max(b2 + 1, parseInt(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-500" 
                />
              </div>
            </div>
            <p className="text-[10.5px] text-slate-400">Aging is dynamically computed relative to your snapshot valuation date.</p>
          </div>
        )}

        {/* Visual Stacked Track Bar */}
        <div className="space-y-1.5">
          <div className="flex h-5.5 rounded-lg overflow-hidden border border-slate-100 shadow-inner">
            {agingData.map((b, idx) => {
              const pct = totalValuation > 0 ? (b.value / totalValuation) * 100 : 0;
              const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500'];
              if (pct === 0) return null;
              return (
                <div 
                  key={idx} 
                  style={{ width: `${pct}%` }} 
                  className={`${colors[idx]} h-full transition-all flex items-center justify-center text-[9px] font-black text-white`}
                  title={`${b.name}: ${pct.toFixed(1)}%`}
                >
                  {pct > 8 ? `${pct.toFixed(0)}%` : ''}
                </div>
              );
            })}
          </div>
          
          {/* Legend Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-slate-600 pt-3">
            {[
              { label: agingData[0]?.name, val: agingData[0]?.value, color: 'bg-emerald-500' },
              { label: agingData[1]?.name, val: agingData[1]?.value, color: 'bg-blue-500' },
              { label: agingData[2]?.name, val: agingData[2]?.value, color: 'bg-amber-500' },
              { label: agingData[3]?.name, val: agingData[3]?.value, color: 'bg-rose-500' }
            ].map((leg, idx) => {
              const pct = totalValuation > 0 ? (leg.val / totalValuation) * 100 : 0;
              return (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${leg.color}`} />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">{leg.label}</span>
                    <strong className="text-xs font-mono text-slate-800">
                      PKR {leg.val?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </strong>
                    <span className="text-[10px] text-slate-400 ml-1 font-normal">({pct.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
