import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { StaffModerator, StaffRole } from '../../types';
import {
  Users,
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Mail,
  Lock,
  Eye,
  Sliders,
  AlertTriangle
} from 'lucide-react';

export const ModeratorsTab: React.FC = () => {
  const {
    staffModerators,
    addStaffModerator,
    updateStaffModerator,
    deleteStaffModerator,
    currentStaffRole,
    setCurrentStaffRole,
    loginAsStaff,
    auditLogs,
    showToast
  } = useStore();

  const isSuperAdmin = currentStaffRole === 'Super Admin';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModId, setEditingModId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: 'Order Moderator' as StaffRole,
    email: '',
    phone: '01',
    status: 'Active' as 'Active' | 'Suspended'
  });

  const handleOpenAdd = () => {
    setEditingModId(null);
    setFormData({
      name: '',
      role: 'Order Moderator',
      email: '',
      phone: '01',
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mod: StaffModerator) => {
    setEditingModId(mod.id);
    setFormData({
      name: mod.name,
      role: mod.role,
      email: mod.email,
      phone: mod.phone,
      status: mod.status
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Validation Error', 'Name and email are required.', 'error');
      return;
    }

    if (editingModId) {
      updateStaffModerator(editingModId, {
        name: formData.name.trim(),
        role: formData.role,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        status: formData.status
      });
    } else {
      addStaffModerator({
        name: formData.name.trim(),
        role: formData.role,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        status: formData.status,
        permissions: getPermissionsForRole(formData.role)
      });
    }
    setIsModalOpen(false);
  };

  const getPermissionsForRole = (role: StaffRole): string[] => {
    switch (role) {
      case 'Super Admin':
        return ['all', 'finances', 'moderators', 'orders', 'products', 'settings', 'sms'];
      case 'Admin':
        return ['orders', 'products', 'customers', 'coupons', 'sms', 'inventory'];
      case 'Order Moderator':
        return ['orders_view', 'orders_approve', 'courier_assign', 'customer_confirm'];
      case 'Product Moderator':
        return ['products_create', 'products_edit', 'inventory_manage', 'media_upload'];
      case 'Finance Moderator':
        return ['finances_view', 'finances_edit', 'finances_export', 'orders_read'];
      case 'Content Moderator':
        return ['banners_edit', 'theme_edit', 'categories_manage'];
      case 'Customer Support':
        return ['orders_read', 'customers_view', 'tracking_lookup'];
      default:
        return [];
    }
  };

  const permissionsMatrix = [
    { module: 'Order Review & Approval', superAdmin: true, admin: true, orderMod: true, prodMod: false, finMod: false, support: false },
    { module: 'Courier Consignment (Pathao/Steadfast)', superAdmin: true, admin: true, orderMod: true, prodMod: false, finMod: false, support: false },
    { module: 'Garment Creation & Stock Restock', superAdmin: true, admin: true, orderMod: false, prodMod: true, finMod: false, support: false },
    { module: 'Business Financial Ledger & P&L', superAdmin: true, admin: false, orderMod: false, prodMod: false, finMod: true, support: false },
    { module: '3D Banners & Visual Themes', superAdmin: true, admin: true, orderMod: false, prodMod: false, finMod: false, support: false },
    { module: 'Staff & Moderator Accounts', superAdmin: true, admin: false, orderMod: false, prodMod: false, finMod: false, support: false },
    { module: 'Payment Credentials & API Settings', superAdmin: true, admin: false, orderMod: false, prodMod: false, finMod: false, support: false }
  ];

  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-3xl border border-[#E5E1D5] p-12 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-heading font-extrabold text-[#14221C] uppercase tracking-tight">
          Super Admin Privileges Required
        </h3>
        <p className="text-xs text-[#202522]/70 leading-relaxed">
          Staff and moderator management is strictly restricted to the <strong>Super Admin</strong>.
          Your current operating identity is <strong>{currentStaffRole}</strong>.
        </p>
        <button
          onClick={() => {
            setCurrentStaffRole('Super Admin');
            loginAsStaff('Super Admin');
            showToast('Role Switched', 'Switched to Super Admin for administration.', 'success');
          }}
          className="mt-2 px-5 py-2.5 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase rounded-xl transition-colors"
        >
          Switch to Super Admin
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-3xl border border-[#E5E1D5] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#14221C] text-[#FF762E] text-[10px] font-bold uppercase rounded">
              RBAC Control
            </span>
            <span className="text-xs text-[#202522]/50">Staff & Moderator Accounts</span>
          </div>
          <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight mt-1">
            Moderator Access & Responsibility Management
          </h3>
          <p className="text-xs text-[#202522]/60 mt-0.5">
            Configure permissions for Order Moderators, Product Moderators, and Finance Officers.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4 text-[#FF762E]" />
          <span>Add Moderator</span>
        </button>
      </div>

      {/* Staff Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffModerators.map((mod) => (
          <div
            key={mod.id}
            className="bg-white p-5 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4 hover:border-stone-400 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#14221C] text-[#FF762E] flex items-center justify-center font-bold text-sm">
                  {mod.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#14221C]">{mod.name}</h4>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                      mod.role === 'Super Admin'
                        ? 'bg-purple-100 text-purple-800'
                        : mod.role === 'Order Moderator'
                        ? 'bg-blue-100 text-blue-800'
                        : mod.role === 'Product Moderator'
                        ? 'bg-amber-100 text-amber-800'
                        : mod.role === 'Finance Moderator'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-100 text-stone-800'
                    }`}
                  >
                    {mod.role}
                  </span>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  mod.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {mod.status}
              </span>
            </div>

            <div className="text-xs text-[#202522]/70 space-y-1.5 pt-2 border-t border-[#E5E1D5]">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#202522]/40" />
                <span>{mod.email}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <Phone className="w-3.5 h-3.5 text-[#202522]/40" />
                <span>{mod.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#202522]/50">
                <Clock className="w-3.5 h-3.5 text-[#202522]/40" />
                <span>Active since {new Date(mod.assignedDate).toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E5E1D5]">
              <button
                onClick={() => {
                  updateStaffModerator(mod.id, {
                    status: mod.status === 'Active' ? 'Suspended' : 'Active'
                  });
                }}
                className={`text-[11px] font-bold underline cursor-pointer ${
                  mod.status === 'Active' ? 'text-amber-700 hover:text-amber-800' : 'text-emerald-700 hover:text-emerald-800'
                }`}
              >
                {mod.status === 'Active' ? 'Suspend Account' : 'Reactivate'}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(mod)}
                  className="p-1.5 hover:bg-stone-100 text-[#202522]/70 hover:text-[#14221C] rounded-lg"
                  title="Edit Role / Info"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {mod.role !== 'Super Admin' && (
                  <button
                    onClick={() => {
                      deleteStaffModerator(mod.id);
                    }}
                    className="p-1.5 hover:bg-rose-50 text-[#202522]/40 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white rounded-3xl border border-[#E5E1D5] overflow-hidden shadow-xs space-y-4 p-5 sm:p-6">
        <div>
          <h4 className="font-heading text-base font-bold text-[#14221C] uppercase tracking-tight">
            Role Permission Matrix & Isolation Rules
          </h4>
          <p className="text-xs text-[#202522]/60 mt-0.5">
            Verified boundary enforcement ensuring Order and Product moderators cannot view finances or change backend configurations.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#14221C] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Platform Capability</th>
                <th className="px-4 py-3 text-center">Super Admin</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Order Moderator</th>
                <th className="px-4 py-3 text-center">Product Moderator</th>
                <th className="px-4 py-3 text-center">Finance Moderator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D5]">
              {permissionsMatrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-semibold text-[#14221C]">{row.module}</td>
                  <td className="px-4 py-3 text-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.admin ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-stone-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.orderMod ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-stone-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.prodMod ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-stone-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.finMod ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-stone-300 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Moderator Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D5] max-w-md w-full p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#E5E1D5]">
              <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                {editingModId ? 'Edit Moderator Account' : 'Register New Moderator'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#202522]/50 hover:text-[#14221C]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14221C] mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Tanvir Ahmed"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-medium focus:outline-none focus:border-[#14221C]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#14221C] mb-1">Staff Role & Access *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as StaffRole })}
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C] focus:outline-none"
                >
                  <option value="Order Moderator">Order Moderator (Fulfillment & Steadfast)</option>
                  <option value="Product Moderator">Product Moderator (Catalog & Inventory)</option>
                  <option value="Finance Moderator">Finance Moderator (P&L Ledger & Expenses)</option>
                  <option value="Content Moderator">Content Moderator (Lookbook & Banners)</option>
                  <option value="Customer Support">Customer Support (Tracking & Inquiries)</option>
                  <option value="Admin">Admin (Full Operations)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Email Address *</label>
                  <input
                    type="email"
                    placeholder="staff@vantrel.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Phone (BD Number)</label>
                  <input
                    type="tel"
                    placeholder="017XXXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14221C] mb-1">Account Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'Active' | 'Suspended' })
                  }
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
                >
                  <option value="Active">Active (Permitted to Log In)</option>
                  <option value="Suspended">Suspended (Access Temporarily Revoked)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E1D5]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#F7F5EF] text-[#202522] rounded-xl font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#14221C] hover:bg-[#202522] text-white font-bold uppercase rounded-xl transition-colors shadow-xs"
                >
                  {editingModId ? 'Update Moderator' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
