import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { FinancialRecord, FinancialCategory } from '../../types';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Edit2,
  Download,
  Filter,
  Search,
  Calendar,
  PieChart,
  ShieldAlert,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';

export const FinancesTab: React.FC = () => {
  const {
    orders,
    products,
    financialRecords,
    addFinancialRecord,
    updateFinancialRecord,
    deleteFinancialRecord,
    clearAllFinances,
    currentStaffRole,
    showToast
  } = useStore();

  // Role Gate: Super Admin, Admin, and Finance Moderator only
  const hasAccess =
    currentStaffRole === 'Super Admin' ||
    currentStaffRole === 'Admin' ||
    currentStaffRole === 'Finance Moderator';

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Income' | 'Expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Manufacturing' as FinancialCategory,
    type: 'Expense' as 'Income' | 'Expense',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    referenceNo: ''
  });

  // Calculate Real-Time E-Commerce Financials
  const financials = useMemo(() => {
    // 1. Total Store Sales Revenue from valid orders
    const validOrders = orders.filter(
      (o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded'
    );
    const storeSalesRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);

    // 2. Real Cost of Goods Sold (COGS) from order items
    let calculatedCOGS = 0;
    validOrders.forEach((o) => {
      o.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const itemCost = prod?.costPrice || Math.round(item.price * 0.45);
        calculatedCOGS += itemCost * item.quantity;
      });
    });

    // 3. Ledger Transactions
    const expenseRecords = financialRecords.filter((r) => r.type.toLowerCase() === 'expense');
    const incomeRecords = financialRecords.filter((r) => r.type.toLowerCase() === 'income');

    const totalRecordedExpenses = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalRecordedIncomes = incomeRecords.reduce((sum, r) => sum + r.amount, 0);

    const totalRevenue = storeSalesRevenue + totalRecordedIncomes;
    const grossProfit = storeSalesRevenue - calculatedCOGS;
    const netProfit = grossProfit + totalRecordedIncomes - totalRecordedExpenses;
    const netProfitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

    return {
      storeSalesRevenue,
      calculatedCOGS,
      totalRecordedIncomes,
      totalRecordedExpenses,
      totalRevenue,
      grossProfit,
      netProfit,
      netProfitMargin
    };
  }, [orders, products, financialRecords]);

  // Filtered Ledger Rows
  const filteredRecords = useMemo(() => {
    const now = new Date();
    return financialRecords.filter((rec) => {
      // Type Filter
      if (typeFilter !== 'all' && rec.type.toLowerCase() !== typeFilter.toLowerCase()) return false;

      // Category Filter
      if (categoryFilter !== 'all' && rec.category !== categoryFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = rec.title.toLowerCase().includes(q);
        const matchDesc = rec.description?.toLowerCase().includes(q);
        const matchRef = rec.referenceNo?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchRef) return false;
      }

      // Date Filter
      if (dateFilter !== 'all') {
        const recDate = new Date(rec.date);
        if (dateFilter === 'today') {
          if (recDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (recDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          if (
            recDate.getMonth() !== now.getMonth() ||
            recDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        } else if (dateFilter === 'year') {
          if (recDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    });
  }, [financialRecords, typeFilter, categoryFilter, searchQuery, dateFilter]);

  const handleOpenAdd = () => {
    setEditingRecordId(null);
    setFormData({
      title: '',
      category: 'Manufacturing',
      type: 'Expense',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      description: '',
      referenceNo: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: FinancialRecord) => {
    setEditingRecordId(rec.id);
    setFormData({
      title: rec.title,
      category: rec.category,
      type: rec.type.toLowerCase() === 'income' ? 'Income' : 'Expense',
      amount: rec.amount,
      date: rec.date,
      description: rec.description || '',
      referenceNo: rec.referenceNo || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.amount <= 0) {
      showToast('Validation Error', 'Please specify a title and positive amount.', 'error');
      return;
    }

    if (editingRecordId) {
      updateFinancialRecord(editingRecordId, {
        title: formData.title.trim(),
        category: formData.category,
        type: formData.type,
        amount: Number(formData.amount),
        date: formData.date,
        description: formData.description.trim() || undefined,
        referenceNo: formData.referenceNo.trim() || undefined
      });
    } else {
      addFinancialRecord({
        title: formData.title.trim(),
        category: formData.category,
        type: formData.type,
        amount: Number(formData.amount),
        date: formData.date,
        description: formData.description.trim() || undefined,
        referenceNo: formData.referenceNo.trim() || undefined
      });
    }

    setIsModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = [
      'Record ID',
      'Date',
      'Title',
      'Type',
      'Category',
      'Amount (BDT)',
      'Reference No',
      'Description'
    ];

    const rows = filteredRecords.map((r) => [
      r.id,
      r.date,
      `"${r.title.replace(/"/g, '""')}"`,
      r.type,
      r.category,
      r.amount,
      r.referenceNo || 'N/A',
      `"${(r.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `VANTREL_Finances_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete', 'Financial ledger downloaded as CSV.', 'success');
  };

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-3xl border border-[#E5E1D5] p-12 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-heading font-extrabold text-[#14221C] uppercase tracking-tight">
          Financial Access Restricted
        </h3>
        <p className="text-xs text-[#202522]/70 leading-relaxed">
          Your current staff role (<strong>{currentStaffRole}</strong>) does not have authorization
          to view or modify VANTREL financial statements, cost of goods, or operating expense
          ledgers. Only <strong>Super Admin</strong> and <strong>Finance Moderator</strong> accounts
          have access to this module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Financial Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#202522]/60 uppercase">
            <span>Sales Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#14221C] tabular-nums">
            ৳{financials.storeSalesRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#202522]/50">
            From {orders.filter((o) => o.orderStatus !== 'Cancelled').length} confirmed orders
          </p>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="bg-white p-5 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#202522]/60 uppercase">
            <span>COGS (Fabric & Production)</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#202522] tabular-nums">
            ৳{financials.calculatedCOGS.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#202522]/50">
            Garment cost baseline per order items
          </p>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white p-5 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#202522]/60 uppercase">
            <span>Operating Expenses</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-700 tabular-nums">
            ৳{financials.totalRecordedExpenses.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#202522]/50">
            Ads, packaging, logistics, and rent
          </p>
        </div>

        {/* Net Profit */}
        <div className="bg-[#14221C] text-white p-5 rounded-3xl shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-white/70 uppercase">
            <span>Net Profit</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 text-[#FF762E] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#FF762E] tabular-nums">
            ৳{financials.netProfit.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span>Margin: {financials.netProfitMargin}%</span>
            <span>·</span>
            <span>Gross: ৳{financials.grossProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Control Bar & Filter Actions */}
      <div className="bg-white p-5 rounded-3xl border border-[#E5E1D5] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
              Business Financial Ledger & Profit Management
            </h3>
            <p className="text-xs text-[#202522]/60 mt-0.5">
              Record manufacturing batches, packaging, courier fees, ads, and review net margins.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white border border-[#E5E1D5] hover:border-stone-400 text-[#14221C] text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#FF762E]" />
              <span>Export Ledger</span>
            </button>

            <button
              onClick={() => {
                clearAllFinances();
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-rose-300 cursor-pointer"
              title="Delete all financial & earnings records"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>সব আয়-ব্যয় মুছুন</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#FF762E]" />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#E5E1D5]">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#202522]/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, description, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs focus:outline-none focus:border-[#14221C]"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs font-bold text-[#14221C] focus:outline-none"
          >
            <option value="all">All Types (Income & Expense)</option>
            <option value="Income">Incomes (+)</option>
            <option value="Expense">Expenses (-)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs font-bold text-[#14221C] focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Manufacturing">Manufacturing (Fabric/Stitching)</option>
            <option value="Packaging">Packaging & Hangtags</option>
            <option value="Courier">Courier & Logistics</option>
            <option value="Ads & Marketing">Ads & Digital Marketing</option>
            <option value="Office & Rent">Store & Office Rent</option>
            <option value="Salaries">Staff Salaries</option>
            <option value="Photography">Photography & Lookbook</option>
            <option value="Website & Tech">Website & Tech Infrastructure</option>
            <option value="Product Sales">Product Sales</option>
            <option value="Wholesale">Wholesale B2B</option>
            <option value="Other">Miscellaneous</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs font-bold text-[#14221C] focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-3xl border border-[#E5E1D5] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount (BDT)</th>
                <th className="px-4 py-3">Reference / Voucher</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D5]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#202522]/50">
                    No financial entries match your filters. Click "Add Transaction" to record an
                    entry.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 text-[#202522]/60 tabular-nums">
                      {new Date(rec.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#14221C]">
                      {rec.title}
                      {rec.description && (
                        <span className="block text-[11px] font-normal text-[#202522]/60">
                          {rec.description}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-lg text-[10px] font-bold text-[#14221C]">
                        {rec.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rec.type.toLowerCase() === 'income'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {rec.type.toLowerCase() === 'income' ? '+' : '-'} {rec.type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 font-bold tabular-nums ${
                        rec.type.toLowerCase() === 'income' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {rec.type.toLowerCase() === 'income' ? '+' : '-'}৳{rec.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[#202522]/60 font-mono text-[11px]">
                      {rec.referenceNo || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1.5 hover:bg-stone-100 text-[#202522]/70 hover:text-[#14221C] rounded-lg"
                          title="Edit Transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            deleteFinancialRecord(rec.id);
                          }}
                          className="p-1.5 hover:bg-rose-50 text-[#202522]/40 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D5] max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#E5E1D5]">
              <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                {editingRecordId ? 'Edit Transaction' : 'Record Financial Transaction'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#202522]/50 hover:text-[#14221C]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div>
                <label className="block font-bold text-[#14221C] mb-1.5">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'Expense' })}
                    className={`py-2 px-3 font-bold rounded-xl border text-center transition-all ${
                      formData.type === 'Expense'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-[#F7F5EF] border-[#E5E1D5] text-[#202522]'
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'Income' })}
                    className={`py-2 px-3 font-bold rounded-xl border text-center transition-all ${
                      formData.type === 'Income'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-[#F7F5EF] border-[#E5E1D5] text-[#202522]'
                    }`}
                  >
                    Income (+)
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block font-bold text-[#14221C] mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="e.g. 500 pcs French Terry Fabric Knitted"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-medium focus:outline-none focus:border-[#14221C]"
                />
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as FinancialCategory })
                    }
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C] focus:outline-none"
                  >
                    <option value="Manufacturing">Manufacturing (Knitting/Dyeing)</option>
                    <option value="Packaging">Packaging & Hangtags</option>
                    <option value="Courier">Courier & Logistics</option>
                    <option value="Ads & Marketing">Ads & Digital Marketing</option>
                    <option value="Office & Rent">Store & Office Rent</option>
                    <option value="Salaries">Staff Salaries</option>
                    <option value="Photography">Photography & Lookbook</option>
                    <option value="Website & Tech">Website & Tech Infrastructure</option>
                    <option value="Product Sales">Product Sales</option>
                    <option value="Wholesale">Wholesale B2B</option>
                    <option value="Other">Miscellaneous</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Amount (৳ BDT) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 45000"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C] focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs font-bold text-[#14221C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">
                    Voucher / Invoice / Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VOUCHER-9812"
                    value={formData.referenceNo}
                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-[#14221C] mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  placeholder="Additional context, supplier name, bank account, etc."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E1D5]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#F7F5EF] text-[#202522] rounded-xl font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#14221C] hover:bg-[#202522] text-white font-bold uppercase tracking-wider rounded-xl transition-colors shadow-xs"
                >
                  {editingRecordId ? 'Update Record' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
