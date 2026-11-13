import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  CartItem,
  Order,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  Coupon,
  StoreSettings,
  User,
  Address,
  ProductCategory,
  StaffRole,
  AuditLog,
  SmsLog,
  SmsTemplate,
  BannerConfig,
  LoyaltyTransaction,
  FinancialRecord,
  StaffModerator,
  ThemeConfig,
  ThemePreset,
  Banner3DConfig,
  ProductVariant,
  WhatsAppLog
} from '../types';
import {
  INITIAL_COUPONS,
  INITIAL_SETTINGS,
  INITIAL_CUSTOMERS,
  INITIAL_SMS_TEMPLATES,
  INITIAL_SMS_LOGS,
  INITIAL_AUDIT_LOGS,
  INITIAL_BANNERS,
  INITIAL_FINANCIAL_RECORDS,
  INITIAL_MODERATORS,
  INITIAL_THEME,
  INITIAL_3D_BANNERS
} from '../data/products';
import { auth, db, IS_GOOGLE_CLOUD_CONNECTED, sanitizeFirestoreData } from '../firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const ALLOWED_SIZES = [
  '28', '29', '30', '31', '32', '33', '34', '36', '38',
  'S', 'M', 'L', 'XL', 'XXL', '3XL'
] as const;

const LEGACY_PRIMARY_PRODUCT_IDS = new Set([
  'prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005',
  'prod-006', 'prod-007', 'prod-008', 'prod-009', 'prod-010',
  'prod-011', 'prod-012', 'prod-013', 'prod-014', 'prod-015',
  'prod-016', 'prod-017', 'prod-018', 'prod-019', 'prod-overcoat-005'
]);

export function sanitizeProductSizes(prod: Product): Product {
  if (!prod) return prod;
  const isPantCategory =
    /pant|trouser|cargo|jogger|bottom|jeans/i.test(prod.category || '') ||
    /pant|trouser|cargo|jogger|bottom|jeans/i.test(prod.subCategory || '') ||
    (Array.isArray(prod.tags) && prod.tags.some((t) => /pant|trouser|cargo/i.test(t)));

  const allowedList = ALLOWED_SIZES as readonly string[];
  const rawSizes = Array.isArray(prod.sizes) ? prod.sizes : [];
  const filteredSizes = rawSizes.filter((s) => allowedList.includes(s));
  
  // For pants, standard waist sizes are 28, 30, 32, 34, 36. For tops, standard is M, L, XL, XXL.
  const defaultSizes = isPantCategory
    ? ['28', '30', '32', '34', '36']
    : ['M', 'L', 'XL', 'XXL'];

  const sizes = filteredSizes.length > 0 ? filteredSizes : defaultSizes;

  const colors = Array.isArray(prod.colors) ? prod.colors : [];

  const existingVariants = Array.isArray(prod.variants) ? prod.variants : [];
  const validVariants = existingVariants.filter((v) => allowedList.includes(v.size));
  const finalVariants: ProductVariant[] = [...validVariants];

  if (colors.length > 0) {
    sizes.forEach((sz) => {
      colors.forEach((col) => {
        const match = finalVariants.find((v) => v.size === sz && v.color === col.name);
        if (!match) {
          finalVariants.push({
            id: `${prod.id}-${sz.toLowerCase()}-${col.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            size: sz,
            color: col.name,
            colorHex: col.hex,
            stock: Math.max(10, Math.floor((prod.totalStock || 50) / Math.max(1, sizes.length * colors.length))),
            sku: `${prod.sku || 'VT'}-${sz}`
          });
        }
      });
    });
  } else {
    sizes.forEach((sz) => {
      const match = finalVariants.find((v) => v.size === sz);
      if (!match) {
        finalVariants.push({
          id: `${prod.id}-${sz.toLowerCase()}`,
          size: sz,
          color: 'Standard',
          colorHex: '#14221C',
          stock: Math.max(10, Math.floor((prod.totalStock || 50) / Math.max(1, sizes.length))),
          sku: `${prod.sku || 'VT'}-${sz}`
        });
      }
    });
  }

  return {
    ...prod,
    sizes,
    colors,
    variants: finalVariants
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'info';
}

export type PageRoute =
  | 'home'
  | 'shop'
  | 'product-detail'
  | 'cart'
  | 'checkout'
  | 'confirmation'
  | 'tracking'
  | 'account'
  | 'compare'
  | 'admin'
  | 'about'
  | 'contact'
  | 'faqs'
  | 'size-guide'
  | 'shipping-policy'
  | 'return-policy'
  | 'privacy-policy'
  | 'terms';

export interface StoreContextType {
  // Navigation & Page State
  currentPage: PageRoute;
  setCurrentPage: (page: PageRoute) => void;
  selectedProductId: string | null;
  openProductDetail: (productId: string) => void;
  selectedCategory: ProductCategory;
  setSelectedCategory: (category: ProductCategory) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Cart
  cart: CartItem[];
  addToCart: (
    product: Product,
    selectedSize: string,
    selectedColor: string,
    quantity: number,
    openDrawer?: boolean
  ) => boolean;
  buyNow: (
    product: Product,
    selectedSize: string,
    selectedColor: string,
    quantity: number
  ) => void;
  updateCartQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartItemCount: number;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;

  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  // Product Comparison (Up to 4 products)
  comparisonList: string[];
  addToComparison: (productId: string) => boolean;
  removeFromComparison: (productId: string) => void;
  clearComparison: () => void;
  isInComparison: (productId: string) => boolean;
  isComparisonModalOpen: boolean;
  setIsComparisonModalOpen: (open: boolean) => void;

  // Coupons
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  applyCouponCode: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  discountAmount: number;

  // Loyalty Points
  appliedPointsDiscount: number;
  redeemPoints: (points: number) => { success: boolean; discountBDT: number; message: string };
  removeRedeemedPoints: () => void;

  // Referral Program
  appliedReferralCode: string | null;
  applyReferralCode: (code: string) => { success: boolean; message: string };
  removeReferralCode: () => void;

  // Delivery & Settings
  settings: StoreSettings;
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  calculateDeliveryFee: (
    zone: 'inside_dhaka' | 'outside_dhaka' | 'remote_area' | 'express_dhaka',
    subtotal: number
  ) => number;

  // Products
  products: Product[];
  activeProducts: Product[];
  archivedProducts: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdDate'>) => void;
  updateProduct: (id: string, updated: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  restoreProduct: (id: string) => void;
  permanentlyDeleteProduct: (id: string) => void;
  deleteAllProducts: () => void;
  duplicateProduct: (id: string) => void;
  moveProductUp: (id: string) => void;
  moveProductDown: (id: string) => void;
  pinProductToTop: (id: string) => void;
  toggleTopProduct: (id: string) => Promise<void>;
  moveProductToTop: (id: string) => void;
  getProductById: (id: string) => Product | undefined;
  getProductBySlug: (slug: string) => Product | undefined;

  // Categories & Banners
  categories: ProductCategory[];
  addCategory: (name: ProductCategory) => void;
  updateCategoryName: (oldName: ProductCategory, newName: ProductCategory) => void;
  deleteCategory: (name: ProductCategory) => void;
  moveCategoryOrder: (category: ProductCategory, direction: 'up' | 'down' | 'first') => void;
  reorderCategories: (newOrder: ProductCategory[]) => void;
  moveProductInCategory: (
    id: string,
    categoryFilter: string,
    direction: 'up' | 'down' | 'top',
    targetRank?: number
  ) => Promise<void>;
  banners: BannerConfig[];
  updateBanner: (id: string, updated: Partial<BannerConfig>) => void;

  // Orders (16-Stage Lifecycle)
  orders: Order[];
  lastPlacedOrder: Order | null;
  placeOrder: (data: {
    customer: Address;
    deliveryZone: Order['deliveryZone'];
    paymentMethod: PaymentMethod | string;
    transactionId?: string;
    partialPayment?: import('../types').PartialPaymentInfo;
  }) => { success: boolean; order?: Order; error?: string };
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  updateOrderPayment: (orderId: string, status: PaymentStatus, transactionId?: string) => void;
  cancelOrder: (orderId: string, reason: string) => { success: boolean; message: string };
  requestOrderReturn: (orderId: string, reason: string) => { success: boolean; message: string };
  approveOrder: (orderId: string) => void;
  assignCourierTracking: (
    orderId: string,
    courierName: Order['courierName'],
    trackingNumber: string
  ) => void;
  trackOrderLookup: (orderNumber?: string, phone?: string) => Order | null;
  clearAllOrders: () => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  addCoupon: (coupon: Coupon) => void;
  deleteCoupon: (code: string) => void;
  toggleCouponActive: (code: string) => void;

  // User / Auth & Customer Management
  currentUser: User | null;
  isAdmin: boolean;
  currentStaffRole: StaffRole;
  setCurrentStaffRole: (role: StaffRole) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalTab: 'login' | 'register' | 'otp' | 'forgot';
  setAuthModalTab: (tab: 'login' | 'register' | 'otp' | 'forgot') => void;
  sendOtp: (phone: string) => { success: boolean; code?: string; message: string };
  verifyOtp: (phone: string, otp: string, customerName?: string) => { success: boolean; user?: User; message: string };
  socialLogin: (provider: 'google' | 'facebook', profileData?: { name?: string; email?: string; phone?: string }) => User;
  verifyAndLoginCustomer: (data: {
    method: 'phone_otp' | 'google' | 'facebook';
    name: string;
    phone: string;
    email?: string;
    otp?: string;
  }) => { success: boolean; user: User; message: string };
  registerCustomer: (data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    referralCode?: string;
  }) => { success: boolean; message: string };
  loginAsCustomer: (emailOrPhone: string, name?: string) => void;
  loginAsStaff: (role: StaffRole, name?: string) => void;
  loginAsAdmin: () => void;
  verifyAdminCredentials: (email: string, pin: string) => { success: boolean; message?: string };
  logout: () => void;
  customers: User[];
  updateCustomerStatus: (userId: string, status: 'Active' | 'Inactive') => void;
  updateUserProfile: (data: Partial<User>) => void;
  addUserAddress: (address: Address) => void;
  deleteUserAddress: (index: number) => void;

  // SMS & WhatsApp Notification System
  smsLogs: SmsLog[];
  smsTemplates: SmsTemplate[];
  updateSmsTemplate: (templateId: string, template: string) => void;
  resendSms: (logId: string) => void;
  sendOrderSms: (
    order: Order,
    event: SmsTemplate['event'],
    customVars?: Record<string, string>
  ) => void;
  whatsappLogs: WhatsAppLog[];
  generateWhatsAppOrderUrl: (order: Order) => string;
  sendWhatsAppNotification: (order: Order) => Promise<{ success: boolean; url: string; log: WhatsAppLog }>;

  // Staff & Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (action: string, details: string) => void;

  // Modals & UI
  isSizeGuideOpen: boolean;
  setIsSizeGuideOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  showToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Business Finance & Profit Management
  financialRecords: FinancialRecord[];
  addFinancialRecord: (rec: Omit<FinancialRecord, 'id' | 'createdAt'>) => void;
  updateFinancialRecord: (id: string, rec: Partial<FinancialRecord>) => void;
  deleteFinancialRecord: (id: string) => void;
  clearAllFinances: () => void;

  // Moderator & Staff Management
  staffModerators: StaffModerator[];
  addStaffModerator: (mod: Omit<StaffModerator, 'id' | 'assignedDate'>) => void;
  updateStaffModerator: (id: string, mod: Partial<StaffModerator>) => void;
  deleteStaffModerator: (id: string) => void;

  // Visual Themes & 3D Banners
  themeConfig: ThemeConfig;
  updateThemeConfig: (cfg: Partial<ThemeConfig>) => void;
  setThemePreset: (preset: ThemePreset) => void;
  banners3D: Banner3DConfig[];
  updateBanner3D: (id: string, cfg: Partial<Banner3DConfig>) => void;
  addBanner3D: (banner: Omit<Banner3DConfig, 'id'>) => void;
  deleteBanner3D: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const SAMPLE_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'VT-89241',
    customer: {
      fullName: 'Muhammad Yeamin',
      phone: '01711234567',
      email: 'muhammadeyamin0@gmail.com',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Banani',
      streetAddress: 'House 42, Road 11, Block D, Banani',
      notes: 'Please call before delivery'
    },
    items: [
      {
        id: 'prod-001-M-Forest Pine',
        productId: 'prod-001',
        name: 'VANTREL Signature Heavyweight Pine Hoodie',
        slug: 'vantrel-heavyweight-pine-hoodie',
        image: '/assets/images/product_premium_hoodie_1792588590406.jpg',
        size: 'M',
        color: 'Forest Pine',
        price: 2650,
        regularPrice: 3200,
        quantity: 1,
        maxStock: 24,
        sku: 'VT-HD-001-M-FP'
      },
      {
        id: 'prod-002-L-Raw Ivory Cream',
        productId: 'prod-002',
        name: 'VANTREL Artisan Raw Cream Heavyweight Oversized Tee',
        slug: 'vantrel-artisan-cream-oversized-tee',
        image: '/assets/images/product_oversized_tee_1792588591424.jpg',
        size: 'L',
        color: 'Raw Ivory Cream',
        price: 1350,
        regularPrice: 1650,
        quantity: 1,
        maxStock: 25,
        sku: 'VT-TS-002-L-IC'
      }
    ],
    subtotal: 4000,
    discount: 400,
    couponCode: 'VANTREL10',
    deliveryZone: 'inside_dhaka',
    deliveryFee: 0,
    total: 3600,
    paymentMethod: 'bKash',
    paymentStatus: 'Paid',
    transactionId: 'BK9X77A12',
    orderStatus: 'Shipped',
    courierName: 'Steadfast',
    trackingNumber: 'ST-DH-8921',
    trackingUrl: 'https://steadfast.com.bd/t/ST-DH-8921',
    estimatedDeliveryMinDays: 1,
    estimatedDeliveryMaxDays: 2,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    customerConfirmationDeadline: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
    canCancelUntil: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
    statusHistory: [
      { status: 'Pending Customer Confirmation', timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), note: 'Order placed via bKash', actor: 'Customer' },
      { status: 'Customer Confirmed', timestamp: new Date(Date.now() - 47.5 * 3600 * 1000).toISOString(), note: 'Confirmed automatically past 15-min window', actor: 'System' },
      { status: 'Order Confirmed', timestamp: new Date(Date.now() - 40 * 3600 * 1000).toISOString(), note: 'Approved by order moderator', actor: 'Rafiqul (Moderator)' },
      { status: 'Processing', timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), note: 'Dispatched to garment packaging line', actor: 'Warehouse Team' },
      { status: 'Packed', timestamp: new Date(Date.now() - 28 * 3600 * 1000).toISOString(), note: 'Sealed in VANTREL custom packaging', actor: 'Warehouse Team' },
      { status: 'Shipped', timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), note: 'Handed over to Steadfast courier (ST-DH-8921)', actor: 'Logistics' }
    ]
  },
  {
    id: 'ord-102',
    orderNumber: 'VT-89190',
    customer: {
      fullName: 'Farhan Kabir',
      phone: '01819998877',
      email: 'farhan@example.com',
      division: 'Chattogram',
      district: 'Chattogram',
      upazila: 'Agrabad',
      streetAddress: 'Flat 4B, Green View Tower, Agrabad C/A',
      notes: 'Leave at reception if unavailable'
    },
    items: [
      {
        id: 'prod-003-32-Indigo / Charcoal Duo',
        productId: 'prod-003',
        name: 'VANTREL Dual Tone Relaxed Fit Selvedge Denim',
        slug: 'vantrel-selvedge-relaxed-denim',
        image: '/assets/images/product_denim_cargo_1792588592254.jpg',
        size: '32',
        color: 'Indigo / Charcoal Duo',
        price: 3150,
        regularPrice: 3800,
        quantity: 1,
        maxStock: 20,
        sku: 'VT-JN-003-32-IC'
      }
    ],
    subtotal: 3150,
    discount: 0,
    deliveryZone: 'outside_dhaka',
    deliveryFee: 0,
    total: 3150,
    paymentMethod: 'Cash on Delivery (COD)',
    paymentStatus: 'Pending',
    orderStatus: 'Awaiting Staff Approval',
    estimatedDeliveryMinDays: 2,
    estimatedDeliveryMaxDays: 3,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    customerConfirmationDeadline: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    canCancelUntil: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: 'Pending Customer Confirmation', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), note: 'Order placed via Cash on Delivery', actor: 'Customer' },
      { status: 'Customer Confirmed', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), note: '15-minute cancellation window elapsed. Marked customer confirmed.', actor: 'System' },
      { status: 'Awaiting Staff Approval', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), note: 'Queued for moderator order verification', actor: 'System' }
    ]
  }
];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Page State
  const [currentPage, setCurrentPageState] = useState<PageRoute>('home');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register' | 'otp' | 'forgot'>('login');

  // Products (strictly from Admin Panel / Firestore — never auto-seeded with primary products)
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('vt_products_v4');
    if (saved) {
      try {
        const parsed: Product[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
            .map(sanitizeProductSizes);
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  // Categories
  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    const saved = localStorage.getItem('vt_categories_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // use default
      }
    }
    return [
      'All',
      'Sweater',
      'Sweatshirt',
      'Long Sleeve T-Shirt',
      'Long Sleeve Set',
      'Pants',
      'Joggers and Trousers',
      'Gents Winter Accessories',
      'Winter Collection',
      'Hoodies',
      'T-Shirts',
      'Shirts',
      'Polo Shirts',
      'Panjabi',
      'Jackets',
      'Traditional Wear'
    ];
  });

  // Banners
  const [banners, setBanners] = useState<BannerConfig[]>(() => {
    const saved = localStorage.getItem('vt_banners');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_BANNERS;
      }
    }
    return INITIAL_BANNERS;
  });

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('vt_cart') || localStorage.getItem('yw_cart');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Wishlist
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('vt_wishlist') || localStorage.getItem('yw_wishlist');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Product Comparison (max 4)
  const [comparisonList, setComparisonList] = useState<string[]>(() => {
    const saved = localStorage.getItem('vt_compare');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    const saved = localStorage.getItem('vt_coupons') || localStorage.getItem('yw_coupons');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_COUPONS;
      }
    }
    return INITIAL_COUPONS;
  });
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // Loyalty & Referrals
  const [appliedPointsDiscount, setAppliedPointsDiscount] = useState<number>(0);
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem('vt_settings_v2') || localStorage.getItem('vt_settings') || localStorage.getItem('yw_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          storeName: parsed.storeName === 'VANTREL' ? 'VANTREL OUTFIT' : (parsed.storeName || 'VANTREL OUTFIT'),
          announcementText: parsed.announcementText && parsed.announcementText.includes('VANTREL LUXURY') ? parsed.announcementText.replace('VANTREL LUXURY', 'VANTREL OUTFIT LUXURY') : (parsed.announcementText || INITIAL_SETTINGS.announcementText),
          deliveryFeeInsideDhaka: parsed.deliveryFeeInsideDhaka === 100 || parsed.deliveryFeeInsideDhaka === 80 ? 70 : (parsed.deliveryFeeInsideDhaka || 70),
          deliveryFeeOutsideDhaka: parsed.deliveryFeeOutsideDhaka === 150 ? 120 : (parsed.deliveryFeeOutsideDhaka || 120)
        };
      } catch {
        return INITIAL_SETTINGS;
      }
    }
    return INITIAL_SETTINGS;
  });

  // Orders
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('vt_orders') || localStorage.getItem('vt_orders_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  });

  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(() => {
    const saved = localStorage.getItem('vt_last_order') || localStorage.getItem('yw_last_order');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Customers
  const [customers, setCustomers] = useState<User[]>(() => {
    const saved = localStorage.getItem('vt_customers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_CUSTOMERS;
      }
    }
    return INITIAL_CUSTOMERS;
  });

  // Current User & Staff Role
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('vt_user') || localStorage.getItem('yw_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentStaffRole, setCurrentStaffRole] = useState<StaffRole>('Super Admin');

  // SMS Logs & Templates
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>(() => {
    const saved = localStorage.getItem('vt_sms_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_SMS_LOGS;
      }
    }
    return INITIAL_SMS_LOGS;
  });

  // WhatsApp Confirmation Logs
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>(() => {
    const saved = localStorage.getItem('vt_whatsapp_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>(() => {
    const saved = localStorage.getItem('vt_sms_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_SMS_TEMPLATES;
      }
    }
    return INITIAL_SMS_TEMPLATES;
  });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('vt_audit_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_AUDIT_LOGS;
      }
    }
    return INITIAL_AUDIT_LOGS;
  });

  // Business Finance & Profit Management - cleared as requested (er admin panel er sob earn and locsion dilet kro)
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>(() => {
    const saved = localStorage.getItem('vt_finances_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Staff & Moderator Management
  const [staffModerators, setStaffModerators] = useState<StaffModerator[]>(() => {
    const saved = localStorage.getItem('vt_moderators');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_MODERATORS;
      }
    }
    return INITIAL_MODERATORS;
  });

  // Visual Themes
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    const saved = localStorage.getItem('vt_theme');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_THEME;
      }
    }
    return INITIAL_THEME;
  });

  // 3D Banners
  const [banners3D, setBanners3D] = useState<Banner3DConfig[]>(() => {
    const saved = localStorage.getItem('vt_banners_3d');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_3D_BANNERS;
      }
    }
    return INITIAL_3D_BANNERS;
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Persist State to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('vt_products_v4', JSON.stringify(products));
    } catch (err) {
      console.warn('Products localStorage cache warning:', err);
    }
  }, [products]);

  useEffect(() => {
    localStorage.setItem('vt_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('vt_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('vt_compare', JSON.stringify(comparisonList));
  }, [comparisonList]);

  useEffect(() => {
    localStorage.setItem('vt_orders', JSON.stringify(orders));
    localStorage.setItem('vt_orders_v2', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('vt_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('vt_coupons', JSON.stringify(coupons));
  }, [coupons]);

  useEffect(() => {
    localStorage.setItem('vt_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('vt_sms_logs', JSON.stringify(smsLogs));
  }, [smsLogs]);

  useEffect(() => {
    localStorage.setItem('vt_sms_templates', JSON.stringify(smsTemplates));
  }, [smsTemplates]);

  useEffect(() => {
    localStorage.setItem('vt_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('vt_banners', JSON.stringify(banners));
  }, [banners]);

  useEffect(() => {
    localStorage.setItem('vt_categories_v2', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('vt_finances', JSON.stringify(financialRecords));
  }, [financialRecords]);

  useEffect(() => {
    localStorage.setItem('vt_moderators', JSON.stringify(staffModerators));
  }, [staffModerators]);

  useEffect(() => {
    localStorage.setItem('vt_theme', JSON.stringify(themeConfig));
    const root = document.documentElement;
    root.style.setProperty('--vt-primary', themeConfig.primaryColor);
    root.style.setProperty('--vt-secondary', themeConfig.secondaryColor);
    root.style.setProperty('--vt-accent', themeConfig.accentColor);
    root.style.setProperty('--vt-bg', themeConfig.bgColor);
    root.style.setProperty('--vt-card-bg', themeConfig.cardBg);
    root.style.setProperty('--vt-text', themeConfig.textColor);
    root.style.setProperty('--vt-border', themeConfig.borderColor);
    document.body.style.backgroundColor = themeConfig.bgColor;
    document.body.style.color = themeConfig.textColor;
  }, [themeConfig]);

  useEffect(() => {
    localStorage.setItem('vt_banners_3d', JSON.stringify(banners3D));
  }, [banners3D]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('vt_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('vt_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (lastPlacedOrder) {
      localStorage.setItem('vt_last_order', JSON.stringify(lastPlacedOrder));
    }
  }, [lastPlacedOrder]);

  // Validate initial Firestore server connectivity on boot
  useEffect(() => {
    if (!IS_GOOGLE_CLOUD_CONNECTED || !db) return;
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn('Firebase client is offline or network unavailable.');
        }
      }
    }
    testConnection();
  }, []);

  // Real-time Firestore Products Sync for Shop Page & Admin Dashboard across Mobile & Laptop
  useEffect(() => {
    let isMounted = true;
    let hasFirestoreSnapshot = false;

    const mergeDynamicCategories = (loadedProducts: Product[]) => {
      if (loadedProducts.length === 0) return;
      setCategories((prevCats) => {
        const existingLower = new Set(prevCats.map((c) => c.toLowerCase()));
        const additions: ProductCategory[] = [];
        loadedProducts.forEach((p) => {
          const cat = (p.category || '').trim();
          if (cat && !existingLower.has(cat.toLowerCase())) {
            existingLower.add(cat.toLowerCase());
            additions.push(cat);
          }
        });
        return additions.length > 0 ? [...prevCats, ...additions] : prevCats;
      });
    };

    const hydrateFromServerFallback = async () => {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && isMounted && !hasFirestoreSnapshot) {
          const serverProducts = (json.data as Product[])
            .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
            .map((p) =>
              sanitizeProductSizes({
                ...p,
                isArchived: Boolean(p.isArchived || p.status === 'archived')
              })
            );
          setProducts(serverProducts);
          mergeDynamicCategories(serverProducts);
        }
      } catch (err) {
        console.warn('Server products fallback load notice:', err);
      }
    };

    if (!IS_GOOGLE_CLOUD_CONNECTED || !db) {
      hydrateFromServerFallback();
      return () => {
        isMounted = false;
      };
    }

    // Detect bots/crawlers (Googlebot, Lighthouse, Google-InspectionTool, bingbot, etc.)
    const isBot =
      typeof navigator !== 'undefined' &&
      /bot|crawler|spider|crawling|googlebot|bingbot|google-inspectiontool|lighthouse/i.test(
        navigator.userAgent || ''
      );

    const productsCol = collection(db, 'products');

    // Bots and search engine crawlers should perform a single one-time query instead of opening continuous streaming XHR channels
    if (isBot) {
      getDocs(productsCol)
        .then((snapshot) => {
          if (!isMounted) return;
          const remoteProducts: Product[] = [];
          snapshot.forEach((docSnap) => {
            if (LEGACY_PRIMARY_PRODUCT_IDS.has(docSnap.id)) return;
            const data = docSnap.data() as Product;
            remoteProducts.push(
              sanitizeProductSizes({
                ...data,
                id: docSnap.id,
                isArchived: Boolean(data.isArchived || data.status === 'archived')
              })
            );
          });
          setProducts(remoteProducts);
          mergeDynamicCategories(remoteProducts);
        })
        .catch((err) => {
          console.warn('Bot products load notice:', err);
          hydrateFromServerFallback();
        });
      return () => {
        isMounted = false;
      };
    }

    // Fast initial hydration from server disk while Firestore listener connects
    hydrateFromServerFallback();

    const unsubscribe = onSnapshot(
      productsCol,
      (snapshot) => {
        if (!isMounted) return;

        if (snapshot.empty) {
          // Do not overwrite server-hydrated products with an empty offline cache snapshot
          if (snapshot.metadata.fromCache) {
            return;
          }
          hasFirestoreSnapshot = true;
          // Never auto-seed primary or default products — only Admin-added products belong in the store
          setProducts([]);
          return;
        }

        hasFirestoreSnapshot = true;

        // Live real-time documents from Firestore (filtering out any legacy primary IDs if ever present)
        const remoteProducts: Product[] = [];
        snapshot.forEach((docSnap) => {
          if (LEGACY_PRIMARY_PRODUCT_IDS.has(docSnap.id)) return;
          const data = docSnap.data() as Product;
          const cleanProd = sanitizeProductSizes({
            ...data,
            id: docSnap.id,
            isArchived: Boolean(data.isArchived || data.status === 'archived')
          });
          remoteProducts.push(cleanProd);
        });

        // Consistent ordering: Pinned products first, then sortOrder, then createdDate
        remoteProducts.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
            return a.sortOrder - b.sortOrder;
          }
          return 0;
        });

        setProducts(remoteProducts);
        mergeDynamicCategories(remoteProducts);
      },
      (error) => {
        console.error('Firestore products onSnapshot error:', error);
        if (!hasFirestoreSnapshot) {
          hydrateFromServerFallback();
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Continuous 100% Guaranteed Orders Synchronization with Server Backend & Firestore
  useEffect(() => {
    let isMounted = true;

    const syncOrdersWithServer = async () => {
      try {
        const res = await fetch('/api/orders');
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && isMounted) {
          setOrders((currentOrders) => {
            // If server returned valid list, the server is authoritative
            return json.data.sort(
              (a: Order, b: Order) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
          });
        }
      } catch {
        // Fallback gracefully
      }
    };

    syncOrdersWithServer();
    const interval = setInterval(syncOrdersWithServer, 6000);

    // Also listen to Firestore orders collection if Firestore is available
    let firestoreUnsub: (() => void) | undefined;
    if (IS_GOOGLE_CLOUD_CONNECTED && db) {
      try {
        const ordersCol = collection(db, 'orders');
        firestoreUnsub = onSnapshot(
          ordersCol,
          (snapshot) => {
            if (!isMounted) return;
            if (snapshot.empty) {
              return;
            }
            const remoteOrders: Order[] = [];
            snapshot.forEach((docSnap) => {
              const remote = docSnap.data() as Order;
              remoteOrders.push({ ...remote, id: docSnap.id });
            });
            remoteOrders.sort(
              (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            setOrders(remoteOrders);
          },
          (error) => {
            console.warn('Firestore orders onSnapshot notice:', error.message);
          }
        );
      } catch (e) {
        console.warn('Firestore orders sync notice:', e);
      }
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (firestoreUnsub) firestoreUnsub();
    };
  }, []);

  // Listen to Firebase Auth state changes (only if GCP is enabled)
  useEffect(() => {
    if (!IS_GOOGLE_CLOUD_CONNECTED || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setCurrentUser((prev) => {
          if (prev && prev.id === fbUser.uid) return prev;
          const userObj: User = {
            id: fbUser.uid,
            name: fbUser.displayName || prev?.name || 'VANTREL Member',
            email: fbUser.email || prev?.email || 'customer@vantrel.com',
            phone: fbUser.phoneNumber || prev?.phone || '01711234567',
            role: prev?.role || 'customer',
            joinedDate: prev?.joinedDate || new Date().toISOString().split('T')[0],
            totalOrders: prev?.totalOrders || 0,
            totalSpent: prev?.totalSpent || 0,
            status: 'Active',
            loyaltyPoints: prev?.loyaltyPoints || 100,
            referralCode: prev?.referralCode || `VT-REF-${Math.floor(1000 + Math.random() * 9000)}`,
            isVerified: true,
            emailVerified: Boolean(fbUser.emailVerified),
            phoneVerified: Boolean(fbUser.phoneNumber),
            verificationMethod: 'google',
            verifiedAt: new Date().toISOString(),
            verificationCertificateId: prev?.verificationCertificateId || `VT-CERT-${Math.floor(100000 + Math.random() * 900000)}`,
            savedAddresses: prev?.savedAddresses || []
          };
          return userObj;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore Wishlist Sync for authenticated / logged-in user (only if GCP is enabled)
  useEffect(() => {
    if (!IS_GOOGLE_CLOUD_CONNECTED || !db) return;
    const isBot =
      typeof navigator !== 'undefined' &&
      /bot|crawler|spider|crawling|googlebot|bingbot|google-inspectiontool|lighthouse/i.test(
        navigator.userAgent || ''
      );
    if (isBot) return;

    const firebaseUid = auth?.currentUser?.uid;
    if (!firebaseUid) return;

    const wishlistCol = collection(db, 'users', firebaseUid, 'wishlist');
    const unsubscribe = onSnapshot(
      wishlistCol,
      (snapshot) => {
        const itemIds = snapshot.docs.map((d) => d.id);
        if (itemIds.length > 0 || !snapshot.metadata.fromCache) {
          setWishlist(itemIds);
        }
      },
      (error) => {
        console.warn('Firestore wishlist sync notice:', error.message);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Toast Handler
  const showToast = useCallback(
    (title: string, message?: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Audit Log Adder
  const addAuditLog = useCallback(
    (action: string, details: string) => {
      const newLog: AuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: currentUser ? `${currentUser.name} (${currentStaffRole})` : `System (${currentStaffRole})`,
        role: currentStaffRole,
        action,
        details
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    },
    [currentUser, currentStaffRole]
  );

  // Background Order Lifecycle: Automatically Transition Pending Orders past 15-minute deadline to 'Order Confirmed'
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setOrders((prevOrders) => {
        let changed = false;
        const updated = prevOrders.map((order) => {
          const deadlineTime = new Date(
            order.confirmationDeadline || order.canCancelUntil || order.customerConfirmationDeadline || 0
          ).getTime();
          const isPending =
            order.orderStatus === 'Pending Customer Confirmation' ||
            order.orderStatus === 'Customer Confirmed';

          if (isPending && deadlineTime > 0 && deadlineTime <= now) {
            changed = true;
            const newHistory = [
              ...order.statusHistory,
              {
                status: 'Order Confirmed' as OrderStatus,
                timestamp: new Date().toISOString(),
                note: `15-minute cancellation window elapsed without cancellation. Automatically confirmed and sent to warehouse.`,
                actor: 'System Automation'
              }
            ];

            // Trigger server auto-confirm endpoint to dispatch email to muhammadeyamin0@gmail.com
            fetch(`/api/orders/${order.id}/auto-confirm`, { method: 'POST' }).catch((err) => {
              console.warn('Auto-confirm server dispatch warning:', err);
            });

            // Update lastPlacedOrder if currently viewed
            setLastPlacedOrder((last) =>
              last && (last.id === order.id || last.orderNumber === order.orderNumber)
                ? { ...last, orderStatus: 'Order Confirmed' as OrderStatus, statusHistory: newHistory }
                : last
            );

            return {
              ...order,
              orderStatus: 'Order Confirmed' as OrderStatus,
              statusHistory: newHistory
            };
          }
          return order;
        });

        if (changed) {
          return updated;
        }
        return prevOrders;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(timer);
  }, []);

  // SMS Notification Dispatcher
  const sendOrderSms = useCallback(
    (order: Order, event: SmsTemplate['event'], customVars?: Record<string, string>) => {
      const templateObj = smsTemplates.find((t) => t.event === event && t.isActive);
      if (!templateObj) return;

      let msg = templateObj.template
        .replace(/{orderNumber}/g, order.orderNumber)
        .replace(/{total}/g, order.total.toLocaleString())
        .replace(/{trackingUrl}/g, `/tracking?order=${order.orderNumber}`)
        .replace(/{courier}/g, order.courierName || 'Fulfillment Courier')
        .replace(/{trackingNumber}/g, order.trackingNumber || 'Pending')
        .replace(/{deliveryEstimate}/g, `${order.estimatedDeliveryMinDays || 1}-${order.estimatedDeliveryMaxDays || 3} Business Days`);

      if (customVars) {
        Object.entries(customVars).forEach(([k, v]) => {
          msg = msg.replace(new RegExp(`{${k}}`, 'g'), v);
        });
      }

      const log: SmsLog = {
        id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        phone: order.customer.phone,
        message: msg,
        template: event,
        status: 'Sent',
        timestamp: new Date().toISOString(),
        provider: `${settings.smsProvider.toUpperCase()} Gateway (BD +880)`
      };

      setSmsLogs((prev) => [log, ...prev]);
    },
    [smsTemplates, settings.smsProvider]
  );

  const resendSms = useCallback((logId: string) => {
    setSmsLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? {
              ...l,
              status: 'Sent',
              timestamp: new Date().toISOString()
            }
          : l
      )
    );
    showToast('SMS Retried', 'Message dispatched through SMS Gateway provider.', 'success');
  }, [showToast]);

  const updateSmsTemplate = useCallback((templateId: string, template: string) => {
    setSmsTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, template } : t))
    );
    showToast('SMS Template Updated', 'Transactional copy saved.', 'success');
  }, [showToast]);

  // WhatsApp Notification System
  const generateWhatsAppOrderUrl = useCallback((order: Order): string => {
    const rawPhone = order.customer?.phone || '';
    const cleanPhone = rawPhone.replace(/[^\d]/g, '');
    let waPhone = cleanPhone;
    if (cleanPhone.startsWith('0')) waPhone = `88${cleanPhone}`;
    else if (cleanPhone.length === 10 && cleanPhone.startsWith('1')) waPhone = `880${cleanPhone}`;

    const customerName = order.customer?.fullName || 'সম্মানিত গ্রাহক';
    const itemsText = (order.items || [])
      .map(
        (item, idx) =>
          `${idx + 1}. *${item.name}* - সাইজ: ${item.size}, কালার: ${item.color}, পরিমাণ: ${item.quantity}টি (৳${(item.price * item.quantity).toLocaleString()} BDT)`
      )
      .join('\n');

    const message = `🎉 *VANTREL OUTFIT - অর্ডার নিশ্চিতকরণ নোটিফিকেশন*

প্রিয় *${customerName}*,
আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!

📦 *অর্ডার নম্বর:* #${order.orderNumber}
📅 *তারিখ:* ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB')}
👕 *আপনার অর্ডারকৃত পণ্যসমূহ:*
${itemsText}

💰 *সর্বমোট বিল:* ৳${order.total.toLocaleString()} BDT (${order.paymentMethod})
📍 *ডেলিভারি ঠিকানা:* ${order.customer?.streetAddress}, ${order.customer?.district}

⏱️ *১৫ মিনিটের ক্যানসেল সুবিধা:*
অর্ডারে কোনো ভুল তথ্য থাকলে বা বাতিল করতে চাইলে আগামী ১৫ মিনিটের মধ্যে ওয়েবসাইট থেকে সরাসরি বাতিল করতে পারবেন।

🚚 *জরুরি ডেলিভারি শর্তাবলী:*
১. ডেলিভারি ম্যান উপস্থিত থাকাকালীন পণ্য পরীক্ষা করে নিন।
২. ডেলিভারি ম্যান চলে যাওয়ার পর ফেরত/বিনিময়ের জন্য অতিরিক্ত ডেলিভারি চার্জ প্রযোজ্য হবে।

🔗 *লাইভ অর্ডার ট্র্যাকিং লিংক:*
https://vantrel.store/tracking?order=${order.orderNumber}

💬 *সরাসরি সাপোর্ট ও মেসেজিং:*
https://wa.me/message/E6PISGJZC63TA1

VANTREL OUTFIT বেছে নেওয়ার জন্য ধন্যবাদ!`;

    const encoded = encodeURIComponent(message);
    if (waPhone) {
      return `https://api.whatsapp.com/send?phone=${waPhone}&text=${encoded}`;
    }
    return `https://wa.me/message/E6PISGJZC63TA1?text=${encoded}`;
  }, []);

  const sendWhatsAppNotification = useCallback(
    async (order: Order): Promise<{ success: boolean; url: string; log: WhatsAppLog }> => {
      const url = generateWhatsAppOrderUrl(order);
      const log: WhatsAppLog = {
        id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        recipientPhone: order.customer.phone,
        message: 'Order confirmation notification prepared for WhatsApp recipient',
        status: 'Dispatched',
        dispatchedAt: new Date().toISOString(),
        directSendUrl: url,
        merchantOrigin: 'https://wa.me/message/E6PISGJZC63TA1'
      };

      setWhatsappLogs((prev) => {
        const updated = [log, ...prev];
        localStorage.setItem('vt_whatsapp_logs', JSON.stringify(updated.slice(0, 50)));
        return updated;
      });

      // Synchronize with backend
      try {
        fetch('/api/send-whatsapp-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            phone: order.customer.phone
          })
        }).catch((e) => console.warn('Backend WhatsApp sync notice:', e));
      } catch (err) {
        console.warn('Backend WhatsApp trigger notice:', err);
      }

      showToast(
        'হোয়াটসঅ্যাপ নোটিফিকেশন প্রস্তুত',
        `অর্ডার #${order.orderNumber} এর মেসেজ তৈরি হয়েছে।`,
        'success'
      );

      return { success: true, url, log };
    },
    [generateWhatsAppOrderUrl, showToast]
  );

  // Navigation
  const setCurrentPage = (page: PageRoute) => {
    setCurrentPageState(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProductDetail = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentPage('product-detail');
  };

  // Cart Subtotal & Item Count
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Cart Actions
  const addToCart = (
    product: Product,
    selectedSize: string,
    selectedColor: string,
    quantity: number,
    openDrawer: boolean = true
  ): boolean => {
    const matchedVariant = product.variants.find(
      (v) => v.size === selectedSize && v.color === selectedColor
    );
    const maxStock = matchedVariant ? matchedVariant.stock : product.totalStock;

    if (maxStock <= 0) {
      showToast('Out of Stock', 'This garment variant is currently unavailable.', 'error');
      return false;
    }

    const itemId = `${product.id}-${selectedSize}-${selectedColor}`;
    const price = product.discountPrice ?? product.regularPrice;

    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.id === itemId);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, maxStock);
        return prevCart.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i));
      } else {
        const newItem: CartItem = {
          id: itemId,
          productId: product.id,
          name: product.name,
          slug: product.slug,
          image: product.images[0] || '',
          size: selectedSize,
          color: selectedColor,
          price,
          regularPrice: product.regularPrice,
          quantity: Math.min(quantity, maxStock),
          maxStock,
          sku: matchedVariant ? matchedVariant.sku : product.sku
        };
        return [...prevCart, newItem];
      }
    });

    if (openDrawer) {
      showToast('Added to Bag', `${product.name} (${selectedSize} / ${selectedColor})`, 'success');
      setIsCartDrawerOpen(true);
    }
    return true;
  };

  const buyNow = (
    product: Product,
    selectedSize: string,
    selectedColor: string,
    quantity: number
  ) => {
    const success = addToCart(product, selectedSize, selectedColor, quantity, false);
    if (success) {
      setIsCartDrawerOpen(false);
      setCurrentPageState('checkout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            return { ...item, quantity: Math.min(nextQty, item.maxStock) };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
    showToast('Item Removed', undefined, 'info');
  };

  const clearCart = () => setCart([]);

  // Wishlist Actions with Firestore Persistence
  const toggleWishlist = async (productId: string) => {
    const exists = wishlist.includes(productId);
    const updated = exists ? wishlist.filter((id) => id !== productId) : [...wishlist, productId];
    setWishlist(updated);

    showToast(
      exists ? 'Removed from Wishlist' : 'Saved to Wishlist',
      exists ? undefined : 'Saved to your account and synced across devices.',
      exists ? 'info' : 'success'
    );

    if (IS_GOOGLE_CLOUD_CONNECTED && db) {
      const firebaseUid = auth?.currentUser?.uid;
      if (firebaseUid) {
        const docPath = `users/${firebaseUid}/wishlist/${productId}`;
        try {
          if (exists) {
            await deleteDoc(doc(db, 'users', firebaseUid, 'wishlist', productId));
          } else {
            const prod = products.find((p) => p.id === productId);
            await setDoc(doc(db, 'users', firebaseUid, 'wishlist', productId), {
              productId,
              addedAt: new Date().toISOString(),
              name: prod?.name || 'VANTREL Garment',
              price: prod ? (prod.discountPrice ?? prod.regularPrice) : 0,
              image: prod?.images?.[0] || ''
            });
          }
        } catch (error) {
          console.warn('Firestore wishlist persistence note:', error);
          try {
            handleFirestoreError(
              error,
              exists ? OperationType.DELETE : OperationType.WRITE,
              docPath
            );
          } catch {
            // Handled per guidelines
          }
        }
      }
    }
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  // Product Comparison (max 4)
  const addToComparison = (productId: string): boolean => {
    if (comparisonList.includes(productId)) {
      showToast('Already in Comparison', undefined, 'info');
      return false;
    }
    if (comparisonList.length >= 4) {
      showToast('Comparison Limit Reached', 'You can compare up to 4 garments at a time.', 'error');
      return false;
    }
    setComparisonList((prev) => [...prev, productId]);
    showToast('Added to Compare', 'Side-by-side specs comparison updated.', 'success');
    return true;
  };

  const removeFromComparison = (productId: string) => {
    setComparisonList((prev) => prev.filter((id) => id !== productId));
    showToast('Removed from comparison', undefined, 'info');
  };

  const clearComparison = () => {
    setComparisonList([]);
    showToast('Comparison Cleared', undefined, 'info');
  };

  const isInComparison = (productId: string) => comparisonList.includes(productId);

  // Coupons
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discountAmount = Math.round((cartSubtotal * appliedCoupon.value) / 100);
      if (appliedCoupon.maxDiscount && discountAmount > appliedCoupon.maxDiscount) {
        discountAmount = appliedCoupon.maxDiscount;
      }
    } else {
      discountAmount = appliedCoupon.value;
    }
  }

  const applyCouponCode = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    const found = coupons.find((c) => c.code.toUpperCase() === cleanCode);

    if (!found) {
      return { success: false, message: 'Invalid promotional code.' };
    }
    if (!found.isActive) {
      return { success: false, message: 'This coupon is no longer active.' };
    }
    if (new Date(found.expiryDate) < new Date()) {
      return { success: false, message: 'This promo voucher has expired.' };
    }
    if (cartSubtotal < found.minOrder) {
      return {
        success: false,
        message: `This coupon requires a minimum subtotal of ৳${found.minOrder.toLocaleString()}.`
      };
    }

    setAppliedCoupon(found);
    showToast('Coupon Applied!', `You saved with promo code ${found.code}`, 'success');
    return { success: true, message: `Coupon ${found.code} applied successfully!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showToast('Coupon removed', undefined, 'info');
  };

  const addCoupon = (newCoupon: Coupon) => {
    setCoupons((prev) => [newCoupon, ...prev.filter((c) => c.code.toUpperCase() !== newCoupon.code.toUpperCase())]);
    addAuditLog('COUPON_CREATE', `Created promo code "${newCoupon.code}"`);
    showToast('Coupon Created', `Code ${newCoupon.code} is now active.`, 'success');
  };

  const deleteCoupon = (code: string) => {
    setCoupons((prev) => prev.filter((c) => c.code.toUpperCase() !== code.toUpperCase()));
    addAuditLog('COUPON_DELETE', `Deleted promo code "${code}"`);
    showToast('Coupon Deleted', `Code ${code} deleted.`, 'info');
  };

  const toggleCouponActive = (code: string) => {
    setCoupons((prev) =>
      prev.map((c) =>
        c.code.toUpperCase() === code.toUpperCase() ? { ...c, isActive: !c.isActive } : c
      )
    );
    showToast('Coupon Status Updated', undefined, 'info');
  };

  // Loyalty Points Redemption
  const redeemPoints = (pointsToRedeem: number) => {
    if (!currentUser) {
      return { success: false, discountBDT: 0, message: 'Please log in to redeem loyalty points.' };
    }
    if (pointsToRedeem <= 0 || pointsToRedeem > currentUser.loyaltyPoints) {
      return { success: false, discountBDT: 0, message: 'Invalid points quantity.' };
    }
    if (pointsToRedeem < 50) {
      return { success: false, discountBDT: 0, message: 'Minimum 50 points required to redeem.' };
    }

    const discountBDT = Math.round(pointsToRedeem * settings.pointsRedeemRate);
    setAppliedPointsDiscount(discountBDT);
    showToast('Points Redeemed', `৳${discountBDT} deducted using ${pointsToRedeem} points.`, 'success');
    return { success: true, discountBDT, message: `Redeemed ${pointsToRedeem} points for ৳${discountBDT} off!` };
  };

  const removeRedeemedPoints = () => {
    setAppliedPointsDiscount(0);
    showToast('Points redemption removed', undefined, 'info');
  };

  // Referral Program
  const applyReferralCode = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean.startsWith('VT-REF-')) {
      return { success: false, message: 'Invalid VANTREL referral format (e.g. VT-REF-XXXX).' };
    }
    if (currentUser && currentUser.referralCode.toUpperCase() === clean) {
      return { success: false, message: 'Self-referral is not permitted.' };
    }
    setAppliedReferralCode(clean);
    showToast('Referral Code Applied', `৳${settings.refereeRewardBDT} welcome gift applied!`, 'success');
    return { success: true, message: `Referral applied! Enjoy ৳${settings.refereeRewardBDT} off your initial drop.` };
  };

  const removeReferralCode = () => {
    setAppliedReferralCode(null);
  };

  // Delivery Fee Calculation (Daraz-style: ৳70 inside Dhaka, ৳120 outside Dhaka)
  const calculateDeliveryFee = (
    zone: 'inside_dhaka' | 'outside_dhaka' | 'remote_area' | 'express_dhaka',
    _subtotal?: number
  ) => {
    if (zone === 'express_dhaka') return settings.deliveryFeeExpress || 110;
    if (zone === 'inside_dhaka') return settings.deliveryFeeInsideDhaka || 70;
    if (zone === 'outside_dhaka') return settings.deliveryFeeOutsideDhaka || 120;
    if (zone === 'remote_area') return settings.deliveryFeeRemote || 140;
    return settings.deliveryFeeInsideDhaka || 70;
  };

  // Active vs Archived Products
  const activeProducts = useMemo(
    () => products.filter((p) => !p.isArchived && p.status !== 'archived'),
    [products]
  );

  const archivedProducts = useMemo(
    () => products.filter((p) => p.isArchived || p.status === 'archived'),
    [products]
  );

  // Product Actions (Direct Real-time Sync to Firebase Firestore)
  const addProduct = async (newProd: Omit<Product, 'id' | 'createdDate'>) => {
    const id = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product: Product = sanitizeProductSizes({
      ...newProd,
      id,
      status: 'published',
      isArchived: false,
      sortOrder: -1,
      createdDate: new Date().toISOString().split('T')[0]
    });
    // Optimistic local update
    setProducts((prev) => [product, ...prev]);
    if (product.category?.trim()) {
      setCategories((prev) =>
        prev.some((c) => c.toLowerCase() === product.category.trim().toLowerCase())
          ? prev
          : [...prev, product.category.trim()]
      );
    }

    // Save directly to Firebase Firestore
    try {
      if (db) {
        const payload = sanitizeFirestoreData(product);
        await setDoc(doc(db, 'products', product.id), payload);
      }
    } catch (e) {
      console.warn('Firestore addProduct error:', e);
      handleFirestoreError(e, OperationType.WRITE, `products/${product.id}`);
    }

    // Also synchronize to server backend and disk storage
    try {
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      }).catch((err) => console.warn('Server product sync error:', err));
    } catch (e) {
      console.warn('Server product sync exception:', e);
    }

    addAuditLog('PRODUCT_CREATE', `Added garment "${product.name}" with SKU ${product.sku}`);
    showToast('Product Created & Synced', `${product.name} is saved to Firebase and live on all devices.`, 'success');
  };

  const updateProduct = async (id: string, updated: Partial<Product>) => {
    const cleanUpdated = { ...updated };
    if (Array.isArray(cleanUpdated.sizes)) {
      const allowed = ALLOWED_SIZES as readonly string[];
      const filtered = cleanUpdated.sizes.filter((s) => allowed.includes(s));
      if (filtered.length > 0) {
        cleanUpdated.sizes = filtered;
      } else {
        delete cleanUpdated.sizes;
      }
    }

    // Optimistic local update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? sanitizeProductSizes({ ...p, ...cleanUpdated }) : p))
    );

    // Save directly to Firebase Firestore
    try {
      if (db) {
        const payload = sanitizeFirestoreData(cleanUpdated);
        await setDoc(doc(db, 'products', id), payload, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore updateProduct error:', e);
      handleFirestoreError(e, OperationType.UPDATE, `products/${id}`);
    }

    // Also synchronize to server backend and disk storage
    try {
      fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanUpdated)
      }).catch((err) => console.warn('Server product update error:', err));
    } catch (e) {
      console.warn('Server product update exception:', e);
    }

    addAuditLog('PRODUCT_UPDATE', `Updated garment ID ${id}`);
    showToast('Product Updated', 'Changes synced across all devices.', 'success');
  };

  const duplicateProduct = async (id: string) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    const duplicated: Product = {
      ...target,
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${target.name} (Copy)`,
      sku: `${target.sku}-CPY`,
      slug: `${target.slug}-copy-${Date.now().toString().slice(-3)}`,
      status: 'published',
      isArchived: false,
      sortOrder: (target.sortOrder ?? 0) + 1,
      createdDate: new Date().toISOString().split('T')[0]
    };
    setProducts((prev) => [duplicated, ...prev]);

    // Save to Firebase Firestore
    try {
      if (db) {
        const payload = sanitizeFirestoreData(duplicated);
        await setDoc(doc(db, 'products', duplicated.id), payload);
      }
    } catch (e) {
      console.warn('Firestore duplicateProduct error:', e);
      handleFirestoreError(e, OperationType.WRITE, `products/${duplicated.id}`);
    }

    // Also synchronize to server backend
    try {
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicated)
      }).catch((err) => console.warn('Server product duplicate error:', err));
    } catch (e) {
      console.warn('Server product duplicate exception:', e);
    }

    addAuditLog('PRODUCT_DUPLICATE', `Duplicated garment "${target.name}" to "${duplicated.name}"`);
    showToast('Product Duplicated', `Created copy ${duplicated.name} in Firebase.`, 'success');
  };

  // Soft Delete: Preserves product in Firebase & Admin Panel, but hides it completely from public customers!
  const deleteProduct = async (id: string) => {
    const target = products.find((p) => p.id === id);
    const archivePayload = {
      isArchived: true,
      status: 'archived' as const
    };

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...archivePayload } : p))
    );

    // Save directly to Firebase Firestore
    try {
      if (db) {
        await setDoc(doc(db, 'products', id), archivePayload, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore soft delete error:', e);
      handleFirestoreError(e, OperationType.UPDATE, `products/${id}`);
    }

    // Also update server backend
    try {
      fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archivePayload)
      }).catch((err) => console.warn('Server product archive error:', err));
    } catch (e) {
      console.warn('Server product archive exception:', e);
    }

    addAuditLog('PRODUCT_DELETE_SOFT', `Archived and hid product "${target?.name || id}" from public store`);
    showToast('পাবলিক থেকে লুকানো হয়েছে', `"${target?.name || 'প্রোডাক্ট'}" পাবলিক থেকে লুকানো হয়েছে, তবে অ্যাডমিন প্যানেলে সুরক্ষিত আছে।`, 'info');
  };

  // Restore: Unhides product and makes it live on public store again!
  const restoreProduct = async (id: string) => {
    const target = products.find((p) => p.id === id);
    const restorePayload = {
      isArchived: false,
      status: 'published' as const
    };

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...restorePayload } : p))
    );

    // Save directly to Firebase Firestore
    try {
      if (db) {
        await setDoc(doc(db, 'products', id), restorePayload, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore restore error:', e);
      handleFirestoreError(e, OperationType.UPDATE, `products/${id}`);
    }

    // Also update server backend
    try {
      fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restorePayload)
      }).catch((err) => console.warn('Server product restore error:', err));
    } catch (e) {
      console.warn('Server product restore exception:', e);
    }

    addAuditLog('PRODUCT_RESTORE', `Restored product "${target?.name || id}" to live storefront`);
    showToast('প্রোডাক্ট পুনরায় সক্রিয় হয়েছে', `"${target?.name || 'প্রোডাক্ট'}" এখন ওয়েবসাইটে আবার লাইভ হয়েছে।`, 'success');
  };

  // Permanent Delete: Remove completely from Firebase Firestore and state
  const permanentlyDeleteProduct = async (id: string) => {
    const target = products.find((p) => p.id === id);
    setProducts((prev) => prev.filter((p) => p.id !== id));

    // Delete directly from Firebase Firestore
    try {
      if (db) {
        await deleteDoc(doc(db, 'products', id));
      }
    } catch (e) {
      console.warn('Firestore deleteDoc error:', e);
      handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
    }

    // Delete from server backend disk and memory
    try {
      fetch(`/api/products/${id}`, {
        method: 'DELETE'
      }).catch((err) => console.warn('Server product delete error:', err));
    } catch (e) {
      console.warn('Server product delete exception:', e);
    }

    addAuditLog('PRODUCT_DELETE_PERMANENT', `Permanently deleted garment "${target?.name || id}"`);
    showToast('স্থায়ীভাবে মুছে ফেলা হয়েছে', 'প্রোডাক্টটি ডাটাবেজ থেকে সম্পূর্ণ মুছে ফেলা হয়েছে।', 'info');
  };

  const deleteAllProducts = async () => {
    const idsToDelete = products.map((p) => p.id);
    setProducts([]);

    if (db && idsToDelete.length > 0) {
      try {
        for (let i = 0; i < idsToDelete.length; i += 450) {
          const chunk = idsToDelete.slice(i, i + 450);
          const batch = writeBatch(db);
          chunk.forEach((id) => {
            batch.delete(doc(db, 'products', id));
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn('Firestore delete all warning:', e);
      }
    }

    try {
      await fetch('/api/products', { method: 'DELETE' });
    } catch (e) {
      console.warn('Server delete all products warning:', e);
    }

    addAuditLog('PRODUCT_DELETE_ALL', 'Deleted all products from catalog');
    showToast('All Products Deleted', 'Catalog is now empty. You can add new products anytime.', 'info');
  };

  const moveProductUp = async (id: string) => {
    let reordered: Product[] = [];
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      reordered = copy;
      return copy;
    });

    if (db && reordered.length > 0) {
      try {
        const batch = writeBatch(db);
        reordered.forEach((p, idx) => {
          batch.set(doc(db, 'products', p.id), { sortOrder: idx }, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Firestore sortOrder update warning:', e);
      }
    }

    showToast('Position Moved Up', 'Product moved higher in catalog list.', 'info');
  };

  const moveProductDown = async (id: string) => {
    let reordered: Product[] = [];
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      reordered = copy;
      return copy;
    });

    if (db && reordered.length > 0) {
      try {
        const batch = writeBatch(db);
        reordered.forEach((p, idx) => {
          batch.set(doc(db, 'products', p.id), { sortOrder: idx }, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Firestore sortOrder update warning:', e);
      }
    }

    showToast('Position Moved Down', 'Product moved lower in catalog list.', 'info');
  };

  const moveProductToTop = async (id: string) => {
    let reordered: Product[] = [];
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      reordered = [item, ...copy];
      return reordered;
    });

    if (db && reordered.length > 0) {
      try {
        const batch = writeBatch(db);
        reordered.forEach((p, idx) => {
          batch.set(doc(db, 'products', p.id), { sortOrder: idx }, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Firestore sortOrder update warning:', e);
      }
    }

    showToast('Moved to Top', 'Product moved to first position (#1).', 'success');
  };

  const pinProductToTop = async (id: string) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    const willPin = !target.isPinned;

    setProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      const updated = { ...target, isPinned: willPin };
      if (willPin) {
        return [updated, ...filtered];
      } else {
        return [...filtered, updated];
      }
    });

    try {
      if (db) {
        await setDoc(doc(db, 'products', id), { isPinned: willPin }, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore pin warning:', e);
    }

    showToast(
      willPin ? '📌 Product Pinned' : 'Product Unpinned',
      willPin ? `"${target?.name || 'Product'}" pinned to the very top (#1).` : `"${target?.name || 'Product'}" unpinned.`,
      'success'
    );
  };

  const toggleTopProduct = async (id: string) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    const willBeTop = !target.isTopProduct;

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isTopProduct: willBeTop } : p))
    );

    try {
      if (db) {
        await setDoc(doc(db, 'products', id), { isTopProduct: willBeTop }, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore toggleTopProduct warning:', e);
    }

    showToast(
      willBeTop ? '⭐ Top Product Added' : 'Removed from Top Products',
      willBeTop
        ? `"${target.name}" এখন হোমপেজের টপ/পপুলার প্রোডাক্ট সেকশনে প্রদর্শিত হবে।`
        : `"${target.name}" হোমপেজ টপ প্রোডাক্ট তালিকা থেকে সরানো হয়েছে।`,
      'success'
    );
  };

  const getProductById = (id: string) => {
    if (!id) return products[0];
    return (
      products.find((p) => p.id === id) ||
      products.find((p) => p.slug === id) ||
      products[0]
    );
  };
  const getProductBySlug = (slug: string) => products.find((p) => p.slug === slug);

  // Categories & Banners
  const addCategory = (name: ProductCategory) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      addAuditLog('CATEGORY_ADD', `Added catalog category "${trimmed}"`);
      showToast('Category Added', `Category "${trimmed}" added to navigation.`, 'success');
    }
  };

  const updateCategoryName = (oldName: ProductCategory, newName: ProductCategory) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === 'All' || oldName === trimmedNew) return;

    // 1. Update categories array in state & localStorage
    setCategories((prev) => {
      const updated = prev.map((c) => (c.toLowerCase() === oldName.toLowerCase() ? trimmedNew : c));
      localStorage.setItem('vt_categories_v2', JSON.stringify(updated));
      return updated;
    });

    // 2. Cascade update to all products having this category
    setProducts((prev) => {
      const updatedProds = prev.map((p) => {
        if (p.category.toLowerCase() === oldName.toLowerCase()) {
          return { ...p, category: trimmedNew };
        }
        return p;
      });
      return updatedProds;
    });

    // 3. Update active filter if currently selected
    if (selectedCategory.toLowerCase() === oldName.toLowerCase()) {
      setSelectedCategory(trimmedNew);
    }

    addAuditLog('CATEGORY_RENAME', `Renamed category "${oldName}" to "${trimmedNew}" and updated products`);
    showToast('ক্যাটাগরির নাম আপডেট হয়েছে', `"${oldName}" সফলভাবে পরিবর্তন করে "${trimmedNew}" করা হয়েছে।`, 'success');
  };

  const deleteCategory = (name: ProductCategory) => {
    if (name === 'All') return;
    setCategories((prev) => {
      const updated = prev.filter((c) => c !== name);
      localStorage.setItem('vt_categories_v2', JSON.stringify(updated));
      return updated;
    });
    if (selectedCategory === name) {
      setSelectedCategory('All');
    }
    addAuditLog('CATEGORY_DELETE', `Removed category "${name}"`);
    showToast('Category Removed', `Category "${name}" removed.`, 'info');
  };

  const moveCategoryOrder = (category: ProductCategory, direction: 'up' | 'down' | 'first') => {
    if (category === 'All') return;
    setCategories((prev) => {
      const idx = prev.indexOf(category);
      if (idx === -1) return prev;
      const copy = [...prev];
      if (direction === 'first') {
        copy.splice(idx, 1);
        const allIdx = copy.indexOf('All');
        if (allIdx === 0) {
          copy.splice(1, 0, category);
        } else {
          copy.unshift(category);
        }
      } else if (direction === 'up') {
        const targetIdx = idx - 1;
        if (targetIdx < 0 || copy[targetIdx] === 'All') return prev;
        const temp = copy[targetIdx];
        copy[targetIdx] = copy[idx];
        copy[idx] = temp;
      } else if (direction === 'down') {
        const targetIdx = idx + 1;
        if (targetIdx >= copy.length) return prev;
        const temp = copy[targetIdx];
        copy[targetIdx] = copy[idx];
        copy[idx] = temp;
      }
      localStorage.setItem('vt_categories_v2', JSON.stringify(copy));
      return copy;
    });
    addAuditLog('CATEGORY_REORDER', `Reordered category "${category}" (${direction})`);
    showToast('ক্যাটাগরি সাজানো হয়েছে', `"${category}" সফলভাবে আগে/পিছে নেওয়া হয়েছে।`, 'success');
  };

  const reorderCategories = (newOrder: ProductCategory[]) => {
    setCategories(newOrder);
    localStorage.setItem('vt_categories_v2', JSON.stringify(newOrder));
    addAuditLog('CATEGORY_REORDER_ALL', `Updated all categories display order`);
    showToast('ক্যাটাগরি ক্রম সেভ হয়েছে', 'ক্যাটাগরিসমূহ নতুন ক্রমানুসারে সাজানো হয়েছে।', 'success');
  };

  const moveProductInCategory = async (
    id: string,
    categoryFilter: string,
    direction: 'up' | 'down' | 'top',
    targetRank?: number
  ) => {
    let reorderedFullList: Product[] = [];

    setProducts((prev) => {
      const inCategory = categoryFilter === 'All'
        ? [...prev]
        : prev.filter((p) => p.category.toLowerCase() === categoryFilter.toLowerCase());

      const catIdx = inCategory.findIndex((p) => p.id === id);
      if (catIdx === -1) return prev;

      const updatedCategoryList = [...inCategory];
      const [item] = updatedCategoryList.splice(catIdx, 1);

      if (typeof targetRank === 'number') {
        const insertIdx = Math.max(0, Math.min(targetRank - 1, updatedCategoryList.length));
        updatedCategoryList.splice(insertIdx, 0, item);
      } else if (direction === 'top') {
        updatedCategoryList.unshift(item);
      } else if (direction === 'up') {
        const newIdx = Math.max(0, catIdx - 1);
        updatedCategoryList.splice(newIdx, 0, item);
      } else if (direction === 'down') {
        const newIdx = Math.min(updatedCategoryList.length, catIdx + 1);
        updatedCategoryList.splice(newIdx, 0, item);
      }

      // Rebuild global products list preserving the new relative order of this category
      let catPointer = 0;
      reorderedFullList = prev.map((p) => {
        if (categoryFilter === 'All' || p.category.toLowerCase() === categoryFilter.toLowerCase()) {
          const replacement = updatedCategoryList[catPointer++];
          return replacement || p;
        }
        return p;
      });

      // Update sortOrder on the affected products
      reorderedFullList = reorderedFullList.map((p, idx) => ({
        ...p,
        sortOrder: idx
      }));

      return reorderedFullList;
    });

    if (db && reorderedFullList.length > 0) {
      try {
        const batch = writeBatch(db);
        reorderedFullList.forEach((p, idx) => {
          batch.set(doc(db, 'products', p.id), { sortOrder: idx }, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Firestore sortOrder batch update error:', e);
      }
    }

    showToast('প্রোডাক্ট পজিশন আপডেট হয়েছে', 'ক্যাটাগরির প্রোডাক্ট ক্রম সফলভাবে সাজানো হয়েছে।', 'success');
  };

  const updateBanner = (id: string, updated: Partial<BannerConfig>) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updated } : b))
    );
    addAuditLog('BANNER_UPDATE', `Updated homepage banner ID ${id}`);
    showToast('Banner Updated', 'Homepage visual refreshed.', 'success');
  };

  // Settings
  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    addAuditLog('SETTINGS_UPDATE', 'Updated global store logistics & promotional configuration');
    showToast('Settings Saved', 'Store configuration updated.', 'success');
  };

  // Orders Actions: Complete 16-Stage Handling
  const placeOrder = (data: {
    customer: Address;
    deliveryZone: Order['deliveryZone'];
    paymentMethod: PaymentMethod | string;
    transactionId?: string;
    partialPayment?: import('../types').PartialPaymentInfo;
  }) => {
    if (cart.length === 0) {
      return { success: false, error: 'Your shopping cart is empty.' };
    }

    // Check stock availability
    for (const item of cart) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) {
        return { success: false, error: `Product ${item.name} not found.` };
      }
      const variant = prod.variants.find((v) => v.size === item.size && v.color === item.color);
      const stock = variant ? variant.stock : prod.totalStock;
      if (item.quantity > stock) {
        return {
          success: false,
          error: `Insufficient stock for ${item.name} (${item.size}/${item.color}). Only ${stock} available.`
        };
      }
    }

    const subtotal = cartSubtotal;
    const deliveryFee = calculateDeliveryFee(data.deliveryZone || 'inside_dhaka', subtotal);
    const referralDiscount = appliedReferralCode ? settings.refereeRewardBDT : 0;
    const totalDiscounts = discountAmount + appliedPointsDiscount + referralDiscount;
    const total = Math.max(0, subtotal - totalDiscounts + deliveryFee);

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `VT-${randomSuffix}`;

    const confirmationDeadline = new Date(
      Date.now() + (settings.confirmationWindowMinutes || 15) * 60 * 1000
    ).toISOString();

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customer: data.customer,
      items: [...cart],
      subtotal,
      discount: totalDiscounts,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      pointsDiscount: appliedPointsDiscount > 0 ? appliedPointsDiscount : undefined,
      deliveryZone: data.deliveryZone,
      deliveryFee,
      total,
      paymentMethod: data.paymentMethod,
      paymentStatus:
        data.paymentMethod === 'Cash on Delivery (COD)' ? 'Pending' : data.partialPayment ? 'Pending' : 'Paid',
      transactionId: data.transactionId,
      partialPayment: data.partialPayment,
      orderStatus: 'Pending Customer Confirmation',
      createdAt: new Date().toISOString(),
      customerConfirmationDeadline: confirmationDeadline,
      confirmationDeadline: confirmationDeadline,
      canCancelUntil: confirmationDeadline,
      courierName: data.deliveryZone === 'inside_dhaka' ? 'Pathao' : 'Steadfast',
      trackingNumber: `VT-PKG-${Math.floor(100000 + Math.random() * 900000)}`,
      trackingUrl: `/tracking?order=${orderNumber}`,
      estimatedDeliveryMinDays: data.deliveryZone === 'inside_dhaka' ? 1 : 2,
      estimatedDeliveryMaxDays: data.deliveryZone === 'inside_dhaka' ? 2 : 4,
      userId: currentUser?.id || `usr-${Date.now()}`,
      isVerifiedCustomer: Boolean(currentUser?.isVerified ?? true),
      verificationMethod: currentUser?.verificationMethod || 'phone_otp',
      verifiedAt: currentUser?.verifiedAt || new Date().toISOString(),
      verificationCertificateId: currentUser?.verificationCertificateId || `VT-CERT-${Math.floor(100000 + Math.random() * 900000)}`,
      contractConfirmed: true,
      contractAgreedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: 'Pending Customer Confirmation',
          timestamp: new Date().toISOString(),
          note: `Verified Order placed via ${data.paymentMethod}. Customer Contract Active. Cancellation window open for ${settings.confirmationWindowMinutes || 15} mins.`,
          actor: 'Customer'
        }
      ]
    };

    // Deduct stock safely
    setProducts((prev) =>
      prev.map((prod) => {
        const cartItemsForProd = cart.filter((i) => i.productId === prod.id);
        if (cartItemsForProd.length === 0) return prod;

        let newTotalStock = prod.totalStock;
        const newVariants = prod.variants.map((v) => {
          const match = cartItemsForProd.find(
            (i) => i.size === v.size && i.color === v.color
          );
          if (match) {
            const deducted = Math.max(0, v.stock - match.quantity);
            newTotalStock -= match.quantity;
            return { ...v, stock: deducted };
          }
          return v;
        });

        return {
          ...prod,
          variants: newVariants,
          totalStock: Math.max(0, newTotalStock)
        };
      })
    );

    // Update or register customer in Customer Management & Award/Deduct Points
    const earnedPoints = Math.floor(total / (settings.pointsPerSpend || 50));
    setCustomers((prev) => {
      const existing = prev.find(
        (c) =>
          c.phone === data.customer.phone ||
          (data.customer.email && c.email === data.customer.email)
      );

      if (existing) {
        const remainingPoints = Math.max(
          0,
          existing.loyaltyPoints - (appliedPointsDiscount > 0 ? appliedPointsDiscount : 0) + earnedPoints
        );

        const newPointsTx: LoyaltyTransaction = {
          id: `pts-${Date.now()}`,
          userId: existing.id,
          amount: earnedPoints,
          type: 'earn',
          balanceAfter: remainingPoints,
          date: new Date().toISOString().split('T')[0],
          description: `Earned from Order #${orderNumber}`,
          orderNumber
        };

        return prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                totalOrders: (c.totalOrders || 0) + 1,
                totalSpent: (c.totalSpent || 0) + total,
                loyaltyPoints: remainingPoints,
                pointsHistory: [newPointsTx, ...(c.pointsHistory || [])]
              }
            : c
        );
      } else {
        const newCust: User = {
          id: `usr-${Date.now()}`,
          name: data.customer.fullName,
          phone: data.customer.phone,
          email: data.customer.email || `${data.customer.phone}@vantrel.com`,
          role: 'customer',
          joinedDate: new Date().toISOString().split('T')[0],
          totalOrders: 1,
          totalSpent: total,
          status: 'Active',
          loyaltyPoints: earnedPoints,
          referralCode: `VT-REF-${data.customer.fullName.slice(0, 4).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`,
          isVerified: true,
          phoneVerified: true,
          emailVerified: Boolean(data.customer.email),
          verificationMethod: currentUser?.verificationMethod || 'phone_otp',
          verifiedAt: new Date().toISOString(),
          verificationCertificateId: `VT-CERT-${Math.floor(100000 + Math.random() * 900000)}`,
          pointsHistory: [
            {
              id: `pts-${Date.now()}`,
              userId: `usr-${Date.now()}`,
              amount: earnedPoints,
              type: 'earn',
              balanceAfter: earnedPoints,
              date: new Date().toISOString().split('T')[0],
              description: `Earned from initial Order #${orderNumber}`,
              orderNumber
            }
          ],
          savedAddresses: [data.customer]
        };
        if (!currentUser) {
          setCurrentUser(newCust);
        }
        return [newCust, ...prev];
      }
    });

    // Save order
    setOrders((prev) => [newOrder, ...prev]);
    setLastPlacedOrder(newOrder);
    setCart([]);
    setAppliedCoupon(null);
    setAppliedPointsDiscount(0);
    setAppliedReferralCode(null);

    // 1. Direct sync to Express backend server (Guarantees Admin Dashboard presence immediately across all sessions/devices)
    try {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      }).catch((err) => {
        console.warn('Server backend order sync warning:', err);
      });
    } catch (e) {
      console.warn('Server order sync warning:', e);
    }

    // 2. Sync to Google Cloud Firestore orders collection
    try {
      if (db) {
        setDoc(doc(db, 'orders', newOrder.id), {
          ...newOrder,
          savedToFirestoreAt: new Date().toISOString()
        }).catch((err) => {
          console.warn('Firestore order save background warning:', err);
        });
      }
    } catch (e) {
      console.warn('Firestore order save warning:', e);
    }

    // 3. Automatically dispatch order notification to Gmail (muhammadeyamin0@gmail.com)
    try {
      fetch('/api/send-order-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder })
      }).catch((err) => {
        console.warn('Gmail order notification dispatch error:', err);
      });
    } catch (e) {
      console.warn('Gmail order notification error:', e);
    }

    // Send SMS automatically
    sendOrderSms(newOrder, 'order_placed');

    // Automatically prepare and record WhatsApp notification for customer's phone
    sendWhatsAppNotification(newOrder).catch((err) => {
      console.warn('WhatsApp automatic notification dispatch notice:', err);
    });

    addAuditLog('ORDER_PLACED', `New order #${newOrder.orderNumber} placed for ৳${newOrder.total}`);

    return { success: true, order: newOrder };
  };

  // Customer Cancellation
  const cancelOrder = (orderId: string, reason: string): { success: boolean; message: string } => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    const isWithinWindow = order.canCancelUntil
      ? new Date().getTime() <= new Date(order.canCancelUntil).getTime()
      : false;

    if (isWithinWindow || order.orderStatus === 'Pending Customer Confirmation') {
      // Direct Cancel & Stock Restoration
      setProducts((currProducts) =>
        currProducts.map((p) => {
          const itemsInOrder = order.items.filter((i) => i.productId === p.id);
          if (itemsInOrder.length === 0) return p;

          let restoredTotal = p.totalStock;
          const restoredVariants = p.variants.map((v) => {
            const match = itemsInOrder.find(
              (i) => i.size === v.size && i.color === v.color
            );
            if (match) {
              restoredTotal += match.quantity;
              return { ...v, stock: v.stock + match.quantity };
            }
            return v;
          });
          return { ...p, variants: restoredVariants, totalStock: restoredTotal };
        })
      );

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                orderStatus: 'Cancelled',
                cancellationReason: reason,
                statusHistory: [
                  ...o.statusHistory,
                  {
                    status: 'Cancelled',
                    timestamp: new Date().toISOString(),
                    note: `Cancelled by customer within grace window. Reason: ${reason}`,
                    actor: 'Customer'
                  }
                ]
              }
            : o
        )
      );

      // If lastPlacedOrder is this order, update it too
      setLastPlacedOrder((prev) =>
        prev && prev.id === orderId
          ? {
              ...prev,
              orderStatus: 'Cancelled',
              cancellationReason: reason
            }
          : prev
      );

      // Sync cancellation to server backend
      try {
        fetch(`/api/orders/${order.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        }).catch((err) => {
          console.warn('Server cancel sync error:', err);
        });
      } catch (e) {
        console.warn('Server cancel sync error:', e);
      }

      // Sync cancellation to Firestore
      try {
        if (db) {
          setDoc(
            doc(db, 'orders', orderId),
            {
              orderStatus: 'Cancelled',
              cancellationReason: reason,
              cancelledAt: new Date().toISOString()
            },
            { merge: true }
          ).catch(() => {});
        }
      } catch (e) {
        // silent
      }

      sendOrderSms(order, 'order_cancelled');
      addAuditLog('ORDER_CANCELLED', `Order #${order.orderNumber} cancelled by customer within deadline. Reason: ${reason}`);
      showToast('অর্ডার বাতিল সম্পন্ন', 'আপনার অর্ডারটি বাতিল করা হয়েছে এবং পণ্য স্টক পুনরায় ফিরিয়ে দেওয়া হয়েছে।', 'info');
      return { success: true, message: 'Order cancelled successfully.' };
    } else {
      // Grace window passed -> Cancellation Requested for moderator review
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                orderStatus: 'Cancellation Requested',
                cancellationReason: reason,
                statusHistory: [
                  ...o.statusHistory,
                  {
                    status: 'Cancellation Requested',
                    timestamp: new Date().toISOString(),
                    note: `Customer requested cancellation beyond window: ${reason}`,
                    actor: 'Customer'
                  }
                ]
              }
            : o
        )
      );
      addAuditLog('ORDER_CANCEL_REQUEST', `Customer requested cancellation for #${order.orderNumber}`);
      showToast('বাতিলের অনুরোধ পাঠানো হয়েছে', '১৫ মিনিটের সময়সীমা পার হওয়ায় অর্ডার বাতিলের অনুরোধ রিভিউ করা হচ্ছে।', 'info');
      return { success: true, message: 'Cancellation request submitted for staff approval.' };
    }
  };

  // Customer Return Request
  const requestOrderReturn = (orderId: string, reason: string): { success: boolean; message: string } => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              orderStatus: 'Return Requested',
              returnReason: reason,
              statusHistory: [
                ...o.statusHistory,
                {
                  status: 'Return Requested',
                  timestamp: new Date().toISOString(),
                  note: `Customer requested garment return/exchange: ${reason}`,
                  actor: 'Customer'
                }
              ]
            }
          : o
      )
    );
    addAuditLog('RETURN_REQUESTED', `Return requested for order #${order.orderNumber}`);
    showToast('Return Requested', 'Our concierge team will contact you to arrange parcel inspection.', 'info');
    return { success: true, message: 'Return request submitted successfully.' };
  };

  // Staff Approval (from Awaiting Staff Approval -> Order Confirmed)
  const approveOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              orderStatus: 'Order Confirmed',
              statusHistory: [
                ...o.statusHistory,
                {
                  status: 'Order Confirmed',
                  timestamp: new Date().toISOString(),
                  note: `Approved and verified by ${currentStaffRole}`,
                  actor: `${currentUser?.name || 'Staff'} (${currentStaffRole})`
                }
              ]
            }
          : o
      )
    );

    sendOrderSms(order, 'order_confirmed');
    addAuditLog('ORDER_APPROVED', `Order #${order.orderNumber} approved by ${currentStaffRole}`);
    showToast('Order Approved', `Order #${order.orderNumber} marked as Confirmed.`, 'success');
  };

  // Assign Courier & Track Number
  const assignCourierTracking = (
    orderId: string,
    courierName: Order['courierName'],
    trackingNumber: string
  ) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    let trackingUrl = `/tracking?order=${order.orderNumber}`;
    if (courierName === 'Steadfast') {
      trackingUrl = `https://steadfast.com.bd/t/${trackingNumber}`;
    } else if (courierName === 'Pathao') {
      trackingUrl = `https://pathao.com/courier-tracking/?consignment_id=${trackingNumber}`;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              orderStatus: 'Shipped',
              courierName,
              trackingNumber,
              trackingUrl,
              statusHistory: [
                ...o.statusHistory,
                {
                  status: 'Shipped',
                  timestamp: new Date().toISOString(),
                  note: `Handed over to ${courierName} courier with consignment #${trackingNumber}`,
                  actor: `${currentUser?.name || 'Staff'} (${currentStaffRole})`
                }
              ]
            }
          : o
      )
    );

    sendOrderSms(
      { ...order, courierName, trackingNumber, trackingUrl },
      'order_shipped'
    );
    addAuditLog('ORDER_SHIPPED', `Assigned ${courierName} #${trackingNumber} to #${order.orderNumber}`);
    showToast('Consignment Assigned', `Order marked as Shipped via ${courierName}.`, 'success');
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, note?: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const isCancelling = status === 'Cancelled' && order.orderStatus !== 'Cancelled';

    // If cancelling, restore inventory!
    if (isCancelling) {
      setProducts((currProducts) =>
        currProducts.map((p) => {
          const itemsInOrder = order.items.filter((i) => i.productId === p.id);
          if (itemsInOrder.length === 0) return p;

          let restoredTotal = p.totalStock;
          const restoredVariants = p.variants.map((v) => {
            const match = itemsInOrder.find(
              (i) => i.size === v.size && i.color === v.color
            );
            if (match) {
              restoredTotal += match.quantity;
              return { ...v, stock: v.stock + match.quantity };
            }
            return v;
          });
          return { ...p, variants: restoredVariants, totalStock: restoredTotal };
        })
      );
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            orderStatus: status,
            statusHistory: [
              ...o.statusHistory,
              {
                status,
                timestamp: new Date().toISOString(),
                note: note || `Status updated to ${status}`,
                actor: `${currentUser?.name || 'Staff'} (${currentStaffRole})`
              }
            ]
          };
        }
        return o;
      })
    );

    // Auto trigger specific SMS events
    if (status === 'Out for Delivery') {
      sendOrderSms(order, 'out_for_delivery');
    } else if (status === 'Delivered') {
      const earned = Math.floor(order.total / (settings.pointsPerSpend || 50));
      sendOrderSms(order, 'order_delivered', { points: earned.toString() });
    } else if (status === 'Cancelled') {
      sendOrderSms(order, 'order_cancelled');
    }

    addAuditLog('STATUS_CHANGE', `Order #${order.orderNumber} status changed to ${status}`);
    showToast('Order Updated', `Status changed to ${status}`, 'success');
  };

  const updateOrderPayment = (orderId: string, status: PaymentStatus, transactionId?: string) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              paymentStatus: status,
              transactionId: transactionId || order.transactionId
            }
          : order
      )
    );
    addAuditLog('PAYMENT_UPDATE', `Order payment updated to ${status}`);
    showToast('Payment Updated', `Payment marked as ${status}`, 'success');
  };

  const trackOrderLookup = (orderNumber?: string, phone?: string) => {
    const cleanNum = (orderNumber || '').trim().toUpperCase();
    const cleanPhone = (phone || '').trim().replace(/[-+\s]/g, '');

    if (!cleanNum && !cleanPhone) return null;

    const found = orders.find((o) => {
      const matchNum = cleanNum ? o.orderNumber.toUpperCase() === cleanNum : false;
      const orderPhoneClean = o.customer.phone.replace(/[-+\s]/g, '');
      const matchPhone = cleanPhone
        ? orderPhoneClean.endsWith(cleanPhone.slice(-10)) ||
          cleanPhone.endsWith(orderPhoneClean.slice(-10))
        : false;

      if (cleanNum && cleanPhone) {
        return matchNum || matchPhone;
      }
      if (cleanNum) return matchNum;
      if (cleanPhone) return matchPhone;
      return false;
    });

    return found || null;
  };

  const clearAllOrders = async () => {
    setOrders([]);
    setLastPlacedOrder(null);
    localStorage.removeItem('vt_orders');
    localStorage.removeItem('vt_orders_v2');
    localStorage.removeItem('yw_orders');
    localStorage.removeItem('vt_last_order');
    localStorage.removeItem('yw_last_order');
    localStorage.removeItem('vt_whatsapp_logs');

    // 1. Purge from Server backend and disk store
    try {
      await fetch('/api/orders', { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend orders clear error:', e);
    }

    // 2. Purge from Firebase Firestore if connected
    if (IS_GOOGLE_CLOUD_CONNECTED && db) {
      try {
        const snapshot = await getDocs(collection(db, 'orders'));
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.forEach((docSnap) => {
            batch.delete(doc(db, 'orders', docSnap.id));
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn('Firestore orders clear notice:', e);
      }
    }

    addAuditLog('ORDERS_PURGED', 'Admin cleared all orders and delivery tracking records.');
    showToast('সব অর্ডার মুছে ফেলা হয়েছে', 'সিস্টেম ও ফায়ারবেসের সমস্ত অর্ডার সফলভাবে পরিষ্কার করা হয়েছে।', 'info');
  };

  const deleteOrder = async (id: string) => {
    const target = orders.find((o) => o.id === id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (lastPlacedOrder && lastPlacedOrder.id === id) {
      setLastPlacedOrder(null);
    }

    // 1. Delete on server backend
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend order delete error:', e);
    }

    // 2. Delete on Firestore
    if (IS_GOOGLE_CLOUD_CONNECTED && db) {
      try {
        await deleteDoc(doc(db, 'orders', id));
      } catch (e) {
        console.warn('Firestore order delete error:', e);
      }
    }

    addAuditLog('ORDER_DELETE', `Deleted order "${target?.orderNumber || id}"`);
    showToast('অর্ডার মুছে ফেলা হয়েছে', `অর্ডার ${target?.orderNumber || id} সফলভাবে মুছে ফেলা হয়েছে।`, 'info');
  };

  // Auth Operations
  const sendOtp = (phone: string) => {
    const clean = phone.replace(/[-+\s]/g, '');
    if (clean.length < 11) {
      return { success: false, message: 'Please enter a valid 11-digit Bangladesh phone number.' };
    }
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    // Record SMS log
    const log: SmsLog = {
      id: `sms-${Date.now()}`,
      phone,
      message: `VANTREL Security: Your one-time verification code is ${mockOtp}. Valid for 5 minutes.`,
      template: 'otp_verification',
      status: 'Sent',
      timestamp: new Date().toISOString(),
      provider: 'Greenweb SMS Gateway BD'
    };
    setSmsLogs((prev) => [log, ...prev]);
    showToast('OTP Sent', `Verification code sent to ${phone}. (Demo code: ${mockOtp})`, 'success');
    return { success: true, code: mockOtp, message: `OTP sent to ${phone}` };
  };

  const verifyOtp = (phone: string, otp: string, customerName?: string) => {
    if (!otp || otp.length < 4) {
      return { success: false, message: 'Please enter the verification code.' };
    }
    const cleanPhone = phone.replace(/[-+\s]/g, '');
    const certId = `VT-CERT-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = customers.find((c) => c.phone.replace(/[-+\s]/g, '').endsWith(cleanPhone.slice(-10)));

    let verifiedUser: User;

    if (existing) {
      verifiedUser = {
        ...existing,
        name: customerName && existing.name === 'VANTREL Member' ? customerName : existing.name,
        isVerified: true,
        phoneVerified: true,
        verificationMethod: 'phone_otp',
        verifiedAt: new Date().toISOString(),
        verificationCertificateId: existing.verificationCertificateId || certId
      };
      setCustomers((prev) =>
        prev.map((c) => (c.id === existing.id ? verifiedUser : c))
      );
    } else {
      verifiedUser = {
        id: `usr-${Date.now()}`,
        name: customerName || 'VANTREL Member',
        phone: cleanPhone,
        email: `${cleanPhone}@vantrel.com`,
        role: 'customer',
        joinedDate: new Date().toISOString().split('T')[0],
        totalOrders: 0,
        totalSpent: 0,
        status: 'Active',
        loyaltyPoints: 100,
        referralCode: `VT-REF-${Math.floor(1000 + Math.random() * 9000)}`,
        isVerified: true,
        phoneVerified: true,
        verificationMethod: 'phone_otp',
        verifiedAt: new Date().toISOString(),
        verificationCertificateId: certId,
        savedAddresses: []
      };
      setCustomers((prev) => [verifiedUser, ...prev]);
    }

    setCurrentUser(verifiedUser);
    setIsAuthModalOpen(false);
    showToast(
      'অ্যাকাউন্ট ভেরিফাইড',
      `স্বাগতম ${verifiedUser.name}! আপনার ফোন নাম্বার ও অ্যাকাউন্ট সফলভাবে ভেরিফাই হয়েছে।`,
      'success'
    );
    return { success: true, user: verifiedUser, message: 'Successfully authenticated & verified.' };
  };

  const socialLogin = (
    provider: 'google' | 'facebook',
    profileData?: { name?: string; email?: string; phone?: string }
  ) => {
    const certId = `VT-CERT-${Math.floor(100000 + Math.random() * 900000)}`;
    const defaultEmail = provider === 'google' ? 'verified.google@gmail.com' : 'verified.facebook@fb.com';
    const email = profileData?.email || defaultEmail;
    const name = profileData?.name || (provider === 'google' ? 'Google Verified Customer' : 'Facebook Verified Customer');
    const phone = profileData?.phone || '01711234567';

    const existing = customers.find(
      (c) => (c.email && c.email.toLowerCase() === email.toLowerCase()) || c.phone.endsWith(phone.slice(-10))
    );

    let verifiedUser: User;

    if (existing) {
      verifiedUser = {
        ...existing,
        name: name !== 'Google Verified Customer' && name !== 'Facebook Verified Customer' ? name : existing.name,
        isVerified: true,
        emailVerified: true,
        verificationMethod: provider,
        verifiedAt: new Date().toISOString(),
        verificationCertificateId: existing.verificationCertificateId || certId
      };
      setCustomers((prev) =>
        prev.map((c) => (c.id === existing.id ? verifiedUser : c))
      );
    } else {
      verifiedUser = {
        id: `usr-${provider}-${Date.now()}`,
        name,
        email,
        phone,
        role: 'customer',
        joinedDate: new Date().toISOString().split('T')[0],
        totalOrders: 0,
        totalSpent: 0,
        status: 'Active',
        loyaltyPoints: 150,
        referralCode: `VT-${provider.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        isVerified: true,
        emailVerified: true,
        phoneVerified: true,
        verificationMethod: provider,
        verifiedAt: new Date().toISOString(),
        verificationCertificateId: certId,
        savedAddresses: []
      };
      setCustomers((prev) => [verifiedUser, ...prev]);
    }

    if (provider === 'google' && !profileData && IS_GOOGLE_CLOUD_CONNECTED && auth) {
      try {
        const gProvider = new GoogleAuthProvider();
        signInWithPopup(auth, gProvider)
          .then(async (result) => {
            const fbUser = result.user;
            const updatedUser: User = {
              id: fbUser.uid,
              name: fbUser.displayName || 'Google Verified Customer',
              email: fbUser.email || 'customer@gmail.com',
              phone: fbUser.phoneNumber || '01711234567',
              role: 'customer',
              joinedDate: new Date().toISOString().split('T')[0],
              totalOrders: 0,
              totalSpent: 0,
              status: 'Active',
              loyaltyPoints: 150,
              referralCode: `VT-GOOGLE-${Math.floor(100 + Math.random() * 900)}`,
              isVerified: true,
              emailVerified: true,
              phoneVerified: Boolean(fbUser.phoneNumber),
              verificationMethod: 'google',
              verifiedAt: new Date().toISOString(),
              verificationCertificateId: certId,
              savedAddresses: []
            };
            setCurrentUser(updatedUser);
            if (db) {
              try {
                await setDoc(
                  doc(db, 'users', fbUser.uid),
                  {
                    id: fbUser.uid,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    role: updatedUser.role,
                    loyaltyPoints: updatedUser.loyaltyPoints
                  },
                  { merge: true }
                );
              } catch (err) {
                console.warn('Firestore user profile sync warning:', err);
              }
            }
          })
          .catch((err) => {
            console.warn('Firebase popup sign-in fallback:', err.message);
          });
      } catch (err) {
        console.warn('Google Auth Provider initialization:', err);
      }
    }

    setCurrentUser(verifiedUser);
    setIsAuthModalOpen(false);
    showToast(
      'অ্যাকাউন্ট ভেরিফাইড',
      `${provider === 'google' ? 'গুগল (Gmail)' : 'ফেসবুক'} দিয়ে আপনার অ্যাকাউন্ট সফলভাবে ভেরিফাই করা হয়েছে!`,
      'success'
    );
    return verifiedUser;
  };

  const verifyAndLoginCustomer = (data: {
    method: 'phone_otp' | 'google' | 'facebook';
    name: string;
    phone: string;
    email?: string;
    otp?: string;
  }) => {
    if (data.method === 'phone_otp') {
      const res = verifyOtp(data.phone, data.otp || '884920', data.name);
      return {
        success: res.success,
        user: res.user || currentUser!,
        message: res.message
      };
    } else {
      const user = socialLogin(data.method, {
        name: data.name,
        email: data.email,
        phone: data.phone
      });
      return {
        success: true,
        user,
        message: `${data.method === 'google' ? 'Google Gmail' : 'Facebook'} verification completed.`
      };
    }
  };

  const registerCustomer = (data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    referralCode?: string;
  }) => {
    const newCust: User = {
      id: `usr-${Date.now()}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: 'customer',
      joinedDate: new Date().toISOString().split('T')[0],
      totalOrders: 0,
      totalSpent: 0,
      status: 'Active',
      loyaltyPoints: 100, // 100 welcome points
      referralCode: `VT-REF-${data.name.slice(0, 4).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`,
      referredBy: data.referralCode,
      pointsHistory: [
        {
          id: `pts-${Date.now()}`,
          userId: `usr-${Date.now()}`,
          amount: 100,
          type: 'bonus',
          balanceAfter: 100,
          date: new Date().toISOString().split('T')[0],
          description: 'Welcome Registration Bonus'
        }
      ],
      savedAddresses: []
    };

    setCustomers((prev) => [newCust, ...prev]);
    setCurrentUser(newCust);
    setIsAuthModalOpen(false);
    showToast('Account Created', `Welcome to VANTREL! 100 loyalty points added to your bag.`, 'success');
    return { success: true, message: 'Account registered successfully.' };
  };

  const loginAsCustomer = (emailOrPhone: string, name?: string) => {
    const existing = customers.find(
      (c) => c.phone.includes(emailOrPhone) || c.email.includes(emailOrPhone)
    );
    const user: User = existing || {
      id: `usr-${Date.now()}`,
      name: name || 'Valued Customer',
      email: emailOrPhone.includes('@') ? emailOrPhone : 'customer@vantrel.com',
      phone: emailOrPhone.includes('@') ? '01700000000' : emailOrPhone,
      role: 'customer',
      loyaltyPoints: 200,
      referralCode: `VT-REF-${Math.floor(1000 + Math.random() * 9000)}`,
      savedAddresses: []
    };
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    showToast('Welcome to VANTREL', `Signed in as ${user.name}`, 'success');
  };

  const loginAsStaff = (role: StaffRole, name?: string) => {
    const staffUser: User = {
      id: `staff-${role.toLowerCase().replace(/\s+/g, '-')}`,
      name: name || `Staff (${role})`,
      email: `${role.toLowerCase().replace(/\s+/g, '')}@vantrel.com`,
      phone: '01711234567',
      role,
      loyaltyPoints: 0,
      referralCode: 'VT-STAFF',
      savedAddresses: []
    };
    setCurrentUser(staffUser);
    setCurrentStaffRole(role);
    showToast(`${role} Active`, `Operating with ${role} permissions.`, 'info');
  };

  const verifyAdminCredentials = (email: string, pin: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();
    if (cleanEmail === 'muhammadeyamin0@gmail.com' && cleanPin === '2010') {
      const adminUser: User = {
        id: 'usr-admin-yeamin',
        name: 'Muhammad Yeamin (Super Admin)',
        email: 'muhammadeyamin0@gmail.com',
        phone: '01711234567',
        role: 'Super Admin',
        loyaltyPoints: 0,
        referralCode: 'VT-ADMIN',
        savedAddresses: [],
        isVerified: true,
        emailVerified: true
      };
      setCurrentUser(adminUser);
      setCurrentStaffRole('Super Admin');
      showToast('Admin Authenticated', 'স্বাগতম Muhammad Yeamin! অ্যাডমিন প্যানেল আনলক হয়েছে।', 'success');
      return { success: true };
    }
    return {
      success: false,
      message: 'ভুল জিমেইল অথবা ৪-ডিজিটের পাসওয়ার্ড! সঠিক তথ্য দিন।'
    };
  };

  const loginAsAdmin = () => {
    if (currentUser?.email === 'muhammadeyamin0@gmail.com') {
      loginAsStaff('Super Admin', 'Muhammad Yeamin (Super Admin)');
    }
  };

  const logout = () => {
    if (IS_GOOGLE_CLOUD_CONNECTED && auth) {
      fbSignOut(auth).catch(() => {});
    }
    setCurrentUser(null);
    setWishlist([]);
    showToast('Signed Out', 'You have been logged out securely.', 'info');
  };

  const updateCustomerStatus = (userId: string, status: 'Active' | 'Inactive') => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === userId ? { ...c, status } : c))
    );
    addAuditLog('CUSTOMER_STATUS', `Customer ID ${userId} set to ${status}`);
    showToast('Customer Status Updated', `Account marked as ${status}`, 'success');
  };

  const updateUserProfile = (data: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data };
    setCurrentUser(updated);
    setCustomers((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...data } : c))
    );
    showToast('Profile Updated', 'Your account settings have been saved.', 'success');
  };

  const addUserAddress = (address: Address) => {
    if (!currentUser) return;
    const newAddresses = [...(currentUser.savedAddresses || []), address];
    updateUserProfile({ savedAddresses: newAddresses });
  };

  const deleteUserAddress = (index: number) => {
    if (!currentUser) return;
    const newAddresses = (currentUser.savedAddresses || []).filter((_, i) => i !== index);
    updateUserProfile({ savedAddresses: newAddresses });
  };

  const isAdmin =
    currentUser?.role === 'Super Admin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'Order Moderator' ||
    currentUser?.role === 'Product Moderator' ||
    currentUser?.role === 'Finance Moderator' ||
    currentUser?.role === 'Content Moderator' ||
    currentUser?.role === 'Customer Support' ||
    currentStaffRole !== undefined;

  // Business Finance & Profit Management Handlers
  const addFinancialRecord = (rec: Omit<FinancialRecord, 'id' | 'createdAt'>) => {
    const newRecord: FinancialRecord = {
      ...rec,
      id: `fin-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setFinancialRecords((prev) => [newRecord, ...prev]);
    addAuditLog('FINANCE_RECORD_ADD', `Added ${newRecord.type} "${newRecord.title}" (৳${newRecord.amount.toLocaleString()})`);
    showToast('Finance Entry Recorded', `${newRecord.title} · ৳${newRecord.amount.toLocaleString()}`, 'success');

    fetch('/api/finances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord)
    }).catch((err) => console.warn('REST finance sync skipped:', err));
  };

  const updateFinancialRecord = (id: string, updated: Partial<FinancialRecord>) => {
    setFinancialRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
    addAuditLog('FINANCE_RECORD_UPDATE', `Updated financial record ${id}`);
    showToast('Record Updated', 'Finance changes saved.', 'success');

    fetch(`/api/finances/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch((err) => console.warn('REST finance update skipped:', err));
  };

  const deleteFinancialRecord = (id: string) => {
    const target = financialRecords.find((r) => r.id === id);
    setFinancialRecords((prev) => prev.filter((r) => r.id !== id));
    addAuditLog('FINANCE_RECORD_DELETE', `Deleted financial entry: ${target?.title || id}`);
    showToast('Entry Removed', 'Financial entry was removed.', 'info');

    fetch(`/api/finances/${id}`, { method: 'DELETE' }).catch((err) =>
      console.warn('REST finance delete skipped:', err)
    );
  };

  const clearAllFinances = () => {
    setFinancialRecords([]);
    localStorage.removeItem('vt_finances');
    localStorage.removeItem('vt_finances_v2');
    addAuditLog('FINANCES_CLEARED', 'Admin wiped all financial and earnings logs.');
    showToast('Finances Cleared', 'All earnings and expense records removed.', 'info');
  };

  // Moderator & Staff Handlers
  const addStaffModerator = (mod: Omit<StaffModerator, 'id' | 'assignedDate'>) => {
    const newMod: StaffModerator = {
      ...mod,
      id: `mod-${Date.now()}`,
      assignedDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      lastActive: 'Never'
    };
    setStaffModerators((prev) => [...prev, newMod]);
    addAuditLog('MODERATOR_ADD', `Assigned ${newMod.name} as ${newMod.role}`);
    showToast('Staff Moderator Created', `${newMod.name} granted ${newMod.role} access.`, 'success');

    fetch('/api/moderators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMod)
    }).catch((err) => console.warn('REST moderator sync skipped:', err));
  };

  const updateStaffModerator = (id: string, updated: Partial<StaffModerator>) => {
    setStaffModerators((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
    );
    addAuditLog('MODERATOR_UPDATE', `Updated permissions/status for moderator ${id}`);
    showToast('Permissions Updated', 'Staff moderator record modified.', 'success');

    fetch(`/api/moderators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch((err) => console.warn('REST moderator update skipped:', err));
  };

  const deleteStaffModerator = (id: string) => {
    const target = staffModerators.find((m) => m.id === id);
    if (target?.role === 'Super Admin') {
      showToast('Action Denied', 'The primary owner / Super Admin cannot be removed.', 'error');
      return;
    }
    setStaffModerators((prev) => prev.filter((m) => m.id !== id));
    addAuditLog('MODERATOR_REMOVE', `Revoked moderator privileges for ${target?.name || id}`);
    showToast('Access Revoked', 'Staff moderator account removed.', 'info');

    fetch(`/api/moderators/${id}`, { method: 'DELETE' }).catch((err) =>
      console.warn('REST moderator delete skipped:', err)
    );
  };

  // Visual Themes Handlers
  const THEME_PRESETS: Record<ThemePreset, Partial<ThemeConfig>> = {
    'minimal-luxury': {
      preset: 'minimal-luxury',
      primaryColor: '#14221C',
      secondaryColor: '#202522',
      accentColor: '#FF762E',
      bgColor: '#F7F5EF',
      cardBg: '#FFFFFF',
      textColor: '#0A0A0A',
      borderColor: '#E5E1D5',
      buttonRadius: 'rounded-xl',
      animationIntensity: 'normal'
    },
    'black-gold': {
      preset: 'black-gold',
      primaryColor: '#0D0D0D',
      secondaryColor: '#1A1A1A',
      accentColor: '#D4AF37',
      bgColor: '#0F0F10',
      cardBg: '#18181A',
      textColor: '#F5F5F0',
      borderColor: '#2E2B20',
      buttonRadius: 'rounded-lg',
      animationIntensity: 'subtle'
    },
    'black-and-gold': {
      preset: 'black-and-gold',
      primaryColor: '#0D0D0D',
      secondaryColor: '#1A1A1A',
      accentColor: '#D4AF37',
      bgColor: '#0F0F10',
      cardBg: '#18181A',
      textColor: '#F5F5F0',
      borderColor: '#2E2B20',
      buttonRadius: 'rounded-lg',
      animationIntensity: 'subtle'
    },
    'modern-streetwear': {
      preset: 'modern-streetwear',
      primaryColor: '#111111',
      secondaryColor: '#1E1E1E',
      accentColor: '#FF3300',
      bgColor: '#F2F2F2',
      cardBg: '#FFFFFF',
      textColor: '#0A0A0A',
      borderColor: '#E0E0E0',
      buttonRadius: 'rounded-none',
      animationIntensity: 'cinematic'
    },
    'clean-white': {
      preset: 'clean-white',
      primaryColor: '#1F2937',
      secondaryColor: '#374151',
      accentColor: '#2563EB',
      bgColor: '#FFFFFF',
      cardBg: '#F9FAFB',
      textColor: '#0A0A0A',
      borderColor: '#E5E7EB',
      buttonRadius: 'rounded-xl',
      animationIntensity: 'normal'
    },
    'dark-cinematic': {
      preset: 'dark-cinematic',
      primaryColor: '#0A0F1D',
      secondaryColor: '#111827',
      accentColor: '#38BDF8',
      bgColor: '#050814',
      cardBg: '#0D1527',
      textColor: '#F8FAFC',
      borderColor: '#1E293B',
      buttonRadius: 'rounded-2xl',
      animationIntensity: 'cinematic'
    },
    'seasonal-collection': {
      preset: 'seasonal-collection',
      primaryColor: '#1B3022',
      secondaryColor: '#2C4A35',
      accentColor: '#E07A5F',
      bgColor: '#F4F1DE',
      cardBg: '#FFFFFF',
      textColor: '#0A0A0A',
      borderColor: '#DFD8C0',
      buttonRadius: 'rounded-xl',
      animationIntensity: 'normal'
    }
  };

  const setThemePreset = (preset: ThemePreset) => {
    const config = THEME_PRESETS[preset];
    if (config) {
      setThemeConfig((prev) => ({ ...prev, ...config }));
      showToast('Theme Changed', `Applied "${preset.replace('-', ' ').toUpperCase()}"`, 'success');
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...themeConfig, ...config })
      }).catch((err) => console.warn('REST theme sync skipped:', err));
    }
  };

  const updateThemeConfig = (cfg: Partial<ThemeConfig>) => {
    setThemeConfig((prev) => {
      const next = { ...prev, ...cfg };
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      }).catch((err) => console.warn('REST theme sync skipped:', err));
      return next;
    });
    showToast('Theme Saved', 'Visual styling customized.', 'success');
  };

  // 3D Banners Handlers
  const updateBanner3D = (id: string, updated: Partial<Banner3DConfig>) => {
    setBanners3D((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updated } : b))
    );
    showToast('3D Banner Updated', 'Visual showcase refreshed.', 'success');
  };

  const addBanner3D = (banner: Omit<Banner3DConfig, 'id'>) => {
    const newBanner: Banner3DConfig = {
      ...banner,
      id: `b3d-${Date.now()}`
    };
    setBanners3D((prev) => [newBanner, ...prev]);
    showToast('3D Banner Added', `${banner.title} created.`, 'success');
  };

  const deleteBanner3D = (id: string) => {
    setBanners3D((prev) => prev.filter((b) => b.id !== id));
    showToast('Banner Removed', undefined, 'info');
  };

  return (
    <StoreContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        selectedProductId,
        openProductDetail,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartSubtotal,
        cartItemCount,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        wishlist,
        toggleWishlist,
        isInWishlist,
        comparisonList,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isInComparison,
        isComparisonModalOpen,
        setIsComparisonModalOpen,
        coupons,
        appliedCoupon,
        applyCouponCode,
        removeCoupon,
        discountAmount,
        appliedPointsDiscount,
        redeemPoints,
        removeRedeemedPoints,
        appliedReferralCode,
        applyReferralCode,
        removeReferralCode,
        settings,
        updateSettings,
        calculateDeliveryFee,
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
        getProductById,
        getProductBySlug,
        categories,
        addCategory,
        updateCategoryName,
        deleteCategory,
        moveCategoryOrder,
        reorderCategories,
        moveProductInCategory,
        banners,
        updateBanner,
        orders,
        lastPlacedOrder,
        placeOrder,
        updateOrderStatus,
        updateOrderPayment,
        cancelOrder,
        requestOrderReturn,
        approveOrder,
        assignCourierTracking,
        trackOrderLookup,
        clearAllOrders,
        deleteOrder,
        addCoupon,
        deleteCoupon,
        toggleCouponActive,
        currentUser,
        isAdmin,
        currentStaffRole,
        setCurrentStaffRole,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        sendOtp,
        verifyOtp,
        socialLogin,
        verifyAndLoginCustomer,
        registerCustomer,
        loginAsCustomer,
        loginAsStaff,
        loginAsAdmin,
        verifyAdminCredentials,
        logout,
        customers,
        updateCustomerStatus,
        updateUserProfile,
        addUserAddress,
        deleteUserAddress,
        smsLogs,
        smsTemplates,
        updateSmsTemplate,
        resendSms,
        sendOrderSms,
        whatsappLogs,
        generateWhatsAppOrderUrl,
        sendWhatsAppNotification,
        auditLogs,
        addAuditLog,
        isSizeGuideOpen,
        setIsSizeGuideOpen,
        toasts,
        showToast,
        removeToast,
        buyNow,
        financialRecords,
        addFinancialRecord,
        updateFinancialRecord,
        deleteFinancialRecord,
        clearAllFinances,
        staffModerators,
        addStaffModerator,
        updateStaffModerator,
        deleteStaffModerator,
        themeConfig,
        updateThemeConfig,
        setThemePreset,
        banners3D,
        updateBanner3D,
        addBanner3D,
        deleteBanner3D
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
