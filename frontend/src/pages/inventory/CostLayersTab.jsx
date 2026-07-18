import React, { useState, useEffect, useCallback } from 'react';
import { 
  Layers, Search, Filter, Eye, Download, X, Calendar, 
  MapPin, Tag, Info, ChevronLeft, ChevronRight, FileSpreadsheet, FileText 
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function CostLayersTab() {
  const { activeCompany } = useAuthStore();
  const [layers, setLayers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  // Detail Drawer
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Load Filters Option lists
  useEffect(() => {
    if (!activeCompany) return;
    const loadOptions = async () => {
      try {
        const [whRes, prodRes] = await Promise.all([
          api.get(`/warehouses/${activeCompany.id}`),
          api.get(`/products/${activeCompany.id}`)
        ]);
        setWarehouses(whRes.data || []);
        setProducts(prodRes.data || []);
      } catch (err) {
        console.error('Failed to load filter options', err);
      }
    };
    loadOptions();
  }, [activeCompany]);

  // Load Cost Layers
  const loadLayers = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        search,
        status,
        warehouseId,
        productId
      };
      const { data } = await api.get(`/inventory/${activeCompany.id}/cost-layers`, { params });
      setLayers(data.data || []);
      setTotalPages(data.pagination.pages || 1);
      setTotalRecords(data.pagination.total || 0);
    } catch (err) {
      console.error('Failed to load cost layers', err);
    }
    setLoading(false);
  }, [activeCompany, page, search, status, warehouseId, productId]);

  useEffect(() => {
    loadLayers();
  }, [loadLayers]);

  // Handle Layer Detail click
  const handleViewLayer = async (layerId) => {
    setSelectedLayerId(layerId);
    setLoadingAudit(true);
    try {
      const { data } = await api.get(`/inventory/${activeCompany.id}/cost-layers/${layerId}/audit`);
      setAuditData(data);
    } catch (err) {
      console.error('Failed to load layer audit data', err);
    }
    setLoadingAudit(false);
  };

  // Export options
  const handleExportCSV = () => {
    if (layers.length === 0) return;
    const headers = ['Layer ID', 'Warehouse', 'Product', 'Source Doc', 'Source Type', 'Received Date', 'Original Qty', 'Remaining Qty', 'Unit Cost', 'Remaining Value', 'Status'];
    const rows = layers.map(l => [
      l.id,
      l.warehouse_name,
      `${l.product_sku} - ${l.product_name}`,
      l.source_document || 'N/A',
      l.source_type,
      new Date(l.received_date).toLocaleDateString(),
      l.received_qty,
      l.remaining_qty,
      l.unit_cost,
      l.remaining_value,
      l.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_cost_layers_${activeCompany.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (layers.length === 0) return;
    const wsData = layers.map(l => ({
      'Layer ID': l.id,
      'Warehouse': l.warehouse_name,
      'Product SKU': l.product_sku,
      'Product Name': l.product_name,
      'Source Doc': l.source_document || 'N/A',
      'Source Type': l.source_type,
      'Received Date': new Date(l.received_date).toLocaleDateString(),
      'Original Qty': l.received_qty,
      'Remaining Qty': l.remaining_qty,
      'Unit Cost (PKR)': l.unit_cost,
      'Remaining Value (PKR)': l.remaining_value,
      'Status': l.status
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Layers');
    XLSX.writeFile(wb, `inventory_cost_layers_${activeCompany.id}.xlsx`);
  };

  const handleExportPDF = () => {
    if (layers.length === 0) return;
    const doc = new jsPDF('landscape');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`INVENTORY COST LAYERS REGISTRY`, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Company: ${activeCompany?.name || 'ACCOUNTELLENCE'}`, 14, 26);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 31);

    const headers = [['Layer ID', 'Warehouse', 'Product', 'Source Doc', 'Type', 'Rec. Date', 'Orig Qty', 'Rem Qty', 'Unit Cost', 'Value', 'Status']];
    const data = layers.map(l => [
      l.id,
      l.warehouse_name,
      `${l.product_sku} - ${l.product_name}`,
      l.source_document || 'N/A',
      l.source_type,
      new Date(l.received_date).toLocaleDateString(),
      l.received_qty.toLocaleString(),
      l.remaining_qty.toLocaleString(),
      `PKR ${l.unit_cost.toFixed(2)}`,
      `PKR ${l.remaining_value.toFixed(2)}`,
      l.status
    ]);

    autoTable(doc, {
      startY: 38,
      head: headers,
      body: data,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8.5 }
    });

    doc.save(`inventory_cost_layers_${activeCompany.id}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="text-emerald-500" size={18} />
            <h3 className="text-[13px] font-black uppercase text-slate-800 tracking-wider">Inventory Cost Layers Inquiry</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
              <FileSpreadsheet size={14} className="text-emerald-600" /> Excel
            </button>
            <button onClick={handleExportCSV} className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
              <FileText size={14} className="text-blue-600" /> CSV
            </button>
            <button onClick={handleExportPDF} className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
              <Download size={14} className="text-rose-600" /> PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search SKU, Name, Doc..." 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-semibold"
            />
          </div>

          <div>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-semibold text-slate-600"
            >
              <option value="ALL">All Cost Layers</option>
              <option value="ACTIVE">Active (Available)</option>
              <option value="CONSUMED">Fully Consumed</option>
              <option value="ADJUSTED">Adjusted Layers</option>
            </select>
          </div>

          <div>
            <select
              value={warehouseId}
              onChange={e => { setWarehouseId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-semibold text-slate-600"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={productId}
              onChange={e => { setProductId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-semibold text-slate-600"
            >
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Layers Table */}
      <div className="card overflow-hidden bg-white border border-slate-100 rounded-2xl shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-center" style={{ width: 75 }}>Layer ID</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Source Doc</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3 text-center">Received Date</th>
                <th className="px-4 py-3 text-right">Received Qty</th>
                <th className="px-4 py-3 text-right">Remaining Qty</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Remaining Value</th>
                <th className="px-4 py-3 text-center" style={{ width: 130 }}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold font-mono">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4" /></td>
                    ))}
                  </tr>
                ))
              ) : layers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-slate-400 font-sans italic">
                    No matching cost layers found in active registries.
                  </td>
                </tr>
              ) : (
                layers.map(l => {
                  let statusBg = 'bg-slate-50 text-slate-600 border-slate-200';
                  if (l.status === 'Active') statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  else if (l.status === 'Partially Consumed') statusBg = 'bg-blue-50 text-blue-700 border-blue-100';
                  else if (l.status === 'Adjusted') statusBg = 'bg-amber-50 text-amber-700 border-amber-100';
                  else if (l.status === 'Fully Consumed') statusBg = 'bg-slate-100 text-slate-500 border-slate-200';

                  return (
                    <tr 
                      key={l.id} 
                      onClick={() => handleViewLayer(l.id)}
                      className="hover:bg-slate-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-center font-bold text-slate-800">#{l.id}</td>
                      <td className="px-4 py-3 font-sans text-slate-700">{l.warehouse_name}</td>
                      <td className="px-4 py-3 font-sans text-slate-800">
                        <p className="font-bold">{l.product_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{l.product_sku}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{l.source_document || 'N/A'}</td>
                      <td className="px-4 py-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200">
                          {l.source_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-sans text-slate-500">
                        {new Date(l.received_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">{l.received_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{l.remaining_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">PKR {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">PKR {l.remaining_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-black border ${statusBg}`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-slate-50 text-slate-500 text-[11px] font-semibold bg-slate-50/20">
            <span>Showing page {page} of {totalPages} ({totalRecords} layers)</span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 border border-slate-200 hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 border border-slate-200 hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Layer Audit Drawer */}
      {selectedLayerId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-emerald-500" />
                <h3 className="font-black text-[13px] text-slate-800 uppercase tracking-wider">
                  Cost Layer Lifecycle Audit: Layer #{selectedLayerId}
                </h3>
              </div>
              <button onClick={() => { setSelectedLayerId(null); setAuditData(null); }} className="p-1.5 hover:bg-slate-200 rounded-full transition-all border-none bg-transparent cursor-pointer">
                <X size={16} className="text-slate-500" />
              </button>
            </div>

            {loadingAudit ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-slate-400 text-xs mt-4">Compiling chronological cost flow timeline...</p>
              </div>
            ) : auditData ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Summary Panel */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4.5 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-xs text-slate-600">
                  <div>
                    <span className="text-[9.5px] text-slate-400 block uppercase mb-0.5">Warehouse Location</span>
                    <span className="text-slate-800">{auditData.layer.warehouse_name}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 block uppercase mb-0.5">Product</span>
                    <span className="text-slate-800 block truncate">{auditData.layer.product_name}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 block uppercase mb-0.5">Acquisition Unit Cost</span>
                    <span className="text-emerald-600 font-mono font-bold">PKR {auditData.layer.unit_cost.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 block uppercase mb-0.5">Remaining Value</span>
                    <span className="text-slate-800 font-mono font-bold">PKR {auditData.layer.remaining_value.toLocaleString()}</span>
                  </div>
                </div>

                {/* Audit Details */}
                <div className="space-y-3">
                  <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-wider text-emerald-600 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                    <Calendar size={13} /> Layer Parameters
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs text-slate-600 font-semibold">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Created Document:</span>
                      <span className="text-slate-800">{auditData.layer.source_document || 'N/A'} ({auditData.layer.source_type})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Received Quantity:</span>
                      <span className="text-slate-800">{auditData.layer.received_qty.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Received Date:</span>
                      <span className="text-slate-800">{new Date(auditData.layer.received_date).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Remaining Balance:</span>
                      <span className="text-slate-800">{auditData.layer.remaining_qty.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4">
                  <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-wider text-emerald-600 border-b border-slate-50 pb-2">
                    Chronological Cost Timeline
                  </h4>
                  <div className="relative pl-6 border-l-2 border-slate-100 ml-3 space-y-5">
                    {auditData.timeline.map((event, idx) => (
                      <div key={idx} className="relative">
                        {/* Dot indicator */}
                        <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-2 bg-white flex items-center justify-center ${
                          event.event === 'Acquisition' 
                            ? 'border-emerald-500 text-emerald-500 shadow-md shadow-emerald-500/10' 
                            : 'border-slate-400 text-slate-400'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            event.event === 'Acquisition' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} />
                        </div>
                        
                        <div>
                          <p className="font-bold text-xs text-slate-800 flex items-center gap-2">
                            <span>{event.event}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString()}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Consumption History Table */}
                <div className="space-y-3.5">
                  <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-wider text-emerald-600 border-b border-slate-50 pb-2">
                    Portion Consumption List
                  </h4>
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[9.5px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Document</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5 text-right">Issued Qty</th>
                          <th className="px-4 py-2.5 text-right">Unit Cost</th>
                          <th className="px-4 py-2.5 text-right font-bold">Extended Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold font-mono">
                        {auditData.consumptions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-slate-400 font-sans italic">
                              This cost layer has not been consumed yet.
                            </td>
                          </tr>
                        ) : (
                          auditData.consumptions.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/20">
                              <td className="px-4 py-2.5 font-sans">{new Date(c.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-2.5 text-slate-800 font-bold">{c.document_number}</td>
                              <td className="px-4 py-2.5 font-sans">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-500">
                                  {c.document_type}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">{c.issued_qty.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right text-emerald-600">PKR {c.unit_cost.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right text-slate-800 font-bold">PKR {c.extended_cost.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
