import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { Address } from '../types';
import {
  User as UserIcon,
  ShoppingBag,
  Heart,
  MapPin,
  Package,
  LogOut,
  ShieldCheck,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  Award,
  Gift,
  Share2,
  CheckCircle2,
  Copy,
  Sliders,
  Bell
} from 'lucide-react';

export const CustomerAccountPage: React.FC = () => {
  const {
    currentUser,
    loginAsCustomer,
    loginAsStaff,
    logout,
    orders,
    wishlist,
    products,
    setCurrentPage,
    updateUserProfile,
    addUserAddress,
    deleteUserAddress,
    setIsAuthModalOpen,
    settings,
    showToast
  } = useStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'wishlist' | 'profile'>('orders');

  // Address modal form
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddrDivision, setNewAddrDivision] = useState('Dhaka');
  const [newAddrDistrict, setNewAddrDistrict] = useState('Dhaka');
  const [newAddrUpazila, setNewAddrUpazila] = useState('Banani');
  const [newAddrStreet, setNewAddrStreet] = useState('');

  // Profile form
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editEmail, setEditEmail] = useState(currentUser?.email || '');
  const [marketingSms, setMarketingSms] = useState(currentUser?.privacySettings?.marketingSms ?? true);
  const [orderAlerts, setOrderAlerts] = useState(currentUser?.privacySettings?.orderAlerts ?? true);

  if (!currentUser) {
    return (
      <div className="bg-[#0A0A0A] text-white min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-[#141414] p-8 sm:p-10 rounded-3xl border border-white/10 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/10 text-[#FF762E] flex items-center justify-center">
            <UserIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading text-2xl font-bold text-white">Customer Account Portal</h2>
            <p className="text-xs text-neutral-400">
              Sign in to manage your orders and saved delivery addresses.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-3.5 px-4 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Sign In with Google / Phone OTP / Email
            </button>
            <button
              onClick={() => loginAsCustomer('01711234567', 'Muhammad Yeamin')}
              className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors"
            >
              Quick Test Sign In (Muhammad Yeamin)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter orders for this customer
  const myOrders = orders.filter(
    (o) =>
      o.customer.phone === currentUser.phone ||
      o.userId === currentUser.id ||
      orders.length <= 2
  );

  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name: editName,
      email: editEmail,
      privacySettings: {
        marketingSms,
        orderAlerts
      }
    });
  };

  const handleAddNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrStreet.trim()) {
      showToast('Validation Error', 'Please enter your street address.', 'error');
      return;
    }
    const newAddress: Address = {
      fullName: currentUser.name,
      phone: currentUser.phone,
      division: newAddrDivision,
      district: newAddrDistrict,
      upazila: newAddrUpazila,
      streetAddress: newAddrStreet.trim()
    };
    addUserAddress(newAddress);
    setShowAddAddressModal(false);
    setNewAddrStreet('');
    showToast('Address Saved', 'New delivery address added.', 'success');
  };

  return (
    <div className="bg-[#0A0A0A] text-white min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Profile Header */}
        <div className="bg-[#141414] p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FF762E] text-white flex items-center justify-center text-2xl font-black font-heading shrink-0 shadow-md">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-white">
                  {currentUser.name}
                </h1>
                {currentUser.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md shadow-2xs border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>ভেরিফাইড অ্যাকাউন্ট</span>
                  </span>
                )}
                {currentUser.role !== 'customer' && (
                  <span className="px-2 py-0.5 bg-[#FF762E] text-white text-[10px] font-bold uppercase rounded">
                    {currentUser.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {currentUser.phone} · {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentUser.role !== 'customer' && (
              <button
                onClick={() => setCurrentPage('admin')}
                className="px-4 py-2 bg-[#14221C] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#202522] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#FF762E]" />
                <span>Admin Dashboard</span>
              </button>
            )}

            <button
              onClick={logout}
              className="px-3.5 py-2 bg-[#F7F5EF] hover:bg-stone-200 text-[#202522] text-xs font-semibold rounded-xl border border-[#E5E1D5] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Account Tabs */}
        <div className="flex overflow-x-auto border-b border-[#E5E1D5] gap-4 sm:gap-6 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 transition-colors relative flex items-center gap-1.5 shrink-0 ${
              activeTab === 'orders'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Package className="w-4 h-4 text-[#FF762E]" />
            <span>My Orders ({myOrders.length})</span>
          </button>


          <button
            onClick={() => setActiveTab('addresses')}
            className={`pb-3 transition-colors relative flex items-center gap-1.5 shrink-0 ${
              activeTab === 'addresses'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <MapPin className="w-4 h-4 text-[#FF762E]" />
            <span>Saved Addresses ({currentUser.savedAddresses?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={`pb-3 transition-colors relative flex items-center gap-1.5 shrink-0 ${
              activeTab === 'wishlist'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Heart className="w-4 h-4 text-[#FF762E]" />
            <span>Wishlist ({wishlist.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 transition-colors relative flex items-center gap-1.5 shrink-0 ${
              activeTab === 'profile'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#FF762E]" />
            <span>Settings & Privacy</span>
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {myOrders.length === 0 ? (
              <div className="bg-[#141414] p-12 rounded-3xl border border-white/10 text-center space-y-3">
                <ShoppingBag className="w-10 h-10 mx-auto text-neutral-500" />
                <h3 className="font-heading text-lg font-bold text-white">No orders placed yet</h3>
                <p className="text-xs text-neutral-400">Your confirmed orders will appear here.</p>
                <button
                  onClick={() => setCurrentPage('shop')}
                  className="px-6 py-2 bg-[#FF762E] text-white text-xs font-bold uppercase rounded-xl"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              myOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-[#141414] p-6 rounded-3xl border border-white/10 shadow-xs space-y-4 text-white"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-white/10 text-xs">
                    <div>
                      <span className="font-mono font-bold text-sm text-white">
                        {ord.orderNumber}
                      </span>
                      <span className="text-neutral-400 ml-2">
                        {new Date(ord.createdAt).toLocaleDateString('en-GB')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-white/10 text-white text-[11px] font-bold rounded-lg uppercase">
                        {ord.orderStatus}
                      </span>
                      <span className="font-bold text-[#FF762E] tabular-nums">
                        ৳ {ord.total.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="space-y-3">
                    {ord.items.map((i) => (
                      <div key={i.id} className="flex items-center gap-3 text-xs">
                        <img
                          src={i.image}
                          alt=""
                          className="w-12 h-14 object-cover rounded-lg bg-neutral-900 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white truncate">{i.name}</h4>
                          <p className="text-[11px] text-neutral-400">
                            Size: {i.size} · Color: {i.color} · Qty: {i.quantity}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-white">
                          ৳ {(i.price * i.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
                    <span>
                      Destination: {ord.customer.upazila}, {ord.customer.district}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{ord.orderStatus}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}


        {/* TAB 2: SAVED ADDRESSES */}
        {activeTab === 'addresses' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Saved Delivery Addresses
              </h3>
              <button
                onClick={() => setShowAddAddressModal(true)}
                className="px-4 py-2 bg-[#FF762E] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#e8631c] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Add Address</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentUser.savedAddresses && currentUser.savedAddresses.length > 0 ? (
                currentUser.savedAddresses.map((addr, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-[#141414] rounded-3xl border border-white/10 space-y-3 text-xs relative group text-white"
                  >
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/30">
                        {idx === 0 ? 'Primary Address' : `Address #${idx + 1}`}
                      </span>
                      <button
                        onClick={() => deleteUserAddress(idx)}
                        className="text-neutral-400 hover:text-rose-400 transition-colors p-1"
                        title="Delete Address"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-bold text-sm text-white">{addr.fullName}</h4>
                    <p className="text-neutral-300 leading-relaxed">
                      {addr.streetAddress}<br />
                      {addr.upazila}, {addr.district}, {addr.division}
                    </p>
                    <p className="text-neutral-400">Mobile: {addr.phone}</p>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-2 p-8 bg-[#141414] rounded-3xl border border-white/10 text-center text-xs text-neutral-400">
                  No saved addresses found. Add one above to expedite future checkouts.
                </div>
              )}
            </div>

            {/* Add Address Modal */}
            {showAddAddressModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
                <div className="bg-[#141414] text-white w-full max-w-md p-6 rounded-3xl border border-white/15 space-y-4 shadow-2xl">
                  <h3 className="font-heading text-lg font-bold text-white">Add New Address</h3>
                  <form onSubmit={handleAddNewAddress} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-300 mb-1">Division</label>
                      <input
                        type="text"
                        value={newAddrDivision}
                        onChange={(e) => setNewAddrDivision(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white/5 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#FF762E]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-300 mb-1">District</label>
                        <input
                          type="text"
                          value={newAddrDistrict}
                          onChange={(e) => setNewAddrDistrict(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white/5 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#FF762E]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-300 mb-1">Upazila / Area</label>
                        <input
                          type="text"
                          value={newAddrUpazila}
                          onChange={(e) => setNewAddrUpazila(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white/5 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#FF762E]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-300 mb-1">Detailed Street / Road / House</label>
                      <textarea
                        rows={2}
                        value={newAddrStreet}
                        onChange={(e) => setNewAddrStreet(e.target.value)}
                        placeholder="House #, Road #, Sector..."
                        className="w-full px-3 py-2 text-xs bg-white/5 border border-white/15 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#FF762E]"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddAddressModal(false)}
                        className="px-4 py-2 bg-white/10 text-xs font-semibold rounded-xl text-white hover:bg-white/15"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#FF762E] text-white text-xs font-bold rounded-xl hover:bg-[#e8631c]"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WISHLIST */}
        {activeTab === 'wishlist' && (
          <div>
            {wishlistProducts.length === 0 ? (
              <div className="bg-[#141414] p-12 rounded-3xl border border-white/10 text-center space-y-3">
                <Heart className="w-10 h-10 mx-auto text-neutral-500" />
                <h3 className="font-heading text-lg font-bold text-white">Your Wishlist is Empty</h3>
                <p className="text-xs text-neutral-400">
                  Save pieces while browsing the catalog to inspect them later.
                </p>
                <button
                  onClick={() => setCurrentPage('shop')}
                  className="px-6 py-2.5 bg-[#FF762E] text-white text-xs font-bold uppercase rounded-xl"
                >
                  Explore Collection
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {wishlistProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SETTINGS & PRIVACY */}
        {activeTab === 'profile' && (
          <div className="bg-[#141414] text-white p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 max-w-xl">
            <h3 className="font-heading text-lg font-bold text-white uppercase tracking-tight">
              Profile & Notification Settings
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF762E]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF762E]"
                />
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <span className="font-bold text-white block">Transactional Notifications</span>

                <label className="flex items-center gap-3 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={orderAlerts}
                    onChange={(e) => setOrderAlerts(e.target.checked)}
                    className="accent-[#FF762E]"
                  />
                  <span>Receive transactional SMS updates on order dispatch</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={marketingSms}
                    onChange={(e) => setMarketingSms(e.target.checked)}
                    className="accent-[#FF762E]"
                  />
                  <span>Receive new arrival announcements & seasonal updates</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#FF762E] text-white font-bold uppercase rounded-xl tracking-wider hover:bg-[#e8631c] transition-colors shadow-xs"
              >
                Save Preferences
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
