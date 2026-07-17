import React, { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, AlertTriangle, Search, Filter,
  TrendingDown, BarChart3, X, ChevronDown, CheckCircle2,
  ArrowDownToLine, SlidersHorizontal, RefreshCw, Eye, Calendar, Clock, Edit2
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const TYPE_COLORS = {
  PURCHASE: { bg: '#f0fdf4', text: '#059669', label: 'Purchase' },
  SALE: { bg: '#fff1f2', text: '#dc2626', label: 'Sale' },
  ADJUSTMENT: { bg: '#eff6ff', text: '#2563eb', label: 'Adjustment' },
  RETURN: { bg: '#faf5ff', text: '#7c3aed', label: 'Return' },
};

export default function InventoryPage({ globalSearch = "" }) {
  const { activeCompany, logout } = useAuthStore();
  const [tab, setTab] = useState('products'); // products | stock | logs
  const [products, setProducts] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [dashStats, setDashStats] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  const search = globalSearch || localSearch;
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [productStock, setProductStock] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Modals
  const [productModal, setProductModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [logDetail, setLogDetail] = useState(null);

  // Forms
  const [productForm, setProductForm] = useState({
    sku: '', name: '', description: '', unit_price: '', cost_price: '',
    unit_of_measure: 'unit', reorder_level: 10,
    inventory_account_id: '', cogs_account_id: '', revenue_account_id: ''
  });
  const [purchaseForm, setPurchaseForm] = useState({
    productId: '', warehouseId: '', quantity: '', unitCost: '', apAccountId: '', reference: '', notes: ''
  });
  const [adjustForm, setAdjustForm] = useState({ productId: '', warehouseId: '', adjustmentQty: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (skipSpinner = false) => {
    if (!activeCompany) return;
    if (!skipSpinner) setLoading(true);

    const fetch = async (url) => {
      try {
        const res = await api.get(url);
        return { data: res.data, error: null };
      } catch (err) {
        const msg = err.response?.data?.message || err.response?.statusText || err.message;
        const status = err.response?.status;
        return { data: null, error: `${status || 'Error'}: ${msg}` };
      }
    };

    try {
      setLoadError(null);
      const [p, s, l, w, a, d] = await Promise.all([
        fetch(`/products/${activeCompany.id}`),
        fetch(`/stock/${activeCompany.id}`),
        fetch(`/stock/${activeCompany.id}/low`),
        fetch(`/warehouses/${activeCompany.id}`),
        fetch(`/accounts/company/${activeCompany.id}`),
        fetch(`/inventory/${activeCompany.id}/dashboard`),
      ]);

      if (a.error) setLoadError(`Account Load Failed: ${a.error}`);
      if (p.data) setProducts(p.data);
      if (s.data) setStockSummary(s.data);
      if (l.data) setLowStock(l.data);
      if (w.data) setWarehouses(w.data);
      setAccounts(Array.isArray(a.data) ? a.data : []);
      if (d.data) {
        setDashStats(d.data.stats);
        setRecentLogs(d.data.recentLogs || []);
      }
    } catch (err) {
      console.error("[Inventory] Load error:", err);
    }
    setLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) load(true);
    });
    return () => { ignore = true; };
  }, [load]);

  const toggleProductExpand = async (productId) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      setProductStock([]);
      return;
    }
    setExpandedProduct(productId);
    setLoadingStock(true);
    try {
      const res = await api.get(`/stock/product/${productId}`);
      setProductStock(res.data);
    } catch (err) {
      console.error("Failed to load product stock", err);
    }
    setLoadingStock(false);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      if (editingId) {
        await api.put(`/products/${activeCompany.id}/${editingId}`, productForm);
      } else {
        await api.post(`/products/${activeCompany.id}`, productForm);
      }
      setProductModal(false);
      setEditingId(null);
      setProductForm({ sku: '', name: '', description: '', unit_price: '', cost_price: '', unit_of_measure: 'unit', reorder_level: 10, inventory_account_id: '', cogs_account_id: '', revenue_account_id: '' });
      load();
    } catch (err) { setFormError(err.response?.data?.error || 'Failed to save product'); }
    setSaving(false);
  };

  const handleEditProduct = (p) => {
    setEditingId(p.id);
    setProductForm({
      sku: p.sku || '',
      name: p.name || '',
      description: p.description || '',
      unit_price: p.unit_price || '',
      cost_price: p.cost_price || '',
      unit_of_measure: p.unit_of_measure || 'unit',
      reorder_level: p.reorder_level || 10,
      inventory_account_id: p.inventory_account_id || '',
      cogs_account_id: p.cogs_account_id || '',
      revenue_account_id: p.revenue_account_id || ''
    });
    setProductModal(true);
  };

  const handlePurchase = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      await api.post(`/stock/${activeCompany.id}/purchase`, purchaseForm);
      setPurchaseModal(false);
      setPurchaseForm({ productId: '', warehouseId: '', quantity: '', unitCost: '', apAccountId: '', reference: '', notes: '' });
      load();
    } catch (err) { setFormError(err.response?.data?.error || 'Purchase failed'); }
    setSaving(false);
  };

  const handleAdjust = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      await api.post(`/stock/${activeCompany.id}/adjust`, adjustForm);
      setAdjustModal(false);
      load();
    } catch (err) { setFormError(err.response?.data?.error || 'Adjustment failed'); }
    setSaving(false);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const filteredStock = stockSummary.filter(s =>
    s.product_name.toLowerCase().includes(search.toLowerCase()) || s.sku.toLowerCase().includes(search.toLowerCase())
  );

  const getAccountTypeKey = (account) => {
    const rawType = (
      account?.type ||
      account?.account_type ||
      account?.category ||
      account?.classification ||
      ''
    ).toString().trim().toLowerCase();

    if (rawType) {
      if (rawType.includes('asset')) return 'asset';
      if (rawType.includes('expense') || rawType.includes('cogs') || rawType.includes('cost')) return 'expense';
      if (rawType.includes('revenue') || rawType.includes('income') || rawType.includes('sale')) return 'revenue';
      if (rawType.includes('liability')) return 'liability';
    }

    // Fallback to account code classes if type metadata is missing/inconsistent.
    const firstDigit = account?.code?.toString()?.trim()?.[0];
    if (firstDigit === '1') return 'asset';
    if (firstDigit === '2') return 'liability';
    if (firstDigit === '4') return 'revenue';
    if (firstDigit === '5') return 'expense';

    return '';
  };

  const assetAccounts = accounts.filter(a => getAccountTypeKey(a) === 'asset');
  const expenseAccounts = accounts.filter(a => getAccountTypeKey(a) === 'expense');
  const revenueAccounts = accounts.filter(a => getAccountTypeKey(a) === 'revenue');
  const liabilityAccounts = accounts.filter(a => getAccountTypeKey(a) === 'liability');

  const kpiList = dashStats ? [
    { label: 'Total Products', value: dashStats.totalProducts, icon: Package, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-650' },
    { label: 'Low Stock Alerts', value: dashStats.lowStockCount, icon: AlertTriangle, iconBgClass: 'bg-amber-50', iconColorClass: 'text-amber-600' },
    { label: 'Total Stock Value', value: `PKR ${parseFloat(dashStats.totalStockValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: BarChart3, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600' }
  ] : [];

  return (
    <>
      <AnimatePresence>
        {loadError && (
          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 shadow-sm">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <div className="flex-1 text-[13px] font-medium">{loadError}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.location.reload()} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition-all flex items-center gap-1.5 border-none cursor-pointer">
                <RefreshCw size={12} /> Retry
              </button>
              <button onClick={() => { logout(); window.location.href = '/login'; }} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 shadow-md transition-all flex items-center gap-1.5 border-none cursor-pointer">
                <X size={12} /> Reset Session
              </button>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      <WorkspaceLayout
        title="Inventory Management"
        subtitle="Track products, stock levels, and movements."
        icon={Package}
        badgeText="Supply Chain"
        breadcrumbs={['ACCOUNTELLENCE', 'Inventory', 'Management']}
        primaryAction={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setFormError(''); setAdjustModal(true); }} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-655 px-4 py-2 text-[12.5px] font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer">
              <SlidersHorizontal size={14} /> Adjust Stock
            </button>
            <button onClick={() => { setFormError(''); setPurchaseModal(true); }} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-655 px-4 py-2 text-[12.5px] font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer">
              <ArrowDownToLine size={14} /> Record Purchase
            </button>
            <button onClick={() => { setFormError(''); setProductModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-none">
              <Plus size={14} /> Add Product
            </button>
          </div>
        }
        searchQuery={tab !== 'logs' ? localSearch : undefined}
        onSearchChange={tab !== 'logs' ? setLocalSearch : undefined}
        searchPlaceholder={`Search ${tab}...`}
        kpis={kpiList}
      >
        {/* Low stock warning bar */}
        {lowStock.length > 0 && (
          <div className="col-span-full">
            <Motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 mb-4 animate-slide-up">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-amber-800">
                  {lowStock.length} product{lowStock.length > 1 ? 's' : ''} below reorder level:
                </p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {lowStock.map(p => (
                    <span key={p.product_id} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      {p.sku} — {p.product_name} ({p.total_qty} left)
                    </span>
                  ))}
                </div>
              </div>
            </Motion.div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="col-span-full mb-2">
          <div className="tab-bar bg-white border border-slate-100 rounded-xl p-1 flex w-fit shadow-xs">
            {[
              { id: 'products', label: 'Products' },
              { id: 'stock', label: 'Stock Levels' },
              { id: 'logs', label: 'Movement Log' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`tab-item px-4.5 py-2 text-[12.5px] font-bold rounded-lg flex items-center gap-1.5 transition-all border-none bg-transparent cursor-pointer ${tab === t.id ? 'bg-emerald-50 text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col-span-full">
          {tab === 'products' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th style={{ width: 110 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">SKU</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Product Name</th>
                  <th style={{ width: 90 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">Unit</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 140 }}>Cost Price</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 140 }}>Unit Price</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 110 }}>In Stock</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 110 }}>Reorder At</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <Motion.tbody variants={stagger} initial="initial" animate="animate" className="divide-y divide-[#E6EBE8] text-slate-650">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton h-4 w-full" /></td>)}</tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-14 text-slate-400 text-[13px]">
                     <Package size={28} className="mx-auto mb-2 text-slate-300" />
                    No products found. Add your first product.
                  </td></tr>
                ) : filteredProducts.map((p) => {
                  const qty = parseFloat(p.total_qty || 0);
                  const isLow = qty <= parseFloat(p.reorder_level || 0);
                  return (
                    <Motion.tr key={p.id} variants={fadeUp} className="hover:bg-slate-50/40">
                      <td className="px-4 py-3 text-center"><span className="font-mono font-semibold text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{p.sku}</span></td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[13.5px] text-slate-800">{p.name}</p>
                        {p.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{p.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-[12px] text-slate-500 font-semibold">{p.unit_of_measure}</span></td>
                      <td className="text-center font-mono text-[12.5px] px-4 py-3 font-semibold text-slate-700">PKR {parseFloat(p.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="text-center font-mono text-[12.5px] font-bold text-emerald-700 px-4 py-3">PKR {parseFloat(p.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="text-center font-mono text-[12.5px] px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          isLow ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {qty.toLocaleString()}
                        </span>
                      </td>
                      <td className="text-center font-mono text-[12.5px] text-slate-500 px-4 py-3">{p.reorder_level}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleEditProduct(p)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 border border-slate-200 text-slate-500 transition-all cursor-pointer inline-flex"
                          title="Edit Product"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </Motion.tr>
                  );
                })}
              </Motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Levels Table */}
      {tab === 'stock' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th style={{ width: 100 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">SKU</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Product</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 120 }}>In Stock</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 120 }}>Reorder At</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 140 }}>Stock Value</th>
                  <th style={{ width: 100 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Status</th>
                </tr>
              </thead>
              <Motion.tbody variants={stagger} initial="initial" animate="animate" className="divide-y divide-[#E6EBE8]">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>
                  ))
                ) : filteredStock.map((s) => (
                  <React.Fragment key={s.product_id}>
                    <Motion.tr variants={fadeUp}
                      onClick={() => toggleProductExpand(s.product_id)}
                      className={`cursor-pointer transition-colors ${s.low_stock ? 'bg-amber-50/30' : ''} ${expandedProduct === s.product_id ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-4 py-3"><span className="font-mono text-[12px] text-slate-600 bg-slate-100 px-2 py-1 rounded">{s.sku}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedProduct === s.product_id ? 'rotate-180' : ''}`} />
                          <span className="font-medium text-[14px]">{s.product_name}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className={`font-mono font-bold text-[14px] ${s.low_stock ? 'text-amber-600' : 'text-slate-900'}`}>
                          {parseFloat(s.total_qty).toFixed(0)}
                        </span>
                      </td>
                      <td className="text-right font-mono text-[13px] text-slate-400 px-4 py-3">{s.reorder_level}</td>
                      <td className="text-right font-mono text-[13px] font-semibold text-slate-700 px-4 py-3">
                        ${(parseFloat(s.total_qty) * parseFloat(s.cost_price)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        {s.low_stock ? (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Low Stock</span>
                        ) : (
                          <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>OK</span>
                        )}
                      </td>
                    </Motion.tr>
                    <AnimatePresence>
                      {expandedProduct === s.product_id && (
                        <tr>
                          <td colSpan={6} className="p-0 border-none">
                            <Motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50/50 border-b border-slate-100">
                              <div className="px-12 py-4">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Stock Breakdown by Location</p>
                                {loadingStock ? (
                                  <div className="flex items-center gap-2 text-[12px] text-slate-400 py-2"><RefreshCw size={12} className="animate-spin" /> Loading location data...</div>
                                ) : productStock.length === 0 ? (
                                  <p className="text-[12px] text-slate-400 py-2 italic">No stock records found for this product.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {productStock.map(ps => (
                                      <div key={ps.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                        <div>
                                          <p className="text-[13px] font-bold text-slate-700">{ps.warehouse_name}</p>
                                          <p className="text-[10px] text-slate-400">{ps.location}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[14px] font-mono font-black text-emerald-600">{parseFloat(ps.quantity).toFixed(0)}</p>
                                          <p className="text-[9px] font-bold text-slate-300 uppercase">Available</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </Motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
              </Motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movement Log */}
      {tab === 'logs' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Product</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Warehouse</th>
                  <th style={{ width: 120 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Type</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Qty Change</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Qty After</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Reference</th>
                </tr>
              </thead>
              <Motion.tbody variants={stagger} initial="initial" animate="animate" className="divide-y divide-[#E6EBE8]">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>
                  ))
                ) : recentLogs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-14 text-slate-400 text-[13px]">No stock movements yet.</td></tr>
                ) : recentLogs.map((log) => {
                  const tc = TYPE_COLORS[log.type] || TYPE_COLORS.ADJUSTMENT;
                  return (
                    <Motion.tr key={log.id} variants={fadeUp}
                      onClick={() => setLogDetail(log)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-slate-600">{new Date(log.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[13px]">{log.product_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{log.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500">{log.warehouse_name}</td>
                      <td className="px-4 py-3"><span className="badge" style={{ background: tc.bg, color: tc.text }}>{tc.label}</span></td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[13px]"
                        style={{ color: parseFloat(log.quantity_change) >= 0 ? '#059669' : '#dc2626' }}>
                        {parseFloat(log.quantity_change) >= 0 ? '+' : ''}{parseFloat(log.quantity_change).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] text-slate-700">{parseFloat(log.quantity_after).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-400">
                        <div className="flex items-center gap-1.5 opacity-60">
                          <Eye size={12} />
                          <span>View Detail</span>
                        </div>
                      </td>
                    </Motion.tr>
                  );
                })}
              </Motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Add Product Modal ─── */}
      <AnimatePresence>
        {productModal && (
          <Modal title={editingId ? "Edit Product" : "Add Product"} onClose={() => { setProductModal(false); setEditingId(null); }}>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <FormError error={formError} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="SKU *"><input required className="input-enterprise" placeholder="e.g. PRD-001" value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })} /></Field>
                <Field label="Unit of Measure">
                  <select className="input-enterprise" value={productForm.unit_of_measure} onChange={e => setProductForm({ ...productForm, unit_of_measure: e.target.value })}>
                    <option value="unit">Unit (pcs)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="meter">Meter (m)</option>
                    <option value="liter">Liter (L)</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="set">Set</option>
                  </select>
                </Field>
              </div>
              <Field label="Product Name *"><input required className="input-enterprise" placeholder="Product name" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cost Price *"><input required type="number" step="0.01" className="input-enterprise" placeholder="0.00" value={productForm.cost_price} onChange={e => setProductForm({ ...productForm, cost_price: e.target.value })} /></Field>
                <Field label="Unit Price *"><input required type="number" step="0.01" className="input-enterprise" placeholder="0.00" value={productForm.unit_price} onChange={e => setProductForm({ ...productForm, unit_price: e.target.value })} /></Field>
              </div>
              <Field label="Reorder Level"><input type="number" className="input-enterprise" placeholder="10" value={productForm.reorder_level} onChange={e => setProductForm({ ...productForm, reorder_level: e.target.value })} /></Field>
              <div className="pt-1 pb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Link to Chart of Accounts</span>
                  <span className="text-slate-300 normal-case font-normal">{accounts.length} accounts loaded</span>
                </p>
                {accounts.length === 0 && !loading && (
                  <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px]">
                    No accounts found for this company. Please ensure your Chart of Accounts is set up.
                  </div>
                )}
                <div className="space-y-3">
                  <Field label="Inventory Asset Account">
                    <select className="input-enterprise" value={productForm.inventory_account_id} onChange={e => setProductForm({ ...productForm, inventory_account_id: e.target.value })}>
                      <option value="">— Select asset account —</option>
                      {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </Field>
                  <Field label="COGS Account">
                    <select className="input-enterprise" value={productForm.cogs_account_id} onChange={e => setProductForm({ ...productForm, cogs_account_id: e.target.value })}>
                      <option value="">— Select expense account —</option>
                      {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Revenue Account">
                    <select className="input-enterprise" value={productForm.revenue_account_id} onChange={e => setProductForm({ ...productForm, revenue_account_id: e.target.value })}>
                      <option value="">— Select revenue account —</option>
                      {revenueAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
              <ModalButtons onCancel={() => { setProductModal(false); setEditingId(null); }} saving={saving} label={editingId ? "Save Changes" : "Add Product"} />
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── Purchase Modal ─── */}
      <AnimatePresence>
        {purchaseModal && (
          <Modal title="Record Purchase (Stock In)" onClose={() => setPurchaseModal(false)}>
            <form onSubmit={handlePurchase} className="space-y-4">
              <FormError error={formError} />
              <Field label="Product *">
                <select required className="input-enterprise" value={purchaseForm.productId} onChange={e => setPurchaseForm({ ...purchaseForm, productId: e.target.value })}>
                  <option value="">— Select product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                </select>
              </Field>
              <Field label="Warehouse *">
                <select required className="input-enterprise" value={purchaseForm.warehouseId} onChange={e => setPurchaseForm({ ...purchaseForm, warehouseId: e.target.value })}>
                  <option value="">— Select warehouse —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Quantity *"><input required type="number" step="0.01" className="input-enterprise" placeholder="0" value={purchaseForm.quantity} onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} /></Field>
                <Field label="Unit Cost *"><input required type="number" step="0.01" className="input-enterprise" placeholder="0.00" value={purchaseForm.unitCost} onChange={e => setPurchaseForm({ ...purchaseForm, unitCost: e.target.value })} /></Field>
              </div>
              <Field label="Accounts Payable Account *">
                <select required className="input-enterprise" value={purchaseForm.apAccountId} onChange={e => setPurchaseForm({ ...purchaseForm, apAccountId: e.target.value })}>
                  <option value="">— Select AP account —</option>
                  {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </Field>
              <Field label="Reference"><input className="input-enterprise" placeholder="PO-001" value={purchaseForm.reference} onChange={e => setPurchaseForm({ ...purchaseForm, reference: e.target.value })} /></Field>
              <Field label="Notes"><textarea className="input-enterprise" rows={2} value={purchaseForm.notes} onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} /></Field>
              <ModalButtons onCancel={() => setPurchaseModal(false)} saving={saving} label="Record Purchase" />
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── Adjust Modal ─── */}
      <AnimatePresence>
        {adjustModal && (
          <Modal title="Stock Adjustment" onClose={() => setAdjustModal(false)}>
            <form onSubmit={handleAdjust} className="space-y-4">
              <FormError error={formError} />
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-[12px] text-blue-700">
                Use positive values to add stock, negative to remove (e.g. -5 removes 5 units).
              </div>
              <Field label="Product *">
                <select required className="input-enterprise" value={adjustForm.productId} onChange={e => setAdjustForm({ ...adjustForm, productId: e.target.value })}>
                  <option value="">— Select product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                </select>
              </Field>
              <Field label="Warehouse *">
                <select required className="input-enterprise" value={adjustForm.warehouseId} onChange={e => setAdjustForm({ ...adjustForm, warehouseId: e.target.value })}>
                  <option value="">— Select warehouse —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Quantity Adjustment *"><input required type="number" step="0.01" className="input-enterprise" placeholder="+10 or -5" value={adjustForm.adjustmentQty} onChange={e => setAdjustForm({ ...adjustForm, adjustmentQty: e.target.value })} /></Field>
              <Field label="Reason"><textarea className="input-enterprise" rows={2} placeholder="Damaged goods, stocktake, etc." value={adjustForm.notes} onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })} /></Field>
              <ModalButtons onCancel={() => setAdjustModal(false)} saving={saving} label="Apply Adjustment" />
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── Log Detail Modal ─── */}
      <AnimatePresence>
        {logDetail && (
          <Modal title="Movement Detail" onClose={() => setLogDetail(null)}>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Product</p>
                  <p className="font-bold text-slate-900">{logDetail.product_name}</p>
                  <p className="text-[12px] font-mono text-slate-500">{logDetail.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Reference</p>
                  <p className="text-[13px] font-semibold text-slate-700">{logDetail.reference_type || 'Manual Transaction'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Quantity Change</p>
                  <p className={`text-[18px] font-mono font-black ${parseFloat(logDetail.quantity_change) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {parseFloat(logDetail.quantity_change) >= 0 ? '+' : ''}{parseFloat(logDetail.quantity_change).toFixed(2)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">New Balance</p>
                  <p className="text-[18px] font-mono font-black text-slate-900">{parseFloat(logDetail.quantity_after).toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Transaction Details</p>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-[13px]"><span className="text-slate-500">Warehouse:</span> <span className="font-medium">{logDetail.warehouse_name}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-slate-500">Date/Time:</span> <span className="font-medium">{new Date(logDetail.created_at).toLocaleString()}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-slate-500">Transaction Type:</span> <span className="font-medium italic">{logDetail.type}</span></div>
                </div>
              </div>

              {logDetail.notes && (
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Internal Notes</p>
                  <p className="text-[13px] text-indigo-900 leading-relaxed italic">"{logDetail.notes}"</p>
                </div>
              )}

              <button onClick={() => setLogDetail(null)} className="btn btn-primary w-full py-3">Close Detail View</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
        </div>
      </WorkspaceLayout>
    </>
  );
}

// ─── Reusable sub-components ──────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Motion.div className="modal-box w-full max-w-lg"
        initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.2 }}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
          <h2 className="font-display font-extrabold text-[17px] text-slate-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>
        <div className="p-7 overflow-y-auto max-h-[75vh]">{children}</div>
      </Motion.div>
    </Motion.div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function FormError({ error }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600 font-medium">
      <AlertTriangle size={14} className="flex-shrink-0" /> {error}
    </div>
  );
}

function ModalButtons({ onCancel, saving, label }) {
  return (
    <div className="flex gap-3 pt-4 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex-1 py-3 flex items-center justify-center gap-2 text-[12.5px] font-bold rounded-xl transition-all cursor-pointer">
        Cancel
      </button>
      <Motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit"
        disabled={saving} className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white flex-[2] py-3 flex items-center justify-center gap-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50">
        {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : label}
      </Motion.button>
    </div>
  );
}
