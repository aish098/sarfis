import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RefreshCw, AlertTriangle, Building2, Package,
  History, ArrowUpRight, ArrowDownLeft, TrendingUp,
  LineChart, DollarSign, Calendar, Tag, ShieldCheck
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function ProductInquiryDrawer({ productId, onClose }) {
  const { activeCompany } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');

  const load = useCallback(async () => {
    if (!productId || !activeCompany) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/products/${activeCompany.id}/${productId}/inquiry`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
    setLoading(false);
  }, [productId, activeCompany]);

  useEffect(() => {
    load();
  }, [load]);

  const TABS = [
    { id: 'Overview', label: 'Overview', icon: Package },
    { id: 'Warehouses', label: 'Warehouses', icon: Building2 },
    { id: 'Ledger', label: 'Inventory Ledger', icon: History },
    { id: 'Sales', label: 'Sales & Margin', icon: TrendingUp },
    { id: 'Forecast', label: 'Forecast & Reorders', icon: LineChart }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-900/30 backdrop-blur-2xs">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-transparent" 
          onClick={onClose} 
        />
        
        <motion.div 
          initial={{ x: '100%', opacity: 0.95 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-100"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-[#FAFBFB] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                <Package size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-extrabold text-[15px] text-slate-800 uppercase tracking-tight">
                    {data?.product?.name || 'Product Inquiry'}
                  </h2>
                  {data?.product?.sku && (
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                      {data.product.sku}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">360° Product Inventory Ledger & Control</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-[11.5px] font-bold border-b-2 transition-all cursor-pointer ${
                    isActive 
                      ? 'border-indigo-600 text-indigo-600 bg-white' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/30'
                  }`}
                >
                  <Icon size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-600 text-[12px] font-semibold">
            {loading ? (
              <div className="p-16 text-center space-y-3">
                <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                <p className="text-slate-400">Loading product metrics...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-600">
                <AlertTriangle size={24} className="mx-auto mb-2 text-rose-500" />
                <p>{error}</p>
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* 1. OVERVIEW TAB */}
                {activeTab === 'Overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Product Category</span>
                        <span className="font-extrabold text-slate-800">{data.product.category}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Unit of Measure</span>
                        <span className="font-extrabold text-slate-800">{data.product.unitOfMeasure}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Unit Cost Price</span>
                        <span className="font-extrabold text-slate-800 font-mono">PKR {data.product.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Retail Selling Price</span>
                        <span className="font-extrabold text-slate-800 font-mono">PKR {data.product.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Reorder Level Threshold</span>
                        <span className="font-extrabold text-slate-800">{data.product.reorderLevel} {data.product.unitOfMeasure}s</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Created Date</span>
                        <span className="font-extrabold text-slate-800">{new Date(data.product.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-700 mb-2 uppercase text-[10px] tracking-wider">Product Description</h4>
                      <p className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-slate-500 font-normal leading-relaxed">
                        {data.product.description || 'No description provided for this product catalogue entry.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. WAREHOUSES TAB */}
                {activeTab === 'Warehouses' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-700 uppercase text-[10px] tracking-wider">Warehouse Distribution</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-2.5">Warehouse Location</th>
                            <th className="px-4 py-2.5 text-right">On Hand</th>
                            <th className="px-4 py-2.5 text-right">Reserved</th>
                            <th className="px-4 py-2.5 text-right">Available</th>
                            <th className="px-4 py-2.5 text-right">Stock Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white text-[11px] font-bold text-slate-600">
                          {data.warehouses.map((wh, idx) => (
                            <tr key={wh.warehouseId || idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5">
                                <span className="font-extrabold text-slate-800 block">{wh.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{wh.location || 'No address'}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono">{wh.onHand.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-amber-600">{wh.reserved.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{wh.available.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-800">
                                PKR {wh.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                          {data.warehouses.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic font-medium">
                                No inventory stock records across company warehouses.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. LEDGER TAB */}
                {activeTab === 'Ledger' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-700 uppercase text-[10px] tracking-wider">Inventory Ledger Account (Card)</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs max-h-96 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider sticky top-0">
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5">Transaction Ref</th>
                            <th className="px-3 py-2.5">Warehouse</th>
                            <th className="px-3 py-2.5 text-right">IN</th>
                            <th className="px-3 py-2.5 text-right">OUT</th>
                            <th className="px-3 py-2.5 text-right">Closing</th>
                            <th className="px-3 py-2.5 text-right">Valuation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white text-[11px] font-bold text-slate-600">
                          {data.inventoryLedger.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2.5 font-mono whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="font-extrabold text-indigo-600 block">{row.reference}</span>
                                <span className={`text-[8.5px] uppercase font-black px-1 rounded inline-block mt-0.5 ${
                                  row.type === 'PURCHASE' ? 'bg-emerald-50 text-emerald-700' :
                                  row.type === 'SALE' ? 'bg-indigo-50 text-indigo-700' :
                                  row.type === 'ADJUSTMENT' ? 'bg-amber-50 text-amber-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {row.type}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{row.warehouse}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{row.in ? `+${row.in.toLocaleString()}` : '—'}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-rose-600">{row.out ? `-${row.out.toLocaleString()}` : '—'}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-slate-800">{row.balance.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                                PKR {row.value.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                          {data.inventoryLedger.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-3 py-6 text-center text-slate-400 italic">
                                No entries logged in inventory accounts ledger.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. SALES TAB */}
                {activeTab === 'Sales' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Purchased Volume</span>
                          <span className="font-extrabold text-[15px] text-slate-800">{data.purchaseSummary.totalQty.toLocaleString()} Units</span>
                        </div>
                        <ArrowDownLeft size={24} className="text-emerald-500 bg-emerald-50 p-1 rounded-lg" />
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Sold Volume</span>
                          <span className="font-extrabold text-[15px] text-slate-800">{data.salesSummary.totalQty.toLocaleString()} Units</span>
                        </div>
                        <ArrowUpRight size={24} className="text-indigo-500 bg-indigo-50 p-1 rounded-lg" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-extrabold text-slate-700 uppercase text-[10px] tracking-wider">Latest Inventory Vouchers</h4>
                      <div className="border border-slate-100 rounded-xl overflow-hidden bg-white text-[11px] font-bold text-slate-600 divide-y divide-slate-50">
                        {data.movements.slice(0, 5).map((m, idx) => (
                          <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-slate-800">{m.referenceType ? `${m.referenceType} #${m.referenceId || ''}` : 'Manual Adjustment'}</span>
                                <span className={`text-[8.5px] uppercase font-black px-1 rounded ${
                                  m.type === 'PURCHASE' ? 'bg-emerald-50 text-emerald-700' :
                                  m.type === 'SALE' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {m.type}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{new Date(m.date).toLocaleString()}</span>
                            </div>
                            <div className="text-right">
                              <span className={`font-extrabold block font-mono ${m.qtyChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {m.qtyChange > 0 ? `+${m.qtyChange.toLocaleString()}` : m.qtyChange.toLocaleString()} {data.product.unitOfMeasure}s
                              </span>
                              <span className="text-[10.5px] text-slate-500 font-mono">
                                @ PKR {m.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. FORECAST TAB */}
                {activeTab === 'Forecast' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">30-Day Sales Volume</span>
                        <span className="font-extrabold text-[15px] text-slate-800">{data.forecast.salesLast30Days.toLocaleString()} Units</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Daily Velocity Rate</span>
                        <span className="font-extrabold text-[15px] text-slate-800">{data.forecast.dailyVelocity.toFixed(2)} Units/Day</span>
                      </div>
                    </div>

                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" size={18} />
                        <h4 className="font-extrabold text-amber-950 uppercase text-[10.5px] tracking-wider">Depletion Forecasting & Alerts</h4>
                      </div>
                      <p className="text-[11.5px] text-slate-600 font-semibold leading-relaxed">
                        At the current sales velocity rate of **{data.forecast.dailyVelocity.toFixed(1)} units/day**, the remaining available stock of **{data.valuation.totalQty.toLocaleString()} {data.product.unitOfMeasure}s** will last approximately:
                      </p>
                      <div className="text-[20px] font-black text-amber-900 font-mono">
                        {data.forecast.daysToDepletion !== null ? `${data.forecast.daysToDepletion} Days` : '∞ (No recent sales logs detected)'}
                      </div>
                      {data.forecast.status === 'REORDER_SUGGESTED' && (
                        <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg text-[10.5px] font-bold">
                          <AlertTriangle size={14} className="animate-bounce" />
                          <span>Reorder Alert: On-Hand stock level has fallen below the minimum catalog threshold.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
