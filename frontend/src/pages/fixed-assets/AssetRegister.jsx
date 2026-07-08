import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Tag, Eye, Info, FileText, Calendar, DollarSign, MapPin, 
  User, Activity, ArrowRight, TrendingUp, X, PlusCircle, Trash2,
  Wrench, Printer, RefreshCw, Filter, ShieldCheck, CheckSquare, ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import AssetForm from './AssetForm';

export default function AssetRegister() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [activeBookFilter, setActiveBookFilter] = useState('Accounting'); // Accounting | Tax | Management

  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Selection states for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Detail Modal / Inquiry state
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [inquiryDetails, setInquiryDetails] = useState(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Form Modals state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDisposalForm, setShowDisposalForm] = useState(false);
  const [showUsageForm, setShowUsageForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);

  // Form fields
  const [disposalData, setDisposalData] = useState({
    disposal_date: new Date().toISOString().split('T')[0],
    disposal_reason: '',
    proceeds_amount: 0
  });

  const [usageData, setUsageData] = useState({
    usage_date: new Date().toISOString().split('T')[0],
    units_used: '',
    source: 'MANUAL'
  });

  const [transferData, setTransferData] = useState({
    location_id: '',
    custodian_employee_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [maintenanceData, setMaintenanceData] = useState({
    description: '',
    maintenance_cost: 0,
    maintenance_date: new Date().toISOString().split('T')[0],
    status: 'ACTIVE'
  });

  useEffect(() => {
    fetchAssets();
    fetchCategories();
    if (activeCompany?.id) {
      fetchWarehouses();
      fetchEmployees();
    }
  }, [activeCompany, filterStatus]);

  useEffect(() => {
    const assetId = searchParams.get('assetId');
    if (assetId) {
      handleOpenInquiry(parseInt(assetId));
    }
    const isNew = searchParams.get('new');
    if (isNew === 'true') {
      setShowAddForm(true);
    }
  }, [searchParams]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/fixed-assets/assets', {
        params: filterStatus ? { status: filterStatus } : {}
      });
      setAssets(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/fixed-assets/categories');
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { data } = await api.get(`/warehouses/${activeCompany.id}`);
      setWarehouses(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get(`/employees/${activeCompany.id}`);
      setEmployees(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenInquiry = async (assetId) => {
    setSelectedAssetId(assetId);
    setInquiryDetails(null);
    setInquiryLoading(true);
    setActiveTab('general');
    try {
      const { data } = await api.get(`/fixed-assets/assets/${assetId}/inquiry`);
      setInquiryDetails(data);
      setInquiryLoading(false);
    } catch (err) {
      console.error(err);
      setInquiryLoading(false);
    }
  };

  const handleCloseInquiry = () => {
    setSelectedAssetId(null);
    setInquiryDetails(null);
    searchParams.delete('assetId');
    setSearchParams(searchParams);
  };

  const handleDisposalSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fixed-assets/assets/dispose', {
        asset_id: selectedAssetId,
        ...disposalData
      });
      setShowDisposalForm(false);
      handleOpenInquiry(selectedAssetId);
      fetchAssets();
      searchParams.delete('action');
      setSearchParams(searchParams);
    } catch (err) {
      alert(err.response?.data?.error || 'Disposal posting failed.');
    }
  };

  const handleUsageSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fixed-assets/assets/usage', {
        asset_id: selectedAssetId,
        ...usageData
      });
      setShowUsageForm(false);
      setUsageData({ usage_date: new Date().toISOString().split('T')[0], units_used: '', source: 'MANUAL' });
      handleOpenInquiry(selectedAssetId);
      fetchAssets();
    } catch (err) {
      alert(err.response?.data?.error || 'Usage logging failed.');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fixed-assets/assets/transfer', {
        asset_id: selectedAssetId,
        ...transferData
      });
      setShowTransferForm(false);
      fetchAssets();
      searchParams.delete('action');
      setSearchParams(searchParams);
    } catch (err) {
      alert(err.response?.data?.error || 'Transfer failed.');
    }
  };

  const handleMaintenanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fixed-assets/assets/maintenance', {
        asset_id: selectedAssetId,
        ...maintenanceData
      });
      setShowMaintenanceForm(false);
      fetchAssets();
      searchParams.delete('action');
      setSearchParams(searchParams);
    } catch (err) {
      alert(err.response?.data?.error || 'Maintenance logging failed.');
    }
  };

  // Bulk Actions
  const handleBulkDepreciation = () => {
    if (selectedIds.length === 0) return;
    navigate('/dashboard/fixed-assets/wizard');
  };

  const handleBulkPrint = () => {
    alert(`Generating print labels for ${selectedIds.length} assets...`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAssets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAssets.map(a => a.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Filter application
  const filteredAssets = assets.filter(a => {
    const code = a.asset_code?.toLowerCase() || '';
    const name = a.asset_name?.toLowerCase() || '';
    const cat = a.category_name?.toLowerCase() || '';
    const term = searchTerm.toLowerCase();
    
    const matchesSearch = code.includes(term) || name.includes(term) || cat.includes(term);
    const matchesCategory = filterCategory ? a.category_id === parseInt(filterCategory) : true;
    const matchesLocation = filterLocation ? a.location_id === parseInt(filterLocation) : true;
    
    return matchesSearch && matchesCategory && matchesLocation;
  });

  const getNextDepDate = () => {
    const d = new Date();
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString();
  };

  const actionParam = searchParams.get('action');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/fixed-assets" className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Asset Registry</h1>
            <p className="text-slate-500 text-sm font-semibold">Verify asset details, print codes, transfer locations, or retire obsolete assets.</p>
          </div>
        </div>
        <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md">
          <Plus size={14} /> Capitalize Asset
        </button>
      </div>

      {/* Primary Toolbar (Filters) */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search code, asset name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold"
            />
          </div>
          {/* Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all font-semibold text-slate-600"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.category_name}</option>
            ))}
          </select>
          {/* Location / Warehouse */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all font-semibold text-slate-600"
          >
            <option value="">All Locations</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all font-semibold text-slate-600"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER_MAINTENANCE">Maintenance</option>
            <option value="SOLD">Sold</option>
            <option value="DISPOSED">Disposed</option>
          </select>
          {/* Active Book */}
          <select
            value={activeBookFilter}
            onChange={(e) => setActiveBookFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all font-semibold text-slate-600"
          >
            <option value="Accounting">Accounting Book</option>
            <option value="Tax">Tax Book</option>
            <option value="Management">Management Book</option>
          </select>
        </div>
      </div>

      {/* Action Mode Helper Banner */}
      {actionParam && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl flex items-center justify-between text-xs font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-indigo-600 shrink-0" />
            <span>
              {actionParam === 'transfer' && "Action Mode: Location/Custodian Transfer. Click the transfer icon (MapPin) on any asset row below to record a change in location or custodian."}
              {actionParam === 'maintenance' && "Action Mode: Log Maintenance. Click the wrench icon on any asset row below to log repair logs, costs, and tasks."}
              {actionParam === 'dispose' && "Action Mode: Retire/Dispose Asset. Click the trash icon on any active asset row below to calculate gain/loss and post disposal journal."}
            </span>
          </div>
          <button 
            onClick={() => {
              searchParams.delete('action');
              setSearchParams(searchParams);
            }} 
            className="p-1 hover:bg-indigo-100 rounded text-indigo-700 font-bold"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Secondary Toolbar (Bulk Actions) */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between text-xs font-bold animate-fade-in">
          <div className="flex items-center gap-2 text-indigo-700">
            <CheckSquare size={16} /> Selected {selectedIds.length} Assets
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkDepreciation} className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[11px] font-black transition-all flex items-center gap-1 shadow-sm">
              <Activity size={12} className="text-purple-600" /> Run Depreciation
            </button>
            <button onClick={handleBulkPrint} className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[11px] font-black transition-all flex items-center gap-1 shadow-sm">
              <Printer size={12} className="text-slate-400" /> Print QR Labels
            </button>
          </div>
        </div>
      )}

      {/* Assets Grid/Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto font-mono"></div>
          </div>
        ) : filteredAssets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredAssets.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                  </th>
                  <th className="px-4 py-3">Asset Code</th>
                  <th className="px-4 py-3">Asset Description</th>
                  <th className="px-4 py-3">Category Class</th>
                  <th className="px-4 py-3 text-right">Acquisition Cost</th>
                  <th className="px-4 py-3 text-center">Next Dep.</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold">
                {filteredAssets.map(asset => (
                  <tr key={asset.id} className="hover:bg-slate-50/30 group">
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(asset.id)}
                        onChange={() => toggleSelect(asset.id)}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-indigo-600 font-black">
                      <button onClick={() => handleOpenInquiry(asset.id)} className="hover:underline text-left">
                        {asset.asset_code}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-800">{asset.asset_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{asset.serial_number || 'No S/N'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        <Tag size={10} /> {asset.category_name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                      PKR {parseFloat(asset.purchase_cost).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-slate-500">
                      {asset.status === 'ACTIVE' ? getNextDepDate() : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-black tracking-wider uppercase ${
                        asset.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        asset.status === 'DISPOSED' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                        asset.status === 'SOLD' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleOpenInquiry(asset.id)} title="360° Inquiry" className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all">
                          <Eye size={14} />
                        </button>
                        {asset.status === 'ACTIVE' && (
                          <button onClick={() => { setSelectedAssetId(asset.id); setShowTransferForm(true); }} title="Transfer location/custodian" className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 rounded transition-all">
                            <MapPin size={14} />
                          </button>
                        )}
                        {asset.status === 'ACTIVE' && (
                          <button onClick={() => { setSelectedAssetId(asset.id); setShowMaintenanceForm(true); }} title="Log maintenance logs" className="p-1 text-slate-400 hover:text-amber-500 hover:bg-slate-100 rounded transition-all">
                            <Wrench size={14} />
                          </button>
                        )}
                        {asset.status === 'ACTIVE' && (
                          <button onClick={() => { setSelectedAssetId(asset.id); setShowDisposalForm(true); }} title="Sell or dispose asset" className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-all">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 font-semibold">
            No assets found matching filters.
          </div>
        )}
      </div>

      {/* Add Asset Modal */}
      {showAddForm && (
        <AssetForm 
          onClose={() => {
            setShowAddForm(false);
            searchParams.delete('new');
            setSearchParams(searchParams);
          }} 
          onSuccess={() => {
            setShowAddForm(false);
            fetchAssets();
          }} 
          categories={categories}
        />
      )}

      {/* Transfer Location/Custodian Modal */}
      {showTransferForm && selectedAssetId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleTransferSubmit} className="bg-white rounded-xl border border-slate-100 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-indigo-700 flex items-center gap-1.5 uppercase">
              <MapPin size={16} /> Asset Transfer Wizard
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold font-mono">
              Asset: {assets.find(a => a.id === selectedAssetId)?.asset_name} ({assets.find(a => a.id === selectedAssetId)?.asset_code})
            </p>
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500">Target Physical Location (Warehouse)</label>
                <select
                  value={transferData.location_id}
                  onChange={(e) => setTransferData({ ...transferData, location_id: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-bold"
                >
                  <option value="">No Location / Unassigned...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Authorized Custodian Employee</label>
                <select
                  value={transferData.custodian_employee_id}
                  onChange={(e) => setTransferData({ ...transferData, custodian_employee_id: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-bold"
                >
                  <option value="">No Custodian / Unassigned...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Transfer Execution Date</label>
                <input
                  type="date"
                  required
                  value={transferData.transfer_date}
                  onChange={(e) => setTransferData({ ...transferData, transfer_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Transfer Remarks / Reason</label>
                <textarea
                  placeholder="Explain why custody or location is changing..."
                  rows={2}
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setShowTransferForm(false)} 
                className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-md"
              >
                Save Transfer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Maintenance Logger Modal */}
      {showMaintenanceForm && selectedAssetId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleMaintenanceSubmit} className="bg-white rounded-xl border border-slate-100 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-amber-700 flex items-center gap-1.5 uppercase">
              <Wrench size={16} /> Record Maintenance Log
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold font-mono">
              Asset: {assets.find(a => a.id === selectedAssetId)?.asset_name} ({assets.find(a => a.id === selectedAssetId)?.asset_code})
            </p>
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500">Service Task Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engine tuning and oil replacement"
                  value={maintenanceData.description}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Maintenance Cost (PKR)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={maintenanceData.maintenance_cost}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, maintenance_cost: parseFloat(e.target.value || 0) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Service Date</label>
                <input
                  type="date"
                  required
                  value={maintenanceData.maintenance_date}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, maintenance_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Transition Status</label>
                <select
                  value={maintenanceData.status}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, status: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-bold"
                >
                  <option value="ACTIVE">Keep Active</option>
                  <option value="UNDER_MAINTENANCE">Set to Under Maintenance</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setShowMaintenanceForm(false)} 
                className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black transition-all shadow-md"
              >
                Save Log
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 360-Degree Inquiry Detail Panel / Modal */}
      {selectedAssetId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Info size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">360° Asset Inquiry</h3>
                  <p className="text-[10px] text-slate-400 font-semibold font-mono">ID: {selectedAssetId}</p>
                </div>
              </div>
              <button onClick={handleCloseInquiry} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-all">
                <X size={16} />
              </button>
            </div>

            {inquiryLoading ? (
              <div className="p-16 text-center flex-1">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-slate-400 text-xs mt-4">Retrieving sub-ledger records...</p>
              </div>
            ) : inquiryDetails ? (
              <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                {/* Master summary banner */}
                <div className="p-5 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/50">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Asset Code</span>
                    <span className="text-xs font-mono font-black text-slate-800">{inquiryDetails.asset.asset_code}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Asset Description</span>
                    <span className="text-xs font-bold text-slate-800 truncate block max-w-[150px]">{inquiryDetails.asset.asset_name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Category Class</span>
                    <span className="text-xs font-bold text-slate-800">{inquiryDetails.asset.category_name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Registry Status</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase ${
                      inquiryDetails.asset.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {inquiryDetails.asset.status}
                    </span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-100 px-5 flex gap-4 text-xs font-bold bg-white sticky top-0 z-10">
                  <button 
                    onClick={() => setActiveTab('general')} 
                    className={`py-3 border-b-2 transition-all ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    General Specs
                  </button>
                  <button 
                    onClick={() => setActiveTab('books')} 
                    className={`py-3 border-b-2 transition-all ${activeTab === 'books' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Depreciation Books ({inquiryDetails.depreciationBooks?.length || 0})
                  </button>
                  <button 
                    onClick={() => setActiveTab('ledger')} 
                    className={`py-3 border-b-2 transition-all ${activeTab === 'ledger' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Asset Ledger History ({inquiryDetails.ledger?.length || 0})
                  </button>
                  {inquiryDetails.asset.depreciation_method === 'UNITS_OF_PRODUCTION' && (
                    <button 
                      onClick={() => setActiveTab('usage')} 
                      className={`py-3 border-b-2 transition-all ${activeTab === 'usage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      Usage Logs ({inquiryDetails.usageLogs?.length || 0})
                    </button>
                  )}
                  {inquiryDetails.disposal && (
                    <button 
                      onClick={() => setActiveTab('disposal')} 
                      className={`py-3 border-b-2 transition-all ${activeTab === 'disposal' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      Retirement Details
                    </button>
                  )}
                </div>

                {/* Tab Contents */}
                <div className="p-5 flex-1 min-h-0 overflow-y-auto">
                  {activeTab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5 text-xs">
                          <h4 className="font-black text-slate-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-indigo-600">
                            <Info size={13} /> Asset Metadata Cards
                          </h4>
                          <div className="grid grid-cols-2 gap-3.5 font-semibold text-slate-600">
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">Original Cost</span>
                              <span className="font-mono font-bold text-slate-800">PKR {inquiryDetails.asset.purchase_cost.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">S/N Code</span>
                              <span className="font-mono text-slate-800">{inquiryDetails.asset.serial_number || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">Purchased Date</span>
                              <span className="text-slate-800">{new Date(inquiryDetails.asset.purchase_date).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">Service Placement Date</span>
                              <span className="text-slate-800">{new Date(inquiryDetails.asset.placed_in_service_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {inquiryDetails.asset.notes && (
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                            <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-wider text-slate-400">Card Notes / Remarks</h4>
                            <p className="text-slate-600 leading-relaxed font-semibold">{inquiryDetails.asset.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5 text-xs">
                          <h4 className="font-black text-slate-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-indigo-600">
                            <MapPin size={13} /> Location & Custodian Logs
                          </h4>
                          <div className="space-y-2.5 font-semibold text-slate-600">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Current Site / Location</span>
                              <span className="text-slate-800">{inquiryDetails.asset.location_name || 'Central Head Office'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Authorized Custodian</span>
                              <span className="text-slate-800 flex items-center gap-1">
                                <User size={12} className="text-slate-400" /> {inquiryDetails.asset.custodian_name || 'Common Corporate Asset'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Integration Voucher Navigation */}
                        {inquiryDetails.asset.purchase_voucher_id && (
                          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-3 text-xs">
                            <h4 className="font-black text-indigo-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                              <FileText size={13} /> Integrated Purchase Workflow
                            </h4>
                            <p className="text-slate-600 font-semibold">This asset card was capitalized from a recorded Purchase Voucher.</p>
                            <Link 
                              to={`/dashboard/vouchers/details?id=${inquiryDetails.asset.purchase_voucher_id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-all"
                            >
                              Open Capitalization Voucher <ArrowRight size={12} />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'books' && (
                    <div className="space-y-4">
                      <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/50 text-xs font-semibold text-slate-600">
                        💡 SARFIS supports multi-book depreciation profiles. The <strong>Accounting Book</strong> integrates with the general ledger, while <strong>Tax</strong> and <strong>Management</strong> books calculate independently.
                      </div>
                      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[9.5px] font-black uppercase text-slate-400 tracking-wider">
                              <th className="px-4 py-2.5">Book Name</th>
                              <th className="px-4 py-2.5">Depreciation Method</th>
                              <th className="px-4 py-2.5 text-center">Useful Life</th>
                              <th className="px-4 py-2.5 text-right">Salvage Value</th>
                              <th className="px-4 py-2.5 text-right">Accumulated Dep.</th>
                              <th className="px-4 py-2.5 text-right">Net Book Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold font-mono">
                            {inquiryDetails.depreciationBooks?.map(book => (
                              <tr key={book.id}>
                                <td className="px-4 py-3 font-sans font-bold text-slate-800">{book.book_name}</td>
                                <td className="px-4 py-3 font-sans text-slate-500">{book.depreciation_method}</td>
                                <td className="px-4 py-3 text-center">{book.useful_life_years} Yr ({book.useful_life_months} Mo)</td>
                                <td className="px-4 py-3 text-right">PKR {book.salvage_value.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-rose-600">PKR {book.accumulated_depreciation.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-bold">PKR {book.current_book_value.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'ledger' && (
                    <div className="space-y-4">
                      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[9.5px] font-black uppercase text-slate-400 tracking-wider">
                              <th className="px-4 py-2.5">Event Type</th>
                              <th className="px-4 py-2.5">Event Date</th>
                              <th className="px-4 py-2.5">Details description</th>
                              <th className="px-4 py-2.5">Book Name</th>
                              <th className="px-4 py-2.5 text-right">Amount</th>
                              <th className="px-4 py-2.5 text-center">Ref Doc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold font-mono">
                            {inquiryDetails.ledger?.map(log => (
                              <tr key={log.id}>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                    log.event_type === 'ACQUISITION' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                    log.event_type === 'DEPRECIATION' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                    log.event_type === 'TRANSFER' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                    log.event_type === 'MAINTENANCE' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                    'bg-rose-50 text-rose-700 border border-rose-100'
                                  }`}>
                                    {log.event_type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 font-sans">{new Date(log.event_date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 font-sans text-slate-700 max-w-xs truncate" title={log.description}>{log.description}</td>
                                <td className="px-4 py-3 font-sans text-slate-500">{log.book_name || 'All'}</td>
                                <td className="px-4 py-3 text-right text-slate-800 font-bold">PKR {log.amount.toLocaleString()}</td>
                                <td className="px-4 py-3 text-center font-sans">
                                  {log.voucher_number ? (
                                    <Link to={`/dashboard/vouchers/details?id=${log.voucher_id}`} className="text-indigo-600 hover:underline">
                                      {log.voucher_number}
                                    </Link>
                                  ) : log.entry_number ? (
                                    <span className="text-slate-500 font-mono">JE-{log.entry_number}</span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'usage' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-xs space-y-1 font-semibold text-slate-600">
                          <p>Estimated Lifetime Capacity: <strong className="text-slate-800 font-mono">{inquiryDetails.asset.estimated_total_units?.toLocaleString()} units</strong></p>
                          <p>Total Life Utilization: <strong className="text-slate-800 font-mono">{inquiryDetails.asset.current_units_used.toLocaleString()} units ({Math.round((inquiryDetails.asset.current_units_used / (inquiryDetails.asset.estimated_total_units || 1)) * 100)}%)</strong></p>
                          <p>Remaining Capacity: <strong className="text-slate-800 font-mono">{(inquiryDetails.asset.estimated_total_units - inquiryDetails.asset.current_units_used).toLocaleString()} units</strong></p>
                        </div>
                        <button onClick={() => setShowUsageForm(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black transition-all flex items-center gap-1">
                          <PlusCircle size={12} /> Log Usage
                        </button>
                      </div>

                      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[9.5px] font-black uppercase text-slate-400 tracking-wider">
                              <th className="px-4 py-2.5">Reading Date</th>
                              <th className="px-4 py-2.5 text-right">Units Consumption</th>
                              <th className="px-4 py-2.5">Source Type</th>
                              <th className="px-4 py-2.5">Recorded By</th>
                              <th className="px-4 py-2.5">Logged At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold font-mono">
                            {inquiryDetails.usageLogs?.map(log => (
                              <tr key={log.id}>
                                <td className="px-4 py-3 text-slate-800 font-sans">{new Date(log.usage_date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800">{log.units_used.toLocaleString()} units</td>
                                <td className="px-4 py-3 font-sans text-slate-500">{log.source}</td>
                                <td className="px-4 py-3 font-sans text-slate-600">{log.created_by_name || 'System'}</td>
                                <td className="px-4 py-3 font-sans text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                              </tr>
                            ))}
                            {inquiryDetails.usageLogs?.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-3.5 text-center text-slate-400 font-sans font-semibold">
                                  No capacity usage logged.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'disposal' && inquiryDetails.disposal && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 text-xs">
                      <h4 className="text-sm font-black text-rose-700 uppercase tracking-wide">Retirement & Disposal Certificate</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-semibold text-slate-600">
                        <div className="space-y-2">
                          <p><span className="text-slate-400">Date Retired:</span> <strong className="text-slate-800 font-mono">{new Date(inquiryDetails.disposal.disposalDate).toLocaleDateString()}</strong></p>
                          <p><span className="text-slate-400">Proceeds Cash value:</span> <strong className="text-slate-800 font-mono">PKR {inquiryDetails.disposal.salvageProceeds.toLocaleString()}</strong></p>
                          <p>
                            <span className="text-slate-400">Associated GL Posting:</span>{' '}
                            <span className="text-indigo-600 font-mono font-bold hover:underline">
                              JV-{inquiryDetails.disposal.journalEntryNumber}
                            </span>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p><span className="text-slate-400">Retirement Reason:</span></p>
                          <p className="bg-white p-3 rounded-lg border border-slate-100 leading-relaxed font-bold text-slate-700">
                            {inquiryDetails.disposal.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                {inquiryDetails.asset.status === 'ACTIVE' && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                    <button 
                      onClick={() => setShowDisposalForm(true)} 
                      className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Trash2 size={13} /> Retire / Sell Asset
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Disposal Form Dialog */}
      {showDisposalForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleDisposalSubmit} className="bg-white rounded-xl border border-slate-100 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-rose-700 flex items-center gap-1.5 uppercase">
              <Trash2 size={16} /> Asset Retirement Wizard
            </h3>
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500">Retirement Date</label>
                <input
                  type="date"
                  required
                  value={disposalData.disposal_date}
                  onChange={(e) => setDisposalData({ ...disposalData, disposal_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Salvage/Sale Proceeds (PKR)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={disposalData.proceeds_amount}
                  onChange={(e) => setDisposalData({ ...disposalData, proceeds_amount: parseFloat(e.target.value || 0) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Disposal Reason / Audit Notes</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this asset is being sold or disposed..."
                  value={disposalData.disposal_reason}
                  onChange={(e) => setDisposalData({ ...disposalData, disposal_reason: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setShowDisposalForm(false)} 
                className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black transition-all shadow-md"
              >
                Post Disposal GL
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Usage Meter Logger Dialog */}
      {showUsageForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUsageSubmit} className="bg-white rounded-xl border border-slate-100 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-indigo-700 flex items-center gap-1.5 uppercase">
              <PlusCircle size={16} /> Log Asset Capacity Usage
            </h3>
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500">Reading Date</label>
                <input
                  type="date"
                  required
                  value={usageData.usage_date}
                  onChange={(e) => setUsageData({ ...usageData, usage_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Units Consumption (KM / Hours / Usage units)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="0.00"
                  value={usageData.units_used}
                  onChange={(e) => setUsageData({ ...usageData, units_used: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Source Type</label>
                <select
                  value={usageData.source}
                  onChange={(e) => setUsageData({ ...usageData, source: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-semibold text-slate-600"
                >
                  <option value="MANUAL">Manual Meter Reading</option>
                  <option value="IOT_SENSOR">IoT Sensor Meter Reading</option>
                  <option value="LOG_BOOK">Log Book Entry</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setShowUsageForm(false)} 
                className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-md"
              >
                Save Log
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
