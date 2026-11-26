import React, { useState, useMemo, useRef } from 'react';
import { getFirebaseAuth } from '../firebase';
import {
  useStore,
  computePricesFromCost,
  COST_TO_SELLING_MARKUP_BDT,
  SELLING_TO_REGULAR_MARKUP_BDT
} from '../context/StoreContext';
import { Product, Order, OrderStatus, PaymentStatus, ProductCategory, Coupon, User, Address } from '../types';
import { resolveDeliveryZone } from '../data/bangladeshData';
import {
  rewriteToCanonicalProxyUrl,
  rewriteProductImagesToProxy,
  toDisplayImageUrl,
  isExternalThirdPartyImage,
  normalizeThirdPartyImageUrl,
  handleProxyImageError
} from '../utils/imageProxy';
import {
  getProductsForCategory,
  getHomepageShowcaseCategories
} from '../utils/categoryShowcase';
import {
  convertFileToWebpDataUrl,
  convertImageSourceToWebp,
  isWebpImageSource,
  PRODUCT_WEBP_MAX_WIDTH,
  DEFAULT_WEBP_QUALITY
} from '../utils/webpConverter';
import {
  generateInternalTrackingId,
  getTrackingCode,
  getOrderProgressInfo
} from '../utils/orderProgress';
import { DEFAULT_META_PIXEL_ID, sanitizeMetaPixelId } from '../utils/metaPixel';
import {
  isProductOutOfStock,
  resolveOutOfStockBehavior,
  isProductHiddenByOutOfStock
} from '../utils/stockVisibility';
import {
  resolveProductGsmLabel,
  resolveProductGsmNumber,
  resolveProductFabricLabel
} from '../utils/productGsm';
import {
  buildSeoImageAlt,
  downloadBatchImages
} from '../utils/imageSeoAndDownload';
import {
  ShieldCheck,
  TrendingUp,
  Package,
  ShoppingBag,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  Check,
  X,
  Truck,
  DollarSign,
  Settings,
  Tag,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  Layers,
  ArrowUpRight,
  Users,
  Code2,
  Database,
  FileCode,
  Copy,
  Terminal,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Play,
  Award,
  TrendingDown,
  Palette,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Building2,
  Navigation,
  Pin,
  Star,
  Sparkles,
  RotateCcw,
  FileSpreadsheet,
  Activity
} from 'lucide-react';
import { FinancesTab } from '../components/admin/FinancesTab';
import { ModeratorsTab } from '../components/admin/ModeratorsTab';
import { ThemesTab } from '../components/admin/ThemesTab';

export const AdminDashboard: React.FC = () => {
  const {
    products,
    activeProducts,
    archivedProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
    permanentlyDeleteProduct,
    deleteAllProducts,
    duplicateProduct,
    moveProductUp,
    moveProductDown,
    pinProductToTop,
    toggleTopProduct,
    moveProductToTop,
    categories,
    addCategory,
    updateCategoryName,
    deleteCategory,
    deleteCategories,
    moveCategoryOrder,
    reorderCategories,
    moveProductInCategory,
    setCategoryBestProduct,
    orders,
    clearAllOrders,
    deleteOrder,
    updateOrderStatus,
    updateOrderPayment,
    approveOrder,
    assignCourierTracking,
    cancelOrder,
    clearAllFinances,
    coupons,
    addCoupon,
    deleteCoupon,
    toggleCouponActive,
    settings,
    updateSettings,
    currentUser,
    signInAdminWithGoogle,
    isFirebaseAdminAuthenticated,
    firebaseAuthLoaded,
    logout,
    currentStaffRole,
    setCurrentStaffRole,
    setCurrentPage,
    showToast,
    customers,
    updateCustomerStatus,
    updateUserProfile,
    smsLogs,
    smsTemplates,
    updateSmsTemplate,
    resendSms,
    auditLogs
  } = useStore();

  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'products'
    | 'categories'
    | 'orders'
    | 'finances'
    | 'moderators'
    | 'themes'
    | 'inventory'
    | 'customers'
    | 'coupons'
    | 'sms-system'
    | 'loyalty-referrals'
    | 'audit-trail'
    | 'developer-api'
    | 'settings'
  >('overview');

  // Assign courier consignment & Tracking ID modal state
  const [courierModalOrder, setCourierModalOrder] = useState<Order | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<Order['courierName']>('Steadfast');
  const [courierTrackingCode, setCourierTrackingCode] = useState('');
  const [courierTargetStatus, setCourierTargetStatus] = useState<OrderStatus>('Shipped');
  const [courierProgressNote, setCourierProgressNote] = useState('');

  // Customer Loyalty adjustment modal state
  const [adjustingCust, setAdjustingCust] = useState<User | null>(null);
  const [adjustPtsAmount, setAdjustPtsAmount] = useState<number>(50);

  // Search & Filter orders state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('All');

  // Customer Management state (Full name, phone, district, upazila, address)
  const [customerSearch, setCustomerSearch] = useState('');
  const [inspectingCustomer, setInspectingCustomer] = useState<User | null>(null);
  const [inspectingCustomerProfile, setInspectingCustomerProfile] = useState<{
    id: string;
    name: string;
    phone: string;
    email?: string;
    district: string;
    upazila: string;
    streetAddress: string;
    joinedDate: string;
    totalOrders: number;
    totalSpent: number;
    status: string;
    orders: Order[];
    allAddresses: Address[];
  } | null>(null);

  // Email Notification State
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Product modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Category Management & Product Reordering state
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryInput, setEditCategoryInput] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState('');
  const [catProductSortCategory, setCatProductSortCategory] = useState<string>('T-Shirts');
  const [directRankInputs, setDirectRankInputs] = useState<Record<string, string>>({});
  const [selectedDeleteCategories, setSelectedDeleteCategories] = useState<string[]>([]);

  // Product Form fields - Complete properties required by brief
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>('Hoodies');
  const [prodSubCategory, setProdSubCategory] = useState('Heavyweight Streetwear');
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodDiscountPrice, setProdDiscountPrice] = useState<number>(0);
  const [prodSku, setProdSku] = useState('VT-NEW-01');
  const [prodStock, setProdStock] = useState<number>(30);
  const [prodFabric, setProdFabric] = useState('100% Combed Ringspun Cotton');
  const [prodFit, setProdFit] = useState('Relaxed Drop-Shoulder Oversized Silhouette');
  const [prodDesc, setProdDesc] = useState('');
  const [prodTagline, setProdTagline] = useState('');
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isDownloadingImages, setIsDownloadingImages] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement | null>(null);
  const [prodSizes, setProdSizes] = useState<string[]>(['M', 'L', 'XL', 'XXL']);
  const [showPantSizes, setShowPantSizes] = useState<boolean>(false);
  const [prodColors, setProdColors] = useState<{ name: string; hex: string }[]>([]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#14221C');
  const [prodGsm, setProdGsm] = useState<number | ''>('');
  const [prodVideoUrl, setProdVideoUrl] = useState<string>('');
  const [prodCost, setProdCost] = useState<number>(0);
  const [prodStatus, setProdStatus] = useState<'published' | 'draft' | 'archived'>('published');
  const [prodIsFeatured, setProdIsFeatured] = useState<boolean>(true);
  const [prodIsNewArrival, setProdIsNewArrival] = useState<boolean>(true);
  const [prodIsBestSeller, setProdIsBestSeller] = useState<boolean>(false);
  const [prodIsPinned, setProdIsPinned] = useState<boolean>(false);
  const [prodIsTopProduct, setProdIsTopProduct] = useState<boolean>(false);
  const [prodOutOfStockBehavior, setProdOutOfStockBehavior] = useState<'default' | 'show' | 'hide'>('default');

  // Products Table Filter & Bulk Selection State
  const [productSearch, setProductSearch] = useState<string>('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('All');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('All');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [confirmDeleteAllProducts, setConfirmDeleteAllProducts] = useState<boolean>(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | '7days' | '30days' | 'year'>('30days');
  const [orderSheetSearch, setOrderSheetSearch] = useState<string>('');
  const [orderSheetFilter, setOrderSheetFilter] = useState<'all' | 'successful'>('all');
  const [orderSheetSort, setOrderSheetSort] = useState<'asc' | 'desc'>('asc');
  const [copiedSheetPhone, setCopiedSheetPhone] = useState<string | null>(null);

  // Order Detail Inspection Modal
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [trackingInput, setTrackingInput] = useState('');
  const [inspectCourier, setInspectCourier] = useState<Order['courierName']>('Steadfast');
  const [inspectTrackingNote, setInspectTrackingNote] = useState('');

  // Coupon Form fields
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponValue, setNewCouponValue] = useState<number>(15);
  const [newCouponType, setNewCouponType] = useState<'percent' | 'fixed'>('percent');
  const [newCouponMin, setNewCouponMin] = useState<number>(2000);
  const [newCouponExpiry, setNewCouponExpiry] = useState('2026-12-31');
  const [newCouponUserLimit, setNewCouponUserLimit] = useState<number>(1);

  // Settings local state
  const [localSettings, setLocalSettings] = useState(settings);
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Developer & API Hub State
  const [selectedApiLang, setSelectedApiLang] = useState<'express' | 'prisma' | 'mongodb' | 'firebase' | 'roadmap'>('express');
  const [apiTesterEndpoint, setApiTesterEndpoint] = useState<'add-product' | 'validate-coupon' | 'create-order'>('validate-coupon');
  const [apiTesterInput, setApiTesterInput] = useState<string>(
    JSON.stringify({ code: 'VANTREL10', cartSubtotal: 3500 }, null, 2)
  );
  const [apiTesterOutput, setApiTesterOutput] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Admin Access Security Gate State
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);

  // Aggregated Customer Profiles from registered customers + all placed orders
  const allCustomerProfiles = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      phone: string;
      email?: string;
      district: string;
      upazila: string;
      streetAddress: string;
      joinedDate: string;
      totalOrders: number;
      totalSpent: number;
      status: string;
      orders: Order[];
      allAddresses: Address[];
    }>();

    // 1. Add registered customers
    customers.forEach((c) => {
      const custOrders = orders.filter(
        (o) => o.customer.phone === c.phone || (c.id && o.userId === c.id)
      );
      const latestOrder = custOrders[0];
      const primaryAddr = c.savedAddresses?.[0] || latestOrder?.customer;

      const key = (c.phone || c.id).trim();
      map.set(key, {
        id: c.id,
        name: c.name && c.name !== 'VANTREL Member' ? c.name : (latestOrder?.customer.fullName || c.name || 'সম্মানিত কাস্টমার'),
        phone: c.phone || latestOrder?.customer.phone || 'নাম্বার নেই',
        email: c.email,
        district: primaryAddr?.district || 'ঢাকা',
        upazila: primaryAddr?.upazila || 'সদর',
        streetAddress: primaryAddr?.streetAddress || 'ঠিকানা দেওয়া হয়নি',
        joinedDate: c.joinedDate || (latestOrder ? new Date(latestOrder.createdAt).toISOString().split('T')[0] : '2026-10-01'),
        totalOrders: custOrders.length > 0 ? custOrders.length : (c.totalOrders || 0),
        totalSpent: custOrders.length > 0 ? custOrders.reduce((sum, o) => sum + o.total, 0) : (c.totalSpent || 0),
        status: c.status || 'Active',
        orders: custOrders,
        allAddresses: c.savedAddresses && c.savedAddresses.length > 0 ? c.savedAddresses : (latestOrder ? [latestOrder.customer] : [])
      });
    });

    // 2. Add or enrich with placed orders
    orders.forEach((o) => {
      const phone = (o.customer.phone || '').trim();
      if (!phone) return;

      const existing = map.get(phone);
      if (existing) {
        if (existing.streetAddress === 'ঠিকানা দেওয়া হয়নি' && o.customer.streetAddress) {
          existing.streetAddress = o.customer.streetAddress;
          existing.district = o.customer.district || existing.district;
          existing.upazila = o.customer.upazila || existing.upazila;
        }
        if (!existing.orders.some((ord) => ord.id === o.id)) {
          existing.orders.push(o);
          existing.totalOrders = existing.orders.length;
          existing.totalSpent = existing.orders.reduce((sum, ord) => sum + ord.total, 0);
        }
        if (!existing.allAddresses.some((a) => a.streetAddress === o.customer.streetAddress)) {
          existing.allAddresses.push(o.customer);
        }
      } else {
        map.set(phone, {
          id: `cust-${phone}`,
          name: o.customer.fullName || 'সম্মানিত ক্রেতা',
          phone: o.customer.phone,
          email: o.customer.email || `${phone}@customer.vantrel.com`,
          district: o.customer.district || 'ঢাকা',
          upazila: o.customer.upazila || 'সদর',
          streetAddress: o.customer.streetAddress || 'বিস্তারিত ঠিকানা',
          joinedDate: new Date(o.createdAt).toISOString().split('T')[0],
          totalOrders: 1,
          totalSpent: o.total,
          status: 'Active',
          orders: [o],
          allAddresses: [o.customer]
        });
      }
    });

    return Array.from(map.values());
  }, [customers, orders]);

  // Filtered customer profiles with full name, phone, district, upazila, address search
  const filteredCustomerProfiles = useMemo(() => {
    if (!customerSearch.trim()) return allCustomerProfiles;
    const q = customerSearch.toLowerCase();
    return allCustomerProfiles.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.district.toLowerCase().includes(q) ||
        c.upazila.toLowerCase().includes(q) ||
        c.streetAddress.toLowerCase().includes(q)
      );
    });
  }, [allCustomerProfiles, customerSearch]);

  // Strict Authorization Check: Only email-verified muhammadeyamin0@gmail.com with Super Admin/Admin role
  const isAuthorizedAdmin =
    Boolean(currentUser) &&
    Boolean(currentUser?.emailVerified) &&
    currentUser?.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
    (currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin');

  if (!isAuthorizedAdmin) {
    const handleGoogleAdminUnlock = async () => {
      setAdminAuthError(null);
      setIsVerifyingAdmin(true);
      try {
        const res = await signInAdminWithGoogle();
        if (!res.success) {
          setAdminAuthError(
            res.message ||
              'অ্যাক্সেস সংরক্ষিত! শুধুমাত্র ভেরিফাইড অ্যাডমিন (muhammadeyamin0@gmail.com) গুগল অ্যাকাউন্ট দিয়ে প্রবেশ করতে পারবেন।'
          );
        }
      } catch (err: any) {
        setAdminAuthError(err?.message || 'Google Admin যাচাই ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
      } finally {
        setIsVerifyingAdmin(false);
      }
    };

    return (
      <div className="bg-[#0A0A0A] text-white min-h-[85vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-[#111413] p-8 rounded-3xl border border-[#223028] shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1C2922] border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-md">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-white tracking-tight">
              অ্যাডমিন পোর্টাল সিকিউরিটি লক
            </h2>
            <p className="text-xs text-stone-400 leading-relaxed max-w-sm mx-auto">
              এই ড্যাশবোর্ডটি শুধুমাত্র অনুমোদিত ও ইমেইল-ভেরিফাইড অ্যাডমিন (
              <span className="font-mono text-emerald-400">muhammadeyamin0@gmail.com</span>)-এর জন্য
              সংরক্ষিত। প্রবেশ করতে Google Admin অ্যাকাউন্ট দিয়ে সাইন ইন করুন।
            </p>
          </div>

          {adminAuthError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{adminAuthError}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleAdminUnlock}
              disabled={isVerifyingAdmin}
              className="w-full py-3.5 px-4 bg-white hover:bg-stone-100 text-[#111413] text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isVerifyingAdmin ? 'যাচাই করা হচ্ছে...' : 'Google Admin দিয়ে আনলক করুন'}</span>
            </button>

            <div className="p-3 bg-[#19221D] border border-[#2B3B32] rounded-xl text-[11px] text-stone-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Firebase Google Authentication ও Server Token Verification সক্রিয় রয়েছে।
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#223028] text-center">
            <button
              onClick={() => setCurrentPage('home')}
              className="text-xs text-stone-400 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              ← ওয়েবসাইটে ফিরে যান (Return to Storefront)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Analytics Metrics
  const totalSales = orders
    .filter((o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded')
    .reduce((sum, o) => sum + o.total, 0);

  const pendingOrders = orders.filter(
    (o) =>
      o.orderStatus === 'Pending Customer Confirmation' ||
      o.orderStatus === 'Customer Confirmed' ||
      o.orderStatus === 'Awaiting Staff Approval'
  ).length;
  const processingOrders = orders.filter((o) => o.orderStatus === 'Processing' || o.orderStatus === 'Packed' || o.orderStatus === 'Order Confirmed').length;
  const shippedOrders = orders.filter((o) => o.orderStatus === 'Shipped' || o.orderStatus === 'Out for Delivery').length;
  const deliveredOrders = orders.filter((o) => o.orderStatus === 'Delivered').length;
  const cancelledOrders = orders.filter((o) => o.orderStatus === 'Cancelled' || o.orderStatus === 'Cancellation Requested').length;
  const lowStockProducts = products.filter((p) => p.totalStock < 25);

  // Delivery Charge (৳70 per successful order) & Separate Normal Delivery Fee Analytics
  const successfulOrdersList = orders.filter(
    (o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded'
  );
  const totalDeliveryCharge70 = successfulOrdersList.length * 70;
  const deliveredDeliveryCharge70 = deliveredOrders * 70;
  const totalNormalDeliveryFee = successfulOrdersList.reduce(
    (sum, o) => sum + (Number(o.deliveryFee) || 0),
    0
  );
  const dhakaFreeOrdersCount = successfulOrdersList.filter(
    (o) => (Number(o.deliveryFee) || 0) === 0
  ).length;
  const paidDeliveryOrdersCount = successfulOrdersList.filter(
    (o) => (Number(o.deliveryFee) || 0) > 0
  ).length;

  // All-Time Chronological Customer Order Sheet (Permanent Serial 1, 2, 3...)
  const allTimeOrderSheetRows = useMemo(() => {
    const uniqueMap = new Map<string, Order>();
    orders.forEach((o) => {
      if (o && o.id) uniqueMap.set(o.id, o);
    });
    const chronological = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    return chronological.map((o, idx) => {
      const isSuccessful = o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded';
      return {
        serialNo: idx + 1,
        order: o,
        isSuccessful,
        deliveryCharge70: isSuccessful ? 70 : 0,
        normalDeliveryFee: Number(o.deliveryFee) || 0
      };
    });
  }, [orders]);

  const filteredOrderSheetRows = useMemo(() => {
    const q = orderSheetSearch.trim().toLowerCase();
    const list = allTimeOrderSheetRows.filter((row) => {
      if (orderSheetFilter === 'successful' && !row.isSuccessful) return false;
      if (!q) return true;
      const o = row.order;
      const itemsText = o.items
        .map((it) => `${it.name} ${it.size} ${it.color}`)
        .join(' ')
        .toLowerCase();
      return (
        String(row.serialNo) === q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.fullName.toLowerCase().includes(q) ||
        o.customer.phone.toLowerCase().includes(q) ||
        o.customer.district.toLowerCase().includes(q) ||
        o.customer.upazila.toLowerCase().includes(q) ||
        o.customer.streetAddress.toLowerCase().includes(q) ||
        itemsText.includes(q)
      );
    });
    return orderSheetSort === 'desc' ? [...list].reverse() : list;
  }, [allTimeOrderSheetRows, orderSheetFilter, orderSheetSearch, orderSheetSort]);

  const handleExportOrderSheetCSV = () => {
    const headers = [
      'Serial No',
      'Order Number',
      'Date & Time',
      'Customer Name',
      'Mobile Number',
      'District',
      'Upazila',
      'Full Address',
      'Product Details',
      'Normal Delivery Fee (BDT)',
      'Success Delivery Charge 70 (BDT)',
      'Total Bill (BDT)',
      'Payment Method',
      'Order Status'
    ];
    const rows = filteredOrderSheetRows.map((row) => {
      const o = row.order;
      const itemSummary = o.items
        .map((it) => `${it.name} (${[it.size, it.color].filter(Boolean).join('/')}) x${it.quantity}`)
        .join(' | ');
      return [
        row.serialNo,
        o.orderNumber,
        `"${new Date(o.createdAt).toLocaleString('en-GB')}"`,
        `"${o.customer.fullName.replace(/"/g, '""')}"`,
        `'${o.customer.phone}`,
        `"${o.customer.district.replace(/"/g, '""')}"`,
        `"${o.customer.upazila.replace(/"/g, '""')}"`,
        `"${o.customer.streetAddress.replace(/"/g, '""')}"`,
        `"${itemSummary.replace(/"/g, '""')}"`,
        row.normalDeliveryFee,
        row.deliveryCharge70,
        o.total,
        `"${o.paymentMethod}"`,
        `"${o.orderStatus}"`
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VANTREL_Order_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sheet Exported', '১, ২, ৩ সিরিয়াল অনুযায়ী কাস্টমার অর্ডার ও ডেলিভারি চার্জ শিট ডাউনলোড হয়েছে।', 'success');
  };

  // Top Selling Products calculation
  const topSellingProducts = [...products]
    .sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0) || b.rating - a.rating)
    .slice(0, 4);

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    if (orderStatusFilter !== 'All' && order.orderStatus !== orderStatusFilter) {
      return false;
    }
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      const matchNum = order.orderNumber.toLowerCase().includes(q);
      const matchName = order.customer.fullName.toLowerCase().includes(q);
      const matchPhone = order.customer.phone.toLowerCase().includes(q);
      if (!matchNum && !matchName && !matchPhone) return false;
    }
    return true;
  });

  const filteredCustomers = customers.filter((c) => {
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Export Customer Addresses to CSV
  const handleExportCustomersCSV = () => {
    const headers = [
      'Customer Name',
      'Mobile Number',
      'District (জেলা)',
      'Upazila (উপজেলা/থানা)',
      'Delivery Address (বিস্তারিত ঠিকানা)',
      'Total Orders',
      'Total Spent (BDT)',
      'Status',
      'Joined Date'
    ];

    const rows = allCustomerProfiles.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `'${c.phone}`,
      `"${c.district.replace(/"/g, '""')}"`,
      `"${c.upazila.replace(/"/g, '""')}"`,
      `"${c.streetAddress.replace(/"/g, '""')}"`,
      c.totalOrders,
      c.totalSpent,
      c.status,
      c.joinedDate
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VANTREL_Customers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete', 'কাস্টমারদের নাম, নাম্বার, জেলা, উপজেলা ও ঠিকানার CSV ফাইল ডাউনলোড হয়েছে।', 'success');
  };

  // Export orders to CSV
  const handleExportCSV = () => {
    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Phone',
      'District',
      'Address',
      'Items Count',
      'Total (BDT)',
      'Payment Method',
      'Payment Status',
      'Fulfillment Status',
      'Courier Tracking'
    ];

    const rows = orders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleDateString('en-GB'),
      `"${o.customer.fullName.replace(/"/g, '""')}"`,
      `'${o.customer.phone}`,
      o.customer.district,
      `"${o.customer.streetAddress.replace(/"/g, '""')}"`,
      o.items.reduce((sum, i) => sum + i.quantity, 0),
      o.total,
      o.paymentMethod,
      o.paymentStatus,
      o.orderStatus,
      o.trackingNumber || 'N/A'
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VANTREL_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete', 'Orders exported to CSV file successfully.', 'success');
  };

  // Product Modal Open for Create
  const handleOpenCreateProduct = () => {
    const firstValidCategory = categories.find((c) => c && c.toLowerCase() !== 'all') || 'Hoodies';
    setEditingProductId(null);
    setProdName('');
    setProdCategory(firstValidCategory);
    setIsCustomCategory(false);
    setCustomCategoryText('');
    setProdSubCategory('Heavyweight Streetwear');
    setProdCost(0);
    setProdDiscountPrice(0);
    setProdPrice(0);
    setProdSku(`VT-DROP-${Math.floor(100 + Math.random() * 900)}`);
    setProdStock(35);
    setProdFabric('100% Combed Ringspun Cotton');
    setProdGsm('');
    setProdVideoUrl('');
    setProdStatus('published');
    setProdIsFeatured(true);
    setProdIsNewArrival(true);
    setProdIsBestSeller(false);
    setProdIsPinned(false);
    setProdIsTopProduct(false);
    setProdFit('Relaxed Drop-Shoulder Oversized Silhouette');
    setProdDesc('Engineered in limited quantities with architectural boxy drape.');
    setProdTagline('Premium heavyweight streetwear essential.');
    setProdImages([]);
    setNewImageUrl('');
    setProdSizes(['M', 'L', 'XL', 'XXL']);
    setShowPantSizes(false);
    setProdColors([]);
    setNewColorName('');
    setProdOutOfStockBehavior('default');
    setShowAdvancedSpecs(false);
    setIsProductModalOpen(true);
  };

  // Product Modal Open for Edit
  const handleOpenEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdCategory(p.category);
    setProdSubCategory(p.subCategory || 'Apparel');
    const initialCost = p.costPrice ?? 0;
    if (initialCost > 0) {
      const computed = computePricesFromCost(initialCost);
      setProdCost(computed.costPrice);
      setProdDiscountPrice(computed.sellingPrice);
      setProdPrice(computed.regularPrice);
    } else {
      setProdCost(0);
      setProdPrice(p.regularPrice);
      setProdDiscountPrice(p.discountPrice ?? p.regularPrice);
    }
    setProdSku(p.sku);
    setProdStock(p.totalStock);
    setProdFabric(resolveProductFabricLabel(p) || p.fabric);
    setProdGsm(resolveProductGsmNumber(p) ?? '');
    setProdVideoUrl(p.videoUrl || '');
    setProdStatus(p.isArchived ? 'archived' : (p.status || 'published'));
    setProdIsFeatured(p.isFeatured ?? true);
    setProdIsNewArrival(p.isNewArrival ?? false);
    setProdIsBestSeller(p.isBestSeller ?? false);
    setProdIsPinned(Boolean(p.isPinned));
    setProdIsTopProduct(Boolean(p.isTopProduct));
    setProdFit(p.fit);
    setProdDesc(p.description);
    setProdTagline(p.tagline);
    const isPant = /pant|trouser|cargo|jogger|bottom|jeans/i.test(p.category || '');
    const allowed = [
      '28', '29', '30', '31', '32', '33', '34', '36', '38',
      'M', 'L', 'XL', 'XXL'
    ];
    const filteredSizes = (p.sizes || []).filter((s) => allowed.includes(s));
    const fallbackSizes = isPant ? ['28', '30', '32', '34', '36'] : ['M', 'L', 'XL', 'XXL'];
    const finalSizes = filteredSizes.length > 0 ? filteredSizes : fallbackSizes;
    setProdSizes(finalSizes);
    setShowPantSizes(isPant || finalSizes.some((s) => /^\d+$/.test(s)));
    setProdImages(p.images || []);
    setProdColors(p.colors || []);
    setProdOutOfStockBehavior(p.outOfStockBehavior || 'default');
    setIsProductModalOpen(true);
  };

  const normalizeImageUrl = (rawInput: string): string => {
    return rewriteToCanonicalProxyUrl(rawInput);
  };

  const handleAddImage = async () => {
    const raw = newImageUrl.trim();
    if (!raw) {
      // If user clicks Add Image without typing a URL, immediately open the file picker
      productImageInputRef.current?.click();
      return;
    }
    const normalized = normalizeImageUrl(raw);
    const isValid =
      normalized.startsWith('https://') ||
      normalized.startsWith('http://') ||
      normalized.startsWith('/') ||
      normalized.startsWith('data:image/');
    if (!isValid) {
      showToast('অকার্যকর লিংক', 'সঠিক ইমেজ URL (https://...) দিন অথবা Upload বাটনে ক্লিক করে ছবি আপলোড করুন।', 'error');
      return;
    }

    let finalImg = normalized;
    let convertedWebp = false;
    if (!isWebpImageSource(normalized)) {
      setIsUploadingImages(true);
      try {
        const webpResult = await convertImageSourceToWebp(normalized, {
          maxWidth: PRODUCT_WEBP_MAX_WIDTH,
          quality: DEFAULT_WEBP_QUALITY
        });
        if (webpResult) {
          finalImg = webpResult;
          convertedWebp = true;
        }
      } finally {
        setIsUploadingImages(false);
      }
    }

    const wasProxied = finalImg.includes('/api/image-proxy?url=');
    setProdImages((prev) => (prev.includes(finalImg) ? prev : [...prev, finalImg]));
    setNewImageUrl('');
    showToast(
      convertedWebp ? 'WebP Image Added' : wasProxied ? 'VANTREL Proxy URL Added' : 'Image Added',
      convertedWebp
        ? 'ছবিটি ব্রাউজার Canvas দিয়ে রিসাইজ (সর্বোচ্চ 1000px) ও .webp ফরম্যাটে কনভার্ট করে যুক্ত করা হয়েছে।'
        : wasProxied
          ? 'থার্ড-পার্টি লিংকটি স্বয়ংক্রিয়ভাবে vantreloutfit.shop ইমেজ প্রক্সি ইউআরএল-এ রূপান্তর করে যুক্ত করা হয়েছে।'
          : 'প্রোডাক্টের নতুন ছবি সফলভাবে যুক্ত হয়েছে।',
      'success'
    );
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    setProdImages((prev) => {
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      return [chosen, ...next];
    });
    showToast('Primary Cover Set', 'This image is now the primary storefront thumbnail.', 'info');
  };

  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    setProdImages((prev) => {
      const next = [...prev];
      const targetIdx = direction === 'left' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const compressAndReadImageFile = (file: File): Promise<string> => {
    return convertFileToWebpDataUrl(file, {
      maxWidth: PRODUCT_WEBP_MAX_WIDTH,
      quality: DEFAULT_WEBP_QUALITY
    });
  };

  const processImageFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const results = await Promise.allSettled(files.map((f) => compressAndReadImageFile(f)));
      const loaded: string[] = [];
      let failedCount = 0;

      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value) {
          loaded.push(res.value);
        } else {
          failedCount++;
        }
      });

      if (loaded.length > 0) {
        setProdImages((prev) => [...prev, ...loaded]);
        showToast('Images Uploaded', `${loaded.length}টি ছবি সফলভাবে আপলোড করা হয়েছে।`, 'success');
      }
      if (failedCount > 0) {
        showToast('কিছু ফাইল আপলোড হয়নি', `${failedCount}টি ফাইল সঠিক ইমেজ ফরম্যাটে ছিল না (JPG, PNG, WebP ব্যবহার করুন)।`, 'error');
      }
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;
    await processImageFiles(files);
  };

  const handleAddColor = () => {
    if (newColorName.trim()) {
      setProdColors((prev) => [...prev, { name: newColorName.trim(), hex: newColorHex }]);
      setNewColorName('');
    }
  };

  const handleCostPriceChange = (rawVal: string) => {
    if (rawVal === '') {
      setProdCost(0);
      setProdDiscountPrice(0);
      setProdPrice(0);
      return;
    }
    const parsed = Math.max(0, Math.round(Number(rawVal) || 0));
    const { costPrice, sellingPrice, regularPrice } = computePricesFromCost(parsed);
    setProdCost(costPrice);
    setProdDiscountPrice(sellingPrice);
    setProdPrice(regularPrice);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProduct) return;

    const cleanName = prodName.trim();
    if (!cleanName) {
      showToast('ভ্যালিডেশন এরর', 'প্রোডাক্টের নাম লিখুন।', 'error');
      return;
    }

    let finalCategoryRaw = isCustomCategory ? customCategoryText.trim() : String(prodCategory || '').trim();
    if (isCustomCategory && !finalCategoryRaw) {
      showToast('ভ্যালিডেশন এরর', 'নতুন ক্যাটাগরির নাম লিখুন অথবা তালিকার ক্যাটাগরি সিলেক্ট করুন।', 'error');
      return;
    }
    if (!finalCategoryRaw || finalCategoryRaw.toLowerCase() === 'all') {
      finalCategoryRaw = categories.find((c) => c && c.toLowerCase() !== 'all') || 'Hoodies';
    }
    const finalCategory = finalCategoryRaw.slice(0, 80) as ProductCategory;

    const cleanCostInput = Number.isFinite(Number(prodCost)) ? Math.max(0, Math.round(Number(prodCost))) : 0;
    const cleanSellPrice = Number.isFinite(Number(prodDiscountPrice)) ? Math.max(0, Math.round(Number(prodDiscountPrice))) : 0;
    const cleanRegPrice = Number.isFinite(Number(prodPrice)) ? Math.max(0, Math.round(Number(prodPrice))) : 0;
    let resolvedRegularPrice = cleanRegPrice;
    let resolvedDiscountPrice: number | undefined = undefined;

    if (cleanCostInput > 0) {
      const computed = computePricesFromCost(cleanCostInput);
      resolvedDiscountPrice = computed.sellingPrice;
      resolvedRegularPrice = computed.regularPrice;
    } else {
      if (cleanSellPrice <= 0 && cleanRegPrice <= 0) {
        showToast('ভ্যালিডেশন এরর', 'সঠিক Cost Price অথবা বিক্রয়/Regular Price (৳) লিখুন।', 'error');
        return;
      }
      if (cleanSellPrice > 0 && cleanRegPrice <= 0) {
        resolvedRegularPrice = cleanSellPrice;
      } else if (cleanSellPrice > 0 && cleanSellPrice < cleanRegPrice) {
        resolvedRegularPrice = cleanRegPrice;
        resolvedDiscountPrice = cleanSellPrice;
      } else if (cleanSellPrice > cleanRegPrice && cleanRegPrice > 0) {
        resolvedRegularPrice = cleanSellPrice;
        resolvedDiscountPrice = undefined;
      } else {
        resolvedRegularPrice = cleanRegPrice;
      }
    }

    const discountPct =
      resolvedDiscountPrice !== undefined && resolvedRegularPrice > 0
        ? Math.round(((resolvedRegularPrice - resolvedDiscountPrice) / resolvedRegularPrice) * 100)
        : 0;

    // Auto-flush pending image URL or color name if admin forgot to click + Add
    let finalImages = [...prodImages];
    if (newImageUrl.trim()) {
      const normalizedPending = normalizeImageUrl(newImageUrl.trim());
      if (
        normalizedPending.startsWith('https://') ||
        normalizedPending.startsWith('http://') ||
        normalizedPending.startsWith('/') ||
        normalizedPending.startsWith('data:image/')
      ) {
        let resolvedPending = normalizedPending;
        if (!isWebpImageSource(normalizedPending)) {
          const webpPending = await convertImageSourceToWebp(normalizedPending, {
            maxWidth: PRODUCT_WEBP_MAX_WIDTH,
            quality: DEFAULT_WEBP_QUALITY
          });
          if (webpPending) resolvedPending = webpPending;
        }
        if (!finalImages.includes(resolvedPending)) {
          finalImages.push(resolvedPending);
        }
        setProdImages(finalImages);
        setNewImageUrl('');
      }
    }
    if (finalImages.length > 20) {
      showToast('ছবি সীমা অতিক্রম', 'একটি প্রোডাক্টে সর্বোচ্চ ২০টি ছবি যুক্ত করা যাবে।', 'error');
      return;
    }

    let finalColors = [...prodColors];
    if (newColorName.trim()) {
      const pendingColor = { name: newColorName.trim(), hex: newColorHex };
      if (!finalColors.some((c) => c.name.toLowerCase() === pendingColor.name.toLowerCase())) {
        finalColors.push(pendingColor);
        setProdColors(finalColors);
      }
      setNewColorName('');
    }

    const cleanSku = (prodSku.trim() || `VT-DROP-${Math.floor(1000 + Math.random() * 9000)}`).slice(0, 80);
    const cleanStock = Number.isFinite(Number(prodStock))
      ? Math.max(0, Math.min(100000, Math.round(Number(prodStock))))
      : 0;
    const cleanCost = Number.isFinite(Number(prodCost)) ? Math.max(0, Math.min(1000000, Math.round(Number(prodCost)))) : 0;
    const cleanDesc = prodDesc.trim() || prodTagline.trim() || `${cleanName} — VANTREL OUTFIT premium collection.`;
    const isPantCategory = /pant|trouser|cargo|jogger|bottom|jeans/i.test(finalCategory);
    const effectiveSizes =
      prodSizes.length > 0 ? prodSizes : isPantCategory ? ['28', '30', '32', '34', '36'] : ['M', 'L', 'XL', 'XXL'];

    const variants =
      finalColors.length > 0
        ? effectiveSizes.flatMap((sz) =>
            finalColors.map((c) => ({
              id: `v-${Date.now()}-${sz}-${c.name.replace(/\s+/g, '')}`,
              size: sz,
              color: c.name,
              colorHex: c.hex,
              stock: cleanStock <= 0 ? 0 : Math.max(1, Math.floor(cleanStock / Math.max(1, effectiveSizes.length * finalColors.length))),
              sku: `${cleanSku}-${sz}-${c.name.slice(0, 2).toUpperCase()}`
            }))
          )
        : effectiveSizes.map((sz) => ({
            id: `v-${Date.now()}-${sz}`,
            size: sz,
            color: 'Standard',
            colorHex: '#14221C',
            stock: cleanStock <= 0 ? 0 : Math.max(1, Math.floor(cleanStock / Math.max(1, effectiveSizes.length))),
            sku: `${cleanSku}-${sz}`
          }));

    if (finalCategory && !categories.some((c) => c.toLowerCase() === finalCategory.toLowerCase())) {
      addCategory(finalCategory);
    }

    const isArchived = prodStatus === 'archived';
    const asciiSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const generatedSlug = (
      asciiSlug ? `${asciiSlug}-${Date.now().toString(36).slice(-4)}` : `vantrel-${Date.now().toString(36)}`
    ).slice(0, 220);

    setIsSavingProduct(true);
    try {
      const saveResult = editingProductId
        ? await updateProduct(editingProductId, {
            name: cleanName.slice(0, 220),
            category: finalCategory,
            subCategory: prodSubCategory.trim() || 'Streetwear',
            regularPrice: resolvedRegularPrice,
            discountPrice: resolvedDiscountPrice,
            discountPercent: discountPct > 0 ? discountPct : undefined,
            costPrice: cleanCost,
            status: prodStatus,
            isArchived,
            isFeatured: prodIsFeatured,
            isNewArrival: prodIsNewArrival,
            isBestSeller: prodIsBestSeller,
            isPinned: prodIsPinned,
            isTopProduct: prodIsTopProduct,
            outOfStockBehavior: prodOutOfStockBehavior,
            sku: cleanSku,
            totalStock: cleanStock,
            fabric: prodFabric.trim() || 'Premium Quality Fabric',
            gsm: prodGsm !== '' && Number.isFinite(Number(prodGsm)) && Number(prodGsm) > 0 ? Number(prodGsm) : undefined,
            videoUrl: prodVideoUrl.trim() || undefined,
            fit: prodFit.trim(),
            description: cleanDesc,
            tagline: prodTagline.trim(),
            images: rewriteProductImagesToProxy(finalImages),
            sizes: effectiveSizes,
            colors: finalColors,
            variants
          })
        : await addProduct({
            slug: generatedSlug,
            name: cleanName.slice(0, 220),
            tagline: prodTagline.trim() || 'Modern lifestyle garment.',
            description: cleanDesc,
            category: finalCategory,
            subCategory: prodSubCategory.trim() || 'Streetwear',
            brand: 'VANTREL OUTFIT',
            sku: cleanSku,
            regularPrice: resolvedRegularPrice,
            discountPrice: resolvedDiscountPrice,
            discountPercent: discountPct > 0 ? discountPct : undefined,
            costPrice: cleanCost,
            status: prodStatus,
            isArchived,
            images: rewriteProductImagesToProxy(finalImages),
            videoUrl: prodVideoUrl.trim() || undefined,
            sizes: effectiveSizes,
            colors: finalColors,
            variants,
            fabric: prodFabric.trim() || 'Premium Quality Fabric',
            gsm: prodGsm !== '' && Number.isFinite(Number(prodGsm)) && Number(prodGsm) > 0 ? Number(prodGsm) : undefined,
            fit: prodFit.trim(),
            care: ['Machine wash cold inside-out', 'Wash with like colors', 'Dry flat in shade'],
            tags: ['VANTREL', 'Drop', 'Streetwear'],
            isFeatured: prodIsFeatured,
            isNewArrival: prodIsNewArrival,
            isBestSeller: prodIsBestSeller,
            isPinned: prodIsPinned,
            isTopProduct: prodIsTopProduct,
            outOfStockBehavior: prodOutOfStockBehavior,
            rating: 5.0,
            reviewCount: 0,
            totalStock: cleanStock
          });

      if (saveResult?.success) {
        setIsProductModalOpen(false);
      }
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Products Table Filter Logic
  const filteredProducts = products.filter((p) => {
    if (productCategoryFilter !== 'All' && p.category !== productCategoryFilter) return false;
    if (productStatusFilter !== 'All') {
      if (productStatusFilter === 'top' && !p.isTopProduct) return false;
      if (productStatusFilter === 'out_of_stock' && (!isProductOutOfStock(p) || p.isArchived || p.status === 'archived')) return false;
      if (productStatusFilter === 'archived' && (!p.isArchived && p.status !== 'archived')) return false;
      if (productStatusFilter === 'published' && (p.isArchived || p.status === 'archived' || p.status === 'draft')) return false;
      if (productStatusFilter === 'draft' && (p.status !== 'draft' || p.isArchived)) return false;
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchSub = (p.subCategory || '').toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchSub) return false;
    }
    return true;
  });

  // Export Products to CSV
  const handleExportProductsCSV = () => {
    const listToExport = selectedProductIds.length > 0
      ? products.filter((p) => selectedProductIds.includes(p.id))
      : filteredProducts;

    const headers = [
      'Product ID',
      'Name',
      'Category',
      'SubCategory',
      'SKU',
      'Regular Price (BDT)',
      'Discount Price (BDT)',
      'Cost Price (BDT)',
      'GSM',
      'Total Stock',
      'Status',
      'Created Date'
    ];

    const rows = listToExport.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      `"${(p.subCategory || '').replace(/"/g, '""')}"`,
      p.sku,
      p.regularPrice,
      p.discountPrice || p.regularPrice,
      p.costPrice || '',
      resolveProductGsmLabel(p) || '',
      p.totalStock,
      p.isArchived ? 'Archived' : (p.status || 'Published'),
      p.createdDate || ''
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VANTREL_Products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete', `${listToExport.length} products exported to CSV file.`, 'success');
  };

  // Bulk / Batch Image Download with consistent naming (vantrel-outfit-1, vantrel-outfit-2, ...)
  const handleDownloadCatalogImagesZip = async (targetProducts: Product[]) => {
    const allImages = targetProducts.flatMap((p) => (Array.isArray(p.images) ? p.images : [])).filter(Boolean);
    if (allImages.length === 0) {
      showToast('No Images Found', 'Selected products do not contain downloadable images.', 'info');
      return;
    }
    if (isDownloadingImages) return;
    setIsDownloadingImages(true);
    try {
      const result = await downloadBatchImages(allImages, {
        mode: allImages.length > 1 ? 'zip' : 'sequential',
        prefix: 'vantrel-outfit',
        zipFilename: 'vantrel-outfit-images.zip'
      });
      if (result.downloaded > 0) {
        showToast(
          'Images Downloaded',
          result.mode === 'zip'
            ? `Bundled ${result.downloaded} images as vantrel-outfit-1..${result.downloaded} in ${result.archiveName || 'vantrel-outfit-images.zip'}.`
            : `Downloaded ${result.archiveName || 'vantrel-outfit-1'}.`,
          'success'
        );
      } else {
        showToast('Download Failed', 'Unable to fetch product images for download.', 'error');
      }
    } catch {
      showToast('Download Failed', 'Unable to fetch product images for download.', 'error');
    } finally {
      setIsDownloadingImages(false);
    }
  };

  const handleDownloadModalGalleryImages = async (mode: 'zip' | 'sequential') => {
    if (prodImages.length === 0 || isDownloadingImages) return;
    setIsDownloadingImages(true);
    try {
      const result = await downloadBatchImages(prodImages, {
        mode,
        prefix: 'vantrel-outfit',
        zipFilename: 'vantrel-outfit-images.zip'
      });
      if (result.downloaded > 0) {
        showToast(
          'Images Downloaded',
          result.mode === 'zip'
            ? `Saved ${result.downloaded} gallery photos into ${result.archiveName || 'vantrel-outfit-images.zip'}.`
            : `Downloaded ${result.downloaded} photos sequentially (vantrel-outfit-1..${result.downloaded}).`,
          'success'
        );
      } else {
        showToast('Download Failed', 'Unable to download one or more gallery images.', 'error');
      }
    } catch {
      showToast('Download Failed', 'Unable to fetch one or more gallery images.', 'error');
    } finally {
      setIsDownloadingImages(false);
    }
  };

  // Bulk Product Actions
  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    const count = selectedProductIds.length;
    selectedProductIds.forEach((id) => deleteProduct(id));
    setSelectedProductIds([]);
    showToast('Bulk Delete Completed', `${count} garments removed from catalog.`, 'info');
  };

  const handleBulkArchive = () => {
    if (selectedProductIds.length === 0) return;
    selectedProductIds.forEach((id) => updateProduct(id, { isArchived: true, status: 'archived' }));
    setSelectedProductIds([]);
    showToast('Bulk Archive Completed', 'Selected garments marked as archived.', 'success');
  };

  const handleBulkPublish = () => {
    if (selectedProductIds.length === 0) return;
    selectedProductIds.forEach((id) => updateProduct(id, { isArchived: false, status: 'published' }));
    setSelectedProductIds([]);
    showToast('Bulk Publish Completed', 'Selected garments published.', 'success');
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;

    const trimmed = newCouponCode.trim().toUpperCase();
    addCoupon({
      code: trimmed,
      type: newCouponType,
      value: newCouponValue,
      minOrder: newCouponMin,
      description: `${newCouponType === 'percent' ? `${newCouponValue}%` : `৳${newCouponValue}`} off above ৳${newCouponMin.toLocaleString()}`,
      expiryDate: newCouponExpiry,
      isActive: true,
      usageLimitPerUser: newCouponUserLimit,
      usedCount: 0
    });
    setNewCouponCode('');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPass = (localSettings.gmailNotificationAppPassword || '').replace(/\s+/g, '');
    const cleanedPixelId = sanitizeMetaPixelId(localSettings.metaPixelId);
    const cleanedSettings = {
      ...localSettings,
      orderNotificationEmail: (localSettings.orderNotificationEmail || 'muhammadeyamin0@gmail.com').trim(),
      gmailNotificationAppPassword: cleanedPass,
      metaPixelId: cleanedPixelId,
      isMetaPixelEnabled: localSettings.isMetaPixelEnabled ?? true
    };
    setLocalSettings(cleanedSettings);
    updateSettings(cleanedSettings);
  };

  const handleTestEmailNotification = async () => {
    setIsTestingEmail(true);
    try {
      const cleanedPass = (localSettings.gmailNotificationAppPassword || '').replace(/\s+/g, '');
      const cleanRecipient = (localSettings.orderNotificationEmail || 'muhammadeyamin0@gmail.com').trim();
      const cleanSender = (localSettings.gmailNotificationUser || 'muhammadeyamin0@gmail.com').trim();
      if (
        cleanedPass !== (settings.gmailNotificationAppPassword || '') ||
        cleanRecipient !== (settings.orderNotificationEmail || '')
      ) {
        updateSettings({
          ...localSettings,
          orderNotificationEmail: cleanRecipient,
          gmailNotificationUser: cleanSender,
          gmailNotificationAppPassword: cleanedPass
        });
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const fbAuth = await getFirebaseAuth().catch(() => null);
      if (fbAuth) {
        if (typeof (fbAuth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
          await (fbAuth as { authStateReady: () => Promise<void> }).authStateReady().catch(() => undefined);
        }
        const token = await fbAuth.currentUser?.getIdToken().catch(() => '');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      const res = await fetch('/api/test-email-notification', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipientEmail: cleanRecipient,
          senderUser: cleanSender,
          appPassword: cleanedPass
        })
      });
      const data = await res.json();
      if (res.ok && data.details?.delivered) {
        showToast('Email Delivered!', `Test email sent to ${data.details.recipient}`, 'success');
      } else if (!res.ok) {
        showToast('Unauthorized / Error', data?.error || 'Google Admin verification required. Sign in again via Google.', 'error');
      } else if (data.details?.authFailed) {
        showToast(
          'Gmail App Password Invalid (535)',
          `SMTP login rejected for ${data.details?.senderUser || 'muhammadeyamin0@gmail.com'}. Regular Gmail password কাজ করবে না—myaccount.google.com/apppasswords থেকে ১৬-অক্ষরের App Password তৈরি করে এখানে সেট করুন।`,
          'error'
        );
      } else {
        showToast('Notification Ready', `Target: ${data.details?.recipient || 'muhammadeyamin0@gmail.com'}. Enter your 16-char App Password or set GMAIL_APP_PASSWORD env var.`, 'info');
      }
    } catch {
      showToast('Error', 'Failed to dispatch test notification.', 'error');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to Clipboard', undefined, 'info');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRunApiTest = () => {
    try {
      const parsed = JSON.parse(apiTesterInput);
      if (apiTesterEndpoint === 'validate-coupon') {
        const found = coupons.find((c) => c.code === parsed.code?.toUpperCase());
        if (!found || !found.isActive) {
          setApiTesterOutput(
            JSON.stringify(
              { success: false, status: 400, error: 'Coupon code is invalid, expired, or deactivated' },
              null,
              2
            )
          );
        } else if (parsed.cartSubtotal < found.minOrder) {
          setApiTesterOutput(
            JSON.stringify(
              {
                success: false,
                status: 400,
                error: `Minimum order subtotal of ৳${found.minOrder} required for coupon ${found.code}`
              },
              null,
              2
            )
          );
        } else {
          const discount =
            found.type === 'percent'
              ? Math.round((parsed.cartSubtotal * found.value) / 100)
              : Math.min(found.value, parsed.cartSubtotal);
          setApiTesterOutput(
            JSON.stringify(
              {
                success: true,
                status: 200,
                data: {
                  code: found.code,
                  discountType: found.type,
                  discountValue: found.value,
                  calculatedDiscountBDT: discount,
                  payableSubtotal: parsed.cartSubtotal - discount
                }
              },
              null,
              2
            )
          );
        }
      } else if (apiTesterEndpoint === 'add-product') {
        setApiTesterOutput(
          JSON.stringify(
            {
              success: true,
              status: 201,
              message: 'Product created successfully in VANTREL catalog database',
              data: {
                id: `prod-vt-${Date.now()}`,
                name: parsed.name || 'Sample Garment',
                sku: parsed.sku || 'VT-SAMPLE-01',
                priceBDT: parsed.regularPrice || 2800,
                totalStock: parsed.totalStock || 50,
                createdAt: new Date().toISOString()
              }
            },
            null,
            2
          )
        );
      } else if (apiTesterEndpoint === 'create-order') {
        const orderNum = `VT-${Math.floor(10000 + Math.random() * 90000)}`;
        setApiTesterOutput(
          JSON.stringify(
            {
              success: true,
              status: 201,
              message: 'Order placed, stock deducted, invoice generated',
              data: {
                orderNumber: orderNum,
                paymentStatus: parsed.paymentMethod === 'Cash on Delivery (COD)' ? 'Pending' : 'Paid',
                deliveryFee: 0,
                trackingReference: `PTH-${Math.floor(100000 + Math.random() * 900000)}`
              }
            },
            null,
            2
          )
        );
      }
    } catch (err: any) {
      setApiTesterOutput(JSON.stringify({ error: 'Invalid JSON payload input: ' + err.message }, null, 2));
    }
  };

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E1D5]">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/images/vantrel-logo.webp"
              alt="Vantrel Outfit Admin Panel Logo"
              width={56}
              height={56}
              decoding="async"
              className="w-13 h-13 sm:w-14 sm:h-14 object-contain rounded-2xl bg-[#14221C] p-2 shadow-md border border-neutral-800 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-[#14221C] text-white text-[10px] font-bold uppercase rounded">
                  VANTREL OUTFIT Core Admin
                </span>
                <span className="text-xs text-[#202522]/50">Enterprise E-Commerce Suite</span>
              </div>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] tracking-tight uppercase mt-1">
                Admin Panel & Backend Console
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('developer-api')}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Code2 className="w-4 h-4 text-[#FF762E]" />
              <span>Developer & API Hub</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-white border border-[#E5E1D5] hover:border-stone-400 text-[#14221C] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-4 h-4 text-[#FF762E]" />
              <span>Export Orders CSV</span>
            </button>

            <button
              onClick={() => setCurrentPage('home')}
              className="px-4 py-2 bg-[#14221C] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#202522] transition-colors"
            >
              View Public Store
            </button>

            <button
              onClick={() => {
                logout();
                showToast('Admin Locked', 'অ্যাডমিন প্যানেল সুরক্ষিতভাবে লক করা হয়েছে।', 'info');
              }}
              className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Lock admin session"
            >
              <Lock className="w-4 h-4 text-rose-400" />
              <span>লক করুন (Lock)</span>
            </button>
          </div>
        </div>

        {firebaseAuthLoaded && !isFirebaseAdminAuthenticated && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5 text-xs text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">
                  Firebase Google Admin সেশন কানেক্টেড নেই
                </span>
                <span className="text-amber-900/80">
                  সব ডিভাইসে স্থায়ীভাবে সেভ করতে Google Admin (muhammadeyamin0@gmail.com) একবার কানেক্ট করুন—এরপর থেকে সবসময় কানেক্টেড থাকবে।
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={isVerifyingAdmin}
              onClick={async () => {
                setIsVerifyingAdmin(true);
                try {
                  const res = await signInAdminWithGoogle();
                  if (!res.success && res.message) {
                    showToast('Google Verify Error', res.message, 'error');
                  }
                } finally {
                  setIsVerifyingAdmin(false);
                }
              }}
              className="px-4 py-2 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer disabled:opacity-60"
            >
              {isVerifyingAdmin ? 'কানেক্ট হচ্ছে...' : 'Google Admin কানেক্ট করুন'}
            </button>
          </div>
        )}

        {/* RBAC Staff Role Selector & Active Privileges Banner */}
        <div className="p-4 bg-white rounded-2xl border border-[#E5E1D5] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14221C] text-[#FF762E] flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#14221C]">Active Staff Operator:</span>
                <span className="px-2 py-0.5 bg-[#14221C] text-[#FF762E] text-[10px] font-bold uppercase rounded">
                  {currentStaffRole}
                </span>
              </div>
              <p className="text-[11px] text-[#202522]/60 mt-0.5">
                {currentStaffRole === 'Super Admin' && 'Full permissions: All features, database migrations, staff management, payment credentials, and audit logs.'}
                {currentStaffRole === 'Admin' && 'Operational access: Products, orders, coupons, customer accounts, and reports.'}
                {currentStaffRole === 'Order Moderator' && 'Fulfillment access: Order review, final approvals, assigning courier consignments (Pathao/Steadfast).'}
                {currentStaffRole === 'Product Moderator' && 'Catalog access: Garment creation, inventory restock, image management, sizing.'}
                {currentStaffRole === 'Content Moderator' && 'Editorial access: Promotional banners, lookbook visuals, categories, and policy copy.'}
                {currentStaffRole === 'Customer Support' && 'Support access: Customer order lookup, tracking consignment help, and customer profiles.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[11px] font-bold text-[#14221C]">Test RBAC Role:</label>
            <select
              value={currentStaffRole}
              onChange={(e) => {
                const r = e.target.value as any;
                setCurrentStaffRole(r);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none text-[#14221C] cursor-pointer"
            >
              <option value="Super Admin">Super Admin</option>
              <option value="Admin">Admin</option>
              <option value="Order Moderator">Order Moderator</option>
              <option value="Product Moderator">Product Moderator</option>
              <option value="Content Moderator">Content Moderator</option>
              <option value="Customer Support">Customer Support</option>
            </select>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex border-b border-[#E5E1D5] gap-2 sm:gap-5 overflow-x-auto text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#FF762E]" />
            <span>Dashboard Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'products'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#FF762E]" />
            <span>Products ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'categories'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Tag className="w-4 h-4 text-[#FF762E]" />
            <span>Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Package className="w-4 h-4 text-[#FF762E]" />
            <span>Orders 16-Stage ({orders.length})</span>
          </button>

          {/* Finances & Profit Management (Super Admin, Admin, Finance Moderator) */}
          {(currentStaffRole === 'Super Admin' ||
            currentStaffRole === 'Admin' ||
            currentStaffRole === 'Finance Moderator') && (
            <button
              onClick={() => setActiveTab('finances')}
              className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'finances'
                  ? 'text-[#14221C] border-b-2 border-[#14221C]'
                  : 'text-[#202522]/60 hover:text-[#14221C]'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Finances & Profit</span>
            </button>
          )}

          {/* Staff & Moderator RBAC (Super Admin Only) */}
          {currentStaffRole === 'Super Admin' && (
            <button
              onClick={() => setActiveTab('moderators')}
              className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'moderators'
                  ? 'text-[#14221C] border-b-2 border-[#14221C]'
                  : 'text-[#202522]/60 hover:text-[#14221C]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Staff & Moderators</span>
            </button>
          )}

          {/* Visual Themes & 3D Banners */}
          {(currentStaffRole === 'Super Admin' || currentStaffRole === 'Admin') && (
            <button
              onClick={() => setActiveTab('themes')}
              className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'themes'
                  ? 'text-[#14221C] border-b-2 border-[#14221C]'
                  : 'text-[#202522]/60 hover:text-[#14221C]'
              }`}
            >
              <Palette className="w-4 h-4 text-[#FF762E]" />
              <span>Themes & 3D Banners</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('customers')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'customers'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Users className="w-4 h-4 text-[#FF762E]" />
            <span>কাস্টমার ও ঠিকানা ({allCustomerProfiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#FF762E]" />
            <span>Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('coupons')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'coupons'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Tag className="w-4 h-4 text-[#FF762E]" />
            <span>Coupons</span>
          </button>

          <button
            onClick={() => setActiveTab('sms-system')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'sms-system'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Phone className="w-4 h-4 text-[#FF762E]" />
            <span>SMS Notifications ({smsLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('loyalty-referrals')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'loyalty-referrals'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Award className="w-4 h-4 text-[#FF762E]" />
            <span>Loyalty & Referrals</span>
          </button>

          <button
            onClick={() => setActiveTab('audit-trail')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'audit-trail'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Clock className="w-4 h-4 text-[#FF762E]" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('developer-api')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'developer-api'
                ? 'text-emerald-800 border-b-2 border-emerald-800'
                : 'text-emerald-700 hover:text-emerald-900'
            }`}
          >
            <Code2 className="w-4 h-4 text-[#FF762E]" />
            <span>Backend API & Schema Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'text-[#14221C] border-b-2 border-[#14221C]'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            <Settings className="w-4 h-4 text-[#FF762E]" />
            <span>Store Settings</span>
          </button>
        </div>

        {/* TAB 1: DASHBOARD ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Header & Period Filter */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-5 rounded-3xl border border-[#E5E1D5]">
              <div>
                <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                  Executive Sales & Inventory Analytics
                </h3>
                <p className="text-xs text-[#202522]/60 mt-0.5">
                  Real-time transactional data, net margins, fulfillment status, and catalog health.
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#F7F5EF] p-1 rounded-2xl border border-[#E5E1D5] self-start sm:self-auto">
                {(['today', '7days', '30days', 'year'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setAnalyticsPeriod(period)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      analyticsPeriod === period
                        ? 'bg-[#14221C] text-white shadow-xs'
                        : 'text-[#202522]/60 hover:text-[#14221C]'
                    }`}
                  >
                    {period === 'today' && 'Today'}
                    {period === '7days' && '7 Days'}
                    {period === '30days' && '30 Days'}
                    {period === 'year' && 'All-Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sales, Delivery Charge & Operational Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-[#E5E1D5] shadow-2xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Gross Sales
                </span>
                <div className="text-2xl font-black text-[#14221C] tabular-nums">
                  ৳{totalSales.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold">
                  Active BDT orders
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-[#E5E1D5] shadow-2xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Net Realized
                </span>
                <div className="text-2xl font-black text-[#FF762E] tabular-nums">
                  ৳{Math.max(0, totalSales - orders.filter(o => o.orderStatus === 'Refunded').reduce((s, o) => s + o.total, 0)).toLocaleString()}
                </div>
                <div className="text-[11px] text-[#202522]/60 font-medium">
                  After refunds & returns
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-[#E5E1D5] shadow-2xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Total Orders
                </span>
                <div className="text-2xl font-black text-[#14221C] tabular-nums">
                  {orders.length}
                </div>
                <div className="text-[11px] text-[#202522]/60">
                  {pendingOrders} Pending · {shippedOrders + deliveredOrders} Dispatched
                </div>
              </div>

              <div className="p-5 bg-amber-50/70 rounded-3xl border border-amber-300 shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Delivery Charge (৳৭০/সফল)
                  </span>
                  <Truck className="w-4 h-4 text-[#FF762E] shrink-0" />
                </div>
                <div className="text-2xl font-black text-[#14221C] tabular-nums">
                  ৳{totalDeliveryCharge70.toLocaleString()}
                </div>
                <div className="text-[11px] text-amber-900/80 font-semibold leading-snug">
                  {successfulOrdersList.length}টি সফল অর্ডার × ৳৭০ · ডেলিভার্ড: {deliveredOrders}টি (৳{deliveredDeliveryCharge70.toLocaleString()})
                </div>
              </div>

              <div className="p-5 bg-emerald-50/60 rounded-3xl border border-emerald-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                    Normal Delivery Fee
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-700 shrink-0" />
                </div>
                <div className="text-2xl font-black text-emerald-900 tabular-nums">
                  ৳{totalNormalDeliveryFee.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-800 font-semibold leading-snug">
                  ঢাকা ফ্রি (৳০): {dhakaFreeOrdersCount}টি · ৳৫০ জোন: {paidDeliveryOrdersCount}টি
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-[#E5E1D5] shadow-2xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Catalog Products
                </span>
                <div className="text-2xl font-black text-[#14221C] tabular-nums">
                  {products.length}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold">
                  {products.filter(p => !p.isArchived).length} Live · {products.filter(p => p.isArchived).length} Archived
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-[#E5E1D5] shadow-2xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Low-Stock Alerts
                </span>
                <div className={`text-2xl font-black tabular-nums ${lowStockProducts.length > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {lowStockProducts.length}
                </div>
                <div className="text-[11px] text-[#202522]/60">
                  Garments &lt; 25 units
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-[#E5E1D5] shadow-2xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Customer Accounts
                </span>
                <div className="text-2xl font-black text-emerald-800 tabular-nums">
                  {customers.length}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium">
                  Verified BD profiles
                </div>
              </div>
            </div>

            {/* ALL-TIME CUSTOMER ORDER SHEET (1, 2, 3... SERIAL LEDGER) */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E1D5]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#14221C] text-[#FF762E] flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                        Customer Order &amp; Delivery Sheet (অল-টাইম শিট)
                      </h3>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-full text-[10px] font-extrabold">
                        মোট {allTimeOrderSheetRows.length}টি অর্ডার স্থায়ীভাবে সেভড
                      </span>
                    </div>
                    <p className="text-xs text-[#202522]/65 mt-0.5">
                      কেউ অর্ডার করলে স্বয়ংক্রিয়ভাবে ১, ২, ৩... ক্রমিক নম্বর, মোবাইল নাম্বার, ঠিকানা, পণ্যের ডিটেইলস, নরমাল ফি ও ৳৭০ ডেলিভারি চার্জসহ স্থায়ীভাবে সেভ হয়।
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderSheetSort((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="px-3 py-2 bg-[#F7F5EF] hover:bg-stone-200 border border-[#E5E1D5] text-[#14221C] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {orderSheetSort === 'asc' ? 'ক্রম: ১ → ' + allTimeOrderSheetRows.length : 'ক্রম: নতুন আগে'}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportOrderSheetCSV}
                    className="px-3.5 py-2 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#FF762E]" />
                    <span>Sheet CSV ডাউনলোড</span>
                  </button>
                </div>
              </div>

              {/* Sheet Search & Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8 relative">
                  <Search className="w-4 h-4 text-[#202522]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="সিরিয়াল নং (1, 2, 3), কাস্টমারের নাম, মোবাইল নাম্বার, অর্ডার নং বা ঠিকানা দিয়ে খুঁজুন..."
                    value={orderSheetSearch}
                    onChange={(e) => setOrderSheetSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <select
                    value={orderSheetFilter}
                    onChange={(e) => setOrderSheetFilter(e.target.value as 'all' | 'successful')}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs font-bold text-[#14221C] cursor-pointer focus:outline-none focus:border-[#FF762E]"
                  >
                    <option value="all">সব অর্ডার শিট ({allTimeOrderSheetRows.length})</option>
                    <option value="successful">শুধু সফল অর্ডার ৳৭০ চার্জ ({successfulOrdersList.length})</option>
                  </select>
                </div>
              </div>

              {/* Spreadsheet Table */}
              <div className="overflow-x-auto border border-[#E5E1D5] rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#14221C] text-white uppercase text-[10px] tracking-wider">
                    <tr className="divide-x divide-white/15">
                      <th className="px-3 py-3 text-center w-14">নং</th>
                      <th className="px-3 py-3 whitespace-nowrap">অর্ডার ও তারিখ</th>
                      <th className="px-3 py-3 whitespace-nowrap">কাস্টমার ও মোবাইল নাম্বার</th>
                      <th className="px-3 py-3 min-w-[200px]">বিস্তারিত ঠিকানা</th>
                      <th className="px-3 py-3 min-w-[220px]">পণ্যের ডিটেইলস</th>
                      <th className="px-3 py-3 text-right whitespace-nowrap">নরমাল ফি</th>
                      <th className="px-3 py-3 text-right whitespace-nowrap">ডেলিভারি চার্জ (৳৭০)</th>
                      <th className="px-3 py-3 text-right whitespace-nowrap">মোট বিল</th>
                      <th className="px-3 py-3 whitespace-nowrap">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D5] bg-white">
                    {filteredOrderSheetRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-xs text-[#202522]/60">
                          কোনো অর্ডার পাওয়া যায়নি। নতুন কোনো কাস্টমার অর্ডার করলে এখানে ১, ২, ৩ সিরিয়াল অনুযায়ী সেভ হবে।
                        </td>
                      </tr>
                    ) : (
                      filteredOrderSheetRows.map((row, rowIdx) => {
                        const o = row.order;
                        return (
                          <tr
                            key={o.id}
                            className={`divide-x divide-[#E5E1D5] transition-colors hover:bg-amber-50/40 ${
                              rowIdx % 2 === 1 ? 'bg-[#F7F5EF]/45' : 'bg-white'
                            }`}
                          >
                            <td className="px-3 py-3 text-center font-black text-[#14221C] tabular-nums bg-[#F7F5EF]/70">
                              {row.serialNo}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-[#14221C] block">
                                {o.orderNumber}
                              </span>
                              <span className="text-[10px] text-[#202522]/60">
                                {new Date(o.createdAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: '2-digit'
                                })}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-bold text-[#14221C]">{o.customer.fullName}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <a
                                  href={`tel:${o.customer.phone}`}
                                  className="font-mono text-[11px] font-bold text-emerald-800 hover:underline"
                                >
                                  {o.customer.phone}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(o.customer.phone);
                                    setCopiedSheetPhone(o.id);
                                    setTimeout(() => setCopiedSheetPhone(null), 1500);
                                  }}
                                  className="p-1 text-stone-400 hover:text-[#14221C] rounded cursor-pointer"
                                  title="Copy Phone Number"
                                >
                                  {copiedSheetPhone === o.id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-[11px] text-[#202522]/85 leading-snug">
                              <span className="font-bold text-[#14221C]">{o.customer.district}</span>
                              {o.customer.upazila ? ` · ${o.customer.upazila}` : ''}
                              <span className="block text-[#202522]/70 mt-0.5">
                                {o.customer.streetAddress}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[11px] text-[#14221C] space-y-1">
                              {o.items.map((it, itemIdx) => (
                                <div key={`${o.id}-${itemIdx}`} className="leading-snug">
                                  <span className="font-semibold">{it.name}</span>
                                  <span className="text-[#202522]/70">
                                    {' '}
                                    ({[it.size, it.color].filter(Boolean).join('/')}) ×{it.quantity}
                                  </span>
                                </div>
                              ))}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                              {row.normalDeliveryFee === 0 ? (
                                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                  ৳০ (ফ্রি)
                                </span>
                              ) : (
                                <span className="font-bold text-[#14221C]">
                                  ৳{row.normalDeliveryFee.toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                              {row.isSuccessful ? (
                                <span className="font-extrabold text-[#FF762E]">
                                  ৳{row.deliveryCharge70}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-stone-400">
                                  ৳০ ({o.orderStatus})
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                              <span className="font-black text-[#14221C] block">
                                ৳{o.total.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-[#202522]/60">
                                {o.paymentMethod === 'Cash on Delivery (COD)' ? 'COD' : o.paymentMethod}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    row.isSuccessful
                                      ? o.orderStatus === 'Delivered'
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-[#14221C] text-white'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {o.orderStatus}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectingOrder(o);
                                    setTrackingInput(o.trackingNumber || '');
                                  }}
                                  className="px-2 py-0.5 bg-[#F7F5EF] hover:bg-stone-200 border border-[#E5E1D5] text-[#14221C] text-[10px] font-bold rounded cursor-pointer"
                                >
                                  দেখুন
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredOrderSheetRows.length > 0 && (
                    <tfoot className="bg-[#F7F5EF] border-t-2 border-[#14221C]/20 font-bold text-xs text-[#14221C]">
                      <tr className="divide-x divide-[#E5E1D5]">
                        <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-wider text-[11px]">
                          মোট শিট হিসাব ({filteredOrderSheetRows.length}টি অর্ডার):
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-900">
                          ৳{filteredOrderSheetRows.reduce((s, r) => s + (r.isSuccessful ? r.normalDeliveryFee : 0), 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[#FF762E]">
                          ৳{filteredOrderSheetRows.reduce((s, r) => s + r.deliveryCharge70, 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-black">
                          ৳{filteredOrderSheetRows.reduce((s, r) => s + (r.isSuccessful ? r.order.total : 0), 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-[#202522]/60">
                          সফল অর্ডার: {filteredOrderSheetRows.filter((r) => r.isSuccessful).length}টি
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Split: Top Selling Products & Low Stock Warnings */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Top Selling Products */}
              <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D5]">
                  <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                    Top-Selling Products
                  </h3>
                  <span className="text-xs text-[#FF762E] font-bold">VANTREL Bestsellers</span>
                </div>

                <div className="space-y-3">
                  {topSellingProducts.map((p, idx) => (
                    <div key={p.id} className="p-3 bg-[#F7F5EF] rounded-2xl flex items-center justify-between gap-3 border border-[#E5E1D5]">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#14221C] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <img
                          src={p.images[0]}
                          alt={buildSeoImageAlt({ name: p.name, category: p.category, brand: p.brand })}
                          className="w-10 h-12 object-cover rounded-lg bg-white shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-xs text-[#14221C] truncate max-w-xs">{p.name}</h4>
                          <p className="text-[11px] text-[#202522]/60">
                            Category: {p.category} · Rating: {p.rating}★
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm text-[#14221C] tabular-nums">
                          ৳{(p.discountPrice || p.regularPrice).toLocaleString()}
                        </span>
                        <span className="block text-[10px] text-emerald-700 font-semibold">
                          {p.totalStock} in stock
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Stock Alerts */}
              <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D5]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                    <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                      Low-Stock Alerts
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-rose-600">Action Needed</span>
                </div>

                {lowStockProducts.length === 0 ? (
                  <p className="text-xs text-emerald-700 py-4 font-semibold">
                    All inventory levels healthy. No garments below replenishment threshold.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lowStockProducts.map((p) => (
                      <div key={p.id} className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-[#14221C] truncate max-w-[180px]">{p.name}</div>
                          <div className="text-[11px] text-rose-700 font-semibold">
                            {p.totalStock <= 0 ? 'OUT OF STOCK (0 units)!' : `Only ${p.totalStock} units remaining!`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            updateProduct(p.id, { totalStock: p.totalStock + 20 });
                            showToast('Restocked', `Added 20 units to ${p.name}`, 'success');
                          }}
                          className="px-3 py-1.5 bg-[#14221C] text-white text-[11px] font-bold rounded-lg uppercase hover:bg-[#202522] cursor-pointer"
                        >
                          +20 Restock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Orders Overview */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D5]">
                <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                  Recent Orders Summary
                </h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold uppercase tracking-wider text-[#FF762E] hover:underline"
                >
                  View All Orders
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F5EF] text-[#202522]/80 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">District</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D5]">
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-[#14221C]">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#14221C]">
                          {order.customer.fullName}
                          <span className="block text-[11px] font-normal text-[#202522]/50">
                            {order.customer.phone}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#202522]/70">
                          {order.customer.district}
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums text-[#14221C]">
                          ৳{order.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold text-[#14221C]">
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#14221C] text-white">
                            {order.orderStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setInspectingOrder(order);
                              setTrackingInput(order.trackingNumber || '');
                            }}
                            className="px-3 py-1 bg-[#F7F5EF] hover:bg-stone-200 text-[#14221C] text-xs font-semibold rounded-lg border border-[#E5E1D5]"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCT MANAGEMENT (CRUD) */}
        {activeTab === 'products' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                  Product Catalog Management ({filteredProducts.length} of {products.length})
                </h3>
                <p className="text-xs text-[#202522]/60 mt-0.5">
                  Complete CRUD, inventory tracking, GSM specs, cost margin calculations, bulk operations, and CSV exports.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {products.length > 0 && (
                  confirmDeleteAllProducts ? (
                    <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1.5 rounded-xl">
                      <span className="text-[11px] font-bold text-rose-800">সব {products.length}টি ডিলিট করবেন?</span>
                      <button
                        onClick={() => {
                          deleteAllProducts();
                          setConfirmDeleteAllProducts(false);
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        হ্যাঁ, ডিলিট করুন
                      </button>
                      <button
                        onClick={() => setConfirmDeleteAllProducts(false)}
                        className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-300 text-[#14221C] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        না
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteAllProducts(true)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Delete All Products from catalog"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>সব প্রোডাক্ট ডিলিট করুন</span>
                    </button>
                  )
                )}

                <button
                  onClick={() => void handleDownloadCatalogImagesZip(filteredProducts)}
                  disabled={isDownloadingImages || filteredProducts.length === 0}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-[#E5E1D5] text-[#14221C] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                  title="Download filtered product images as vantrel-outfit-images.zip"
                >
                  <Download className="w-3.5 h-3.5 text-[#FF762E]" />
                  <span>{isDownloadingImages ? 'Zipping...' : 'Images (.ZIP)'}</span>
                </button>

                <button
                  onClick={handleExportProductsCSV}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-[#E5E1D5] text-[#14221C] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={handleOpenCreateProduct}
                  className="px-4 py-2 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 shadow-md whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>প্রোডাক্ট অ্যাড করুন</span>
                </button>
              </div>
            </div>

            {/* Firebase Live Cloud Protection Banner */}
            <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-emerald-950">
                  Firebase Cloud Firestore & Server Storage সক্রিয়:
                </span>
                <span className="text-emerald-800 hidden sm:inline">
                  অ্যাড, এডিট বা ডিলিট করা সমস্ত প্রোডাক্ট রিয়েল-টাইমে ক্লাউড ও সার্ভার ডিস্কে সেভ হয় এবং সব ডিভাইসে তাৎক্ষণিক লাইভ আপডেট হয়ে যায়।
                </span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase shrink-0">
                Live Synced
              </span>
            </div>

            {/* Homepage Top Products Quick Control Banner */}
            <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100/70 border border-amber-300 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-400 text-neutral-950 rounded-lg shadow-2xs">
                    <Star className="w-4 h-4 fill-current" />
                  </span>
                  <div>
                    <h4 className="font-heading font-extrabold text-sm text-[#14221C]">
                      হোমপেজ টপ / পপুলার প্রোডাক্টস কন্ট্রোল
                    </h4>
                    <p className="text-[11px] text-[#202522]/70">
                      স্টোরের যে যে প্রোডাক্টে <span className="font-bold text-amber-950">⭐ Top Product</span> মার্ক করবেন, সেগুলো সরাসরি হোমপেজের টপ/পপুলার সেকশনে প্রদর্শিত হবে।
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 bg-amber-200/80 text-amber-950 text-xs font-black rounded-lg border border-amber-400">
                    {products.filter((p) => p.isTopProduct && !p.isArchived && p.status !== 'archived').length}টি প্রোডাক্ট হোমপেজে লাইভ
                  </span>
                  <button
                    type="button"
                    onClick={() => setProductStatusFilter(productStatusFilter === 'top' ? 'All' : 'top')}
                    className="px-3 py-1 bg-[#14221C] text-white hover:bg-neutral-800 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    {productStatusFilter === 'top' ? 'সব প্রোডাক্ট দেখুন' : 'শুধু টপ প্রোডাক্টস দেখুন'}
                  </button>
                </div>
              </div>

              {/* Quick Top Product Preview Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/70">
                <span className="text-[11px] font-bold text-amber-900 shrink-0">বর্তমানে নির্বাচিত টপ প্রোডাক্টস:</span>
                {products
                  .filter((p) => p.isTopProduct && !p.isArchived && p.status !== 'archived')
                  .map((tp) => (
                    <div
                      key={tp.id}
                      className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/90 border border-amber-300 rounded-xl shadow-2xs text-xs text-[#14221C]"
                    >
                      {tp.images?.[0] ? (
                        <img
                          src={toDisplayImageUrl(tp.images[0])}
                          alt={buildSeoImageAlt({ name: tp.name, category: tp.category, brand: tp.brand })}
                          className="w-5 h-5 rounded object-cover bg-stone-100 shrink-0"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-stone-400 shrink-0" />
                      )}
                      <span className="font-bold truncate max-w-[140px] sm:max-w-[180px]">
                        {tp.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleTopProduct(tp.id)}
                        className="p-0.5 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                        title="টপ প্রোডাক্ট থেকে বাদ দিন"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                {products.filter((p) => p.isTopProduct && !p.isArchived && p.status !== 'archived').length === 0 && (
                  <span className="text-xs text-amber-800 italic">
                    কোনো প্রোডাক্ট টপ হিসেবে মার্ক করা নেই। নিচের টেবিল থেকে ⭐ আইকনে ক্লিক করে যেকোনো প্রোডাক্টকে টপ করুন।
                  </span>
                )}
              </div>
            </div>

            {/* Out-of-Stock Global Visibility & Order-Block Control Banner */}
            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="p-1.5 bg-rose-600 text-white rounded-lg shadow-2xs shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-heading font-extrabold text-sm text-[#14221C]">
                      Out of Stock (স্টক শেষ) গ্লোবাল কন্ট্রোল
                    </h4>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-extrabold rounded-full border border-rose-300">
                      {products.filter((p) => !p.isArchived && p.status !== 'archived' && isProductOutOfStock(p)).length}টি Out of Stock
                    </span>
                  </div>
                  <p className="text-[11px] text-[#202522]/75 mt-0.5">
                    কোনো প্রোডাক্টের Stock 0 হলে ডিফল্টভাবে ওয়েবসাইটে কীভাবে দেখাবে তা এখান থেকে সেট করুন (প্রতিটি প্রোডাক্টে আলাদাভাবে Hide / Show সেট করাও যাবে)।
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ outOfStockDefaultBehavior: 'show' });
                    showToast('Out of Stock নিয়ম আপডেট', 'স্টক শেষ হলে প্রোডাক্টে "Out of Stock" লেখা দেখাবে এবং অর্ডার বন্ধ থাকবে।', 'info');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    (settings.outOfStockDefaultBehavior || 'show') === 'show'
                      ? 'bg-[#14221C] text-white border-[#14221C] shadow-xs'
                      : 'bg-white text-[#14221C] border-[#E5E1D5] hover:bg-stone-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show + অর্ডার বন্ধ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ outOfStockDefaultBehavior: 'hide' });
                    showToast('Out of Stock নিয়ম আপডেট', 'স্টক শেষ হলে প্রোডাক্টটি ওয়েবসাইট থেকে অটো হাইড (Hide) হয়ে যাবে।', 'info');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    settings.outOfStockDefaultBehavior === 'hide'
                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                      : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Auto Hide (লুকান)</span>
                </button>
              </div>
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E5E1D5] pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setProductStatusFilter('All')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  productStatusFilter === 'All'
                    ? 'bg-[#14221C] text-white shadow-xs'
                    : 'bg-[#F7F5EF] text-[#202522]/70 hover:bg-stone-200'
                }`}
              >
                <span>সবগুলো প্রোডাক্ট</span>
                <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-black/20">
                  {products.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProductStatusFilter('top')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  productStatusFilter === 'top'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs ring-1 ring-amber-600'
                    : 'bg-amber-100/70 text-amber-950 hover:bg-amber-200'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                <span>⭐ হোমপেজ টপ প্রোডাক্টস</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950">
                  {products.filter((p) => p.isTopProduct && !p.isArchived && p.status !== 'archived').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProductStatusFilter('published')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  productStatusFilter === 'published'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-[#F7F5EF] text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span>পাবলিক / সক্রিয়</span>
                <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900">
                  {activeProducts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProductStatusFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  productStatusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Out of Stock (স্টক শেষ)</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-900">
                  {products.filter((p) => !p.isArchived && p.status !== 'archived' && isProductOutOfStock(p)).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProductStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  productStatusFilter === 'archived'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-[#F7F5EF] text-rose-800 hover:bg-rose-100'
                }`}
              >
                <span>লুকানো / ডিলিট করা (Trash)</span>
                <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-900">
                  {archivedProducts.length}
                </span>
              </button>
            </div>

            {/* Search & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5 relative">
                <Search className="w-4 h-4 text-[#202522]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="পোশাকের নাম, SKU, বা ক্যাটাগরি দিয়ে খুঁজুন..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs text-[#14221C]"
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-semibold text-[#14221C]"
                >
                  <option value="All">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-semibold text-[#14221C]"
                >
                  <option value="All">All Statuses</option>
                  <option value="top">⭐ Top Products Only (টপ প্রোডাক্টস)</option>
                  <option value="published">Published Only</option>
                  <option value="out_of_stock">Out of Stock Only (স্টক শেষ)</option>
                  <option value="draft">Drafts Only</option>
                  <option value="archived">Archived Only</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedProductIds.length > 0 && (
              <div className="p-3 bg-[#14221C] text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-semibold">
                  {selectedProductIds.length} garment(s) selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleBulkPublish}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Publish
                  </button>
                  <button
                    onClick={() => {
                      selectedProductIds.forEach((id) => {
                        const target = products.find((p) => p.id === id);
                        if (target) {
                          updateProduct(id, {
                            totalStock: 0,
                            variants: (target.variants || []).map((v) => ({ ...v, stock: 0 }))
                          });
                        }
                      });
                      showToast('Out of Stock', `${selectedProductIds.length}টি প্রোডাক্ট Out of Stock করা হয়েছে।`, 'info');
                      setSelectedProductIds([]);
                    }}
                    className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Mark Out of Stock (0)
                  </button>
                  <button
                    onClick={() => {
                      selectedProductIds.forEach((id) => {
                        const target = products.find((p) => p.id === id);
                        if (target && !target.isTopProduct) toggleTopProduct(id);
                      });
                      setSelectedProductIds([]);
                    }}
                    className="px-3 py-1 bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-lg font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="নির্বাচিত সব প্রোডাক্টকে হোমপেজ টপ প্রোডাক্ট করুন"
                  >
                    <Star className="w-3 h-3 fill-current" />
                    <span>⭐ Mark Top</span>
                  </button>
                  <button
                    onClick={() => void handleDownloadCatalogImagesZip(products.filter((p) => selectedProductIds.includes(p.id)))}
                    disabled={isDownloadingImages}
                    className="px-3 py-1 bg-[#FF762E] hover:bg-[#e8631c] text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Download selected product images as vantrel-outfit-images.zip"
                  >
                    <Download className="w-3 h-3" />
                    <span>{isDownloadingImages ? 'Zipping...' : 'Download Images (.ZIP)'}</span>
                  </button>
                  <button
                    onClick={handleBulkArchive}
                    className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Archive
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={() => setSelectedProductIds([])}
                    className="text-white/60 hover:text-white px-2 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds(filteredProducts.map((p) => p.id));
                          } else {
                            setSelectedProductIds([]);
                          }
                        }}
                        className="rounded border-[#E5E1D5]"
                      />
                    </th>
                    <th className="px-2 py-3 text-center w-24">Order / ক্রম</th>
                    <th className="px-4 py-3">Garment Piece</th>
                    <th className="px-4 py-3">Category & Sub</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Price & Margin</th>
                    <th className="px-4 py-3">Stock & Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D5]">
                  {filteredProducts.map((p, idx) => {
                    const price = p.discountPrice || p.regularPrice;
                    const cost = p.costPrice || Math.round(p.regularPrice * 0.45);
                    const margin = Math.round(((price - cost) / price) * 100);
                    const isSelected = selectedProductIds.includes(p.id);

                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-amber-50/50' : ''} ${p.isPinned ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                              } else {
                                setSelectedProductIds([...selectedProductIds, p.id]);
                              }
                            }}
                            className="rounded border-[#E5E1D5]"
                          />
                        </td>
                        {/* Reorder and Pin Controls */}
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => pinProductToTop(p.id)}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                p.isPinned
                                  ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs ring-1 ring-amber-600'
                                  : 'bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-700'
                              }`}
                              title={p.isPinned ? 'Unpin from top' : '📌 সবার উপরে পিন করুন (Pin to Top)'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono text-[10px] font-bold text-stone-500 w-5 text-center">
                              #{idx + 1}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  if (productCategoryFilter !== 'All') {
                                    moveProductInCategory(p.id, productCategoryFilter, 'up');
                                  } else {
                                    moveProductUp(p.id);
                                  }
                                }}
                                className="p-0.5 hover:bg-stone-200 text-stone-600 disabled:opacity-20 rounded cursor-pointer disabled:cursor-not-allowed"
                                title="উপরে নিন (Move Up)"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === filteredProducts.length - 1}
                                onClick={() => {
                                  if (productCategoryFilter !== 'All') {
                                    moveProductInCategory(p.id, productCategoryFilter, 'down');
                                  } else {
                                    moveProductDown(p.id);
                                  }
                                }}
                                className="p-0.5 hover:bg-stone-200 text-stone-600 disabled:opacity-20 rounded cursor-pointer disabled:cursor-not-allowed"
                                title="নিচে নিন (Move Down)"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                if (productCategoryFilter !== 'All') {
                                  moveProductInCategory(p.id, productCategoryFilter, 'top');
                                } else {
                                  moveProductToTop(p.id);
                                }
                              }}
                              className="p-1 hover:bg-amber-100 text-stone-400 hover:text-amber-800 rounded disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                              title="সবার উপরে নিন (Move to #1 / Top)"
                            >
                              <span className="text-[10px] font-black">🔝</span>
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-0.5">
                            {p.isPinned && (
                              <span className="text-[8px] font-extrabold text-amber-800 bg-amber-100 px-1 py-0.2 rounded uppercase tracking-wider">
                                Pinned
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleTopProduct(p.id)}
                              className={`text-[8px] font-extrabold px-1 py-0.2 rounded uppercase tracking-wider flex items-center gap-0.5 cursor-pointer transition-colors ${
                                p.isTopProduct
                                  ? 'text-amber-950 bg-amber-300 hover:bg-amber-400 shadow-2xs'
                                  : 'text-stone-400 bg-stone-100 hover:bg-stone-200'
                              }`}
                              title={p.isTopProduct ? 'হোমপেজ টপ প্রোডাক্ট থেকে বাদ দিন' : '⭐ হোমপেজ টপ টেন / পপুলারে যুক্ত করুন'}
                            >
                              <Star className={`w-2 h-2 ${p.isTopProduct ? 'fill-current' : ''}`} />
                              <span>{p.isTopProduct ? 'Top' : '+Top'}</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#14221C] flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img
                              src={toDisplayImageUrl(p.images[0])}
                              alt={buildSeoImageAlt({ name: p.name, category: p.category, brand: p.brand })}
                              className="w-10 h-12 object-cover rounded bg-stone-100 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-12 rounded bg-stone-100 border border-[#E5E1D5] flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-stone-400" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              {p.isTopProduct && (
                                <span className="px-1.5 py-0.2 bg-amber-400 text-neutral-950 text-[9px] font-extrabold rounded flex items-center gap-0.5 shadow-2xs" title="হোমপেজ টপ প্রোডাক্ট">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  <span>TOP</span>
                                </span>
                              )}
                              {resolveProductGsmLabel(p) && (
                                <span className="px-1.5 py-0.2 bg-[#14221C] text-[#FF762E] text-[9px] font-bold rounded">
                                  {resolveProductGsmLabel(p)}
                                </span>
                              )}
                            </div>
                            <span className="block text-[11px] font-normal text-[#202522]/60">
                              {resolveProductFabricLabel(p).slice(0, 32)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#202522]/70">
                          <span className="font-semibold text-[#14221C]">{p.category}</span>
                          <span className="block text-[10px] text-[#202522]/50">{p.subCategory}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">{p.sku}</td>
                        <td className="px-4 py-3 tabular-nums">
                          <div className="font-bold text-[#14221C]">
                            ৳{price.toLocaleString()}
                            {p.discountPrice && (
                              <span className="text-[10px] text-[#FF762E] ml-1">
                                (-{p.discountPercent}%)
                              </span>
                            )}
                          </div>
                          <span className="block text-[10px] text-emerald-700 font-medium">
                            Cost: ৳{cost} · {margin}% margin
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isProductOutOfStock(p) ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                                OUT OF STOCK (0)
                              </span>
                              {(() => {
                                const resolvedOos = resolveOutOfStockBehavior(p, settings.outOfStockDefaultBehavior);
                                const nextOos = resolvedOos === 'hide' ? 'show' : 'hide';
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateProduct(p.id, { outOfStockBehavior: nextOos });
                                      showToast(
                                        nextOos === 'hide' ? 'Store থেকে Hide করা হয়েছে' : 'Out of Stock হিসেবে দেখাবে',
                                        nextOos === 'hide'
                                          ? `${p.name} এখন কাস্টমারদের কাছে লুকানো থাকবে।`
                                          : `${p.name} ওয়েবসাইটে "Out of Stock" লেখা সহ দেখাবে কিন্তু অর্ডার বন্ধ থাকবে।`,
                                        'info'
                                      );
                                    }}
                                    className={`block px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                      resolvedOos === 'hide'
                                        ? 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                                        : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                    }`}
                                    title="ক্লিক করে Out of Stock হলে Hide নাকি Show (অর্ডার বন্ধ) হবে তা পরিবর্তন করুন"
                                  >
                                    {resolvedOos === 'hide' ? '🙈 Store-এ Hide' : '👁️ দেখাবে (অর্ডার বন্ধ)'}
                                  </button>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span
                                className={`font-bold tabular-nums block ${
                                  p.totalStock < 25 ? 'text-rose-600' : 'text-emerald-700'
                                }`}
                              >
                                {p.totalStock} units
                              </span>
                              <div className="flex flex-wrap items-center gap-1">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    p.isArchived
                                      ? 'bg-stone-200 text-stone-700'
                                      : p.status === 'draft'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {p.isArchived ? 'Archived' : p.status || 'Published'}
                                </span>
                                {p.outOfStockBehavior && p.outOfStockBehavior !== 'default' && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                                    {p.outOfStockBehavior === 'hide' ? 'OOS: Hide' : 'OOS: Show'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          {!p.isArchived && p.status !== 'archived' && (
                            isProductOutOfStock(p) ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateProduct(p.id, {
                                      totalStock: 20,
                                      variants: (p.variants || []).map((v, vIdx) => ({
                                        ...v,
                                        stock: Math.max(1, Math.floor(20 / Math.max(1, p.variants.length))) + (vIdx === 0 ? 20 % Math.max(1, p.variants.length) : 0)
                                      }))
                                    });
                                    showToast('Restocked', `${p.name}-এ +20 স্টক যুক্ত হয়েছে।`, 'success');
                                  }}
                                  className="px-2 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                                  title="+20 Stock যোগ করুন"
                                >
                                  +20 Stock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentMode = resolveOutOfStockBehavior(p, settings.outOfStockDefaultBehavior);
                                    const nextMode = currentMode === 'hide' ? 'show' : 'hide';
                                    updateProduct(p.id, { outOfStockBehavior: nextMode });
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isProductHiddenByOutOfStock(p, settings.outOfStockDefaultBehavior)
                                      ? 'text-stone-700 bg-stone-200 hover:bg-stone-300'
                                      : 'text-amber-800 bg-amber-100 hover:bg-amber-200'
                                  }`}
                                  title={
                                    isProductHiddenByOutOfStock(p, settings.outOfStockDefaultBehavior)
                                      ? 'বর্তমানে Hide আছে — ক্লিক করলে "Out of Stock" হিসেবে দেখাবে (অর্ডার বন্ধ)'
                                      : 'বর্তমানে Show হচ্ছে — ক্লিক করলে Store থেকে Hide হবে'
                                  }
                                >
                                  {isProductHiddenByOutOfStock(p, settings.outOfStockDefaultBehavior) ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  updateProduct(p.id, {
                                    totalStock: 0,
                                    variants: (p.variants || []).map((v) => ({ ...v, stock: 0 }))
                                  });
                                  showToast('Out of Stock', `${p.name} এখন Out of Stock (Stock = 0) করা হয়েছে।`, 'info');
                                }}
                                className="px-2 py-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                                title="এক ক্লিকে Stock 0 (Out of Stock) করুন"
                              >
                                Stock 0
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => toggleTopProduct(p.id)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              p.isTopProduct
                                ? 'text-amber-950 bg-amber-400 hover:bg-amber-500 ring-2 ring-amber-500 shadow-xs'
                                : 'text-stone-500 hover:text-amber-600 bg-[#F7F5EF]'
                            }`}
                            title={p.isTopProduct ? 'হোমপেজ টপ প্রোডাক্ট থেকে বাদ দিন (Remove from Top)' : '⭐ হোমপেজ টপ প্রোডাক্ট করুন (Mark as Top Product)'}
                          >
                            <Star className={`w-3.5 h-3.5 ${p.isTopProduct ? 'fill-amber-950 text-amber-950' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => pinProductToTop(p.id)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              p.isPinned
                                ? 'text-amber-800 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-400'
                                : 'text-stone-600 hover:text-amber-700 bg-[#F7F5EF]'
                            }`}
                            title={p.isPinned ? 'Unpin' : '📌 সবার উপরে পিন করুন (Pin to Top)'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => duplicateProduct(p.id)}
                            className="p-1.5 text-stone-600 hover:text-[#14221C] bg-[#F7F5EF] rounded-lg cursor-pointer"
                            title="Duplicate Product"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditProduct(p)}
                            className="p-1.5 text-stone-600 hover:text-[#14221C] bg-[#F7F5EF] rounded-lg cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {p.isArchived || p.status === 'archived' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => restoreProduct(p.id)}
                                className="px-2 py-1 text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-bold text-[10px]"
                                title="পুনরায় পাবলিক ওয়েবসাইটে ফিরিয়ে আনুন (Restore)"
                              >
                                <RotateCcw className="w-3 h-3 text-emerald-700" />
                                <span>পুনরায় লাইভ করুন</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  permanentlyDeleteProduct(p.id);
                                }}
                                className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                title="স্থায়ীভাবে মুছে ফেলুন (Delete Forever)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => deleteProduct(p.id)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              title="পাবলিক থেকে ডিলিট/লুকিয়ে রাখুন (Hide from Public Store & Save in Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2.5: CATEGORY MANAGEMENT & REORDERING STUDIO */}
        {activeTab === 'categories' && (
          <div className="space-y-8">
            {/* 1. Category Ordering Section */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-[#E5E1D5]">
                <div>
                  <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight flex items-center gap-2">
                    <Tag className="w-5 h-5 text-[#FF762E]" />
                    <span>ক্যাটাগরি সাজান ও কন্ট্রোল প্যানেল ({categories.length}টি ক্যাটাগরি)</span>
                  </h3>
                  <p className="text-xs text-[#202522]/70 mt-1 max-w-2xl">
                    ক্যাটাগরিগুলোকে সামনে-পিছনে সাজাতে নিচের <span className="font-bold text-[#14221C]">⬅️ সামনে নিন</span> ও <span className="font-bold text-[#14221C]">➡️ পিছনে নিন</span> বাটন ব্যবহার করুন। যেমন: টি-শার্টের আগে হুডি, কিংবা প্যান্টকে আগে নিতে পারেন। এখানে যেভাবে সাজাবেন, হোমপেজের ৪টি ক্যাটাগরি কার্ড এবং শপ পেজে হুবহু সেই ক্রমে দেখতে পাবেন।
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 bg-[#F7F5EF] px-3 py-1.5 rounded-xl border border-[#E5E1D5] shrink-0">
                  <span>মোট প্রোডাক্ট:</span>
                  <span className="font-black text-[#14221C]">{products.length}টি</span>
                </div>
              </div>

              {/* Create Category Input Card */}
              <div className="p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#14221C]">
                  নতুন ক্যাটাগরি তৈরি করুন
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCategoryInput.trim()) {
                      showToast('ভ্যালিডেশন এরর', 'ক্যাটাগরির নাম লিখুন', 'error');
                      return;
                    }
                    addCategory(newCategoryInput.trim());
                    setNewCategoryInput('');
                  }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-[#202522]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="যেমন: টি-শার্ট, ড্রপ শোল্ডার, হুডি, ফরমাল প্যান্ট, প্রিমিয়াম জ্যাকেট..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E1D5] rounded-xl text-xs font-medium text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ক্যাটাগরি যুক্ত করুন</span>
                  </button>
                </form>
              </div>

              {/* Categories Reordering Cards Grid */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#14221C]">
                      সক্রিয় ক্যাটাগরি তালিকা (ক্রম অনুযায়ী সাজানো)
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      ১, ২, ৩... ক্রমানুসারে আপনার ওয়েবসাইটে ক্যাটাগরিগুলো প্রদর্শিত হবে। একাধিক ডিলিট করতে কার্ডে টিক দিন।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedDeleteCategories.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            deleteCategories(selectedDeleteCategories);
                            if (selectedDeleteCategories.includes(catProductSortCategory)) {
                              setCatProductSortCategory('All');
                            }
                            setSelectedDeleteCategories([]);
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>সিলেক্ট করা ({selectedDeleteCategories.length}টি) মুছুন</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDeleteCategories([])}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          বাতিল
                        </button>
                      </>
                    )}
                    <span className="text-[10px] bg-stone-100 text-stone-700 font-bold px-2 py-1 rounded-md">
                      বাটন দিয়ে আগে-পিছে নিন
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {categories.map((cat, idx) => {
                    const prodCount = cat === 'All'
                      ? products.length
                      : products.filter(p => p.category.toLowerCase() === cat.toLowerCase()).length;
                    const isAll = cat === 'All';
                    const isFirstMovable = !isAll && (idx === 1 || (categories[0] !== 'All' && idx === 0));
                    const isLastMovable = !isAll && idx === categories.length - 1;
                    const isSelectedForDelete = !isAll && selectedDeleteCategories.includes(cat);

                    return (
                      <div
                        key={cat}
                        className={`p-4 bg-white rounded-2xl border transition-all shadow-2xs flex flex-col justify-between space-y-3.5 ${
                          isAll
                            ? 'border-neutral-300 bg-stone-50/60'
                            : isSelectedForDelete
                            ? 'border-rose-500 ring-1 ring-rose-400 bg-rose-50/30'
                            : 'border-[#E5E1D5] hover:border-[#14221C]'
                        }`}
                      >
                        {/* Header & Position Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {!isAll && (
                              <input
                                type="checkbox"
                                checked={isSelectedForDelete}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDeleteCategories((prev) => [...prev, cat]);
                                  } else {
                                    setSelectedDeleteCategories((prev) => prev.filter((item) => item !== cat));
                                  }
                                }}
                                className="w-4 h-4 accent-rose-600 rounded cursor-pointer shrink-0"
                                aria-label={`Select ${cat} for deletion`}
                                title="একাধিক ডিলিটের জন্য সিলেক্ট করুন"
                              />
                            )}
                            <span className="w-6 h-6 rounded-lg bg-[#14221C] text-white font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-heading text-sm font-bold text-[#14221C]">
                                {cat}
                              </div>
                              <div className="text-[11px] text-[#202522]/60 mt-0.5">
                                {prodCount}টি প্রোডাক্ট যুক্ত আছে
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isAll ? 'bg-[#14221C] text-white' : 'bg-[#FF762E]/15 text-[#FF762E]'
                          }`}>
                            {isAll ? 'সিস্টেম' : `#${idx + 1}`}
                          </span>
                        </div>

                        {/* Reorder Buttons (Move Forward / Move Backward / Make First) */}
                        {!isAll && (
                          <div className="p-2 bg-[#F7F5EF] rounded-xl border border-[#E5E1D5] flex items-center justify-between gap-1">
                            <button
                              type="button"
                              disabled={isFirstMovable}
                              onClick={() => moveCategoryOrder(cat, 'up')}
                              className="px-2 py-1 text-[11px] font-bold bg-white hover:bg-stone-100 disabled:opacity-25 border border-stone-200 rounded-lg text-stone-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-all"
                              title="সামনে / আগে নিন"
                            >
                              <ArrowLeft className="w-3 h-3 text-stone-500" />
                              <span>সামনে</span>
                            </button>

                            <button
                              type="button"
                              disabled={isFirstMovable}
                              onClick={() => moveCategoryOrder(cat, 'first')}
                              className="px-1.5 py-1 text-[10px] font-black bg-amber-100 hover:bg-amber-200 disabled:opacity-25 border border-amber-300 rounded-lg text-amber-950 flex items-center gap-0.5 cursor-pointer disabled:cursor-not-allowed transition-all"
                              title="এক ক্লিকে সবার শুরুতে নিন"
                            >
                              <span>🔝 শুরুতে</span>
                            </button>

                            <button
                              type="button"
                              disabled={isLastMovable}
                              onClick={() => moveCategoryOrder(cat, 'down')}
                              className="px-2 py-1 text-[11px] font-bold bg-white hover:bg-stone-100 disabled:opacity-25 border border-stone-200 rounded-lg text-stone-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-all"
                              title="পিছনে / পরে নিন"
                            >
                              <span>পিছনে</span>
                              <ArrowRight className="w-3 h-3 text-stone-500" />
                            </button>
                          </div>
                        )}

                        {/* Inline Category Name Editor */}
                        {editingCategory === cat && !isAll && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const trimmed = editCategoryInput.trim();
                              if (!trimmed) {
                                showToast('ভ্যালিডেশন এরর', 'ক্যাটাগরির নাম খালি রাখা যাবে না।', 'error');
                                return;
                              }
                              updateCategoryName(cat, trimmed);
                              setEditingCategory(null);
                            }}
                            className="p-3 bg-amber-50/95 rounded-xl border border-amber-300 space-y-2"
                          >
                            <label className="block text-[11px] font-black text-amber-950 uppercase">
                              ক্যাটাগরির নতুন নাম লিখুন:
                            </label>
                            <input
                              type="text"
                              autoFocus
                              value={editCategoryInput}
                              onChange={(e) => setEditCategoryInput(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-amber-400 rounded-lg text-xs font-bold text-[#14221C] focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner"
                              placeholder="যেমন: প্রিমিয়াম প্যান্ট ও কার্গো..."
                            />
                            <div className="flex items-center justify-end gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setEditingCategory(null)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
                              >
                                বাতিল
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1 text-[11px] font-bold text-white bg-[#FF762E] hover:bg-[#e8631c] rounded-md shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>সেভ করুন</span>
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Quick Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#E5E1D5] text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setCatProductSortCategory(cat);
                              // Smooth scroll to product sorter below
                              document.getElementById('cat-product-sorter-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-[#FF762E] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>প্রোডাক্ট সাজান</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {!isAll && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setEditCategoryInput(cat);
                                }}
                                className="px-2 py-1 text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-bold text-[11px]"
                                title="ক্যাটাগরির নাম এডিট করুন"
                              >
                                <Edit2 className="w-3 h-3 text-amber-700" />
                                <span>এডিট নাম</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setCurrentPage('shop');
                              }}
                              className="text-stone-500 hover:text-stone-800 p-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                              title="শপে দেখুন"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {!isAll && (
                              <button
                                type="button"
                                onClick={() => {
                                  deleteCategory(cat);
                                  setSelectedDeleteCategories((prev) => prev.filter((item) => item !== cat));
                                  if (catProductSortCategory === cat) {
                                    setCatProductSortCategory('All');
                                  }
                                }}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="ক্যাটাগরি মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 1.5 Homepage 4 Category Section Cards — Best Product Cover Selector */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-[#E5E1D5]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 bg-[#14221C] text-white text-[10px] font-black uppercase rounded-full flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-[#FF762E]" />
                      <span>হোমপেজ ক্যাটাগরি কভার</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      অটো বেস্ট + ম্যানুয়াল পরিবর্তন সিস্টেম
                    </span>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                    হোমপেজের ৪টি সেকশন কার্ডের বেস্ট প্রোডাক্ট কন্ট্রোল
                  </h3>
                  <p className="text-xs text-[#202522]/70 mt-1 max-w-2xl">
                    হোমপেজে কোনো প্রাইমারি/ডিফল্ট ছবি ব্যবহার না করে প্রতিটি ক্যাটাগরির সেরা প্রোডাক্টের আসল ছবি দেখানো হচ্ছে। নিচ থেকে যেকোনো সেকশনের প্রোডাক্ট পরিবর্তন করতে পারবেন।
                  </p>
                </div>
              </div>

              {(() => {
                const showcaseCards = getHomepageShowcaseCategories(categories, products, 4);
                if (showcaseCards.length === 0) {
                  return (
                    <div className="p-6 bg-[#F7F5EF] rounded-2xl border border-dashed border-[#E5E1D5] text-center text-xs text-stone-600">
                      ক্যাটাগরিতে প্রোডাক্ট যুক্ত করার পর এখানে হোমপেজের ৪টি সেকশন কার্ডের বেস্ট প্রোডাক্ট প্রিভিউ ও পরিবর্তনের অপশন দেখতে পাবেন।
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {showcaseCards.map((card, cardIdx) => {
                      const catChoices = getProductsForCategory(card.category, products);
                      const manualChoice = catChoices.find((p) => p.isCategoryShowcase);
                      const activeBest = card.bestProduct;
                      const bestPrice = activeBest.discountPrice || activeBest.regularPrice;

                      return (
                        <div
                          key={card.category}
                          className="p-3.5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#14221C] text-white rounded-md">
                                কার্ড #{cardIdx + 1} · {card.category}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                manualChoice ? 'bg-amber-200 text-amber-950' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {manualChoice ? 'ম্যানুয়াল সিলেক্ট' : 'অটো বেস্ট'}
                              </span>
                            </div>

                            <div className="relative h-36 rounded-xl overflow-hidden bg-neutral-900 border border-[#E5E1D5]">
                              <img
                                src={toDisplayImageUrl(activeBest.images[0])}
                                alt={buildSeoImageAlt({ name: activeBest.name, category: activeBest.category, brand: activeBest.brand })}
                                onError={handleProxyImageError}
                                className="w-full h-full object-cover object-center"
                              />
                              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white">
                                <p className="text-xs font-bold truncate">{activeBest.name}</p>
                                <p className="text-[10px] text-amber-300 font-semibold">
                                  ৳{bestPrice.toLocaleString()} · ★{activeBest.rating || 5}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase text-stone-600">
                              এই সেকশনের প্রোডাক্ট পরিবর্তন করুন:
                            </label>
                            <select
                              value={manualChoice?.id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCategoryBestProduct(card.category, val || null);
                              }}
                              className="w-full px-2.5 py-2 bg-white border border-[#E5E1D5] rounded-xl text-xs font-semibold text-[#14221C] focus:outline-none focus:border-[#FF762E] cursor-pointer"
                            >
                              <option value="">অটো বেস্ট ({activeBest.name})</option>
                              {catChoices.map((prod) => (
                                <option key={prod.id} value={prod.id}>
                                  {prod.name} — ৳{(prod.discountPrice || prod.regularPrice).toLocaleString()}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* 2. Category-Wise Product Reordering & Top 10 Control Section */}
            <div id="cat-product-sorter-section" className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-[#E5E1D5]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 bg-[#FF762E] text-white text-[10px] font-black uppercase rounded-full">
                      প্রোডাক্ট ক্রমানুসার ও সাজানো
                    </span>
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                      <span>টপ টেন ও কাস্টম র্যাংকিং</span>
                    </span>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                    ক্যাটাগরিভিত্তিক প্রোডাক্ট ওপর-নিচ সাজান
                  </h3>
                  <p className="text-xs text-[#202522]/70 mt-1 max-w-2xl">
                    যে কোনো ক্যাটাগরি সিলেক্ট করে তার ভেতরের প্রোডাক্টগুলো উপর থেকে নিচে আপনার পছন্দমতো সাজাতে পারেন। প্রয়োজনে যে কোনো প্রোডাক্টকে <span className="font-bold text-[#14221C]">🔝 ১ নম্বরে</span> বা <span className="font-bold text-amber-800">⭐ টপ প্রোডাক্ট</span> হিসেবে হোমপেজে হাইলাইট করতে পারেন।
                  </p>
                </div>

                {/* Category Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-stone-600 uppercase">ক্যাটাগরি:</label>
                  <select
                    value={catProductSortCategory}
                    onChange={(e) => setCatProductSortCategory(e.target.value)}
                    className="px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs font-bold text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({c === 'All' ? products.length : products.filter(p => p.category.toLowerCase() === c.toLowerCase()).length}টি)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {categories.map((c) => {
                  const count = c === 'All'
                    ? products.length
                    : products.filter(p => p.category.toLowerCase() === c.toLowerCase()).length;
                  const isSelected = catProductSortCategory === c;

                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatProductSortCategory(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#14221C] text-white shadow-xs'
                          : 'bg-[#F7F5EF] hover:bg-stone-200 text-stone-700 border border-[#E5E1D5]'
                      }`}
                    >
                      <span>{c}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-800'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Products List for the Selected Category */}
              {(() => {
                const categoryProducts = catProductSortCategory === 'All'
                  ? [...products].filter(p => !p.isArchived && p.status !== 'archived')
                  : products.filter(p => p.category.toLowerCase() === catProductSortCategory.toLowerCase() && !p.isArchived && p.status !== 'archived');

                if (categoryProducts.length === 0) {
                  return (
                    <div className="p-10 text-center bg-[#F7F5EF] rounded-2xl border border-dashed border-[#E5E1D5] space-y-2">
                      <Package className="w-8 h-8 text-stone-400 mx-auto" />
                      <p className="text-sm font-bold text-stone-700">
                        "{catProductSortCategory}" ক্যাটাগরিতে এখনও কোনো প্রোডাক্ট যুক্ত করা হয়নি।
                      </p>
                      <p className="text-xs text-stone-500">
                        প্রোডাক্ট অ্যাড করার পর এখানে সেগুলোকে উপর-নিচ সাজাতে পারবেন।
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-500 px-1">
                      <span>"{catProductSortCategory}" ক্যাটাগরির {categoryProducts.length}টি প্রোডাক্ট (ক্রম অনুযায়ী):</span>
                      <span className="text-[11px] text-amber-800 font-bold">
                        ⭐ স্টার বাটনে ক্লিক করে হোমপেজ টপ প্রোডাক্টে পাঠাতে পারেন
                      </span>
                    </div>

                    <div className="divide-y divide-[#E5E1D5] border border-[#E5E1D5] rounded-2xl overflow-hidden bg-white shadow-2xs">
                      {categoryProducts.map((p, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === categoryProducts.length - 1;
                        const price = p.discountPrice || p.regularPrice;

                        return (
                          <div
                            key={p.id}
                            className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                              p.isPinned ? 'bg-amber-50/40' : p.isTopProduct ? 'bg-amber-50/20' : 'hover:bg-stone-50/80'
                            }`}
                          >
                            {/* Product Info & Rank */}
                            <div className="flex items-center gap-3.5 min-w-0">
                              {/* Position Rank Badge */}
                              <div className="w-9 h-9 rounded-xl bg-[#14221C] text-white font-mono text-sm font-black flex items-center justify-center shrink-0 shadow-xs">
                                #{idx + 1}
                              </div>

                              {/* Thumbnail */}
                              <img
                                src={toDisplayImageUrl(p.images?.[0] || '/assets/images/product_premium_hoodie_1792588590406.webp')}
                                alt={buildSeoImageAlt({ name: p.name, category: p.category, brand: p.brand })}
                                onError={handleProxyImageError}
                                className="w-12 h-14 object-cover rounded-xl bg-stone-100 border border-stone-200 shrink-0"
                              />

                              {/* Title, Category & Price */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-heading font-bold text-sm text-[#14221C] truncate">
                                    {p.name}
                                  </h4>
                                  {p.isPinned && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded">
                                      Pinned #1
                                    </span>
                                  )}
                                  {p.isTopProduct && (
                                    <span className="px-1.5 py-0.5 bg-amber-300 text-amber-950 text-[9px] font-black uppercase rounded flex items-center gap-0.5 shadow-2xs">
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      <span>Top 10</span>
                                    </span>
                                  )}
                                  {p.isCategoryShowcase && (
                                    <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-950 text-[9px] font-black uppercase rounded flex items-center gap-0.5 shadow-2xs">
                                      <Award className="w-2.5 h-2.5" />
                                      <span>সেকশন বেস্ট কভার</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                                  <span className="font-bold text-[#14221C]">৳{price.toLocaleString()}</span>
                                  <span>·</span>
                                  <span>স্টক: {p.totalStock} পিস</span>
                                  <span>·</span>
                                  <span className="text-[11px] font-mono text-stone-400">SKU: {p.sku}</span>
                                </div>
                              </div>
                            </div>

                            {/* Reordering Controls (Up / Down / Top / Direct Rank / Top 10 Toggle) */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                              {/* Up / Down Controls */}
                              <div className="flex items-center gap-1 bg-[#F7F5EF] p-1 rounded-xl border border-[#E5E1D5]">
                                <button
                                  type="button"
                                  disabled={isFirst}
                                  onClick={() => moveProductInCategory(p.id, catProductSortCategory, 'up')}
                                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-stone-100 disabled:opacity-25 border border-stone-200 rounded-lg text-stone-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-2xs transition-all"
                                  title="এক ধাপ উপরে তুলুন"
                                >
                                  <ChevronUp className="w-4 h-4 text-stone-600" />
                                  <span className="hidden sm:inline">উপরে</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isLast}
                                  onClick={() => moveProductInCategory(p.id, catProductSortCategory, 'down')}
                                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-stone-100 disabled:opacity-25 border border-stone-200 rounded-lg text-stone-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-2xs transition-all"
                                  title="এক ধাপ নিচে নামান"
                                >
                                  <ChevronDown className="w-4 h-4 text-stone-600" />
                                  <span className="hidden sm:inline">নিচে</span>
                                </button>
                              </div>

                              {/* Move to Top #1 */}
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => moveProductInCategory(p.id, catProductSortCategory, 'top')}
                                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-25 border border-amber-300 text-amber-950 text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-all shadow-2xs"
                                title="সবার উপরে ১ নম্বরে নিন"
                              >
                                <span>🔝 ১ নম্বরে নিন</span>
                              </button>

                              {/* Top 10 Homepage Toggle */}
                              <button
                                type="button"
                                onClick={() => toggleTopProduct(p.id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1 cursor-pointer transition-all shadow-2xs ${
                                  p.isTopProduct
                                    ? 'bg-amber-400 hover:bg-amber-500 border-amber-500 text-neutral-950 font-black'
                                    : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-600'
                                }`}
                                title={p.isTopProduct ? 'হোমপেজ টপ টেন থেকে বাদ দিন' : '⭐ হোমপেজ টপ টেনে যুক্ত করুন'}
                              >
                                <Star className={`w-3.5 h-3.5 ${p.isTopProduct ? 'fill-current text-black' : 'text-stone-400'}`} />
                                <span>{p.isTopProduct ? 'টপ টেনে আছে' : '+টপ টেন'}</span>
                              </button>

                              {/* Section Best Product / Category Card Cover Toggle */}
                              <button
                                type="button"
                                onClick={() => setCategoryBestProduct(p.category, p.isCategoryShowcase ? null : p.id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1 cursor-pointer transition-all shadow-2xs ${
                                  p.isCategoryShowcase
                                    ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white font-black'
                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                                }`}
                                title={p.isCategoryShowcase ? 'সেকশন কার্ড কভার থেকে সরিয়ে অটো বেস্ট করুন' : 'এই প্রোডাক্টটিকে হোমপেজ ক্যাটাগরি কার্ডের ছবি হিসেবে সেট করুন'}
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>{p.isCategoryShowcase ? 'সেকশন কভারে আছে' : 'সেকশন কভার'}</span>
                              </button>

                              {/* Direct Position / Rank Setter */}
                              <div className="flex items-center gap-1 bg-[#F7F5EF] p-1 rounded-xl border border-[#E5E1D5]">
                                <span className="text-[11px] font-bold text-stone-500 pl-1">পজিশন:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max={categoryProducts.length}
                                  placeholder={String(idx + 1)}
                                  value={directRankInputs[p.id] ?? ''}
                                  onChange={(e) => {
                                    setDirectRankInputs({
                                      ...directRankInputs,
                                      [p.id]: e.target.value
                                    });
                                  }}
                                  className="w-12 px-1.5 py-0.5 text-center text-xs font-bold bg-white border border-stone-300 rounded-md text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rankVal = parseInt(directRankInputs[p.id] || '', 10);
                                    if (isNaN(rankVal) || rankVal < 1 || rankVal > categoryProducts.length) {
                                      showToast('সঠিক পজিশন লিখুন', `১ থেকে ${categoryProducts.length} এর মধ্যে নম্বর দিন`, 'error');
                                      return;
                                    }
                                    moveProductInCategory(p.id, catProductSortCategory, 'up', rankVal);
                                    setDirectRankInputs({
                                      ...directRankInputs,
                                      [p.id]: ''
                                    });
                                  }}
                                  className="px-2 py-0.5 bg-[#14221C] hover:bg-neutral-800 text-white text-[11px] font-bold rounded-md cursor-pointer transition-colors"
                                  title="পজিশন সেট করুন"
                                >
                                  সেট
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 3: ORDER MANAGEMENT */}
        {activeTab === 'orders' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                  Order Management ({filteredOrders.length})
                </h3>
                <p className="text-xs text-[#202522]/60 mt-0.5">
                  16-stage order lifecycle with automated 15-min customer confirmation, staff verification, and BD courier tracking.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-semibold text-[#14221C]"
                >
                  <option value="All">All Statuses ({orders.length})</option>
                  <option value="Pending Customer Confirmation">Pending Customer Confirmation</option>
                  <option value="Customer Confirmed">Customer Confirmed</option>
                  <option value="Awaiting Staff Approval">Awaiting Staff Approval</option>
                  <option value="Order Confirmed">Order Confirmed</option>
                  <option value="Processing">Processing</option>
                  <option value="Packed">Packed</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancellation Requested">Cancellation Requested</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Return Requested">Return Requested</option>
                  <option value="Returned">Returned</option>
                  <option value="Refund Pending">Refund Pending</option>
                  <option value="Refunded">Refunded</option>
                  <option value="Failed Delivery">Failed Delivery</option>
                </select>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-[#E5E1D5] text-[#14221C] text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Export</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearAllOrders();
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Clear all orders and delivery tracking"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>সব অর্ডার ও লোকেশন মুছুন</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#202522]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search orders by Order Number, Customer Name, or Phone (+880)..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
              />
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer Details</th>
                    <th className="px-4 py-3">Delivery Address</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total (BDT)</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Fulfillment Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D5]">
                  {filteredOrders.map((order) => {
                    const orderTrackingCode = getTrackingCode(order);
                    const orderProg = getOrderProgressInfo(order);
                    return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#14221C]">
                        <div className="flex items-center gap-1.5">
                          <span>{order.orderNumber}</span>
                          {!orderProg.isCancelledOrException && (
                            <span className="px-1.5 py-0.5 rounded bg-stone-100 text-[#14221C] text-[9px] font-sans font-bold">
                              {orderProg.percent}%
                            </span>
                          )}
                        </div>
                        {orderTrackingCode ? (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 font-mono">
                              {order.courierName || 'Courier'}: {orderTrackingCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(orderTrackingCode, `trk-${order.id}`)}
                              className="p-0.5 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
                              title="Tracking ID কপি করুন"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : orderProg.isConfirmed && !orderProg.isCancelledOrException ? (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-sans font-semibold">
                            Tracking ID যুক্ত করুন
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[#202522]/60 tabular-nums">
                        {new Date(order.createdAt).toLocaleDateString('en-GB')}
                        <span className="block text-[10px] text-[#202522]/40">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#14221C]">
                        <div className="flex items-center gap-1.5">
                          <span>{order.customer.fullName}</span>
                          {order.isVerifiedCustomer && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        <span className="block text-[11px] font-mono font-normal text-[#202522]/60">
                          {order.customer.phone}
                          {order.verificationMethod && (
                            <span className="ml-1 text-[10px] text-stone-500 font-sans">
                              ({order.verificationMethod === 'google' ? 'Gmail' : order.verificationMethod === 'facebook' ? 'Facebook' : 'OTP'})
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#202522]/80 max-w-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            resolveDeliveryZone(order.customer.district, order.customer.upazila) === 'inside_dhaka'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {order.customer.district} (
                            {(order.deliveryFee ?? (resolveDeliveryZone(order.customer.district, order.customer.upazila) === 'inside_dhaka' ? 0 : 50)) === 0
                              ? 'ফ্রি ৳০'
                              : `৳${order.deliveryFee ?? 50}`}
                            )
                          </span>
                          <span className="text-[11px] font-bold text-[#14221C]">
                            {order.customer.upazila}
                          </span>
                        </div>
                        <div className="flex items-start gap-1 mt-1">
                          <span className="text-[11px] font-medium text-[#202522]/70 leading-tight">
                            {order.customer.streetAddress}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(
                              `${order.customer.fullName} | ${order.customer.phone} | ${order.customer.streetAddress}, ${order.customer.upazila}, ${order.customer.district}`,
                              `ord-addr-${order.id}`
                            )}
                            className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-700 shrink-0 cursor-pointer"
                            title="সম্পূর্ণ ঠিকানা কপি করুন"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} pcs
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-[#14221C]">
                        ৳{order.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold block text-[#14221C]">
                          {order.paymentMethod}
                        </span>
                        <span className={`text-[10px] font-bold ${order.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.orderStatus}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg cursor-pointer border ${
                            order.orderStatus === 'Order Confirmed' || order.orderStatus === 'Delivered'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : order.orderStatus.includes('Cancelled') || order.orderStatus.includes('Refund')
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : order.orderStatus.includes('Awaiting') || order.orderStatus.includes('Pending')
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-stone-50 text-stone-800 border-stone-200'
                          }`}
                        >
                          <option value="Pending Customer Confirmation">Pending Customer Confirmation</option>
                          <option value="Customer Confirmed">Customer Confirmed</option>
                          <option value="Awaiting Staff Approval">Awaiting Staff Approval</option>
                          <option value="Order Confirmed">Order Confirmed</option>
                          <option value="Processing">Processing</option>
                          <option value="Packed">Packed</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Out for Delivery">Out for Delivery</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancellation Requested">Cancellation Requested</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Return Requested">Return Requested</option>
                          <option value="Returned">Returned</option>
                          <option value="Refund Pending">Refund Pending</option>
                          <option value="Refunded">Refunded</option>
                          <option value="Failed Delivery">Failed Delivery</option>
                        </select>
                        {order.cancellationReason && (
                          <span className="block text-[10px] text-rose-600 font-semibold mt-1 max-w-[180px] leading-tight bg-rose-50/80 px-1.5 py-0.5 rounded border border-rose-200">
                            বাতিলের কারণ: {order.cancellationReason}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Quick Confirm + Prompt Tracking ID */}
                          {(order.orderStatus === 'Awaiting Staff Approval' ||
                            order.orderStatus === 'Customer Confirmed' ||
                            order.orderStatus === 'Pending Customer Confirmation') && (
                            <button
                              type="button"
                              onClick={() => {
                                approveOrder(order.id);
                                setCourierModalOrder({ ...order, orderStatus: 'Order Confirmed' });
                                setSelectedCourier(order.courierName || 'Steadfast');
                                setCourierTrackingCode(getTrackingCode(order) || generateInternalTrackingId(order.orderNumber));
                                setCourierTargetStatus('Order Confirmed');
                                setCourierProgressNote('অর্ডার কনফার্ম হয়েছে এবং প্যাকিং প্রস্তুতি চলছে।');
                              }}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Confirm order and add Tracking ID"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm Order</span>
                            </button>
                          )}

                          {/* Quick Cancel Approve button if customer requested */}
                          {order.orderStatus === 'Cancellation Requested' && (
                            <button
                              type="button"
                              onClick={() => cancelOrder(order.id, 'Staff approved cancellation request')}
                              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Approve Cancellation & Restore Stock"
                            >
                              <X className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          )}

                          {/* Add / Update Tracking ID button for Confirmed or Active Orders */}
                          {orderProg.isConfirmed && !orderProg.isCancelledOrException && (
                            <button
                              type="button"
                              onClick={() => {
                                setCourierModalOrder(order);
                                setCourierTrackingCode(orderTrackingCode || generateInternalTrackingId(order.orderNumber));
                                setSelectedCourier(order.courierName || 'Steadfast');
                                setCourierTargetStatus(
                                  order.orderStatus === 'Order Confirmed' ? 'Shipped' : order.orderStatus
                                );
                                setCourierProgressNote(order.currentLocationNote || '');
                              }}
                              className={`px-2.5 py-1 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer ${
                                orderTrackingCode
                                  ? 'bg-[#202522] hover:bg-[#14221C]'
                                  : 'bg-[#FF762E] hover:bg-[#e56320]'
                              }`}
                              title="অর্ডার কনফার্মের পর Tracking ID যুক্ত বা আপডেট করুন"
                            >
                              <Truck className="w-3 h-3" />
                              <span>{orderTrackingCode ? 'Update Tracking' : '+ Tracking ID'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setInspectingOrder(order);
                              setTrackingInput(orderTrackingCode || '');
                              setInspectCourier(order.courierName || 'Steadfast');
                              setInspectTrackingNote(order.currentLocationNote || '');
                            }}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-[#14221C] text-[11px] font-semibold rounded-lg cursor-pointer"
                          >
                            Inspect
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteOrder(order.id)}
                            className="p-1 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: BUSINESS FINANCE & PROFIT MANAGEMENT */}
        {activeTab === 'finances' && <FinancesTab />}

        {/* TAB: STAFF & MODERATORS MANAGEMENT */}
        {activeTab === 'moderators' && <ModeratorsTab />}

        {/* TAB: VISUAL THEMES & 3D BANNERS */}
        {activeTab === 'themes' && <ThemesTab />}

        {/* TAB 4: CUSTOMER & ADDRESS MANAGEMENT */}
        {activeTab === 'customers' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
            {/* Header & Title */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-[#E5E1D5]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                    কাস্টমার ও ডেলিভারি ঠিকানা তালিকা ({filteredCustomerProfiles.length})
                  </h3>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                    সরাসরি লাইভ ডাটা
                  </span>
                </div>
                <p className="text-xs text-[#202522]/70 mt-1">
                  এখানে সকল কাস্টমারদের নাম, সচল মোবাইল নাম্বার, জেলা, উপজেলা এবং সম্পূর্ণ ডেলিভারি ঠিকানা সহজে দেখতে পাবেন।
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportCustomersCSV}
                  className="px-3.5 py-2 bg-[#F7F5EF] hover:bg-stone-200 border border-[#E5E1D5] text-[#14221C] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export full customer directory with addresses to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-[#FF762E]" />
                  <span>কাস্টমার ডাটা CSV এক্সপোর্ট</span>
                </button>
              </div>
            </div>

            {/* Quick Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5]">
                <span className="text-[#202522]/60 text-[11px] block font-medium">মোট কাস্টমার</span>
                <span className="text-xl font-black text-[#14221C] tabular-nums mt-0.5 block">
                  {allCustomerProfiles.length} জন
                </span>
              </div>
              <div className="p-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5]">
                <span className="text-[#202522]/60 text-[11px] block font-medium">ঢাকা জেলার কাস্টমার</span>
                <span className="text-xl font-black text-[#14221C] tabular-nums mt-0.5 block">
                  {allCustomerProfiles.filter((c) => c.district.toLowerCase().includes('dhaka')).length} জন
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold block">সিটি ফ্রি (৳০) · সাব-এরিয়া ৳৫০</span>
              </div>
              <div className="p-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5]">
                <span className="text-[#202522]/60 text-[11px] block font-medium">ঢাকার বাইরের ৬৩ জেলা</span>
                <span className="text-xl font-black text-[#14221C] tabular-nums mt-0.5 block">
                  {allCustomerProfiles.filter((c) => !c.district.toLowerCase().includes('dhaka')).length} জন
                </span>
                <span className="text-[10px] text-amber-700 font-semibold block">ডেলিভারি চার্জ ৳৫০</span>
              </div>
              <div className="p-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5]">
                <span className="text-[#202522]/60 text-[11px] block font-medium">মোট সম্পন্ন অর্ডার</span>
                <span className="text-xl font-black text-emerald-800 tabular-nums mt-0.5 block">
                  {orders.length} টি
                </span>
              </div>
            </div>

            {/* Search Input Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#202522]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="কাস্টমারের নাম, মোবাইল নাম্বার, জেলা, উপজেলা বা বিস্তারিত ঠিকানা দিয়ে খুঁজুন..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] text-[#14221C]"
              />
            </div>

            {/* Customers & Addresses Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#E5E1D5]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">১. কাস্টমার নাম</th>
                    <th className="px-4 py-3.5">২. মোবাইল নাম্বার</th>
                    <th className="px-4 py-3.5">৩. জেলা</th>
                    <th className="px-4 py-3.5">৪. উপজেলা / থানা</th>
                    <th className="px-4 py-3.5">৫. বিস্তারিত ঠিকানা</th>
                    <th className="px-4 py-3.5 text-center">অর্ডার সংখ্যা</th>
                    <th className="px-4 py-3.5 text-right">বিস্তারিত ডিটেইলস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D5] bg-white">
                  {filteredCustomerProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                        কোনো কাস্টমার পাওয়া যায়নি। নতুন কাস্টমার অর্ডার করলে এখানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerProfiles.map((cust) => {
                      const isDhaka = cust.district.toLowerCase().includes('dhaka');
                      const fullCopyText = `${cust.name} | ${cust.phone} | ${cust.streetAddress}, ${cust.upazila}, ${cust.district}`;

                      return (
                        <tr key={cust.id} className="hover:bg-amber-50/20 transition-colors">
                          {/* ১. কাস্টমার নাম */}
                          <td className="px-4 py-3 font-bold text-[#14221C]">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-[#14221C] text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                {cust.name.trim().charAt(0) || 'C'}
                              </div>
                              <div>
                                <span className="block text-xs font-bold text-[#14221C]">
                                  {cust.name}
                                </span>
                                {cust.email && (
                                  <span className="block text-[10px] text-[#202522]/50 font-normal">
                                    {cust.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* ২. মোবাইল নাম্বার */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-[#14221C]">
                                {cust.phone}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(cust.phone, `phone-${cust.id}`)}
                                className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                                title="নাম্বার কপি করুন"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <a
                              href={`tel:${cust.phone}`}
                              className="text-[10px] text-[#FF762E] hover:underline flex items-center gap-0.5 mt-0.5"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              <span>কল দিন</span>
                            </a>
                          </td>

                          {/* ৩. জেলা */}
                          <td className="px-4 py-3 font-semibold">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                isDhaka
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>{cust.district}</span>
                              <span className="text-[9px] opacity-80 font-mono">
                                ({resolveDeliveryZone(cust.district, cust.upazila) === 'inside_dhaka' ? 'ফ্রি ৳০' : '৳৫০'})
                              </span>
                            </span>
                          </td>

                          {/* ৪. উপজেলা / থানা */}
                          <td className="px-4 py-3 font-semibold text-[#14221C]">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F7F5EF] text-[11px] text-[#14221C] border border-[#E5E1D5]">
                              <Building2 className="w-3 h-3 text-[#FF762E] shrink-0" />
                              <span>{cust.upazila}</span>
                            </span>
                          </td>

                          {/* ৫. বিস্তারিত ঠিকানা */}
                          <td className="px-4 py-3 text-[#202522]/80 max-w-xs">
                            <div className="flex items-start gap-1">
                              <span className="text-[11px] font-medium leading-relaxed">
                                {cust.streetAddress}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(fullCopyText, `addr-${cust.id}`)}
                                className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-[#14221C] transition-colors shrink-0 ml-1 cursor-pointer"
                                title="সম্পূর্ণ ঠিকানা কপি করুন"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* অর্ডার সংখ্যা ও খরচ */}
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-xs text-[#14221C] block">
                              {cust.totalOrders} টি
                            </span>
                            <span className="text-[10px] text-[#202522]/60 font-medium tabular-nums block">
                              ৳{cust.totalSpent.toLocaleString()}
                            </span>
                          </td>

                          {/* অ্যাকশন */}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setInspectingCustomerProfile(cust)}
                              className="px-3 py-1.5 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                            >
                              ডিটেইলস দেখুন
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: INVENTORY MANAGEMENT */}
        {activeTab === 'inventory' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
            <div>
              <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                Live Stock & Warehouse Matrix
              </h3>
              <p className="text-xs text-[#202522]/60 mt-0.5">
                Real-time stock across garment sizes and colors with instant restock triggers.
              </p>
            </div>

            <div className="space-y-4">
              {products.map((prod) => (
                <div key={prod.id} className="p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={prod.images[0]}
                        alt={buildSeoImageAlt({ name: prod.name, category: prod.category, brand: prod.brand })}
                        className="w-12 h-14 object-cover rounded-lg bg-white shrink-0"
                      />
                      <div>
                        <h4 className="font-bold text-sm text-[#14221C]">{prod.name}</h4>
                        <p className="text-xs text-[#202522]/60">
                          SKU: {prod.sku} · Category: {prod.category} ({prod.subCategory})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {prod.totalStock <= 0 ? (
                        <span className="px-2.5 py-1 bg-rose-600 text-white text-xs font-extrabold rounded-lg uppercase">
                          OUT OF STOCK (0 pcs)
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#14221C]">
                          Total Stock: {prod.totalStock} pcs
                        </span>
                      )}
                      <button
                        onClick={() => {
                          updateProduct(prod.id, { totalStock: prod.totalStock + 20 });
                        }}
                        className="px-3 py-1.5 bg-[#14221C] text-white text-xs font-bold uppercase rounded-lg hover:bg-[#202522] cursor-pointer"
                      >
                        +20 Restock
                      </button>
                    </div>
                  </div>

                  {/* Variant Stock Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2 border-t border-[#E5E1D5] text-xs">
                    {prod.variants.map((v) => (
                      <div key={v.id} className="p-2 bg-white rounded-lg border border-[#E5E1D5] text-center space-y-1">
                        <div className="font-bold text-[#14221C]">{v.size}{v.color ? ` (${v.color.slice(0, 8)})` : ''}</div>
                        <div className={`font-semibold tabular-nums text-xs ${v.stock <= 5 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {v.stock} in stock
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: COUPON & DISCOUNT SYSTEM */}
        {activeTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Create Coupon */}
            <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
              <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                Create Promotional Voucher
              </h3>

              <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Coupon Code</label>
                  <input
                    type="text"
                    placeholder="e.g. VANTREL30"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl uppercase font-mono font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">Discount Type</label>
                    <select
                      value={newCouponType}
                      onChange={(e) => setNewCouponType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                    >
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed (৳ BDT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">
                      {newCouponType === 'percent' ? 'Discount (%)' : 'Discount (৳)'}
                    </label>
                    <input
                      type="number"
                      value={newCouponValue}
                      onChange={(e) => setNewCouponValue(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">Min Purchase (৳)</label>
                    <input
                      type="number"
                      value={newCouponMin}
                      onChange={(e) => setNewCouponMin(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">Usage Limit / User</label>
                    <input
                      type="number"
                      value={newCouponUserLimit}
                      onChange={(e) => setNewCouponUserLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newCouponExpiry}
                    onChange={(e) => setNewCouponExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#14221C] text-white font-bold uppercase rounded-xl hover:bg-[#202522]"
                >
                  Create Live Coupon
                </button>
              </form>
            </div>

            {/* List Coupons */}
            <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
              <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                Active Promo Codes ({coupons.length})
              </h3>

              <div className="space-y-3">
                {coupons.map((c) => (
                  <div key={c.code} className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#14221C]">{c.code}</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          {c.type === 'percent' ? `${c.value}% OFF` : `৳${c.value} OFF`}
                        </span>
                        {c.usageLimitPerUser && (
                          <span className="text-[10px] text-[#202522]/50 font-medium">
                            Limit: {c.usageLimitPerUser}/user
                          </span>
                        )}
                      </div>
                      <p className="text-[#202522]/60 mt-0.5">{c.description}</p>
                      <div className="text-[10px] text-[#202522]/50 mt-1">
                        Min Order: ৳{c.minOrder.toLocaleString()} · Used: {c.usedCount || 0} times
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right text-[11px] text-[#202522]/50">
                        <span>Expires: {c.expiryDate}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCouponActive(c.code)}
                        className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                          c.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCoupon(c.code)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete Promo Code"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SMS GATEWAY & NOTIFICATION SYSTEM */}
        {activeTab === 'sms-system' && (
          <div className="space-y-8">
            {/* Top Gateway Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  SMS Gateway
                </span>
                <div className="text-xl font-black text-[#14221C]">
                  {settings.smsProvider.toUpperCase()} BD
                </div>
                <p className="text-[11px] text-emerald-700 font-bold">API Connected & Active</p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Dispatched Messages
                </span>
                <div className="text-3xl font-black text-[#14221C] tabular-nums">
                  {smsLogs.length}
                </div>
                <p className="text-[11px] text-[#202522]/60">Across orders & OTP security</p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Approved Sender ID
                </span>
                <div className="text-xl font-bold font-mono text-[#14221C]">
                  {settings.smsSenderId || 'VANTREL'}
                </div>
                <p className="text-[11px] text-emerald-700 font-semibold">Masking approved by BTRC</p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Delivery Success Rate
                </span>
                <div className="text-3xl font-black text-emerald-700 tabular-nums">
                  100%
                </div>
                <p className="text-[11px] text-[#202522]/60">Zero failed transmissions</p>
              </div>
            </div>

            {/* Split: Gateway Config & Message Template Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Provider Configuration */}
              <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D5]">
                  <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                    SMS Gateway Settings
                  </h3>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                    Live Provider
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">
                      Supported Bangladesh Provider
                    </label>
                    <select
                      value={settings.smsProvider}
                      onChange={(e) => updateSettings({ smsProvider: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-semibold"
                    >
                      <option value="greenweb">Greenweb SMS Gateway BD (API v2)</option>
                      <option value="bulksmsbd">BulkSMSBD.com (Token API)</option>
                      <option value="sslwireless">SSL Wireless Push API</option>
                      <option value="twilio">Twilio Global (+880 International)</option>
                      <option value="simulator">In-Browser Test Simulator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">API Key / Token</label>
                    <input
                      type="password"
                      value={settings.smsApiKey || ''}
                      onChange={(e) => updateSettings({ smsApiKey: e.target.value })}
                      placeholder="Configured via server environment or enter SMS token"
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">Registered Sender ID (Masking)</label>
                    <input
                      type="text"
                      value={settings.smsSenderId || 'VANTREL'}
                      onChange={(e) => updateSettings({ smsSenderId: e.target.value })}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-mono uppercase text-xs"
                    />
                  </div>

                  <div className="p-3 bg-[#F7F5EF] rounded-xl text-[11px] text-[#202522]/70 leading-relaxed border border-[#E5E1D5]">
                    <strong>Note:</strong> All messages sent to +880 customer numbers are securely signed and dispatched from server-side environment credentials.
                  </div>
                </div>
              </div>

              {/* Editable Templates */}
              <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D5]">
                  <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                    Transactional SMS Templates
                  </h3>
                  <span className="text-[11px] text-[#202522]/50 font-mono">
                    Placeholders: &#123;orderNumber&#125;, &#123;total&#125;, &#123;courier&#125;, &#123;trackingUrl&#125;
                  </span>
                </div>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  {smsTemplates.map((tmpl) => (
                    <div key={tmpl.id} className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <strong className="text-[#14221C]">{tmpl.name}</strong>
                        <span className="px-2 py-0.5 bg-white border border-[#E5E1D5] text-[10px] font-mono rounded">
                          {tmpl.event}
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        value={tmpl.template}
                        onChange={(e) => updateSmsTemplate(tmpl.id, e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live SMS Delivery Logs */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                  Real-Time SMS Dispatch Logs
                </h3>
                <span className="text-xs text-[#202522]/60">Total: {smsLogs.length} events</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Recipient (+880)</th>
                      <th className="px-4 py-3">Order / Event</th>
                      <th className="px-4 py-3">Dispatched Copy</th>
                      <th className="px-4 py-3">Gateway</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D5]">
                    {smsLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-[11px] text-[#202522]/60 tabular-nums">
                          {new Date(log.timestamp || log.dispatchedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-[#14221C]">{log.phone || log.recipientPhone}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-stone-100 rounded text-[10px] font-bold">
                            {log.orderNumber || log.template}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#202522]/80 max-w-sm truncate" title={log.message}>
                          "{log.message}"
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#202522]/60">{log.provider}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => resendSms(log.id)}
                            className="px-2.5 py-1 bg-[#14221C] text-white text-[11px] font-bold rounded-lg hover:bg-[#202522]"
                          >
                            Resend
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: LOYALTY & REFERRALS MANAGEMENT */}
        {activeTab === 'loyalty-referrals' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Total Points in Circulation
                </span>
                <div className="text-3xl font-black text-[#14221C] tabular-nums">
                  {customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0)} pts
                </div>
                <p className="text-[11px] text-emerald-700 font-bold">
                  ৳{customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0)} BDT customer credit
                </p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Earn Ratio
                </span>
                <div className="text-2xl font-black text-[#14221C]">
                  1 Pt / ৳{settings.pointsPerSpend}
                </div>
                <p className="text-[11px] text-[#202522]/60">Configurable per order</p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Referral Reward (Referrer)
                </span>
                <div className="text-2xl font-black text-emerald-700 tabular-nums">
                  ৳{settings.referralRewardBDT}
                </div>
                <p className="text-[11px] text-[#202522]/60">Awarded after referee drops</p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#E5E1D5] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/60">
                  Referee Welcome Gift
                </span>
                <div className="text-2xl font-black text-[#FF762E] tabular-nums">
                  ৳{settings.refereeRewardBDT}
                </div>
                <p className="text-[11px] text-[#202522]/60">Instant discount on initial drop</p>
              </div>
            </div>

            {/* Customer Points Adjustment Table */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
              <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                Customer Loyalty & Referral Registry
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Referral Code</th>
                      <th className="px-4 py-3">Available Points</th>
                      <th className="px-4 py-3">Cash Value (BDT)</th>
                      <th className="px-4 py-3 text-right">Adjust Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D5]">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-[#14221C]">{c.name}</td>
                        <td className="px-4 py-3 font-mono text-[#202522]/80">{c.phone}</td>
                        <td className="px-4 py-3 font-mono font-bold text-[#FF762E]">{c.referralCode}</td>
                        <td className="px-4 py-3 font-bold tabular-nums text-emerald-800">
                          {c.loyaltyPoints || 0} pts
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-[#14221C]">
                          ৳{c.loyaltyPoints || 0}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setAdjustingCust(c);
                              setAdjustPtsAmount(50);
                            }}
                            className="px-3 py-1 bg-[#14221C] text-white text-xs font-bold rounded-lg hover:bg-[#202522]"
                          >
                            +/- Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Adjust Modal */}
            {adjustingCust && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white w-full max-w-md p-6 rounded-3xl border border-[#E5E1D5] space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-heading font-bold text-base text-[#14221C]">
                      Adjust Points: {adjustingCust.name}
                    </h4>
                    <button onClick={() => setAdjustingCust(null)} className="p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[#202522]/70">
                    Current balance: <strong>{adjustingCust.loyaltyPoints} points</strong>. Enter delta to add or deduct.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                      Adjustment Delta (positive to grant, negative to deduct)
                    </label>
                    <input
                      type="number"
                      value={adjustPtsAmount}
                      onChange={(e) => setAdjustPtsAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setAdjustingCust(null)}
                      className="px-4 py-2 bg-stone-100 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const newPts = Math.max(0, (adjustingCust.loyaltyPoints || 0) + adjustPtsAmount);
                        updateCustomerStatus(adjustingCust.id, adjustingCust.status || 'Active');
                        // Update points in customer record
                        const updatedCustomers = customers.map((c) =>
                          c.id === adjustingCust.id ? { ...c, loyaltyPoints: newPts } : c
                        );
                        localStorage.setItem('vt_customers', JSON.stringify(updatedCustomers));
                        showToast('Points Adjusted', `${adjustPtsAmount > 0 ? '+' : ''}${adjustPtsAmount} points updated for ${adjustingCust.name}.`, 'success');
                        setAdjustingCust(null);
                      }}
                      className="px-4 py-2 bg-[#14221C] text-white text-xs font-bold rounded-xl"
                    >
                      Save Adjustment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 9: AUDIT TRAIL */}
        {activeTab === 'audit-trail' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                  Staff Action Audit Trail & Security Logs
                </h3>
                <p className="text-xs text-[#202522]/60 mt-0.5">
                  Complete immutable record of all privileged staff operations, status overrides, and system reconfigurations.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl">
                Tamper-Proof Audit Trail
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Staff Operator</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Action Event</th>
                    <th className="px-4 py-3">Operation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D5]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-[11px] text-[#202522]/60 tabular-nums">
                        {new Date(log.timestamp).toLocaleDateString('en-GB')} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#14221C]">{log.actor}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-[#14221C] text-white text-[10px] font-bold rounded">
                          {log.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[11px] text-[#FF762E]">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-[#202522]/80 leading-relaxed">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 10: DEVELOPER & API ARCHITECTURE HUB */}
        {activeTab === 'developer-api' && (
          <div className="space-y-8">
            <div className="bg-[#14221C] text-white p-8 rounded-3xl shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
                    VANTREL Full-Stack Architecture Hub
                  </span>
                  <h2 className="font-heading text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mt-1">
                    Database Schema, REST APIs & Integration Guide
                  </h2>
                  <p className="text-xs text-white/70 max-w-2xl mt-1 leading-relaxed">
                    Production architecture to connect your Flutter, React, or Next.js app with Node.js/Express REST APIs, PostgreSQL / MongoDB / Firebase Firestore, media storage, and payment gateways.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedApiLang('roadmap')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                      selectedApiLang === 'roadmap' ? 'bg-[#FF762E] text-white' : 'bg-white/10 text-white'
                    }`}
                  >
                    Roadmap
                  </button>
                  <button
                    onClick={() => setSelectedApiLang('prisma')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                      selectedApiLang === 'prisma' ? 'bg-[#FF762E] text-white' : 'bg-white/10 text-white'
                    }`}
                  >
                    SQL Schema
                  </button>
                  <button
                    onClick={() => setSelectedApiLang('express')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                      selectedApiLang === 'express' ? 'bg-[#FF762E] text-white' : 'bg-white/10 text-white'
                    }`}
                  >
                    Node.js API
                  </button>
                  <button
                    onClick={() => setSelectedApiLang('firebase')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                      selectedApiLang === 'firebase' ? 'bg-[#FF762E] text-white' : 'bg-white/10 text-white'
                    }`}
                  >
                    Firebase
                  </button>
                </div>
              </div>
            </div>

            {/* Architecture Roadmap View */}
            {selectedApiLang === 'roadmap' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6">
                <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                  Step-by-Step Architecture & Connection Plan
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                  <div className="p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                    <div className="w-8 h-8 rounded-lg bg-[#14221C] text-white font-bold flex items-center justify-center">
                      1
                    </div>
                    <h4 className="font-bold text-sm text-[#14221C]">Database & Authentication</h4>
                    <p className="text-[#202522]/70 leading-relaxed font-sans">
                      Provision PostgreSQL with Prisma ORM or Firebase Firestore. Implement JWT or Firebase Auth with two distinct roles: <code className="text-[#FF762E] font-bold">admin</code> and <code className="text-[#FF762E] font-bold">customer</code>. Protect all administrative endpoints with a role-guard middleware.
                    </p>
                  </div>

                  <div className="p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                    <div className="w-8 h-8 rounded-lg bg-[#14221C] text-white font-bold flex items-center justify-center">
                      2
                    </div>
                    <h4 className="font-bold text-sm text-[#14221C]">Media & Payment Gateways</h4>
                    <p className="text-[#202522]/70 leading-relaxed font-sans">
                      Integrate Cloudinary or Firebase Storage for multi-image product uploads with automated WebP compression. Integrate official bKash Checkout URL API, Nagad Direct, SSLCommerz IPN, and Stripe Webhook handlers for real-time transaction verification.
                    </p>
                  </div>

                  <div className="p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                    <div className="w-8 h-8 rounded-lg bg-[#14221C] text-white font-bold flex items-center justify-center">
                      3
                    </div>
                    <h4 className="font-bold text-sm text-[#14221C]">Frontend Client Connection</h4>
                    <p className="text-[#202522]/70 leading-relaxed font-sans">
                      In Flutter: use <code className="text-[#14221C] font-semibold">dio</code> or <code className="text-[#14221C] font-semibold">http</code> with an ApiInterceptor that injects Bearer JWT tokens. In React/Next.js: use TanStack Query or Axios. Handle offline cart persistence and server-side coupon validation at checkout.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Prisma Schema View */}
            {selectedApiLang === 'prisma' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                      PostgreSQL / Prisma Database Schema
                    </h3>
                    <p className="text-xs text-[#202522]/60">Complete schema for Products, Variants, Orders, Coupons, and Users</p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CUSTOMER
  ADMIN
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  PACKED
  SHIPPED
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

model User {
  id           String      @id @default(uuid())
  name         String
  email        String      @unique
  phone        String      @unique
  passwordHash String
  role         Role        @default(CUSTOMER)
  addresses    Address[]
  orders       Order[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model Product {
  id             String           @id @default(uuid())
  slug           String           @unique
  name           String
  description    String
  category       String
  subCategory    String
  brand          String           @default("VANTREL")
  sku            String           @unique
  regularPrice   Float
  discountPrice  Float?
  images         String[]
  fabric         String
  fit            String
  totalStock     Int              @default(0)
  variants       ProductVariant[]
  reviews        Review[]
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}

model ProductVariant {
  id         String   @id @default(uuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  size       String
  color      String
  colorHex   String
  stock      Int      @default(0)
  sku        String   @unique
}

model Order {
  id              String         @id @default(uuid())
  orderNumber     String         @unique
  userId          String?
  user            User?          @relation(fields: [userId], references: [id])
  customerName    String
  customerPhone   String
  deliveryAddress String
  district        String
  subtotal        Float
  discount        Float          @default(0)
  deliveryFee     Float
  total           Float
  orderStatus     OrderStatus    @default(PENDING)
  paymentMethod   String
  paymentStatus   PaymentStatus  @default(PENDING)
  transactionId   String?
  trackingNumber  String?
  items           OrderItem[]
  createdAt       DateTime       @default(now())
}

model OrderItem {
  id         String  @id @default(uuid())
  orderId    String
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId  String
  name       String
  size       String
  color      String
  price      Float
  quantity   Int
}

model Coupon {
  id                String    @id @default(uuid())
  code              String    @unique
  type              String    // "percent" or "fixed"
  value             Float
  minOrder          Float     @default(0)
  usageLimitPerUser Int       @default(1)
  usedCount         Int       @default(0)
  expiryDate        DateTime
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
}`,
                        'prisma'
                      )
                    }
                    className="px-3 py-1.5 bg-[#14221C] text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'prisma' ? 'Copied!' : 'Copy Prisma Schema'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-[#14221C] text-stone-200 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-96">
{`// schema.prisma — VANTREL Full-Stack Relational Database
model Product {
  id             String           @id @default(uuid())
  slug           String           @unique
  name           String
  description    String
  category       String
  subCategory    String
  brand          String           @default("VANTREL")
  sku            String           @unique
  regularPrice   Float
  discountPrice  Float?
  images         String[]
  fabric         String
  fit            String
  totalStock     Int              @default(0)
  variants       ProductVariant[]
}

model Order {
  id              String         @id @default(uuid())
  orderNumber     String         @unique // e.g. VT-89241
  customerName    String
  customerPhone   String
  deliveryAddress String
  district        String
  subtotal        Float
  discount        Float          @default(0)
  deliveryFee     Float
  total           Float
  orderStatus     OrderStatus    @default(PENDING)
  paymentMethod   String         // bKash, COD, Nagad
  paymentStatus   PaymentStatus  @default(PENDING)
  transactionId   String?
  items           OrderItem[]
}`}
                </pre>
              </div>
            )}

            {/* Express.js REST API Code View */}
            {selectedApiLang === 'express' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                      Express.js REST API Endpoints & Controllers
                    </h3>
                    <p className="text-xs text-[#202522]/60">
                      Product Creation Controller & Real-Time Coupon Validation Route
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `// VANTREL Backend API Controller (Node.js + Express + TypeScript)
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware';

const prisma = new PrismaClient();
const router = express.Router();

// 1. POST /api/v1/admin/products — Create new product with variants (Protected: Admin Only)
router.post('/admin/products', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      category,
      subCategory,
      regularPrice,
      discountPrice,
      sku,
      totalStock,
      fabric,
      fit,
      images,
      variants
    } = req.body;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        category,
        subCategory,
        brand: 'VANTREL',
        sku,
        regularPrice: Number(regularPrice),
        discountPrice: discountPrice ? Number(discountPrice) : null,
        totalStock: Number(totalStock),
        fabric,
        fit,
        images: images || [],
        variants: {
          create: variants.map((v: any) => ({
            size: v.size,
            color: v.color,
            colorHex: v.colorHex || '#14221C',
            stock: Number(v.stock),
            sku: v.sku || \`\${sku}-\${v.size}\`
          }))
        }
      },
      include: { variants: true }
    });

    return res.status(201).json({ success: true, product });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. POST /api/v1/coupons/validate — Validate coupon and calculate discount
router.post('/coupons/validate', async (req: Request, res: Response) => {
  try {
    const { code, cartSubtotal, userId } = req.body;

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (!coupon || !coupon.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon code.' });
    }

    if (new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ success: false, message: 'This coupon has expired.' });
    }

    if (cartSubtotal < coupon.minOrder) {
      return res.status(400).json({
        success: false,
        message: \`Minimum cart subtotal of ৳\${coupon.minOrder.toLocaleString()} required.\`
      });
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      discount = Math.round((cartSubtotal * coupon.value) / 100);
    } else {
      discount = Math.min(coupon.value, cartSubtotal);
    }

    return res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        discountAmount: discount,
        payableAmount: cartSubtotal - discount
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;`,
                        'express'
                      )
                    }
                    className="px-3 py-1.5 bg-[#14221C] text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'express' ? 'Copied!' : 'Copy Express API Code'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-[#14221C] text-stone-200 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-96">
{`// 1. Add Product Endpoint: POST /api/v1/admin/products
router.post('/admin/products', requireAdmin, async (req, res) => {
  const { name, category, regularPrice, discountPrice, sku, totalStock, images, variants } = req.body;
  const product = await prisma.product.create({
    data: { name, category, regularPrice, discountPrice, sku, totalStock, images, variants: { create: variants } }
  });
  res.status(201).json({ success: true, product });
});

// 2. Validate Coupon Endpoint: POST /api/v1/coupons/validate
router.post('/coupons/validate', async (req, res) => {
  const { code, cartSubtotal } = req.body;
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) return res.status(400).json({ error: 'Invalid coupon' });
  if (cartSubtotal < coupon.minOrder) return res.status(400).json({ error: \`Min ৳\${coupon.minOrder} required\` });
  const discount = coupon.type === 'percent' ? Math.round((cartSubtotal * coupon.value) / 100) : coupon.value;
  res.json({ success: true, discountAmount: discount, payable: cartSubtotal - discount });
});`}
                </pre>
              </div>
            )}

            {/* Firebase Firestore Rules & Functions */}
            {selectedApiLang === 'firebase' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                      Firebase Firestore Security Rules & Structure
                    </h3>
                    <p className="text-xs text-[#202522]/60">Role-based security rules for VANTREL clothing collections</p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        request.auth.token.email == 'muhammadeyamin0@gmail.com' &&
        request.auth.token.email_verified == true;
    }

    match /products/{productId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /categories/{categoryId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /orders/{orderId} {
      allow read, update, delete: if isAdmin();
      allow create: if request.resource.data.keys().hasAll(['orderNumber', 'total', 'items', 'customer']);
    }
  }
}`,
                        'firebase'
                      )
                    }
                    className="px-3 py-1.5 bg-[#14221C] text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'firebase' ? 'Copied!' : 'Copy Firebase Rules'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-[#14221C] text-stone-200 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-96">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        request.auth.token.email == 'muhammadeyamin0@gmail.com' &&
        request.auth.token.email_verified == true;
    }
    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /orders/{orderId} {
      allow read, update, delete: if isAdmin();
      allow create: if request.resource.data.keys().hasAll(['orderNumber', 'total', 'items', 'customer']);
    }
  }
}`}
                </pre>
              </div>
            )}

            {/* Interactive Live REST API Tester */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-[#E5E1D5]">
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                    Interactive Live REST API Simulator
                  </h3>
                  <p className="text-xs text-[#202522]/60">
                    Test backend API payloads with live response generation right inside this console.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setApiTesterEndpoint('validate-coupon');
                      setApiTesterInput(JSON.stringify({ code: 'VANTREL10', cartSubtotal: 3500 }, null, 2));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      apiTesterEndpoint === 'validate-coupon' ? 'bg-[#14221C] text-white' : 'bg-[#F7F5EF] text-[#202522]'
                    }`}
                  >
                    POST /coupons/validate
                  </button>
                  <button
                    onClick={() => {
                      setApiTesterEndpoint('add-product');
                      setApiTesterInput(
                        JSON.stringify(
                          {
                            name: 'VANTREL Noir Relaxed Trouser',
                            category: 'Pants',
                            regularPrice: 2950,
                            discountPrice: 2500,
                            sku: 'VT-PA-99',
                            totalStock: 40
                          },
                          null,
                          2
                        )
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      apiTesterEndpoint === 'add-product' ? 'bg-[#14221C] text-white' : 'bg-[#F7F5EF] text-[#202522]'
                    }`}
                  >
                    POST /admin/products
                  </button>
                  <button
                    onClick={() => {
                      setApiTesterEndpoint('create-order');
                      setApiTesterInput(
                        JSON.stringify(
                          {
                            customerName: 'Tanvir Ahmed',
                            phone: '01712345678',
                            paymentMethod: 'Cash on Delivery (COD)',
                            itemsCount: 2,
                            subtotal: 4200
                          },
                          null,
                          2
                        )
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      apiTesterEndpoint === 'create-order' ? 'bg-[#14221C] text-white' : 'bg-[#F7F5EF] text-[#202522]'
                    }`}
                  >
                    POST /orders/checkout
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    Request Payload (JSON)
                  </label>
                  <textarea
                    rows={8}
                    value={apiTesterInput}
                    onChange={(e) => setApiTesterInput(e.target.value)}
                    className="w-full p-3 bg-[#14221C] text-emerald-400 font-mono text-xs rounded-xl focus:outline-none"
                  />
                  <button
                    onClick={handleRunApiTest}
                    className="mt-2 w-full py-2 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Execute REST Request</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    Response Output (200 OK / 400 Error)
                  </label>
                  <pre className="w-full p-3 bg-[#14221C] text-stone-200 font-mono text-xs rounded-xl overflow-x-auto min-h-[175px] max-h-56">
                    {apiTesterOutput || '// Click "Execute REST Request" to run live test'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: STORE SETTINGS */}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-6 max-w-3xl">
            <div>
              <h3 className="font-heading text-xl font-bold text-[#14221C] uppercase tracking-tight">
                Storefront & Courier Logistics Configuration
              </h3>
              <p className="text-xs text-[#202522]/60 mt-0.5">
                Configure nationwide courier delivery charges, announcement alerts, and merchant bKash lines.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14221C] mb-1">Store Announcement Ticker</label>
                <input
                  type="text"
                  value={localSettings.announcementText}
                  onChange={(e) => setLocalSettings({ ...localSettings, announcementText: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Inside Dhaka City Fee (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={localSettings.deliveryFeeInsideDhaka ?? 0}
                    onChange={(e) => setLocalSettings({ ...localSettings, deliveryFeeInsideDhaka: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Dhaka Sub-Area Fee (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={localSettings.deliveryFeeDhakaSubArea ?? 50}
                    onChange={(e) => setLocalSettings({ ...localSettings, deliveryFeeDhakaSubArea: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">63 Districts / Outside Fee (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={localSettings.deliveryFeeOutsideDhaka ?? 50}
                    onChange={(e) => setLocalSettings({ ...localSettings, deliveryFeeOutsideDhaka: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Free Delivery Threshold (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={localSettings.freeShippingThreshold ?? 0}
                    onChange={(e) => setLocalSettings({ ...localSettings, freeShippingThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-emerald-700"
                  />
                </div>
              </div>

              {/* bKash Gateway Online / Pending Toggle */}
              <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[#14221C]">bKash Merchant Payment Gateway</h4>
                    <p className="text-[11px] text-[#202522]/60">
                      বিকাশ মার্চেন্ট পেমেন্ট অনবোর্ডিং ও অনলাইন স্ট্যাটাস নিয়ন্ত্রণ করুন
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                    localSettings.isBkashActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {localSettings.isBkashActive ? 'সক্রিয় / Online' : 'পেন্ডিং / Pending'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">Gateway Status</label>
                    <select
                      value={localSettings.isBkashActive ? 'active' : 'pending'}
                      onChange={(e) => {
                        const active = e.target.value === 'active';
                        setLocalSettings({
                          ...localSettings,
                          isBkashActive: active,
                          bKashStatus: active ? 'active' : 'pending'
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#E5E1D5] rounded-xl font-bold"
                    >
                      <option value="pending">পেন্ডিং (বর্তমানে অফলাইন / পেন্ডিং)</option>
                      <option value="active">সক্রিয় (অনলাইন পেমেন্ট চালু করুন)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">bKash Merchant Number</label>
                    <input
                      type="text"
                      value={localSettings.bKashMerchantNumber}
                      onChange={(e) => setLocalSettings({ ...localSettings, bKashMerchantNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#E5E1D5] rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14221C] mb-1">Support WhatsApp Number</label>
                <input
                  type="text"
                  value={localSettings.whatsapp}
                  onChange={(e) => setLocalSettings({ ...localSettings, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-[#14221C] mb-1">VANTREL Studio Address</label>
                <input
                  type="text"
                  value={localSettings.address}
                  onChange={(e) => setLocalSettings({ ...localSettings, address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                />
              </div>

              {/* Meta Pixel & Ads Conversion Tracking */}
              <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#FF762E]" />
                    <span className="font-bold text-[#14221C] text-sm">
                      Meta Pixel & Ads Conversion Tracking
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={localSettings.isMetaPixelEnabled ?? true}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          isMetaPixelEnabled: e.target.checked
                        })
                      }
                      className="w-4 h-4 accent-[#14221C] rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#14221C]">
                      {(localSettings.isMetaPixelEnabled ?? true) ? 'Enabled' : 'Paused'}
                    </span>
                  </label>
                </div>

                <p className="text-[11px] text-[#202522]/70 leading-relaxed">
                  Facebook ও Instagram বিজ্ঞাপনের ভিজিটররা সরাসরি লিংকে ক্লিক করে ঢুকলে নিচের Pixel ID দিয়ে স্বয়ংক্রিয়ভাবে ফুল-ফানেল ইভেন্ট ট্র্যাক হবে।
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">
                      Meta Pixel ID
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={localSettings.metaPixelId ?? DEFAULT_META_PIXEL_ID}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          metaPixelId: e.target.value.replace(/[^\d]/g, '')
                        })
                      }
                      placeholder={DEFAULT_META_PIXEL_ID}
                      className="w-full px-3 py-2 bg-white border border-[#E5E1D5] rounded-xl font-mono text-xs text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                    />
                  </div>

                  <div className="p-3 bg-white border border-[#E5E1D5] rounded-xl space-y-1">
                    <div className="text-[11px] font-bold text-[#14221C] uppercase tracking-wider">
                      Tracked Funnel Events (BDT)
                    </div>
                    <div className="text-[11px] text-[#202522]/75 font-mono leading-relaxed">
                      PageView · ViewContent · AddToCart · InitiateCheckout · Purchase
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Email Notifications */}
              <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#FF762E]" />
                    <span className="font-bold text-[#14221C] text-sm">
                      Automatic Order Email Notifications
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                    Active & Free
                  </span>
                </div>
                <p className="text-[11px] text-[#202522]/60 leading-relaxed">
                  Every new customer order placed will automatically be sent to your Gmail inbox with complete customer phone, address, and product details.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">
                      Notification Recipient Gmail
                    </label>
                    <input
                      type="email"
                      value={localSettings.orderNotificationEmail || 'muhammadeyamin0@gmail.com'}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, orderNotificationEmail: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#E5E1D5] rounded-xl font-medium text-xs"
                      placeholder="muhammadeyamin0@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">
                      Server SMTP Credential (Vercel Env: GMAIL_APP_PASSWORD / Fallback)
                    </label>
                    <div className="relative">
                      <input
                        type={showSmtpPassword ? 'text' : 'password'}
                        value={localSettings.gmailNotificationAppPassword || ''}
                        onChange={(e) => {
                          const cleanedPass = e.target.value.replace(/\s+/g, '');
                          setLocalSettings({ ...localSettings, gmailNotificationAppPassword: cleanedPass });
                        }}
                        placeholder="16-char Google App Password (স্পেস অটো রিমুভ হবে)"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full pl-3 pr-14 py-2 bg-white border border-[#E5E1D5] rounded-xl font-mono text-xs text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold text-[#14221C]/70 hover:text-[#14221C] bg-stone-100 rounded-md cursor-pointer"
                      >
                        {showSmtpPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-[10px] text-[#202522]/55 mt-1">
                      Env <code className="font-mono">GMAIL_APP_PASSWORD</code> না থাকলে এটি fallback হিসেবে কাজ করবে।
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-[#E5E1D5]/60">
                  <span className="text-[10px] text-[#202522]/50">
                    Target: <strong className="text-[#14221C]">muhammadeyamin0@gmail.com</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleTestEmailNotification}
                    disabled={isTestingEmail}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-[#14221C] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#FF762E]" />
                    <span>{isTestingEmail ? 'Sending...' : 'Test Send to muhammadeyamin0@gmail.com'}</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="px-6 py-3 bg-[#14221C] text-white font-bold uppercase tracking-wider rounded-xl hover:bg-[#202522] transition-colors shadow-sm"
              >
                Save Store Configuration
              </button>
            </form>
          </div>
        )}

        {/* MODAL: CREATE / EDIT PRODUCT (CRUD WITH ALL REQUIRED PROPERTIES) */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-[#E5E1D5] max-w-3xl w-full p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-[#E5E1D5]">
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                    {editingProductId ? 'Edit VANTREL OUTFIT Garment Piece' : 'Add New VANTREL OUTFIT Garment (CRUD)'}
                  </h3>
                  <p className="text-[11px] text-[#202522]/60">All properties required by production e-commerce specifications.</p>
                </div>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-1 text-[#202522]/60 hover:text-[#14221C]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} noValidate className="space-y-6 text-xs">
                {/* Notice banner highlighting the 4 essential fields */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <div className="text-[11px] text-emerald-900 leading-tight">
                    <strong>Simple Product Upload:</strong> Only 4 fields are essential (Name, Description, Price, Images). All advanced inventory, sizing, and technical specs below are optional.
                  </div>
                </div>

                {/* FIELD 1: PRODUCT NAME */}
                <div>
                  <label className="block font-bold text-[#14221C] mb-1.5 uppercase tracking-wider text-[11px]">
                    1. Product Name / পোশাকের নাম *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VANTREL Heavyweight Boxy Hoodie"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-sm text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                  />
                </div>

                {/* FIELD 2: CATEGORY SELECTION (Existing or Custom) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-[#14221C] uppercase tracking-wider text-[11px]">
                      2. Product Category / ক্যাটাগরি *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-[11px] text-[#FF762E] font-bold hover:underline cursor-pointer"
                    >
                      {isCustomCategory ? 'তালিকায় থাকা ক্যাটাগরি বেছে নিন' : '+ নতুন ক্যাটাগরি লিখুন'}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <input
                      type="text"
                      placeholder="নতুন ক্যাটাগরির নাম লিখুন (যেমন: ড্রপ শোল্ডার, টি-শার্ট, হুডি)..."
                      value={customCategoryText}
                      onChange={(e) => setCustomCategoryText(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#F7F5EF] border border-[#FF762E] rounded-xl text-xs font-bold text-[#14221C] focus:outline-none"
                    />
                  ) : (
                    <select
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value as any)}
                      className="w-full px-4 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-xs text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                    >
                      {(() => {
                        const selectableCategories = categories.filter((c) => c && c.toLowerCase() !== 'all');
                        const hasCurrent = selectableCategories.some(
                          (c) => c.toLowerCase() === String(prodCategory || '').toLowerCase()
                        );
                        const list = hasCurrent || !prodCategory || prodCategory === 'All'
                          ? selectableCategories
                          : [prodCategory, ...selectableCategories];
                        return list.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ));
                      })()}
                    </select>
                  )}
                </div>

                {/* FIELD 3: PRICING (Cost Price First -> Auto Selling Price -> Auto Regular Price) */}
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-[#14221C] mb-1.5 uppercase tracking-wider text-[11px]">
                        3. Cost Price / ক্রয়-উৎপাদন মূল্য (৳) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#14221C] text-sm">
                          ৳
                        </span>
                        <input
                          type="number"
                          min="0"
                          placeholder=""
                          value={prodCost || ''}
                          onChange={(e) => handleCostPriceChange(e.target.value)}
                          className="w-full pl-8 pr-4 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-extrabold text-sm text-[#14221C] tabular-nums focus:outline-none focus:border-[#FF762E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-[#14221C] mb-1.5 uppercase tracking-wider text-[11px]">
                        বিক্রয় মূল্য / Selling Price (৳) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#FF762E] text-sm">
                          ৳
                        </span>
                        <input
                          type="number"
                          min="1"
                          placeholder=""
                          value={prodDiscountPrice || ''}
                          onChange={(e) =>
                            setProdDiscountPrice(e.target.value === '' ? 0 : Number(e.target.value))
                          }
                          required
                          className="w-full pl-8 pr-4 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-extrabold text-sm text-[#FF762E] tabular-nums focus:outline-none focus:border-[#FF762E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-[#14221C] mb-1.5 uppercase tracking-wider text-[11px]">
                        Regular Price (৳) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-500 text-sm">
                          ৳
                        </span>
                        <input
                          type="number"
                          min="1"
                          placeholder=""
                          value={prodPrice || ''}
                          onChange={(e) =>
                            setProdPrice(e.target.value === '' ? 0 : Number(e.target.value))
                          }
                          required
                          className="w-full pl-8 pr-4 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-extrabold text-sm text-[#14221C] tabular-nums focus:outline-none focus:border-[#FF762E]"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#202522]/70 tabular-nums">
                    অটো হিসাব: Cost Price + ৳{COST_TO_SELLING_MARKUP_BDT} = মূল বিক্রয় মূল্য · বিক্রয় মূল্য + ৳{SELLING_TO_REGULAR_MARKUP_BDT} = Regular Price (সব প্রোডাক্টে অটো প্রযোজ্য)
                  </p>
                </div>

                {/* FIELD 3.5: STOCK & OUT-OF-STOCK BEHAVIOR CONTROL */}
                <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block font-bold text-[#14221C] uppercase tracking-wider text-[11px]">
                        স্টক ও Out-of-Stock কন্ট্রোল (Stock & Visibility)
                      </label>
                      <p className="text-[11px] text-[#202522]/70">
                        স্টক 0 হলে প্রোডাক্ট ওয়েবসাইট থেকে হাইড হবে নাকি "Out of Stock" দেখিয়ে অর্ডার বন্ধ রাখবে তা ঠিক করুন।
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProdStock((prev) => (prev <= 0 ? 20 : 0))}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
                        prodStock <= 0
                          ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                          : 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                      }`}
                    >
                      {prodStock <= 0 ? '+20 Stock দিন (Restock)' : 'স্টক শেষ করুন (Stock = 0)'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-4">
                      <label className="block font-bold text-[#14221C] mb-1 text-[11px]">
                        Total Stock (মোট পিস)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={prodStock}
                        onChange={(e) => setProdStock(Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full px-3 py-2 bg-white border rounded-xl font-extrabold text-sm tabular-nums focus:outline-none ${
                          prodStock <= 0
                            ? 'border-rose-400 text-rose-600 bg-rose-50/40'
                            : 'border-[#E5E1D5] text-[#14221C] focus:border-[#FF762E]'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block font-bold text-[#14221C] mb-1 text-[11px]">
                        Out of Stock (স্টক 0) হলে ওয়েবসাইটে কী হবে?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setProdOutOfStockBehavior('default')}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border text-left transition-colors cursor-pointer ${
                            prodOutOfStockBehavior === 'default'
                              ? 'bg-[#14221C] text-white border-[#14221C]'
                              : 'bg-white text-[#14221C] border-[#E5E1D5] hover:bg-stone-100'
                          }`}
                        >
                          <div>গ্লোবাল নিয়ম</div>
                          <div className="text-[10px] opacity-75 font-normal">
                            ({settings.outOfStockDefaultBehavior === 'hide' ? 'Auto Hide' : 'Show · অর্ডার বন্ধ'})
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProdOutOfStockBehavior('show')}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border text-left transition-colors cursor-pointer ${
                            prodOutOfStockBehavior === 'show'
                              ? 'bg-amber-500 text-neutral-950 border-amber-600'
                              : 'bg-white text-[#14221C] border-[#E5E1D5] hover:bg-amber-50'
                          }`}
                        >
                          <div>👁️ Show (দেখাবে)</div>
                          <div className="text-[10px] opacity-80 font-normal">Out of Stock · অর্ডার বন্ধ</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProdOutOfStockBehavior('hide')}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border text-left transition-colors cursor-pointer ${
                            prodOutOfStockBehavior === 'hide'
                              ? 'bg-rose-700 text-white border-rose-800'
                              : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          <div>🙈 Hide (লুকান)</div>
                          <div className="text-[10px] opacity-80 font-normal">কাস্টমার দেখবে না</div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FIELD 4: PRODUCT DESCRIPTION & TAGLINE */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1.5 uppercase tracking-wider text-[11px]">
                      Short Tagline / সাবটাইটেল
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: প্রিমিয়াম ১০০% কম্বড কটন রিল্যাক্সড ফিট"
                      value={prodTagline}
                      onChange={(e) => setProdTagline(e.target.value)}
                      className="w-full px-4 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1.5 uppercase tracking-wider text-[11px]">
                      Product Description / বিস্তারিত বিবরণ *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="পোশাকের কাপড়, ফিটিং, সেলাই ও কোয়ালিটি সম্পর্কিত বিস্তারিত লিখুন..."
                      value={prodDesc}
                      onChange={(e) => setProdDesc(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs text-[#14221C] focus:outline-none focus:border-[#FF762E]"
                    />
                  </div>
                </div>

                {/* FIELD 5: SIZES & COLORS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#F7F5EF] rounded-xl border border-[#E5E1D5]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-bold text-[#14221C] uppercase tracking-wider text-[10px]">
                        সাইজ ({prodSizes.join(', ') || 'কোনোটি নয়'})
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPantSizes((prev) => !prev)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer shrink-0 ${
                          showPantSizes
                            ? 'bg-amber-200 text-amber-950 border-amber-300'
                            : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-200'
                        }`}
                        title="প্যান্ট / ট্রাউজারের কোমর সাইজ (ঐচ্ছিক)"
                      >
                        {showPantSizes ? '− প্যান্ট সাইজ' : '+ প্যান্ট (ঐচ্ছিক)'}
                      </button>
                    </div>

                    {/* Always-visible T-Shirt & Hoodie Sizes (M to XXL only; S & 3XL removed) */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-stone-500">
                        টি-শার্ট / হুডি সাইজ (সবসময় সক্রিয়):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {['M', 'L', 'XL', 'XXL'].map((sz) => {
                          const isSelected = prodSizes.includes(sz);
                          return (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setProdSizes(prodSizes.filter((s) => s !== sz));
                                } else {
                                  setProdSizes([...prodSizes, sz]);
                                }
                              }}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#14221C] text-white border-[#14221C] shadow-xs'
                                  : 'bg-white text-[#202522] border-[#E5E1D5] hover:border-neutral-400'
                              }`}
                            >
                              {sz}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Optional Collapsible Pant Waist Sizes */}
                    {showPantSizes && (
                      <div className="pt-1.5 border-t border-[#E5E1D5] space-y-1 animate-fadeIn">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-stone-500">
                            প্যান্ট কোমর সাইজ (Waist):
                          </span>
                          <button
                            type="button"
                            onClick={() => setProdSizes(['28', '30', '32', '34', '36'])}
                            className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                          >
                            ২৮-৩৬ সেট করুন
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {['28', '29', '30', '31', '32', '34', '36'].map((sz) => {
                            const isSelected = prodSizes.includes(sz);
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setProdSizes(prodSizes.filter((s) => s !== sz));
                                  } else {
                                    setProdSizes([...prodSizes, sz]);
                                  }
                                }}
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#14221C] text-white border-[#14221C] shadow-xs'
                                    : 'bg-white text-[#202522] border-[#E5E1D5] hover:border-neutral-400'
                                }`}
                              >
                                {sz}"
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div>
                        <label className="block font-bold text-[#14221C] uppercase tracking-wider text-[10px]">
                          কালার ভ্যারিয়েন্ট ({prodColors.length}টি)
                        </label>
                        <p className="text-[10px] text-[#202522]/60">
                          ঐচ্ছিক—প্রয়োজনে নিচের কালার যোগ করুন বা খালি রাখুন।
                        </p>
                      </div>
                    </div>

                    {prodColors.length > 0 ? (
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap p-2 bg-white rounded-lg border border-[#E5E1D5]">
                        {prodColors.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-lg text-[11px] font-bold group hover:border-[#14221C] transition-colors"
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-black/25 shrink-0"
                              style={{ backgroundColor: c.hex }}
                              title={c.hex}
                            />
                            <span className="text-[#14221C]">{c.name}</span>
                            <button
                              type="button"
                              onClick={() => setProdColors(prodColors.filter((_, idx) => idx !== i))}
                              className="text-stone-400 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                              title="Remove color"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 bg-white/70 border border-dashed border-[#E5E1D5] rounded-lg text-[10px] text-[#202522]/70 mb-2">
                        <span>কোনো কালার সিলেক্ট করা হয়নি (বাধ্যতামূলক নয়)।</span>
                      </div>
                    )}

                    {/* Quick Add Palette Chips (Optional shortcuts for Admin) */}
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {[
                        { name: 'Black', hex: '#000000' },
                        { name: 'White', hex: '#FFFFFF' },
                        { name: 'Charcoal', hex: '#222522' },
                        { name: 'Navy Blue', hex: '#1B2A4A' },
                        { name: 'Forest Pine', hex: '#14221C' },
                        { name: 'Maroon', hex: '#5B1E31' },
                        { name: 'Olive Green', hex: '#3D4A3E' },
                        { name: 'Beige', hex: '#D4C5B9' }
                      ].map((chip) => {
                        const exists = prodColors.some((c) => c.name.toLowerCase() === chip.name.toLowerCase());
                        return (
                          <button
                            key={chip.name}
                            type="button"
                            onClick={() => {
                              if (exists) {
                                setProdColors(prodColors.filter((c) => c.name.toLowerCase() !== chip.name.toLowerCase()));
                              } else {
                                setProdColors([...prodColors, chip]);
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                              exists
                                ? 'bg-[#14221C] text-white border-[#14221C]'
                                : 'bg-white text-[#14221C] border-[#E5E1D5] hover:border-[#14221C]'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: chip.hex }}
                            />
                            <span>{chip.name}</span>
                            {exists && <span className="text-[9px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="অন্য কোনো কালারের নাম লিখুন (যেমন: Crimson Red, Emerald Green)..."
                        value={newColorName}
                        onChange={(e) => setNewColorName(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-[#E5E1D5] rounded-lg text-xs"
                      />
                      <input
                        type="color"
                        value={newColorHex}
                        onChange={(e) => setNewColorHex(e.target.value)}
                        className="w-9 h-8 p-0.5 bg-white border border-[#E5E1D5] rounded-lg cursor-pointer shrink-0"
                        title="কালার নির্বাচন করুন"
                      />
                      <button
                        type="button"
                        onClick={handleAddColor}
                        className="px-3 py-1.5 bg-[#14221C] text-white text-xs font-bold rounded-lg hover:bg-[#202522] cursor-pointer shrink-0"
                      >
                        + Add Color
                      </button>
                    </div>
                  </div>
                </div>

                {/* ESSENTIAL FIELD 4: MULTIPLE PRODUCT IMAGES */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="block font-bold text-[#14221C] uppercase tracking-wider text-[11px]">
                        4. Product Images ({prodImages.length}টি যুক্ত আছে)
                      </label>
                      <span className="text-[10px] text-[#202522]/60">
                        বাধ্যতামূলক কোনো ছবি নেই — আপনি যে ছবি আপলোড করবেন বা লিংক দিবেন শুধুমাত্র সেটাই সেট থাকবে।
                      </span>
                    </div>
                    {prodImages.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleDownloadModalGalleryImages('zip')}
                          disabled={isDownloadingImages}
                          className="px-2.5 py-1 bg-[#14221C] hover:bg-neutral-800 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Bundle all gallery photos into vantrel-outfit-images.zip"
                        >
                          <Download className="w-3 h-3 text-[#FF762E]" />
                          <span>{isDownloadingImages ? 'Zipping...' : 'Download ZIP'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadModalGalleryImages('sequential')}
                          disabled={isDownloadingImages}
                          className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 text-[#14221C] text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Download files individually as vantrel-outfit-1, vantrel-outfit-2..."
                        >
                          <Download className="w-3 h-3" />
                          <span>Sequential</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Image Thumbnails with Primary Badge & Reorder (Supports Drag & Drop) */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer?.files?.length) {
                        void processImageFiles(e.dataTransfer.files);
                      }
                    }}
                    className="p-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5]"
                  >
                    {prodImages.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {prodImages.map((img, idx) => (
                          <div
                            key={idx}
                            className={`relative w-24 h-32 rounded-xl overflow-hidden border-2 bg-white flex flex-col justify-between group shadow-2xs ${
                              idx === 0 ? 'border-[#14221C] ring-2 ring-[#FF762E]/20' : 'border-[#E5E1D5]'
                            }`}
                          >
                            <img
                              src={toDisplayImageUrl(img)}
                              alt={buildSeoImageAlt({
                                name: prodName || 'Apparel Item',
                                category: isCustomCategory ? customCategoryText : prodCategory,
                                viewIndex: idx
                              })}
                              onError={handleProxyImageError}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />

                            {/* Primary Badge */}
                            {idx === 0 ? (
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#14221C] text-[#FF762E] text-[9px] font-extrabold uppercase rounded shadow-xs">
                                Primary
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryImage(idx)}
                                className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/75 hover:bg-[#14221C] text-white text-[9px] font-bold uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              >
                                Set Primary
                              </button>
                            )}

                            {/* Remove Image Button */}
                            <button
                              type="button"
                              onClick={() => setProdImages(prodImages.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Remove Image"
                            >
                              <X className="w-3 h-3" />
                            </button>

                            {/* Move Left / Right Reorder Controls */}
                            <div className="absolute bottom-1 inset-x-1 flex items-center justify-between opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-black/60 rounded px-1 py-0.5 text-white">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveImage(idx, 'left')}
                                className="disabled:opacity-20 hover:text-[#FF762E] cursor-pointer"
                                title="Move Earlier"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <span className="text-[9px] font-mono font-bold">#{idx + 1}</span>
                              <button
                                type="button"
                                disabled={idx === prodImages.length - 1}
                                onClick={() => handleMoveImage(idx, 'right')}
                                className="disabled:opacity-20 hover:text-[#FF762E] cursor-pointer"
                                title="Move Later"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        onClick={() => productImageInputRef.current?.click()}
                        className="py-6 px-4 text-center border-2 border-dashed border-[#E5E1D5] hover:border-[#FF762E] rounded-xl bg-white/60 cursor-pointer transition-colors"
                      >
                        <ImageIcon className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-[#14221C]">
                          এখানে ক্লিক করে বা ছবি টেনে এনে (Drag & Drop) প্রোডাক্টের ছবি আপলোড করুন
                        </p>
                        <p className="text-[11px] text-[#202522]/60 mt-1">
                          নিচে ইমেজ URL দিন অথবা কম্পিউটার/মোবাইল থেকে সরাসরি ১ বা একাধিক ছবি আপলোড করুন।
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Add Image URL or File Upload */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="ইমেজ URL পেস্ট করুন অথবা কপি করা ছবি Ctrl+V দিয়ে পেস্ট করুন..."
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddImage();
                        }
                      }}
                      onPaste={(e) => {
                        const pastedFiles = e.clipboardData?.files;
                        if (pastedFiles && pastedFiles.length > 0) {
                          e.preventDefault();
                          void processImageFiles(pastedFiles);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs focus:outline-none focus:border-[#FF762E]"
                    />
                    <button
                      type="button"
                      disabled={isUploadingImages}
                      onClick={handleAddImage}
                      className="px-4 py-2 bg-[#14221C] hover:bg-[#202522] disabled:opacity-50 text-white rounded-xl font-bold uppercase shrink-0 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#FF762E]" />
                      <span>{newImageUrl.trim() ? 'Add Image URL' : 'Upload / Add Image'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingImages}
                      onClick={() => productImageInputRef.current?.click()}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 border border-[#E5E1D5] text-[#14221C] rounded-xl font-bold uppercase cursor-pointer shrink-0 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#FF762E]" />
                      <span>{isUploadingImages ? 'আপলোড হচ্ছে...' : 'Upload Local Files (১ বা একাধিক)'}</span>
                    </button>
                    <input
                      ref={productImageInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </div>

                  {/* Live Proxy URL Preview Indicator when Admin types/pastes a 3rd-party or dropshipping link */}
                  {newImageUrl.trim() && isExternalThirdPartyImage(normalizeThirdPartyImageUrl(newImageUrl)) && (
                    <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 space-y-0.5">
                      <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Auto Image Proxy (vantreloutfit.shop) সক্রিয় হবে:</span>
                      </div>
                      <p className="font-mono text-[10px] text-emerald-700 break-all">
                        {rewriteToCanonicalProxyUrl(newImageUrl)}
                      </p>
                    </div>
                  )}

                  {/* Quick Preset Clothing Images */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-neutral-500 font-bold">স্যাম্পল ছবি যুক্ত করুন:</span>
                    {[
                      { label: 'Hoodie', url: 'https://www.vantreloutfit.shop/assets/images/product_premium_hoodie_1792588590406.webp' },
                      { label: 'T-Shirt', url: 'https://www.vantreloutfit.shop/assets/images/product_oversized_tee_1792588591424.webp' },
                      { label: 'Panjabi', url: 'https://www.vantreloutfit.shop/assets/images/product_panjabi_casual_1792588592268.webp' },
                      { label: 'Pants', url: 'https://www.vantreloutfit.shop/assets/images/product_denim_cargo_1792588592254.webp' },
                      { label: 'Jacket', url: 'https://www.vantreloutfit.shop/assets/images/hero_fashion_yeamin_1792588589630.webp' }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const updated = [...prodImages, preset.url];
                          setProdImages(updated);
                        }}
                        className="px-2 py-1 bg-white border border-[#E5E1D5] hover:border-[#FF762E] text-[10px] font-bold rounded-lg text-[#14221C] transition-colors cursor-pointer"
                        title="এই স্যাম্পল ছবি যোগ করুন"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* COLLAPSIBLE SECTION: ADVANCED GARMENT SPECIFICATIONS & INVENTORY */}
                <div className="pt-2 border-t border-[#E5E1D5]">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSpecs(!showAdvancedSpecs)}
                    className="w-full py-3 px-4 bg-[#F7F5EF] hover:bg-stone-200/80 rounded-2xl flex items-center justify-between text-xs font-bold text-[#14221C] uppercase tracking-wider transition-colors"
                  >
                    <span>Advanced Inventory, Sizing & Technical Specs (Optional)</span>
                    <div className="flex items-center gap-1.5 text-[#202522]/60">
                      <span className="text-[11px] font-normal normal-case font-sans">
                        {showAdvancedSpecs ? 'Hide details' : 'Show details'}
                      </span>
                      {showAdvancedSpecs ? (
                        <ChevronUp className="w-4 h-4 text-[#14221C]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#14221C]" />
                      )}
                    </div>
                  </button>

                  {showAdvancedSpecs && (
                    <div className="mt-4 p-5 bg-white rounded-2xl border border-[#E5E1D5] space-y-4">
                      {/* Subcategory, SKU & Stock Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-[#14221C] mb-1">
                            Sub-Category / ধরন
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Heavyweight Streetwear"
                            value={prodSubCategory}
                            onChange={(e) => setProdSubCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#14221C] mb-1">SKU Code</label>
                          <input
                            type="text"
                            value={prodSku}
                            onChange={(e) => setProdSku(e.target.value)}
                            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-mono uppercase"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#14221C] mb-1">
                            Total Stock Units
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={prodStock}
                            onChange={(e) => setProdStock(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold tabular-nums"
                          />
                        </div>
                      </div>

                      {/* Fabric, GSM, Video */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-[#14221C] mb-1">Fabric & Weave</label>
                          <input
                            type="text"
                            value={prodFabric}
                            onChange={(e) => setProdFabric(e.target.value)}
                            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#14221C] mb-1">Fabric GSM (Optional)</label>
                          <input
                            type="number"
                            placeholder="Description থেকে অটো নেবে"
                            value={prodGsm}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              setProdGsm(raw === '' ? '' : Math.max(0, Number(raw) || 0));
                            }}
                            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#14221C] mb-1">Runway Video URL</label>
                          <input
                            type="text"
                            placeholder="e.g. https://.../video.mp4"
                            value={prodVideoUrl}
                            onChange={(e) => setProdVideoUrl(e.target.value)}
                            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-mono text-[11px]"
                          />
                        </div>
                      </div>

                      {/* Badges & Status */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="flex flex-wrap items-center gap-4 p-3 bg-[#F7F5EF] rounded-xl border border-[#E5E1D5]">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#14221C]">
                            <input
                              type="checkbox"
                              checked={prodIsFeatured}
                              onChange={(e) => setProdIsFeatured(e.target.checked)}
                              className="rounded border-[#E5E1D5] text-[#14221C]"
                            />
                            <span>Featured</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#14221C]">
                            <input
                              type="checkbox"
                              checked={prodIsNewArrival}
                              onChange={(e) => setProdIsNewArrival(e.target.checked)}
                              className="rounded border-[#E5E1D5] text-[#14221C]"
                            />
                            <span>New Arrival</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#14221C]">
                            <input
                              type="checkbox"
                              checked={prodIsBestSeller}
                              onChange={(e) => setProdIsBestSeller(e.target.checked)}
                              className="rounded border-[#E5E1D5] text-[#14221C]"
                            />
                            <span>Bestseller</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#14221C]">
                            <input
                              type="checkbox"
                              checked={prodIsPinned}
                              onChange={(e) => setProdIsPinned(e.target.checked)}
                              className="rounded border-[#E5E1D5] text-amber-600"
                            />
                            <span className="flex items-center gap-1 text-amber-800 font-bold">
                              <Pin className="w-3.5 h-3.5 text-amber-600" />
                              <span>📌 সবার উপরে পিন করুন (Pin to Top)</span>
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#14221C]">
                            <input
                              type="checkbox"
                              checked={prodIsTopProduct}
                              onChange={(e) => setProdIsTopProduct(e.target.checked)}
                              className="rounded border-[#E5E1D5] text-amber-500"
                            />
                            <span className="flex items-center gap-1 text-amber-950 font-bold bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>⭐ টপ প্রোডাক্ট (হোমপেজ টপ সেকশনে প্রদর্শন করুন)</span>
                            </span>
                          </label>
                        </div>

                        <div>
                          <label className="block font-bold text-[#14221C] mb-1">
                            Publication Status
                          </label>
                          <select
                            value={prodStatus}
                            onChange={(e) => setProdStatus(e.target.value as any)}
                            className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-semibold text-[#14221C]"
                          >
                            <option value="published">Published (Visible on storefront)</option>
                            <option value="draft">Draft (Saved in catalog only)</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E1D5]">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2.5 bg-[#F7F5EF] hover:bg-stone-200 text-[#202522] rounded-xl font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProduct || isUploadingImages}
                    className="px-8 py-2.5 bg-[#14221C] hover:bg-[#202522] disabled:opacity-50 text-white font-bold uppercase tracking-wider rounded-xl transition-colors shadow-md cursor-pointer"
                  >
                    {isSavingProduct
                      ? 'সংরক্ষণ হচ্ছে...'
                      : editingProductId
                        ? 'Update Garment Piece'
                        : 'Save & Publish Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: COMPREHENSIVE CUSTOMER PROFILE & FULL ADDRESS INSPECTOR */}
        {(inspectingCustomerProfile || inspectingCustomer) && (() => {
          const cust = inspectingCustomerProfile || (inspectingCustomer ? allCustomerProfiles.find((c) => c.phone === inspectingCustomer.phone) || {
            id: inspectingCustomer.id,
            name: inspectingCustomer.name,
            phone: inspectingCustomer.phone,
            email: inspectingCustomer.email,
            district: inspectingCustomer.savedAddresses?.[0]?.district || 'ঢাকা',
            upazila: inspectingCustomer.savedAddresses?.[0]?.upazila || 'সদর',
            streetAddress: inspectingCustomer.savedAddresses?.[0]?.streetAddress || 'ঠিকানা পাওয়া যায়নি',
            joinedDate: inspectingCustomer.joinedDate || '2026-10-01',
            totalOrders: inspectingCustomer.totalOrders || 0,
            totalSpent: inspectingCustomer.totalSpent || 0,
            status: inspectingCustomer.status || 'Active',
            orders: orders.filter((o) => o.customer.phone === inspectingCustomer.phone),
            allAddresses: inspectingCustomer.savedAddresses || []
          } : null);

          if (!cust) return null;

          const isDhaka = cust.district.toLowerCase().includes('dhaka');
          const fullAddressString = `${cust.name} | ${cust.phone} | ${cust.streetAddress}, ${cust.upazila}, ${cust.district}`;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white rounded-3xl border border-[#E5E1D5] max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Modal Header */}
                <div className="flex justify-between items-start pb-4 border-b border-[#E5E1D5]">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#14221C] text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
                      {cust.name.trim().charAt(0) || 'C'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-xl font-bold text-[#14221C]">
                          {cust.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          {cust.status}
                        </span>
                      </div>
                      <span className="text-xs text-[#202522]/60">
                        নিবন্ধিত / প্রথম অর্ডার: {cust.joinedDate} · মোট অর্ডার: {cust.totalOrders} টি
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setInspectingCustomer(null);
                      setInspectingCustomerProfile(null);
                    }}
                    className="p-1.5 text-[#202522]/60 hover:text-[#14221C] rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 5 MANDATORY CUSTOMER DETAILS HIGHLIGHT CARD */}
                <div className="p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5E1D5]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#14221C] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#FF762E]" />
                      <span>কাস্টমারের সম্পূর্ণ বিবরণ ও ডেলিভারি ঠিকানা</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullAddressString, 'modal-full-copy')}
                      className="px-3 py-1 bg-[#14221C] hover:bg-[#202522] text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Copy className="w-3 h-3 text-[#FF762E]" />
                      <span>কুরিয়ারের জন্য সম্পূর্ণ কপি</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* ১. নাম */}
                    <div className="p-3 bg-white rounded-xl border border-[#E5E1D5]">
                      <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">
                        ১. কাস্টমারের নাম
                      </span>
                      <span className="text-sm font-extrabold text-[#14221C] mt-0.5 block">
                        {cust.name}
                      </span>
                    </div>

                    {/* ২. মোবাইল নাম্বার */}
                    <div className="p-3 bg-white rounded-xl border border-[#E5E1D5]">
                      <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">
                        ২. সচল মোবাইল নাম্বার
                      </span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-sm font-extrabold font-mono text-[#14221C]">
                          {cust.phone}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(cust.phone, 'modal-phone')}
                            className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-700"
                            title="কপি করুন"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`tel:${cust.phone}`}
                            className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            <span>কল দিন</span>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* ৩. জেলা */}
                    <div className="p-3 bg-white rounded-xl border border-[#E5E1D5]">
                      <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">
                        ৩. ডেলিভারি জেলা
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-extrabold text-[#14221C]">
                          {cust.district}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDhaka
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {resolveDeliveryZone(cust.district, cust.upazila) === 'inside_dhaka'
                            ? 'ঢাকা সিটি (ডেলিভারি ফ্রি ৳০)'
                            : resolveDeliveryZone(cust.district, cust.upazila) === 'dhaka_sub_area'
                            ? 'ঢাকা সাব-এরিয়া (ডেলিভারি চার্জ ৳৫০)'
                            : '৬৩ জেলা (ডেলিভারি চার্জ ৳৫০)'}
                        </span>
                      </div>
                    </div>

                    {/* ৪. উপজেলা / থানা */}
                    <div className="p-3 bg-white rounded-xl border border-[#E5E1D5]">
                      <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">
                        ৪. উপজেলা / থানা
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 text-sm font-extrabold text-[#14221C]">
                        <Building2 className="w-4 h-4 text-[#FF762E]" />
                        <span>{cust.upazila}</span>
                      </div>
                    </div>
                  </div>

                  {/* ৫. বিস্তারিত ঠিকানা */}
                  <div className="p-3 bg-white rounded-xl border border-[#E5E1D5]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-[#202522]/50">
                        ৫. আশেপাশের বিস্তারিত ঠিকানা (বাড়ি নং, রোড নং, এলাকা)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cust.streetAddress, 'modal-addr')}
                        className="text-[10px] text-[#FF762E] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Copy className="w-3 h-3" />
                        <span>শুধু ঠিকানা কপি</span>
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-[#14221C] leading-relaxed">
                      {cust.streetAddress}
                    </p>
                  </div>
                </div>

                {/* All Saved Addresses on File */}
                {cust.allAddresses && cust.allAddresses.length > 1 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#14221C]">
                      কাস্টমারের অন্যান্য সংরক্ষিত ঠিকানাসমূহ ({cust.allAddresses.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {cust.allAddresses.map((addr, idx) => (
                        <div key={idx} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                          <div className="font-bold text-[#14221C]">{addr.fullName} ({addr.phone})</div>
                          <div className="text-[11px] text-stone-600 mt-0.5">
                            {addr.streetAddress}, {addr.upazila}, {addr.district}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orders History */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#14221C]">
                    অর্ডার হিস্ট্রি ({cust.orders.length} টি অর্ডার · মোট ব্যয়: ৳{cust.totalSpent.toLocaleString()})
                  </h4>

                  {cust.orders.length === 0 ? (
                    <p className="text-xs text-stone-500 py-3 text-center bg-stone-50 rounded-xl">
                      এই কাস্টমারের কোনো অর্ডার পাওয়া যায়নি।
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {cust.orders.map((ord) => (
                        <div key={ord.id} className="p-3.5 bg-[#F7F5EF] rounded-xl border border-[#E5E1D5] text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-[#14221C]">{ord.orderNumber}</span>
                            <span className="px-2 py-0.5 bg-[#14221C] text-white rounded text-[10px] font-bold">
                              {ord.orderStatus}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#202522]/70 flex justify-between items-center">
                            <span>তারিখ: {new Date(ord.createdAt).toLocaleDateString('en-GB')} · বিল: <strong>৳{ord.total.toLocaleString()}</strong></span>
                            <span>{ord.paymentMethod}</span>
                          </div>
                          <div className="text-[10px] text-stone-600 bg-white p-2 rounded-lg border border-stone-200">
                            <strong>ডেলিভারি হয়েছিল:</strong> {ord.customer.streetAddress}, {ord.customer.upazila}, {ord.customer.district}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end pt-4 border-t border-[#E5E1D5]">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectingCustomer(null);
                      setInspectingCustomerProfile(null);
                    }}
                    className="px-6 py-2.5 bg-[#14221C] text-white text-xs font-bold uppercase rounded-xl hover:bg-[#202522] cursor-pointer"
                  >
                    বন্ধ করুন (Close)
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL: ORDER DETAILS & STATUS UPDATE */}
        {inspectingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-[#E5E1D5] max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-[#E5E1D5]">
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#14221C]">
                    Order Management — {inspectingOrder.orderNumber}
                  </h3>
                  <span className="text-xs text-[#202522]/50">
                    Placed: {new Date(inspectingOrder.createdAt).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => setInspectingOrder(null)}
                  className="p-1 text-[#202522]/60 hover:text-[#14221C]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Delivery info */}
              <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E1D5]">
                  <span className="font-bold text-[#14221C] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF762E]" />
                    <span>কাস্টমার ও ডেলিভারি বিবরণ (৫টি তথ্য)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(
                      `${inspectingOrder.customer.fullName} | ${inspectingOrder.customer.phone} | ${inspectingOrder.customer.streetAddress}, ${inspectingOrder.customer.upazila}, ${inspectingOrder.customer.district}`,
                      'inspect-ord-copy'
                    )}
                    className="px-2.5 py-1 bg-[#14221C] hover:bg-[#202522] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3 text-[#FF762E]" />
                    <span>কুরিয়ারের জন্য সম্পূর্ণ কপি</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D5]">
                    <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">১. নাম</span>
                    <span className="font-bold text-[#14221C] text-sm block mt-0.5">
                      {inspectingOrder.customer.fullName}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D5]">
                    <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">২. মোবাইল নাম্বার</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono font-bold text-[#14221C] text-sm">
                        {inspectingOrder.customer.phone}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(inspectingOrder.customer.phone, 'ord-phone')}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded"
                          title="নাম্বার কপি করুন"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`tel:${inspectingOrder.customer.phone}`}
                          className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold"
                        >
                          কল দিন
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D5]">
                    <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">৩. জেলা</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-bold text-[#14221C]">{inspectingOrder.customer.district}</span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                        ডেলিভারি চার্জ:{' '}
                        {(inspectingOrder.deliveryFee ?? (resolveDeliveryZone(inspectingOrder.customer.district, inspectingOrder.customer.upazila) === 'inside_dhaka' ? 0 : 50)) === 0
                          ? 'ফ্রি (৳০)'
                          : `৳${inspectingOrder.deliveryFee ?? 50}`}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D5]">
                    <span className="text-[10px] font-bold uppercase text-[#202522]/50 block">৪. উপজেলা / থানা</span>
                    <span className="font-bold text-[#14221C] block mt-0.5">
                      {inspectingOrder.customer.upazila}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D5]">
                  <span className="text-[10px] font-bold uppercase text-[#202522]/50 block mb-0.5">
                    ৫. বিস্তারিত ডেলিভারি ঠিকানা
                  </span>
                  <p className="font-medium text-[#14221C] leading-relaxed">
                    {inspectingOrder.customer.streetAddress}
                  </p>
                </div>

                {inspectingOrder.customer.notes && (
                  <p className="italic text-[#202522]/70 text-[11px] pt-1">
                    <strong>কাস্টমারের নোট / নির্দেশনা:</strong> {inspectingOrder.customer.notes}
                  </p>
                )}
              </div>

              {/* Status Update Control */}
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">Change Order Status</label>
                    <select
                      value={inspectingOrder.orderStatus}
                      onChange={(e) => {
                        const newSt = e.target.value as OrderStatus;
                        updateOrderStatus(inspectingOrder.id, newSt, statusNote);
                        setInspectingOrder({ ...inspectingOrder, orderStatus: newSt });
                      }}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                    >
                      <option value="Pending Customer Confirmation">Pending Customer Confirmation</option>
                      <option value="Customer Confirmed">Customer Confirmed</option>
                      <option value="Awaiting Staff Approval">Awaiting Staff Approval</option>
                      <option value="Order Confirmed">Order Confirmed</option>
                      <option value="Processing">Processing</option>
                      <option value="Packed">Packed</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Out for Delivery">Out for Delivery</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancellation Requested">Cancellation Requested</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Return Requested">Return Requested</option>
                      <option value="Returned">Returned</option>
                      <option value="Refund Pending">Refund Pending</option>
                      <option value="Refunded">Refunded</option>
                      <option value="Failed Delivery">Failed Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">Payment Status</label>
                    <select
                      value={inspectingOrder.paymentStatus}
                      onChange={(e) => {
                        const newPay = e.target.value as PaymentStatus;
                        updateOrderPayment(inspectingOrder.id, newPay);
                        setInspectingOrder({ ...inspectingOrder, paymentStatus: newPay });
                      }}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Failed">Failed</option>
                      <option value="Refunded">Refunded</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-[#14221C]">
                      Tracking ID ও কুরিয়ার যুক্ত / আপডেট করুন
                    </label>
                    <button
                      type="button"
                      onClick={() => setTrackingInput(generateInternalTrackingId(inspectingOrder.orderNumber))}
                      className="px-2 py-0.5 bg-white border border-[#E5E1D5] hover:border-[#14221C] text-[10px] font-bold text-[#14221C] rounded-lg cursor-pointer"
                    >
                      🎲 Auto Tracking ID
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={inspectCourier}
                      onChange={(e) => setInspectCourier(e.target.value as Order['courierName'])}
                      className="px-3 py-2 bg-white border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
                    >
                      <option value="Steadfast">Steadfast</option>
                      <option value="Pathao">Pathao</option>
                      <option value="RedX">RedX</option>
                      <option value="Paperfly">Paperfly</option>
                      <option value="eCourier">eCourier</option>
                      <option value="In-House">In-House Rider</option>
                    </select>
                    <input
                      type="text"
                      placeholder="e.g. STEAD-894211 or VT-TRK-..."
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                      className="sm:col-span-2 px-3 py-2 bg-white border border-[#E5E1D5] rounded-xl font-mono font-bold uppercase"
                    />
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="কাস্টমারকে দেখানোর জন্য বর্তমান অবস্থা/লোকেশন নোট (ঐচ্ছিক)"
                      value={inspectTrackingNote}
                      onChange={(e) => setInspectTrackingNote(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-[#E5E1D5] rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cleanTrack = trackingInput.trim();
                        if (!cleanTrack) {
                          showToast('Tracking ID খালি', 'অনুগ্রহ করে একটি Tracking ID লিখুন বা Auto বাটনে ক্লিক করুন।', 'error');
                          return;
                        }
                        const targetSt: OrderStatus =
                          inspectingOrder.orderStatus === 'Pending Customer Confirmation' ||
                          inspectingOrder.orderStatus === 'Customer Confirmed' ||
                          inspectingOrder.orderStatus === 'Awaiting Staff Approval'
                            ? 'Order Confirmed'
                            : inspectingOrder.orderStatus;
                        assignCourierTracking(inspectingOrder.id, inspectCourier, cleanTrack, {
                          targetStatus: targetSt,
                          note: inspectTrackingNote.trim() || undefined
                        });
                        setInspectingOrder({
                          ...inspectingOrder,
                          orderStatus: targetSt,
                          courierName: inspectCourier,
                          trackingNumber: cleanTrack,
                          courierTrackingCode: cleanTrack,
                          currentLocationNote: inspectTrackingNote.trim() || inspectingOrder.currentLocationNote
                        });
                      }}
                      className="px-4 py-2 bg-[#14221C] hover:bg-[#202522] text-white rounded-xl font-bold uppercase cursor-pointer shrink-0"
                    >
                      Save Tracking ID
                    </button>
                  </div>
                </div>

                {getTrackingCode(inspectingOrder) && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-900 block">
                        {inspectingOrder.courierName || 'Steadfast'}: {getTrackingCode(inspectingOrder)}
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        কাস্টমার ওয়েবসাইটে লাইভ ট্র্যাকিং ও অগ্রগতি দেখতে পাচ্ছেন
                      </span>
                    </div>
                    {inspectingOrder.trackingUrl && inspectingOrder.trackingUrl.startsWith('http') && (
                      <a
                        href={inspectingOrder.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1 text-[11px]"
                      >
                        <span>Track Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-[#14221C] uppercase tracking-wider">Order Items</h4>
                <div className="divide-y divide-[#E5E1D5]">
                  {inspectingOrder.items.map((i) => (
                    <div key={i.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-[#14221C]">{i.name}</div>
                        <div className="text-[11px] text-[#202522]/60">
                          {i.size} / {i.color} · Qty: {i.quantity}
                        </div>
                      </div>
                      <div className="font-bold tabular-nums">
                        ৳{(i.price * i.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[#E5E1D5] gap-2 flex-wrap">
                {(inspectingOrder.orderStatus === 'Awaiting Staff Approval' ||
                  inspectingOrder.orderStatus === 'Customer Confirmed' ||
                  inspectingOrder.orderStatus === 'Pending Customer Confirmation') && (
                  <button
                    type="button"
                    onClick={() => {
                      approveOrder(inspectingOrder.id);
                      const confirmedOrd = { ...inspectingOrder, orderStatus: 'Order Confirmed' as OrderStatus };
                      setInspectingOrder(null);
                      setCourierModalOrder(confirmedOrd);
                      setSelectedCourier(confirmedOrd.courierName || 'Steadfast');
                      setCourierTrackingCode(getTrackingCode(confirmedOrd) || generateInternalTrackingId(confirmedOrd.orderNumber));
                      setCourierTargetStatus('Order Confirmed');
                      setCourierProgressNote('অর্ডার কনফার্ম হয়েছে এবং প্যাকিং প্রস্তুতি চলছে।');
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Add Tracking ID</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectingOrder(null)}
                  className="px-6 py-2 bg-[#14221C] text-white text-xs font-bold uppercase rounded-xl ml-auto cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ASSIGN TRACKING ID & COURIER PROGRESS */}
        {courierModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-[#E5E1D5] max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
              <div className="flex justify-between items-center pb-3 border-b border-[#E5E1D5]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF762E] block">
                    Post-Confirmation Tracking System
                  </span>
                  <h3 className="font-heading text-lg font-bold text-[#14221C] tracking-tight">
                    Tracking ID যুক্ত / আপডেট করুন — {courierModalOrder.orderNumber}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCourierModalOrder(null)}
                  className="p-1 text-[#202522]/60 hover:text-[#14221C] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] text-xs space-y-1">
                <p><strong>কাস্টমার:</strong> {courierModalOrder.customer.fullName} ({courierModalOrder.customer.phone})</p>
                <p><strong>গন্তব্য:</strong> {courierModalOrder.customer.upazila}, {courierModalOrder.customer.district}</p>
                <p><strong>মোট বিল:</strong> ৳{courierModalOrder.total.toLocaleString()} ({courierModalOrder.paymentStatus})</p>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">কুরিয়ার পার্টনার</label>
                    <select
                      value={selectedCourier}
                      onChange={(e) => setSelectedCourier(e.target.value as Order['courierName'])}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
                    >
                      <option value="Steadfast">Steadfast Courier</option>
                      <option value="Pathao">Pathao Courier</option>
                      <option value="RedX">RedX Logistics</option>
                      <option value="Paperfly">Paperfly BD</option>
                      <option value="eCourier">eCourier Bangladesh</option>
                      <option value="In-House">In-House Express Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#14221C] mb-1">অর্ডারটি কতটুকু এগিয়েছে (Stage)</label>
                    <select
                      value={courierTargetStatus}
                      onChange={(e) => setCourierTargetStatus(e.target.value as OrderStatus)}
                      className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
                    >
                      <option value="Order Confirmed">Order Confirmed (কনফার্ম - ৩২%)</option>
                      <option value="Processing">Processing (প্রসেসিং - ৪৮%)</option>
                      <option value="Packed">Packed (প্যাকিং সম্পন্ন - ৬৪%)</option>
                      <option value="Shipped">Shipped (কুরিয়ারে হস্তান্তর - ৮০%)</option>
                      <option value="Out for Delivery">Out for Delivery (ডেলিভারির পথে - ৯২%)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-[#14221C]">Tracking ID / Consignment Code</label>
                    <button
                      type="button"
                      onClick={() => setCourierTrackingCode(generateInternalTrackingId(courierModalOrder.orderNumber))}
                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      🎲 Auto Tracking ID তৈরি করুন
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={selectedCourier === 'Steadfast' ? 'e.g. STF-893201BD or VT-TRK-...' : 'e.g. PTH-551940 or VT-TRK-...'}
                    value={courierTrackingCode}
                    onChange={(e) => setCourierTrackingCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-mono uppercase font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">
                    বর্তমান অবস্থা / লোকেশন আপডেট (কাস্টমার ট্র্যাকিংয়ে দেখতে পাবেন)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: প্যাকিং সম্পন্ন হয়ে ঢাকা কুরিয়ার হাব থেকে রওনা হয়েছে"
                    value={courierProgressNote}
                    onChange={(e) => setCourierProgressNote(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[
                      'অর্ডার কনফার্ম ও প্যাকিং চলছে',
                      'কুরিয়ারে হ্যান্ডওভার সম্পন্ন',
                      'ডেলিভারির জন্য রওনা হয়েছে'
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCourierProgressNote(preset)}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-md text-[10px] text-[#14221C] cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E1D5]">
                <button
                  type="button"
                  onClick={() => setCourierModalOrder(null)}
                  className="px-4 py-2 bg-[#F7F5EF] hover:bg-stone-200 text-[#202522] rounded-xl font-semibold text-xs cursor-pointer"
                >
                  পরে যুক্ত করবো
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!courierTrackingCode.trim()) {
                      showToast('Tracking ID প্রয়োজন', 'অনুগ্রহ করে Tracking ID লিখুন বা Auto তৈরি বাটনে ক্লিক করুন।', 'error');
                      return;
                    }
                    assignCourierTracking(courierModalOrder.id, selectedCourier, courierTrackingCode.trim(), {
                      targetStatus: courierTargetStatus,
                      note: courierProgressNote.trim() || undefined
                    });
                    setCourierModalOrder(null);
                  }}
                  className="px-5 py-2 bg-[#14221C] text-white font-bold uppercase rounded-xl hover:bg-[#202522] text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Truck className="w-3.5 h-3.5 text-[#FF762E]" />
                  <span>Save Tracking ID</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
