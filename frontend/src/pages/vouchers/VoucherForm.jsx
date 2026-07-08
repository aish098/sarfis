import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { 
  ArrowLeft, Save, Plus, Trash2, BookOpen, AlertTriangle, 
  HelpCircle, Check, CheckCircle, Info, Calendar, Warehouse, User, DollarSign, ListCollapse, FileText,
  X, ShieldAlert, Clock
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const VOUCHER_TYPES = [
  { id: 'SALES', label: 'Sales Invoice', desc: 'Dr AR, Cr Revenue & Dr COGS, Cr Inventory' },
  { id: 'PURCHASE', label: 'Purchase Voucher', desc: 'Dr Inventory, Cr AP' },
  { id: 'RECEIPT', label: 'Cash Receipt', desc: 'Dr Cash/Bank, Cr AR' },
  { id: 'PAYMENT', label: 'Payment Voucher', desc: 'Dr AP, Cr Cash/Bank' },
  { id: 'JOURNAL', label: 'Journal Adjustment', desc: 'Custom Debit/Credit double entries' },
];

export default function VoucherForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [type, setType] = useState('SALES');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Type-specific payloads
  const [clientId, setClientId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [customArAccountId, setCustomArAccountId] = useState('');
  const [customApAccountId, setCustomApAccountId] = useState('');
  const [amount, setAmount] = useState('');
  
  // Document line items for Sales/Purchase
  const [items, setItems] = useState([{ productId: '', quantity: '', unitPrice: '', unitCost: '' }]);

  // Custom Journal Lines
  const [journalLines, setJournalLines] = useState([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' },
  ]);

  // Catalogs
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [clients, setClients] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [settings, setSettings] = useState(null);

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [submitAction, setSubmitAction] = useState('draft'); // draft | submit
  const [partnerRiskStatus, setPartnerRiskStatus] = useState(null);
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [activeOverrideRequest, setActiveOverrideRequest] = useState(null);
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [overrideRequestId, setOverrideRequestId] = useState(null);
  const [riskCheckLoading, setRiskCheckLoading] = useState(false);
  const [overrideRequesting, setOverrideRequesting] = useState(false);

  // Fetch catalogs
  const fetchCatalogs = useCallback(async () => {
    if (!activeCompany) return;
    try {
      const [prods, whs, clis, vends, accs, pers, sett] = await Promise.all([
        api.get(`/products/${activeCompany.id}`).catch(() => ({ data: [] })),
        api.get(`/warehouses/${activeCompany.id}`).catch(() => ({ data: [] })),
        api.get(`/clients/${activeCompany.id}`).catch(() => ({ data: [] })),
        api.get(`/vendors/${activeCompany.id}`).catch(() => ({ data: [] })),
        api.get(`/accounts/company/${activeCompany.id}`).catch(() => ({ data: [] })),
        api.get(`/periods/${activeCompany.id}`).catch(() => ({ data: [] })),
        api.get(`/settings/${activeCompany.id}`).catch(() => ({ data: null })),
      ]);

      setProducts(prods.data);
      setWarehouses(whs.data);
      setClients(clis.data);
      setVendors(vends.data);
      setAccounts(accs.data);
      setPeriods(pers.data);
      if (sett.data) setSettings(sett.data);
    } catch (err) {
      console.error('Error fetching catalogs:', err);
    }
  }, [activeCompany]);

  // Load existing voucher for editing
  const loadVoucher = useCallback(async () => {
    if (!id || !activeCompany) return;
    try {
      const res = await api.get(`/vouchers/${activeCompany.id}/${id}`);
      const v = res.data;
      if (v) {
        setType(v.type);
        setDate(new Date(v.date).toISOString().split('T')[0]);
        setTotalAmount(parseFloat(v.total_amount || 0));
        setTaxAmount(parseFloat(v.tax_amount || 0));
        setNotes(v.payload?.notes || '');

        if (v.type === 'SALES') {
          setClientId(v.payload?.clientId || '');
          setWarehouseId(v.payload?.warehouseId || '');
          setCustomArAccountId(v.payload?.ar_account_id || '');
          if (v.payload?.items) {
            setItems(v.payload.items.map(i => ({
              productId: i.productId || '',
              quantity: i.quantity || '',
              unitPrice: i.unitPrice || '',
              unitCost: i.unitCost || ''
            })));
          }
        } else if (v.type === 'PURCHASE') {
          setVendorId(v.payload?.vendorId || '');
          setWarehouseId(v.payload?.warehouseId || '');
          setCustomApAccountId(v.payload?.ap_account_id || '');
          if (v.payload?.items) {
            setItems(v.payload.items.map(i => ({
              productId: i.productId || '',
              quantity: i.quantity || '',
              unitPrice: i.unitPrice || '',
              unitCost: i.unitCost || ''
            })));
          }
        } else if (v.type === 'RECEIPT') {
          setClientId(v.payload?.clientId || '');
          setCashAccountId(v.payload?.cashAccountId || '');
          setCustomArAccountId(v.payload?.ar_account_id || '');
          setAmount(v.payload?.amount || '');
        } else if (v.type === 'PAYMENT') {
          setVendorId(v.payload?.vendorId || '');
          setCashAccountId(v.payload?.cashAccountId || '');
          setCustomApAccountId(v.payload?.ap_account_id || '');
          setAmount(v.payload?.amount || '');
        } else if (v.type === 'JOURNAL') {
          if (v.payload?.lines) {
            setJournalLines(v.payload.lines.map(l => ({
              accountId: l.accountId || '',
              debit: l.debit || '',
              credit: l.credit || ''
            })));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load voucher:', err);
      setFormError('Failed to load voucher details.');
    }
  }, [id, activeCompany]);

  const checkPartnerRisk = useCallback(async (entityType, entityId) => {
    if (!entityId || !activeCompany) {
      setPartnerRiskStatus(null);
      setOverrideApproved(false);
      setOverrideRequestId(null);
      setActiveOverrideRequest(null);
      return;
    }
    setRiskCheckLoading(true);
    try {
      const res = await api.get(`/risk/status/${entityType}/${entityId}`);
      const risk = res.data;
      setPartnerRiskStatus(risk);
      setOverrideApproved(false);
      setOverrideRequestId(null);
      setActiveOverrideRequest(null);
      
      if (risk.cash_only && ['SALES', 'PURCHASE'].includes(type)) {
        const cashAcc = accounts.find(a => a.id === parseInt(settings?.default_cash_account_id)) || accounts.find(a => a.code.startsWith('1010'));
        if (cashAcc) setCashAccountId(String(cashAcc.id));
      }
    } catch (err) {
      console.error('Failed to load partner risk status:', err);
    } finally {
      setRiskCheckLoading(false);
    }
  }, [activeCompany, settings, type, accounts]);

  useEffect(() => {
    if (['SALES', 'RECEIPT'].includes(type) && clientId) {
      checkPartnerRisk('CUSTOMER', clientId);
    } else {
      setPartnerRiskStatus(null);
      setOverrideApprovedBy(null);
    }
  }, [clientId, type, checkPartnerRisk]);

  useEffect(() => {
    if (['PURCHASE', 'PAYMENT'].includes(type) && vendorId) {
      checkPartnerRisk('VENDOR', vendorId);
    } else {
      setPartnerRiskStatus(null);
      setOverrideApprovedBy(null);
    }
  }, [vendorId, type, checkPartnerRisk]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchCatalogs();
      if (id) {
        await loadVoucher();
      }
      setIsLoading(false);
    };
    init();
  }, [id, fetchCatalogs, loadVoucher]);

  // Recalculate totals for SALES / PURCHASE
  useEffect(() => {
    if (['SALES', 'PURCHASE'].includes(type)) {
      let sum = 0;
      items.forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(type === 'SALES' ? item.unitPrice : item.unitCost) || 0;
        sum += qty * rate;
      });
      setTotalAmount(sum);
      
      // Calculate tax if tax rate exists
      const taxRate = parseFloat(settings?.tax_rate || 0);
      if (taxRate > 0) {
        setTaxAmount(Math.round(sum * (taxRate / 100) * 100) / 100);
      } else {
        setTaxAmount(0);
      }
    } else if (['RECEIPT', 'PAYMENT'].includes(type)) {
      setTotalAmount(parseFloat(amount) || 0);
      setTaxAmount(0);
    } else if (type === 'JOURNAL') {
      let debitSum = 0;
      journalLines.forEach(l => {
        debitSum += parseFloat(l.debit) || 0;
      });
      setTotalAmount(debitSum);
      setTaxAmount(0);
    }
  }, [items, amount, journalLines, type, settings]);

  // Validate date against lock periods
  useEffect(() => {
    if (!date || periods.length === 0) return;
    const txDate = new Date(date);
    const lockedPeriod = periods.find(p => {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      return txDate >= start && txDate <= end && p.status === 'CLOSED';
    });

    if (lockedPeriod) {
      setWarnings([
        `Warning: Selected date falls within a CLOSED accounting period (${lockedPeriod.period_name}). The posting engine will reject submissions in this date range.`
      ]);
    } else {
      setWarnings([]);
    }
  }, [date, periods]);

  // Item form modifiers
  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: '', unitPrice: '', unitCost: '' }]);
  };

  const handleRemoveItem = (idx) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const newItems = [...items];
    newItems[idx][field] = val;

    if (field === 'productId') {
      const prod = products.find(p => String(p.id) === String(val));
      if (prod) {
        newItems[idx].unitPrice = prod.unit_price || 0;
        newItems[idx].unitCost = prod.cost_price || 0;
      }
    }
    setItems(newItems);
  };

  // Journal line modifiers
  const handleAddJournalLine = () => {
    setJournalLines([...journalLines, { accountId: '', debit: '', credit: '' }]);
  };

  const handleRemoveJournalLine = (idx) => {
    if (journalLines.length <= 2) return;
    setJournalLines(journalLines.filter((_, i) => i !== idx));
  };

  const handleJournalLineChange = (idx, field, val) => {
    const newLines = [...journalLines];
    if (field === 'debit' && val !== '') {
      newLines[idx].credit = ''; // Clear opposite side
    } else if (field === 'credit' && val !== '') {
      newLines[idx].debit = ''; // Clear opposite side
    }
    newLines[idx][field] = val;
    setJournalLines(newLines);
  };

  const handleSubmitOverrideRequest = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;
    setOverrideRequesting(true);
    try {
      const isCreditLimitExceeded = partnerRiskStatus.credit_limit_override && type === 'SALES' && (() => {
        const client = clients.find(c => String(c.id) === String(clientId));
        const currentBal = parseFloat(client?.current_balance || 0);
        const limit = parseFloat(partnerRiskStatus.credit_limit_override);
        return (currentBal + totalAmount) > limit;
      })();

      const reqType = isCreditLimitExceeded ? 'CREDIT_POLICY_CHANGE' : 'TRANSACTION_OVERRIDE';
      const entityName = ['SALES', 'RECEIPT'].includes(type) 
        ? clients.find(c => String(c.id) === String(clientId))?.name
        : vendors.find(v => String(v.id) === String(vendorId))?.name;

      const res = await api.post('/risk/approval-requests', {
        entityType: ['SALES', 'RECEIPT'].includes(type) ? 'CUSTOMER' : 'VENDOR',
        entityId: ['SALES', 'RECEIPT'].includes(type) ? clientId : vendorId,
        requestType: reqType,
        voucherId: id || null,
        reason: overrideReason,
        entityName,
        metadata: {
          totalAmount,
          creditLimit: partnerRiskStatus.credit_limit_override
        }
      });
      
      setActiveOverrideRequest(res.data);
      setShowOverridePrompt(false);
      setOverrideReason('');
      setFormError('Transaction override request submitted. Pending manager approval review.');
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to submit override request.');
    } finally {
      setOverrideRequesting(false);
    }
  };

  const handleCheckOverrideStatus = async () => {
    if (!activeOverrideRequest) return;
    try {
      const res = await api.get(`/risk/approval-requests/${activeOverrideRequest.id}`);
      const req = res.data;
      if (req.status === 'APPROVED') {
        setOverrideApproved(true);
        setOverrideRequestId(req.id);
        setFormError('');
        setActiveOverrideRequest(null);
      } else if (req.status === 'REJECTED') {
        setFormError(`Override request was rejected by supervisor: "${req.review_notes || 'No notes'}"`);
        setActiveOverrideRequest(null);
      } else {
        alert('Override request is still PENDING manager approval review.');
      }
    } catch (err) {
      console.error('Failed to check override request status:', err);
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    if (partnerRiskStatus) {
      if (partnerRiskStatus.status === 'BLACKLISTED' && !overrideApproved) {
        setShowOverridePrompt(true);
        setFormError('Transaction Blocked: This partner is blacklisted. Manager override is required.');
        setSaving(false);
        return;
      }

      if (partnerRiskStatus.cash_only && !['RECEIPT', 'PAYMENT'].includes(type)) {
        if (type === 'SALES' && !cashAccountId) {
          setFormError('Transaction Blocked: Cash-only restriction is active. Credit terms are disabled.');
          setSaving(false);
          return;
        }
        if (type === 'PURCHASE' && !cashAccountId) {
          setFormError('Transaction Blocked: Cash-only restriction is active. Credit terms are disabled.');
          setSaving(false);
          return;
        }
      }

      if (partnerRiskStatus.credit_limit_override && type === 'SALES') {
        const client = clients.find(c => String(c.id) === String(clientId));
        const currentBal = parseFloat(client?.current_balance || 0);
        const limit = parseFloat(partnerRiskStatus.credit_limit_override);
        if ((currentBal + totalAmount) > limit && !overrideApproved) {
          setShowOverridePrompt(true);
          setFormError(`Transaction Blocked: Credit limit exceeded (Limit: PKR ${limit.toLocaleString()}). Manager override required.`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      // 1. Build Payload
      let payload = { notes };
      
      if (type === 'SALES') {
        if (!clientId) throw new Error('Customer is required.');
        if (!warehouseId) throw new Error('Warehouse is required.');
        const validItems = items.filter(i => i.productId && parseFloat(i.quantity) > 0);
        if (validItems.length === 0) throw new Error('Voucher must contain at least one line item.');
        payload = {
          ...payload,
          clientId,
          warehouseId,
          ar_account_id: customArAccountId || undefined,
          items: validItems.map(i => ({
            productId: parseInt(i.productId),
            quantity: parseFloat(i.quantity),
            unitPrice: parseFloat(i.unitPrice),
            unitCost: parseFloat(i.unitCost)
          }))
        };
      } else if (type === 'PURCHASE') {
        if (!vendorId) throw new Error('Supplier is required.');
        if (!warehouseId) throw new Error('Warehouse is required.');
        const validItems = items.filter(i => i.productId && parseFloat(i.quantity) > 0);
        if (validItems.length === 0) throw new Error('Voucher must contain at least one line item.');
        payload = {
          ...payload,
          vendorId,
          warehouseId,
          ap_account_id: customApAccountId || undefined,
          items: validItems.map(i => ({
            productId: parseInt(i.productId),
            quantity: parseFloat(i.quantity),
            unitCost: parseFloat(i.unitCost)
          }))
        };
      } else if (type === 'RECEIPT') {
        if (!clientId) throw new Error('Customer is required.');
        if (!amount || parseFloat(amount) <= 0) throw new Error('Receipt amount must be positive.');
        payload = {
          ...payload,
          clientId: parseInt(clientId),
          cashAccountId: cashAccountId ? parseInt(cashAccountId) : undefined,
          ar_account_id: customArAccountId ? parseInt(customArAccountId) : undefined,
          amount: parseFloat(amount)
        };
      } else if (type === 'PAYMENT') {
        if (!vendorId) throw new Error('Supplier is required.');
        if (!amount || parseFloat(amount) <= 0) throw new Error('Payment amount must be positive.');
        payload = {
          ...payload,
          vendorId: parseInt(vendorId),
          cashAccountId: cashAccountId ? parseInt(cashAccountId) : undefined,
          ap_account_id: customApAccountId ? parseInt(customApAccountId) : undefined,
          amount: parseFloat(amount)
        };
      } else if (type === 'JOURNAL') {
        const validLines = journalLines.filter(l => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
        if (validLines.length < 2) throw new Error('Journal adjustments must contain at least 2 lines.');
        
        let sumDebits = 0;
        let sumCredits = 0;
        const mappedLines = validLines.map(l => {
          const deb = parseFloat(l.debit) || 0;
          const cred = parseFloat(l.credit) || 0;
          sumDebits += deb;
          sumCredits += cred;
          return {
            accountId: parseInt(l.accountId),
            debit: deb,
            credit: cred
          };
        });

        if (Math.round(sumDebits * 100) !== Math.round(sumCredits * 100)) {
          throw new Error(`Out of Balance: Debits ($${sumDebits.toFixed(2)}) must exactly equal Credits ($${sumCredits.toFixed(2)})`);
        }

        payload = {
          ...payload,
          description: notes || 'Journal Voucher Adjustment',
          lines: mappedLines
        };
      }

      payload.date = date;
      if (overrideRequestId) {
        payload.override_request_id = overrideRequestId;
      }

      // 2. Send API Call
      let response;
      if (id) {
        response = await api.put(`/vouchers/${activeCompany.id}/${id}`, {
          type,
          date,
          payload,
          totalAmount,
          taxAmount
        });
      } else {
        response = await api.post(`/vouchers/${activeCompany.id}`, {
          type,
          date,
          payload,
          totalAmount,
          taxAmount
        });
      }

      const savedVoucher = response.data;
      if (submitAction === 'submit') {
        await api.post(`/vouchers/${activeCompany.id}/${savedVoucher.id}/submit`);
      }

      navigate('/dashboard/vouchers');
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Failed to save voucher.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for account categories matching
  const getAccountLabel = (acc) => {
    return `${acc.code} - ${acc.name} (${acc.category || acc.type})`;
  };

  // Generate automated double-entry preview logs
  const getSimulatedEntries = () => {
    const list = [];
    const salesAcc = accounts.find(a => a.id === parseInt(settings?.default_sales_account_id)) || { code: '4000', name: 'Sales Revenue' };
    const apAcc = accounts.find(a => a.id === parseInt(customApAccountId || settings?.default_ap_account_id)) || { code: '2000', name: 'Accounts Payable' };
    const arAcc = accounts.find(a => a.id === parseInt(customArAccountId || settings?.default_ar_account_id)) || { code: '1200', name: 'Accounts Receivable' };
    const invAcc = accounts.find(a => a.id === parseInt(settings?.default_inventory_account_id)) || { code: '1300', name: 'Product Inventory' };
    const cogsAcc = accounts.find(a => a.id === parseInt(settings?.default_cogs_account_id)) || { code: '5010', name: 'Cost of Goods Sold (COGS)' };
    const cashAcc = accounts.find(a => a.id === parseInt(cashAccountId || settings?.default_cash_account_id)) || { code: '1010', name: 'Cash / Operating Bank' };

    if (type === 'PURCHASE') {
      list.push(
        { account: invAcc, debit: totalAmount, credit: 0, desc: 'Receive goods into Inventory asset' },
        { account: apAcc, debit: 0, credit: totalAmount, desc: 'Accrue Accounts Payable balance to Supplier' }
      );
    } else if (type === 'SALES') {
      let estCOGS = 0;
      items.forEach(i => {
        const qty = parseFloat(i.quantity) || 0;
        const cost = parseFloat(i.unitCost) || 0;
        estCOGS += qty * cost;
      });

      list.push(
        { account: arAcc, debit: totalAmount, credit: 0, desc: 'Customer invoice outstanding balance (AR)' },
        { account: salesAcc, debit: 0, credit: totalAmount, desc: 'Record gross sales revenue credit' },
        { account: cogsAcc, debit: estCOGS, credit: 0, desc: 'Expensing product cost of sales (Dr COGS)' },
        { account: invAcc, debit: 0, credit: estCOGS, desc: 'Deducting asset cost of goods sold from warehouse stock' }
      );
    } else if (type === 'RECEIPT') {
      list.push(
        { account: cashAcc, debit: totalAmount, credit: 0, desc: 'Deposit funds into corporate bank account' },
        { account: arAcc, debit: 0, credit: totalAmount, desc: 'Settling customer accounts receivable balance' }
      );
    } else if (type === 'PAYMENT') {
      list.push(
        { account: apAcc, debit: totalAmount, credit: 0, desc: 'Debit Accounts Payable to settle supplier liability' },
        { account: cashAcc, debit: 0, credit: totalAmount, desc: 'Disburse funds from corporate cash/bank' }
      );
    } else if (type === 'JOURNAL') {
      journalLines.forEach(l => {
        const acc = accounts.find(a => String(a.id) === String(l.accountId)) || { code: '—', name: 'Select Account' };
        const deb = parseFloat(l.debit) || 0;
        const cred = parseFloat(l.credit) || 0;
        if (deb > 0 || cred > 0) {
          list.push({ account: acc, debit: deb, credit: cred, desc: notes || 'Manual adjustment entry line' });
        }
      });
    }
    return list;
  };

  const previewLines = getSimulatedEntries();
  const previewDebitSum = previewLines.reduce((s, l) => s + l.debit, 0);
  const previewCreditSum = previewLines.reduce((s, l) => s + l.credit, 0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] font-bold text-slate-400">Loading catalogs & voucher config...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/vouchers" className="w-10 h-10 rounded-xl flex items-center justify-center border border-emerald-200 bg-white hover:bg-emerald-50 transition-all text-emerald-600 shadow-sm cursor-pointer">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] items-center justify-center text-white shadow-md shadow-emerald-500/10 hidden sm:flex">
            <FileText size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">
                {id ? 'Edit Voucher' : 'New ERP Voucher'}
              </h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Draft Mode</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
              {id ? 'Modify transaction details prior to ledger posting.' : 'Create forms-driven vouchers with automatic posting simulation.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Core Form Card */}
        <div className="xl:col-span-2 space-y-6">
          <Motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card !rounded-2xl border border-slate-100 bg-white p-6 lg:p-8 space-y-6"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-55 bg-rose-50 border border-rose-100 text-rose-700">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <p className="text-[13.5px] font-medium leading-relaxed">{formError}</p>
                </div>
              )}

              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2.5 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-700">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <p className="text-[13.5px] font-medium leading-relaxed">{w}</p>
                </div>
              ))}

              {/* Mode switch */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Voucher Mode</label>
                {id ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-display font-bold text-slate-800 text-[14px]">
                    {VOUCHER_TYPES.find(t => t.id === type)?.label} (Locked for Edit)
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    {VOUCHER_TYPES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={`px-2.5 py-2 text-[12px] font-bold rounded-lg transition-all text-center ${
                          type === t.id 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Common Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Posting Date</label>
                  <div className="relative inline-block w-full sm:w-auto">
                    <Calendar size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input 
                      type="date" 
                      required 
                      className="input-enterprise text-[13px] !pl-10 w-full sm:!w-[220px]" 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Conditional header fields */}
                {['SALES', 'RECEIPT'].includes(type) && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Customer (Client) *</label>
                    <div className="relative">
                      <User size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                      <select 
                        required 
                        className="input-enterprise text-[13px] !pl-10"
                        value={clientId} 
                        onChange={e => setClientId(e.target.value)}
                      >
                        <option value="">— Select Customer —</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {['PURCHASE', 'PAYMENT'].includes(type) && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Supplier (Vendor) *</label>
                    <div className="relative">
                      <User size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                      <select 
                        required 
                        className="input-enterprise text-[13px] !pl-10"
                        value={vendorId} 
                        onChange={e => setVendorId(e.target.value)}
                      >
                        <option value="">— Select Supplier —</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Partner Risk Warning Panel */}
              {partnerRiskStatus && partnerRiskStatus.status !== 'ACTIVE' && (
                <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  partnerRiskStatus.status === 'BLACKLISTED' 
                    ? 'bg-red-50 border-red-200 text-red-800' 
                    : partnerRiskStatus.status === 'WATCHLIST' 
                    ? 'bg-amber-50 border-amber-200 text-amber-800' 
                    : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}>
                  <div className="space-y-1">
                    <p className="text-[13px] font-black uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle size={15} /> 
                      Risk Flag Detected: {partnerRiskStatus.status} (Score: {partnerRiskStatus.risk_score})
                    </p>
                    <p className="text-[12.5px] font-medium leading-relaxed mt-1">
                      {partnerRiskStatus.status === 'BLACKLISTED' 
                        ? `Transactions are BLOCKED. Reason: ${partnerRiskStatus.notes || 'Bad Debt / Payment issues.'}`
                        : `Risk Level: ${partnerRiskStatus.risk_level}. Policy: ${partnerRiskStatus.cash_only ? 'Cash-only terms enforced.' : 'Standard.'} ${partnerRiskStatus.credit_limit_override ? `Credit cap override: PKR ${parseFloat(partnerRiskStatus.credit_limit_override).toLocaleString()}` : ''}`}
                    </p>
                    {overrideApproved && (
                      <p className="text-[11px] font-extrabold uppercase text-emerald-600 tracking-wider">
                        ✔️ Override Granted by Supervisor
                      </p>
                    )}
                    {activeOverrideRequest && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11.5px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                          <Clock size={11} className="animate-pulse" /> Pending Override Review #{activeOverrideRequest.id}
                        </span>
                        <button type="button" onClick={handleCheckOverrideStatus}
                          className="text-[11.5px] font-bold text-blue-600 hover:text-blue-800 underline transition-all">
                          Check Approval Status
                        </button>
                      </div>
                    )}
                  </div>
                  {!overrideApproved && !activeOverrideRequest && (
                    <button type="button" onClick={() => setShowOverridePrompt(true)}
                      className="px-4 py-2 text-[12px] font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shrink-0">
                      Request Override
                    </button>
                  )}
                </div>
              )}

              {/* Warehouse selector for Inventory actions */}
              {['SALES', 'PURCHASE'].includes(type) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Dispatch / Receipt Warehouse *</label>
                    <div className="relative">
                      <Warehouse size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                      <select 
                        required 
                        className="input-enterprise text-[13px] !pl-10"
                        value={warehouseId} 
                        onChange={e => setWarehouseId(e.target.value)}
                      >
                        <option value="">— Select Warehouse Location —</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {type === 'SALES' && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">AR Account Override (Optional)</label>
                      <select 
                        className="input-enterprise text-[13px]"
                        value={customArAccountId} 
                        onChange={e => setCustomArAccountId(e.target.value)}
                      >
                        <option value="">Default (From mappings)</option>
                        {accounts.filter(a => a.category === 'Asset').map(a => <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>)}
                      </select>
                    </div>
                  )}

                  {type === 'PURCHASE' && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">AP Account Override (Optional)</label>
                      <select 
                        className="input-enterprise text-[13px]"
                        value={customApAccountId} 
                        onChange={e => setCustomApAccountId(e.target.value)}
                      >
                        <option value="">Default (From mappings)</option>
                        {accounts.filter(a => a.category === 'Liability').map(a => <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Mode-Specific Body forms */}
              {/* 1. SALES or PURCHASE Line Items */}
              {['SALES', 'PURCHASE'].includes(type) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Transaction Line Items</span>
                    <button 
                      type="button" 
                      onClick={handleAddItem}
                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus size={11} /> Add Item Line
                    </button>
                  </div>

                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="hidden md:grid grid-cols-12 gap-2.5 px-4 py-3 bg-[#EBF2EE] border-b-[2px] border-[#D1E0D8] text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">
                      <div className="col-span-5">Product/SKU</div>
                      <div className="col-span-2 text-right">Quantity</div>
                      <div className="col-span-3 text-right">{type === 'SALES' ? 'Unit Price ($)' : 'Unit Cost ($)'}</div>
                      <div className="col-span-2 text-right">Total ($)</div>
                    </div>

                    {/* Lines */}
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                      {items.map((item, idx) => {
                        const rowTotal = (parseFloat(item.quantity) || 0) * (parseFloat(type === 'SALES' ? item.unitPrice : item.unitCost) || 0);
                        return (
                          <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2.5 px-4 py-4 md:py-2.5 items-stretch md:items-center bg-white hover:bg-slate-50/40 border-b md:border-b-0 border-slate-100 last:border-b-0">
                            <div className="flex flex-col gap-1 md:col-span-5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">Product/SKU</span>
                              <select 
                                required
                                className="input-enterprise text-[12.5px] py-1.5"
                                value={item.productId}
                                onChange={e => handleItemChange(idx, 'productId', e.target.value)}
                              >
                                <option value="">Select product...</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.sku} — {p.name} (${parseFloat(p.cost_price).toFixed(2)} WAC)
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1 md:col-span-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">Quantity</span>
                              <input 
                                type="number" 
                                required
                                min="0.01" 
                                step="any"
                                placeholder="0" 
                                className="input-enterprise text-[12.5px] py-1.5 md:text-right font-mono font-semibold"
                                value={item.quantity}
                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-1 md:col-span-3">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">
                                {type === 'SALES' ? 'Unit Price ($)' : 'Unit Cost ($)'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="number" 
                                  required
                                  min="0.00" 
                                  step="any"
                                  placeholder="0.00" 
                                  className="input-enterprise text-[12.5px] py-1.5 md:text-right font-mono font-semibold flex-grow"
                                  value={type === 'SALES' ? item.unitPrice : item.unitCost}
                                  onChange={e => handleItemChange(idx, type === 'SALES' ? 'unitPrice' : 'unitCost', e.target.value)}
                                />
                                {items.length > 1 && (
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveItem(idx)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between md:block md:col-span-2 md:text-right font-mono font-extrabold text-[12.5px] text-slate-800 pr-1 mt-1 md:mt-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden font-sans">Total</span>
                              <span>${rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer totals */}
                    <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 text-[12.5px] font-bold text-slate-500">
                      <div className="flex justify-between">
                        <span>Items Subtotal</span>
                        <span className="font-mono text-slate-800">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {taxAmount > 0 && (
                        <div className="flex justify-between text-slate-400 text-[11.5px]">
                          <span>Est. Sales Tax ({settings?.tax_rate || 0}%)</span>
                          <span className="font-mono">${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200/80 pt-2 text-[14px]">
                        <span className="text-slate-800 font-extrabold">Estimated Total Invoice Amount</span>
                        <span className="font-mono font-black text-indigo-600">
                          ${(totalAmount + taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. RECEIPT or PAYMENT form */}
              {['RECEIPT', 'PAYMENT'].includes(type) && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Cash Flow Setup</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Liquid Cash / Bank Account *</label>
                      <select 
                        required 
                        className="input-enterprise text-[13px]"
                        value={cashAccountId} 
                        onChange={e => setCashAccountId(e.target.value)}
                      >
                        <option value="">— Select Cash Account —</option>
                        {accounts.filter(a => getAccountCategory(a) === 'Asset').map(a => <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Outstanding Amount ($) *</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="number" 
                          required 
                          min="0.01" 
                          step="0.01"
                          placeholder="0.00" 
                          className="input-enterprise !pl-10 text-[13.5px] font-mono font-semibold" 
                          value={amount} 
                          onChange={e => setAmount(e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {type === 'RECEIPT' && (
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Customer AR Account Override (Optional)</label>
                        <select 
                          className="input-enterprise text-[13px]"
                          value={customArAccountId} 
                          onChange={e => setCustomArAccountId(e.target.value)}
                        >
                          <option value="">Default (AR Account)</option>
                          {accounts.filter(a => getAccountCategory(a) === 'Asset').map(a => <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>)}
                        </select>
                      </div>
                    )}

                    {type === 'PAYMENT' && (
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Supplier AP Account Override (Optional)</label>
                        <select 
                          className="input-enterprise text-[13px]"
                          value={customApAccountId} 
                          onChange={e => setCustomApAccountId(e.target.value)}
                        >
                          <option value="">Default (AP Account)</option>
                          {accounts.filter(a => getAccountCategory(a) === 'Liability').map(a => <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Custom JOURNAL Adjustment Entries */}
              {type === 'JOURNAL' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Journal Double-Entries</span>
                    <button 
                      type="button" 
                      onClick={handleAddJournalLine}
                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus size={11} /> Add Entry Line
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="hidden md:grid grid-cols-12 gap-2.5 px-4 py-3 bg-[#EBF2EE] border-b-[2px] border-[#D1E0D8] text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">
                      <div className="col-span-6">General Ledger Account</div>
                      <div className="col-span-3 text-right">Debit ($)</div>
                      <div className="col-span-3 text-right">Credit ($)</div>
                    </div>

                    {/* Lines */}
                    <div className="divide-y divide-slate-100">
                      {journalLines.map((line, idx) => (
                        <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2.5 px-4 py-4 md:py-2 bg-white hover:bg-slate-50/40 items-stretch md:items-center border-b md:border-b-0 border-slate-100 last:border-b-0">
                          <div className="flex flex-col gap-1 md:col-span-6">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden font-sans">General Ledger Account</span>
                            <select 
                              required 
                              className="input-enterprise text-[12.5px] py-1.5"
                              value={line.accountId}
                              onChange={e => handleJournalLineChange(idx, 'accountId', e.target.value)}
                            >
                              <option value="">Select account...</option>
                              {accounts.map(a => <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1 md:col-span-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden font-sans">Debit ($)</span>
                            <input 
                              type="number" 
                              step="any"
                              placeholder="0.00" 
                              className="input-enterprise text-[12.5px] py-1.5 md:text-right font-mono font-semibold"
                              value={line.debit}
                              onChange={e => handleJournalLineChange(idx, 'debit', e.target.value)}
                              disabled={line.credit !== ''}
                            />
                          </div>
                          <div className="flex flex-col gap-1 md:col-span-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden font-sans">Credit ($)</span>
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="number" 
                                step="any"
                                placeholder="0.00" 
                                className="input-enterprise text-[12.5px] py-1.5 md:text-right font-mono font-semibold flex-grow"
                                value={line.credit}
                                onChange={e => handleJournalLineChange(idx, 'credit', e.target.value)}
                                disabled={line.debit !== ''}
                              />
                              {journalLines.length > 2 && (
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveJournalLine(idx)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    {(() => {
                      const debTotal = journalLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
                      const credTotal = journalLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
                      const isUnbalanced = Math.round(debTotal * 100) !== Math.round(credTotal * 100);
                      return (
                        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[12.5px] font-bold">
                          <span className="text-slate-500 flex items-center gap-1.5">
                            {isUnbalanced ? (
                              <span className="text-rose-500 flex items-center gap-1"><AlertTriangle size={13} /> Unbalanced Journal</span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1"><Check size={13} /> Journal Balanced</span>
                            )}
                          </span>
                          <div className="flex gap-8 font-mono text-[14px]">
                            <div className="text-right">
                              <span className="text-slate-400 text-[10px] block font-sans uppercase tracking-wider font-extrabold mb-0.5">Total Debits</span>
                              <span className="text-slate-800 font-extrabold">${debTotal.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 text-[10px] block font-sans uppercase tracking-wider font-extrabold mb-0.5">Total Credits</span>
                              <span className="text-slate-800 font-extrabold">${credTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Memo/Description Remarks */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remarks / Internal notes</label>
                <textarea 
                  className="input-enterprise py-2 resize-none" 
                  rows={2}
                  placeholder="Provide audit description details..." 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                />
              </div>

              {/* Submission Buttons */}
              <div className="flex gap-3 border-t border-slate-100 pt-5">
                <Link to="/dashboard/vouchers" className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex-1 py-3 flex items-center justify-center gap-2 text-[12.5px] font-bold rounded-xl transition-all cursor-pointer">
                  Cancel
                </Link>
                <button 
                  type="submit" 
                  disabled={saving}
                  onClick={() => setSubmitAction('draft')}
                  className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex-1 py-3 flex items-center justify-center gap-2 text-[12.5px] font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving && submitAction === 'draft' ? 'Saving...' : 'Save Draft'}
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  onClick={() => setSubmitAction('submit')}
                  className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white flex-[2] py-3 flex items-center justify-center gap-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle size={15} className="text-white" />
                  {saving && submitAction === 'submit' ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </Motion.div>
        </div>

        {/* Double-Entry Ledger Preview sidebar */}
        <div className="space-y-6">
          <div className="card p-6 border border-slate-200 bg-slate-900 text-white relative overflow-hidden shadow-xl shadow-slate-900/10">
            {/* Background design glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
              <BookOpen size={16} className="text-indigo-400" />
              <div>
                <h3 className="font-display font-extrabold text-[15px] text-white">Posting Simulator</h3>
                <p className="text-[10px] text-white/50">Double-entry general ledger visualization</p>
              </div>
            </div>

            {previewLines.length === 0 ? (
              <div className="text-center py-10 text-white/40 text-[12px] italic">
                Add items or set cash flow values to simulate double entry.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="divide-y divide-white/5 space-y-3">
                  {previewLines.map((l, i) => (
                    <div key={i} className="pt-3 text-[12px]">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="font-mono text-white/95 font-semibold">{l.account.code || '—'} - {l.account.name || 'Select Account'}</p>
                          <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{l.desc}</p>
                        </div>
                        <div className="text-right font-mono flex-shrink-0">
                          {l.debit > 0 ? (
                            <span className="text-indigo-300 font-bold block">Dr ${l.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-emerald-400 font-bold block pl-6">Cr ${l.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-4 mt-2 space-y-1.5 text-[11px] font-bold text-white/60">
                  <div className="flex justify-between font-mono">
                    <span>Ledger Debit Sum</span>
                    <span>Dr ${previewDebitSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Ledger Credit Sum</span>
                    <span>Cr ${previewCreditSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 text-[12.5px] font-black text-indigo-300">
                    <span>Status</span>
                    {Math.round(previewDebitSum * 100) === Math.round(previewCreditSum * 100) ? (
                      <span className="text-emerald-400 flex items-center gap-1">Balanced <Check size={12} /></span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">Out of Balance <AlertTriangle size={12} /></span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick instructions info block */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex gap-3 text-indigo-800">
            <Info size={18} className="flex-shrink-0 text-indigo-500 mt-0.5" />
            <div className="text-[12.5px] leading-relaxed">
              <p className="font-bold mb-1">Double-Entry Post Controls</p>
              <p className="text-indigo-700/80 mb-2">
                All saved vouchers are created in **DRAFT** state first to allow revision.
              </p>
              <p className="text-indigo-700/80">
                Authorized users can click **"Post to Ledger"** from the registry to commit the entry, lock the document, and post real-time updates to stock value and client/supplier ledgers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showOverridePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleSubmitOverrideRequest} className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-[13px] font-extrabold uppercase text-slate-800 flex items-center gap-1.5"><ShieldAlert size={15} className="text-red-500" /> Request Manager Override</h4>
              <button type="button" onClick={() => setShowOverridePrompt(false)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
            </div>

            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 mb-1">State Justification / Reason for Posting Override</label>
              <textarea required rows="3" className="input-enterprise p-2.5 text-[12.5px] bg-slate-50 border-slate-200" placeholder="State reason, eg: Customer promised bank transfer within 24h." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowOverridePrompt(false)} className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-[12px] font-bold flex-1">Cancel</button>
              <button type="submit" disabled={overrideRequesting} className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-[12px] font-bold flex-1">
                {overrideRequesting ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function getAccountCategory(account) {
  const cat = (account?.category || account?.type || '').toLowerCase();
  if (cat.includes('asset')) return 'Asset';
  if (cat.includes('liability')) return 'Liability';
  if (cat.includes('equity')) return 'Equity';
  if (cat.includes('revenue') || cat.includes('income')) return 'Revenue';
  if (cat.includes('expense')) return 'Expense';

  // Code starting number fallback
  const char = String(account?.code || '')[0];
  if (char === '1') return 'Asset';
  if (char === '2') return 'Liability';
  if (char === '3') return 'Equity';
  if (char === '4') return 'Revenue';
  if (char === '5') return 'Expense';
  return 'Asset';
}
