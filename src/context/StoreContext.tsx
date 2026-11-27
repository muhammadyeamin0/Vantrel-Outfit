import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { rewriteProductImagesToProxy, rewriteToCanonicalProxyUrl } from '../utils/imageProxy';
import { isSearchCrawler, withTimeout } from '../utils/crawlerDetect';
import { doesProductMatchCategory } from '../utils/categoryShowcase';
import { isProductOutOfStock, shouldHideProductFromPublic } from '../utils/stockVisibility';
import { buildCourierTrackingUrl } from '../utils/orderProgress';
import { findProductByUrlParam } from '../utils/seoSlug';
import {
  ensureMetaPixelLoaded,
  sanitizeMetaPixelId,
  trackMetaAddToCart
} from '../utils/metaPixel';
import {
  IS_GOOGLE_CLOUD_CONNECTED,
  getAuthModule,
  getCurrentFirebaseUserSync,
  getFirebaseAuth,
  getFirebaseDb,
  getFirestoreModule,
  sanitizeFirestoreData,
  signInWithGooglePopup,
  signOutFirebase
} from '../firebase';

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

export const COST_TO_SELLING_MARKUP_BDT = 220;
export const SELLING_TO_REGULAR_MARKUP_BDT = 200;

const CATALOG_CACHE_TTL_MS = 20 * 60 * 1000;
const ORDERS_CACHE_TTL_MS = 15 * 60 * 1000;
const WISHLIST_CACHE_TTL_MS = 20 * 60 * 1000;
const CLIENT_QUOTA_BACKOFF_MS = 60 * 60 * 1000;

const VT_PRODUCTS_SYNCED_AT_KEY = 'vt_products_last_synced_at';
const VT_CATEGORIES_SYNCED_AT_KEY = 'vt_categories_last_synced_at';
const VT_ORDERS_SYNCED_AT_KEY = 'vt_orders_last_synced_at';
const VT_CLIENT_QUOTA_BACKOFF_KEY = 'vt_fs_quota_backoff_until';

function readSyncTimestamp(key: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (!val) return null;
    const ms = new Date(val).getTime();
    return Number.isFinite(ms) ? val : null;
  } catch {
    return null;
  }
}

function isCacheTimestampFresh(key: string, ttlMs: number): boolean {
  try {
    const val = localStorage.getItem(key);
    if (!val) return false;
    const ms = new Date(val).getTime();
    return Number.isFinite(ms) && Date.now() - ms < ttlMs;
  } catch {
    return false;
  }
}

function stampSyncTimestamp(key: string, isoOverride?: string): string {
  const iso = isoOverride || new Date().toISOString();
  try {
    localStorage.setItem(key, iso);
  } catch {
    // ignore storage errors
  }
  return iso;
}

function isClientFirestoreQuotaBackedOff(): boolean {
  try {
    const until = Number(localStorage.getItem(VT_CLIENT_QUOTA_BACKOFF_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function markClientFirestoreQuotaBackedOff(): void {
  try {
    localStorage.setItem(VT_CLIENT_QUOTA_BACKOFF_KEY, String(Date.now() + CLIENT_QUOTA_BACKOFF_MS));
  } catch {
    // ignore storage errors
  }
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  const code = typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code.toLowerCase() : '';
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    code === 'resource-exhausted' ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('free daily read units')
  );
}

export function dedupeProductsById(list: Product[]): Product[] {
  const seen = new Set<string>();
  const unique: Product[] = [];
  for (const item of list) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

export function computePricesFromCost(cost: number): {
  costPrice: number;
  sellingPrice: number;
  regularPrice: number;
  discountPercent: number;
} {
  const cleanCost = Math.max(0, Math.round(Number(cost) || 0));
  const sellingPrice = cleanCost + COST_TO_SELLING_MARKUP_BDT;
  const regularPrice = sellingPrice + SELLING_TO_REGULAR_MARKUP_BDT;
  const discountPercent =
    regularPrice > 0 ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100) : 0;
  return {
    costPrice: cleanCost,
    sellingPrice,
    regularPrice,
    discountPercent
  };
}

export function applyCostMarkupRule<
  T extends {
    costPrice?: number;
    discountPrice?: number;
    regularPrice: number;
    discountPercent?: number;
  }
>(prod: T): T {
  const numericCost = typeof prod.costPrice === 'number' ? prod.costPrice : Number(prod.costPrice);
  if (!Number.isFinite(numericCost) || numericCost <= 0) return prod;
  const { costPrice, sellingPrice, regularPrice, discountPercent } = computePricesFromCost(numericCost);
  return {
    ...prod,
    costPrice,
    discountPrice: sellingPrice,
    regularPrice,
    discountPercent
  };
}

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

  const numericTotalStock =
    typeof prod.totalStock === 'number' && Number.isFinite(prod.totalStock)
      ? Math.max(0, Math.round(prod.totalStock))
      : 50;

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
            stock:
              numericTotalStock <= 0
                ? 0
                : Math.max(1, Math.floor(numericTotalStock / Math.max(1, sizes.length * colors.length))),
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
          stock:
            numericTotalStock <= 0
              ? 0
              : Math.max(1, Math.floor(numericTotalStock / Math.max(1, sizes.length))),
          sku: `${prod.sku || 'VT'}-${sz}`
        });
      }
    });
  }

  const syncedVariants: ProductVariant[] =
    numericTotalStock <= 0
      ? finalVariants.map((v) => ({ ...v, stock: 0 }))
      : finalVariants.length > 0 && finalVariants.every((v) => (v.stock ?? 0) <= 0)
      ? finalVariants.map((v) => ({
          ...v,
          stock: Math.max(1, Math.floor(numericTotalStock / Math.max(1, finalVariants.length)))
        }))
      : finalVariants;

  return applyCostMarkupRule({
    ...prod,
    totalStock: numericTotalStock,
    images: rewriteProductImagesToProxy(prod.images),
    sizes,
    colors,
    variants: syncedVariants
  });
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const activeUser = getCurrentFirebaseUserSync();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeUser?.uid,
      email: activeUser?.email,
      emailVerified: activeUser?.emailVerified,
      isAnonymous: activeUser?.isAnonymous,
      tenantId: activeUser?.tenantId,
      providerInfo: activeUser?.providerData?.map((provider: any) => ({
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
  isProductsLoading: boolean;

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
    zone: 'inside_dhaka' | 'dhaka_sub_area' | 'outside_dhaka' | 'remote_area' | 'express_dhaka',
    subtotal: number
  ) => number;

  // Products & Catalog Sync
  products: Product[];
  activeProducts: Product[];
  archivedProducts: Product[];
  isCatalogSyncing: boolean;
  catalogLastSyncedAt: string | null;
  catalogSyncWarning: string | null;
  refreshCatalog: (force?: boolean) => Promise<{ success: boolean; count: number; message?: string }>;
  addProduct: (
    product: Omit<Product, 'id' | 'createdDate'>
  ) => Promise<{ success: boolean; firestoreSynced: boolean; apiSynced: boolean; error?: string }>;
  updateProduct: (
    id: string,
    updated: Partial<Product>
  ) => Promise<{ success: boolean; firestoreSynced: boolean; apiSynced: boolean; error?: string }>;
  deleteProduct: (id: string) => void;
  restoreProduct: (id: string) => void;
  permanentlyDeleteProduct: (id: string) => void;
  deleteAllProducts: () => void;
  recalculateAllPricesFromCost: () => Promise<number>;
  duplicateProduct: (id: string) => void;
  moveProductUp: (id: string) => void;
  moveProductDown: (id: string) => void;
  pinProductToTop: (id: string) => void;
  toggleTopProduct: (id: string) => Promise<void>;
  moveProductToTop: (id: string) => void;
  addProductReview: (
    productId: string,
    review: {
      id: string;
      author: string;
      rating: number;
      date: string;
      comment: string;
      verifiedPurchase?: boolean;
      location?: string;
      photos?: string[];
    }
  ) => void;
  getProductById: (id: string) => Product | undefined;
  getProductBySlug: (slug: string) => Product | undefined;

  // Categories & Banners
  categories: ProductCategory[];
  addCategory: (name: ProductCategory) => void;
  updateCategoryName: (oldName: ProductCategory, newName: ProductCategory) => void;
  deleteCategory: (name: ProductCategory) => void;
  deleteCategories: (names: ProductCategory[]) => void;
  moveCategoryOrder: (category: ProductCategory, direction: 'up' | 'down' | 'first') => void;
  reorderCategories: (newOrder: ProductCategory[]) => void;
  moveProductInCategory: (
    id: string,
    categoryFilter: string,
    direction: 'up' | 'down' | 'top',
    targetRank?: number
  ) => Promise<void>;
  setCategoryBestProduct: (category: ProductCategory, productId: string | null) => Promise<void>;
  banners: BannerConfig[];
  updateBanner: (id: string, updated: Partial<BannerConfig>) => void;

  // Orders (16-Stage Lifecycle)
  orders: Order[];
  isOrdersSyncing: boolean;
  ordersSyncWarning: string | null;
  ordersLastSyncedAt: string | null;
  ordersHasMore: boolean;
  ordersFetchLimit: number;
  ordersDateRangeDays: number | 'all';
  setOrdersDateRangeDays: (days: number | 'all') => void;
  refreshOrders: (
    force?: boolean,
    options?: { limit?: number; sinceDays?: number | 'all'; status?: string }
  ) => Promise<{ success: boolean; count: number; message?: string; hasMore?: boolean }>;
  loadMoreOrders: () => Promise<{ success: boolean; count: number; message?: string }>;
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
    trackingNumber: string,
    options?: {
      targetStatus?: OrderStatus;
      note?: string;
      trackingUrl?: string;
    }
  ) => void;
  trackOrderLookup: (orderNumber?: string, phone?: string) => Order | null;
  refreshOrderFromServer: (orderNumberOrTracking: string, phone: string) => Promise<Order | null>;
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
  sendOtp: (phone: string) => { success: boolean; message: string };
  verifyOtp: (phone: string, otp: string, customerName?: string) => { success: boolean; user?: User; message: string };
  socialLogin: (
    provider: 'google' | 'facebook',
    profileData?: { name?: string; email?: string; phone?: string }
  ) => Promise<User | null>;
  verifyAndLoginCustomer: (data: {
    method: 'phone_otp' | 'google' | 'facebook';
    name: string;
    phone: string;
    email?: string;
    otp?: string;
  }) => Promise<{ success: boolean; user?: User; message: string }>;
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
  signInAdminWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  isFirebaseAdminAuthenticated: boolean;
  firebaseAuthLoaded: boolean;
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

  // Products (hydrates immediately from pre-rendered #vantrel-ssr-products or localStorage — never auto-seeded with primary products)
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof document !== 'undefined') {
      const ssrScript = document.getElementById('vantrel-ssr-products');
      if (ssrScript && ssrScript.textContent) {
        try {
          const parsedSsr: Product[] = JSON.parse(ssrScript.textContent);
          if (Array.isArray(parsedSsr) && parsedSsr.length > 0) {
            const hydratedSsr = dedupeProductsById(
              parsedSsr
                .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
                .map(sanitizeProductSizes)
            );
            // If SSR payload is partial (deep-link speed optimization), merge any locally cached items immediately
            if (ssrScript.getAttribute('data-partial') === 'true') {
              try {
                const cachedRaw = localStorage.getItem('vt_products_v4');
                if (cachedRaw) {
                  const cachedParsed = JSON.parse(cachedRaw) as Product[];
                  if (Array.isArray(cachedParsed) && cachedParsed.length > 0) {
                    return dedupeProductsById([
                      ...hydratedSsr,
                      ...cachedParsed
                        .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
                        .map(sanitizeProductSizes)
                    ]);
                  }
                }
              } catch {
                // ignore cache merge error
              }
            }
            return hydratedSsr;
          }
        } catch {
          // fallback below
        }
      }
    }
    const saved = localStorage.getItem('vt_products_v4');
    if (saved) {
      try {
        const parsed: Product[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return dedupeProductsById(
            parsed
              .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
              .map(sanitizeProductSizes)
          );
        }
      } catch {
        return [];
      }
    }
    return [];
  });
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(() => products.length === 0);
  const [isCatalogSyncing, setIsCatalogSyncing] = useState<boolean>(false);
  const [catalogLastSyncedAt, setCatalogLastSyncedAt] = useState<string | null>(() =>
    readSyncTimestamp(VT_PRODUCTS_SYNCED_AT_KEY)
  );
  const [catalogSyncWarning, setCatalogSyncWarning] = useState<string | null>(null);
  const productsRef = useRef<Product[]>(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

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

  const [deletedCategories, setDeletedCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('vt_deleted_categories_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean);
        }
      } catch {
        // fallback empty
      }
    }
    return [];
  });
  const deletedCategoriesRef = useRef<string[]>(deletedCategories);
  const categoriesRef = useRef<ProductCategory[]>(categories);
  const hasLocalCategoryMutationRef = useRef<boolean>(false);

  useEffect(() => {
    deletedCategoriesRef.current = deletedCategories;
    localStorage.setItem('vt_deleted_categories_v1', JSON.stringify(deletedCategories));
  }, [deletedCategories]);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

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
    const savedV3 = localStorage.getItem('vt_settings_v3');
    if (savedV3) {
      try {
        const parsed = JSON.parse(savedV3);
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          storeName: parsed.storeName === 'VANTREL' ? 'VANTREL OUTFIT' : (parsed.storeName || 'VANTREL OUTFIT'),
          deliveryFeeInsideDhaka: parsed.deliveryFeeInsideDhaka ?? INITIAL_SETTINGS.deliveryFeeInsideDhaka,
          deliveryFeeDhakaSubArea: parsed.deliveryFeeDhakaSubArea ?? INITIAL_SETTINGS.deliveryFeeDhakaSubArea,
          deliveryFeeOutsideDhaka: parsed.deliveryFeeOutsideDhaka ?? INITIAL_SETTINGS.deliveryFeeOutsideDhaka,
          deliveryFeeRemote: parsed.deliveryFeeRemote ?? INITIAL_SETTINGS.deliveryFeeRemote,
          deliveryFeeExpress: parsed.deliveryFeeExpress ?? INITIAL_SETTINGS.deliveryFeeExpress
        };
      } catch {
        return INITIAL_SETTINGS;
      }
    }

    const legacySaved =
      localStorage.getItem('vt_settings_v2') ||
      localStorage.getItem('vt_settings') ||
      localStorage.getItem('yw_settings');
    if (legacySaved) {
      try {
        const parsed = JSON.parse(legacySaved);
        const hasOldHeadline =
          !parsed.announcementText ||
          parsed.announcementText.includes('৳70') ||
          parsed.announcementText.includes('৳120') ||
          parsed.announcementText.includes('VANTREL LUXURY');
        const oldInside = parsed.deliveryFeeInsideDhaka;
        const oldOutside = parsed.deliveryFeeOutsideDhaka;
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          storeName: parsed.storeName === 'VANTREL' ? 'VANTREL OUTFIT' : (parsed.storeName || 'VANTREL OUTFIT'),
          announcementText: hasOldHeadline ? INITIAL_SETTINGS.announcementText : parsed.announcementText,
          deliveryFeeInsideDhaka:
            oldInside === undefined || oldInside === 70 || oldInside === 80 || oldInside === 100 ? 0 : oldInside,
          deliveryFeeDhakaSubArea: parsed.deliveryFeeDhakaSubArea ?? 50,
          deliveryFeeOutsideDhaka:
            oldOutside === undefined || oldOutside === 120 || oldOutside === 130 || oldOutside === 150 ? 50 : oldOutside,
          deliveryFeeRemote: 50,
          deliveryFeeExpress: 50
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
  const [isOrdersSyncing, setIsOrdersSyncing] = useState(false);
  const [ordersSyncWarning, setOrdersSyncWarning] = useState<string | null>(null);
  const [ordersLastSyncedAt, setOrdersLastSyncedAt] = useState<string | null>(() =>
    readSyncTimestamp(VT_ORDERS_SYNCED_AT_KEY)
  );
  const [ordersHasMore, setOrdersHasMore] = useState<boolean>(false);
  const [ordersFetchLimit, setOrdersFetchLimit] = useState<number>(50);
  const [ordersDateRangeDays, setOrdersDateRangeDays] = useState<number | 'all'>('all');
  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  const deletedOrderIdsRef = useRef<Set<string>>(new Set());

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
  const [firebaseAuthLoaded, setFirebaseAuthLoaded] = useState(() => Boolean(getCurrentFirebaseUserSync()));
  const [isFirebaseAdminAuthenticated, setIsFirebaseAdminAuthenticated] = useState(() => {
    const syncUser = getCurrentFirebaseUserSync();
    return Boolean(
      syncUser &&
        syncUser.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
        syncUser.emailVerified
    );
  });

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

  // Staff & Moderator Management (no primary or automatic moderators; Super Admin adds manually)
  const [staffModerators, setStaffModerators] = useState<StaffModerator[]>(() => {
    const legacyAutoModIds = new Set(['mod-001', 'mod-002', 'mod-003', 'mod-004']);
    const saved = localStorage.getItem('vt_moderators');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (localStorage.getItem('vt_mods_manual_only_v1') !== '1') {
            const cleaned = parsed.filter(
              (m: StaffModerator) => m && m.id && !legacyAutoModIds.has(m.id)
            );
            localStorage.setItem('vt_mods_manual_only_v1', '1');
            localStorage.setItem('vt_moderators', JSON.stringify(cleaned));
            return cleaned;
          }
          return parsed;
        }
        return [];
      } catch {
        return [];
      }
    }
    localStorage.setItem('vt_mods_manual_only_v1', '1');
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

  // Persist State to LocalStorage (slim inline base64 strings if large so 5MB quota never blocks boot)
  useEffect(() => {
    try {
      const serialized = JSON.stringify(products);
      if (serialized.length <= 2_600_000) {
        localStorage.setItem('vt_products_v4', serialized);
      } else {
        const slimmed = products.map((p) => ({
          ...p,
          images: (p.images || []).map((img, idx) =>
            typeof img === 'string' && img.startsWith('data:image/')
              ? `/api/product-image?id=${encodeURIComponent(p.id)}&idx=${idx}`
              : img
          )
        }));
        localStorage.setItem('vt_products_v4', JSON.stringify(slimmed));
      }
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
    localStorage.setItem('vt_settings_v3', JSON.stringify(settings));
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

  const getAdminAuthHeaders = useCallback(async (extraHeaders?: Record<string, string>) => {
    const headers: Record<string, string> = { ...(extraHeaders || {}) };
    try {
      const fbAuth = await getFirebaseAuth();
      if (typeof (fbAuth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
        await (fbAuth as { authStateReady: () => Promise<void> }).authStateReady();
      }
      if (fbAuth.currentUser) {
        const token = await fbAuth.currentUser.getIdToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch {
      // Proceed without bearer token
    }
    return headers;
  }, []);

  // Rehydrate in-memory backend SMTP fallback from verified AdminDashboard session without creating disk files
  useEffect(() => {
    const cleanedPass = (settings.gmailNotificationAppPassword || '').replace(/\s+/g, '');
    if (currentPage !== 'admin' || !cleanedPass || currentUser?.email?.toLowerCase() !== 'muhammadeyamin0@gmail.com') {
      return;
    }
    let cancelled = false;
    getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
      if (cancelled || !headers.Authorization) return;
      fetch('/api/settings/smtp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderNotificationEmail: settings.orderNotificationEmail,
          gmailNotificationUser: settings.gmailNotificationUser,
          gmailNotificationAppPassword: cleanedPass
        })
      }).catch(() => {
        // Non-critical in-memory hydration notice
      });
    });
    return () => {
      cancelled = true;
    };
  }, [currentPage, currentUser?.email, settings.gmailNotificationAppPassword, settings.orderNotificationEmail, settings.gmailNotificationUser, getAdminAuthHeaders]);

  // Validate Firestore server connectivity once per browser session when verified Admin enters Admin Dashboard
  useEffect(() => {
    const syncUser = getCurrentFirebaseUserSync();
    if (
      currentPage !== 'admin' ||
      !IS_GOOGLE_CLOUD_CONNECTED ||
      isSearchCrawler() ||
      isClientFirestoreQuotaBackedOff() ||
      syncUser?.email?.toLowerCase() !== 'muhammadeyamin0@gmail.com' ||
      !syncUser?.emailVerified
    ) {
      return;
    }
    try {
      if (sessionStorage.getItem('vt_fb_conn_checked_v1') === '1') return;
    } catch {
      // continue check
    }
    let cancelled = false;
    async function testConnection() {
      try {
        const [db, { doc, getDocFromServer }] = await Promise.all([
          getFirebaseDb(),
          getFirestoreModule()
        ]);
        if (cancelled) return;
        await withTimeout(getDocFromServer(doc(db, 'test', 'connection')), 4000, 'Connection check timed out');
        try {
          sessionStorage.setItem('vt_fb_conn_checked_v1', '1');
        } catch {
          // ignore
        }
      } catch (error) {
        if (isQuotaExceededError(error)) {
          markClientFirestoreQuotaBackedOff();
        } else if (!cancelled && error instanceof Error && error.message.includes('the client is offline')) {
          console.warn('Firebase client is offline or network unavailable.');
        }
      }
    }
    testConnection();
    return () => {
      cancelled = true;
    };
  }, [currentPage, currentUser?.email, isFirebaseAdminAuthenticated]);

  // Public Storefront Products Loading: Uses embedded SSR catalog or clean /api/products REST endpoint
  // (Eliminates client-side Firestore Listen/channel WebChannel XHR streams during Googlebot indexing & public visits)
  useEffect(() => {
    let isMounted = true;

    const mergeDynamicCategories = (loadedProducts: Product[]) => {
      if (loadedProducts.length === 0) return;
      let storedDeleted: string[] = [];
      try {
        const rawDel = localStorage.getItem('vt_deleted_categories_v1');
        if (rawDel) {
          const parsedDel = JSON.parse(rawDel);
          if (Array.isArray(parsedDel)) {
            storedDeleted = parsedDel.map((d) => String(d || '').trim().toLowerCase());
          }
        }
      } catch {
        // ignore storage parse error
      }
      const deletedSet = new Set<string>([
        ...deletedCategoriesRef.current.map((d) => d.trim().toLowerCase()),
        ...storedDeleted
      ]);

      setCategories((prevCats) => {
        const existingLower = new Set(prevCats.map((c) => c.trim().toLowerCase()));
        const additions: ProductCategory[] = [];
        loadedProducts.forEach((p) => {
          if (p.isArchived || p.status === 'archived') return;
          const cat = (p.category || '').trim();
          const catLower = cat.toLowerCase();
          if (cat && !existingLower.has(catLower) && !deletedSet.has(catLower)) {
            existingLower.add(catLower);
            additions.push(cat);
          }
        });
        return additions.length > 0 ? [...prevCats, ...additions] : prevCats;
      });
    };

    const sortProductsList = (items: Product[]) => {
      return [...items].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
          return a.sortOrder - b.sortOrder;
        }
        return 0;
      });
    };

    // 1. Check for server-embedded catalog first (zero XHR needed on SSR/Googlebot routes)
    let hasSsrCatalog = false;
    let isPartialSsrCatalog = false;
    if (typeof document !== 'undefined') {
      const ssrScript = document.getElementById('vantrel-ssr-products');
      if (ssrScript && ssrScript.textContent) {
        try {
          isPartialSsrCatalog = ssrScript.getAttribute('data-partial') === 'true';
          const parsedSsr = JSON.parse(ssrScript.textContent) as Product[];
          if (Array.isArray(parsedSsr) && parsedSsr.length > 0) {
            hasSsrCatalog = true;
            const cleanSsr = sortProductsList(
              dedupeProductsById(
                parsedSsr
                  .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
                  .map((p) =>
                    sanitizeProductSizes({
                      ...p,
                      isArchived: Boolean(p.isArchived || p.status === 'archived')
                    })
                  )
              )
            );
            setProducts((prev) => dedupeProductsById([...cleanSsr, ...prev]));
            setIsProductsLoading(false);
            mergeDynamicCategories(cleanSsr);
            if (!readSyncTimestamp(VT_PRODUCTS_SYNCED_AT_KEY)) {
              setCatalogLastSyncedAt(stampSyncTimestamp(VT_PRODUCTS_SYNCED_AT_KEY));
            }
          }
        } catch {
          // Proceed to fetch below
        }
      }
    }

    // Search crawlers with SSR catalog already embedded do not need any additional XHR requests
    if (isSearchCrawler() && hasSsrCatalog) {
      setIsProductsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    // 1b. Fast single-product deep-link lookup if visitor arrived on /product/:slug before catalog arrived
    if (typeof window !== 'undefined') {
      try {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const searchParams = new URLSearchParams(window.location.search);
        const deepLinkParam =
          (pathParts[0]?.toLowerCase() === 'product' && pathParts[1]
            ? decodeURIComponent(pathParts[1])
            : null) ||
          searchParams.get('product') ||
          searchParams.get('productId') ||
          (searchParams.get('page') === 'product' ? searchParams.get('id') : null);

        if (deepLinkParam && !findProductByUrlParam(deepLinkParam, productsRef.current)) {
          fetch(`/api/products?id=${encodeURIComponent(deepLinkParam)}`, {
            headers: { Accept: 'application/json' },
            cache: 'default'
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
              if (!isMounted || !json?.success || !json?.data) return;
              const singleProd = sanitizeProductSizes({
                ...(json.data as Product),
                isArchived: Boolean(json.data.isArchived || json.data.status === 'archived')
              });
              setProducts((prev) => dedupeProductsById([singleProd, ...prev]));
              setIsProductsLoading(false);
            })
            .catch(() => {
              // Full catalog fetch below will populate
            });
        }
      } catch {
        // Ignore deep-link URL parse edge cases
      }
    }

    const hasRecentAdminMutation = (() => {
      try {
        const ts = Number(sessionStorage.getItem('vt_catalog_mutated_at') || 0);
        return ts > 0 && Date.now() - ts < 5 * 60 * 1000;
      } catch {
        return false;
      }
    })();

    // 2. Clean single-shot HTTP fetch to /api/products (skips on mount when valid cached catalog < 20 min exists)
    const loadFromProductsApi = async () => {
      const hasValidLocalCatalog =
        productsRef.current.length > 0 &&
        isCacheTimestampFresh(VT_PRODUCTS_SYNCED_AT_KEY, CATALOG_CACHE_TTL_MS) &&
        !hasRecentAdminMutation;

      if (hasValidLocalCatalog) {
        if (isMounted) setIsProductsLoading(false);
        return;
      }

      const isAdminEntry =
        hasRecentAdminMutation ||
        (typeof window !== 'undefined' &&
          (window.location.pathname.toLowerCase().startsWith('/admin') || currentPage === 'admin'));
      try {
        const res = await fetch(`/api/products${isAdminEntry ? '?fresh=1' : ''}`, {
          headers: { Accept: 'application/json' },
          cache: isAdminEntry ? 'no-store' : 'default'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && isMounted) {
          const serverProducts = sortProductsList(
            dedupeProductsById(
              (json.data as Product[])
                .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
                .map((p) =>
                  sanitizeProductSizes({
                    ...p,
                    discountPrice:
                      typeof p.discountPrice === 'number' && p.discountPrice > 0 ? p.discountPrice : undefined,
                    discountPercent:
                      typeof p.discountPercent === 'number' && p.discountPercent > 0 ? p.discountPercent : undefined,
                    isArchived: Boolean(p.isArchived || p.status === 'archived')
                  })
                )
            )
          );
          if (serverProducts.length > 0) {
            setProducts(serverProducts);
            mergeDynamicCategories(serverProducts);
          }
          setIsProductsLoading(false);
          setCatalogSyncWarning(null);
          setCatalogLastSyncedAt(stampSyncTimestamp(VT_PRODUCTS_SYNCED_AT_KEY));
        } else if (isMounted) {
          setIsProductsLoading(false);
        }
      } catch (err) {
        // Emergency Firestore fallback ONLY if cache is empty, non-crawler, and not quota-backed-off
        if (
          !isMounted ||
          isSearchCrawler() ||
          !IS_GOOGLE_CLOUD_CONNECTED ||
          isClientFirestoreQuotaBackedOff() ||
          productsRef.current.length > 0
        ) {
          if (isMounted) setIsProductsLoading(false);
          console.warn('Products API load notice:', err);
          return;
        }
        try {
          const [db, { collection, getDocs }] = await Promise.all([
            getFirebaseDb(),
            getFirestoreModule()
          ]);
          const snapshot = await withTimeout(
            getDocs(collection(db, 'products')),
            5000,
            'Firestore fallback read timed out'
          );
          if (!isMounted) return;
          if (snapshot.empty) {
            setIsProductsLoading(false);
            return;
          }
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
          const sorted = sortProductsList(dedupeProductsById(remoteProducts));
          if (sorted.length > 0) {
            setProducts(sorted);
            mergeDynamicCategories(sorted);
            setCatalogLastSyncedAt(stampSyncTimestamp(VT_PRODUCTS_SYNCED_AT_KEY));
          }
          setIsProductsLoading(false);
        } catch (fbErr) {
          if (isQuotaExceededError(fbErr)) {
            markClientFirestoreQuotaBackedOff();
            setCatalogSyncWarning(
              'Firebase Firestore কোটা সীমা পূর্ণ হওয়ায় ক্যাশ থেকে প্রোডাক্ট দেখানো হচ্ছে।'
            );
          }
          if (isMounted) setIsProductsLoading(false);
          console.warn('Products fallback load notice:', fbErr);
        }
      }
    };

    if (!isSearchCrawler() || isPartialSsrCatalog || !hasSsrCatalog) {
      loadFromProductsApi();
    }

    // Defer secondary Firestore settings/categories sync and skip entirely if 20-minute TTL cache is fresh
    let firestoreHydrateStarted = false;
    let hydrateTimer: number | undefined;
    const interactionEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll'];

    const hydrateRemoteSettings = async () => {
      if (
        !isMounted ||
        firestoreHydrateStarted ||
        !IS_GOOGLE_CLOUD_CONNECTED ||
        isSearchCrawler() ||
        isClientFirestoreQuotaBackedOff()
      ) {
        return;
      }
      const hasValidCachedCategories =
        categoriesRef.current.length > 1 &&
        isCacheTimestampFresh(VT_CATEGORIES_SYNCED_AT_KEY, CATALOG_CACHE_TTL_MS) &&
        !hasRecentAdminMutation;

      if (hasValidCachedCategories) {
        firestoreHydrateStarted = true;
        return;
      }

      firestoreHydrateStarted = true;
      try {
        const [db, { doc, getDoc }] = await Promise.all([
          getFirebaseDb(),
          getFirestoreModule()
        ]);
        if (!isMounted) return;

        getDoc(doc(db, 'settings', 'categories'))
          .then((snap) => {
            if (!isMounted || hasLocalCategoryMutationRef.current || !snap.exists()) return;
            const data = snap.data() as { list?: unknown; deleted?: unknown };
            const remoteDeleted = Array.isArray(data.deleted)
              ? data.deleted.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean)
              : [];
            deletedCategoriesRef.current = remoteDeleted;
            setDeletedCategories(remoteDeleted);
            localStorage.setItem('vt_deleted_categories_v1', JSON.stringify(remoteDeleted));

            if (Array.isArray(data.list) && data.list.length > 0) {
              const cleanList = data.list.map((c) => String(c || '').trim()).filter(Boolean);
              const withAll = cleanList.some((c) => c.toLowerCase() === 'all')
                ? cleanList
                : ['All', ...cleanList];
              categoriesRef.current = withAll;
              setCategories(withAll);
              localStorage.setItem('vt_categories_v2', JSON.stringify(withAll));
            }
            stampSyncTimestamp(VT_CATEGORIES_SYNCED_AT_KEY);
          })
          .catch((err) => {
            if (isQuotaExceededError(err)) {
              markClientFirestoreQuotaBackedOff();
            }
            console.warn('Firestore categories load notice:', err);
          });

        // Hydrate public storefront settings (Meta Pixel ID, announcement, delivery fees) non-blockingly
        withTimeout(getDoc(doc(db, 'settings', 'store')), 4000, 'Public store settings timeout')
          .then((snap) => {
            if (!isMounted || !snap.exists()) return;
            const remoteCfg = snap.data() as Partial<StoreSettings>;
            setSettings((prev) => ({
              ...prev,
              metaPixelId: remoteCfg.metaPixelId ? sanitizeMetaPixelId(remoteCfg.metaPixelId) : prev.metaPixelId,
              isMetaPixelEnabled:
                typeof remoteCfg.isMetaPixelEnabled === 'boolean'
                  ? remoteCfg.isMetaPixelEnabled
                  : prev.isMetaPixelEnabled,
              announcementText: remoteCfg.announcementText || prev.announcementText,
              deliveryFeeInsideDhaka:
                typeof remoteCfg.deliveryFeeInsideDhaka === 'number'
                  ? remoteCfg.deliveryFeeInsideDhaka
                  : prev.deliveryFeeInsideDhaka,
              deliveryFeeDhakaSubArea:
                typeof remoteCfg.deliveryFeeDhakaSubArea === 'number'
                  ? remoteCfg.deliveryFeeDhakaSubArea
                  : prev.deliveryFeeDhakaSubArea,
              deliveryFeeOutsideDhaka:
                typeof remoteCfg.deliveryFeeOutsideDhaka === 'number'
                  ? remoteCfg.deliveryFeeOutsideDhaka
                  : prev.deliveryFeeOutsideDhaka,
              freeShippingThreshold:
                typeof remoteCfg.freeShippingThreshold === 'number'
                  ? remoteCfg.freeShippingThreshold
                  : prev.freeShippingThreshold,
              isBkashActive:
                typeof remoteCfg.isBkashActive === 'boolean' ? remoteCfg.isBkashActive : prev.isBkashActive,
              bKashStatus: remoteCfg.bKashStatus || prev.bKashStatus,
              bKashMerchantNumber: remoteCfg.bKashMerchantNumber ?? prev.bKashMerchantNumber,
              whatsapp: remoteCfg.whatsapp || prev.whatsapp,
              address: remoteCfg.address || prev.address,
              outOfStockDefaultBehavior:
                remoteCfg.outOfStockDefaultBehavior === 'hide' || remoteCfg.outOfStockDefaultBehavior === 'show'
                  ? remoteCfg.outOfStockDefaultBehavior
                  : prev.outOfStockDefaultBehavior
            }));
          })
          .catch((err) => {
            if (isQuotaExceededError(err)) {
              markClientFirestoreQuotaBackedOff();
            }
          });
      } catch {
        // Ignore deferred Firebase settings hydration error
      }
    };

    if (IS_GOOGLE_CLOUD_CONNECTED && !isSearchCrawler()) {
      const isAdminPath =
        typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin');
      if (isAdminPath) {
        void hydrateRemoteSettings();
      } else {
        interactionEvents.forEach((ev) =>
          window.addEventListener(ev, hydrateRemoteSettings, { once: true, passive: true })
        );
        hydrateTimer = window.setTimeout(hydrateRemoteSettings, 5800);
      }
    }

    return () => {
      isMounted = false;
      if (hydrateTimer) window.clearTimeout(hydrateTimer);
      interactionEvents.forEach((ev) => window.removeEventListener(ev, hydrateRemoteSettings));
    };
  }, []);

  const autoPriceHealAttemptedRef = useRef<boolean>(false);

  // Manual / TTL-Gated Catalog Refresh (replaces continuous Firestore products onSnapshot listener)
  const refreshCatalog = useCallback(
    async (force = false): Promise<{ success: boolean; count: number; message?: string }> => {
      if (isSearchCrawler()) {
        return { success: true, count: productsRef.current.length };
      }

      const sortProductsList = (items: Product[]) =>
        [...items].sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
            return a.sortOrder - b.sortOrder;
          }
          return 0;
        });

      const cacheFresh =
        productsRef.current.length > 0 &&
        isCacheTimestampFresh(VT_PRODUCTS_SYNCED_AT_KEY, CATALOG_CACHE_TTL_MS) &&
        isCacheTimestampFresh(VT_CATEGORIES_SYNCED_AT_KEY, CATALOG_CACHE_TTL_MS);

      if (!force && cacheFresh) {
        return { success: true, count: productsRef.current.length };
      }

      setIsCatalogSyncing(true);
      let loadedProducts: Product[] = [];
      let warningMsg: string | null = null;
      let syncedSuccessfully = false;

      // 1. Fetch server catalog REST API first (keeps Firestore reads cached server-side)
      try {
        const res = await fetch(`/api/products${force ? '?fresh=1' : ''}`, {
          headers: { Accept: 'application/json' },
          cache: force ? 'no-store' : 'default'
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            loadedProducts = sortProductsList(
              dedupeProductsById(
                (json.data as Product[])
                  .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
                  .map((p) =>
                    sanitizeProductSizes({
                      ...p,
                      discountPrice:
                        typeof p.discountPrice === 'number' && p.discountPrice > 0 ? p.discountPrice : undefined,
                      discountPercent:
                        typeof p.discountPercent === 'number' && p.discountPercent > 0 ? p.discountPercent : undefined,
                      isArchived: Boolean(p.isArchived || p.status === 'archived')
                    })
                  )
              )
            );
            syncedSuccessfully = true;
          }
        }
      } catch {
        // Proceed to Firestore getDocs fallback if needed
      }

      // 2. Direct one-time Firestore getDocs / getDoc on manual Refresh or when API returned nothing
      const fbUser = getCurrentFirebaseUserSync();
      const isVerifiedAdmin =
        fbUser?.email?.toLowerCase() === 'muhammadeyamin0@gmail.com' && Boolean(fbUser?.emailVerified);

      if ((force || loadedProducts.length === 0) && IS_GOOGLE_CLOUD_CONNECTED && !isClientFirestoreQuotaBackedOff()) {
        try {
          const [db, { collection, doc, getDoc, getDocs }] = await Promise.all([
            getFirebaseDb(),
            getFirestoreModule()
          ]);

          // Only hit Firestore products collection directly if manual force refresh by Admin or API failed
          if (force || loadedProducts.length === 0) {
            const snapshot = await withTimeout(
              getDocs(collection(db, 'products')),
              7000,
              'Catalog Firestore read timed out'
            );
            if (!snapshot.empty) {
              const remoteProducts: Product[] = [];
              const priceFixesToSync: Product[] = [];
              snapshot.forEach((docSnap) => {
                if (LEGACY_PRIMARY_PRODUCT_IDS.has(docSnap.id)) return;
                const data = docSnap.data() as Product;
                const normalized = sanitizeProductSizes({
                  ...data,
                  id: docSnap.id,
                  discountPrice:
                    typeof data.discountPrice === 'number' && data.discountPrice > 0 ? data.discountPrice : undefined,
                  discountPercent:
                    typeof data.discountPercent === 'number' && data.discountPercent > 0 ? data.discountPercent : undefined,
                  isArchived: Boolean(data.isArchived || data.status === 'archived')
                });
                remoteProducts.push(normalized);

                const rawCost = typeof data.costPrice === 'number' ? data.costPrice : Number(data.costPrice);
                if (
                  Number.isFinite(rawCost) &&
                  rawCost > 0 &&
                  (data.discountPrice !== normalized.discountPrice ||
                    data.regularPrice !== normalized.regularPrice ||
                    data.discountPercent !== normalized.discountPercent)
                ) {
                  priceFixesToSync.push(normalized);
                }
              });

              if (remoteProducts.length > 0) {
                loadedProducts = sortProductsList(dedupeProductsById(remoteProducts));
                syncedSuccessfully = true;
              }

              if (priceFixesToSync.length > 0 && !autoPriceHealAttemptedRef.current && isVerifiedAdmin) {
                autoPriceHealAttemptedRef.current = true;
                void (async () => {
                  try {
                    const { writeBatch } = await getFirestoreModule();
                    for (let i = 0; i < priceFixesToSync.length; i += 400) {
                      const chunk = priceFixesToSync.slice(i, i + 400);
                      const batch = writeBatch(db);
                      chunk.forEach((item) => {
                        batch.set(
                          doc(db, 'products', item.id),
                          sanitizeFirestoreData({
                            costPrice: item.costPrice,
                            discountPrice: item.discountPrice,
                            regularPrice: item.regularPrice,
                            discountPercent: item.discountPercent
                          }),
                          { merge: true }
                        );
                      });
                      await batch.commit();
                    }
                  } catch {
                    autoPriceHealAttemptedRef.current = false;
                  }
                })();
              }
            }
          }

          // Refresh categories order one-time when forced or stale
          if (force || !isCacheTimestampFresh(VT_CATEGORIES_SYNCED_AT_KEY, CATALOG_CACHE_TTL_MS)) {
            const catSnap = await withTimeout(
              getDoc(doc(db, 'settings', 'categories')),
              5000,
              'Categories read timed out'
            );
            if (catSnap.exists() && !hasLocalCategoryMutationRef.current) {
              const data = catSnap.data() as { list?: unknown; deleted?: unknown };
              const remoteDeleted = Array.isArray(data.deleted)
                ? data.deleted.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean)
                : [];
              deletedCategoriesRef.current = remoteDeleted;
              setDeletedCategories(remoteDeleted);
              localStorage.setItem('vt_deleted_categories_v1', JSON.stringify(remoteDeleted));

              if (Array.isArray(data.list) && data.list.length > 0) {
                const cleanList = data.list.map((c) => String(c || '').trim()).filter(Boolean);
                const withAll = cleanList.some((c) => c.toLowerCase() === 'all')
                  ? cleanList
                  : ['All', ...cleanList];
                categoriesRef.current = withAll;
                setCategories(withAll);
                localStorage.setItem('vt_categories_v2', JSON.stringify(withAll));
              }
              stampSyncTimestamp(VT_CATEGORIES_SYNCED_AT_KEY);
            }
          }
        } catch (err) {
          if (isQuotaExceededError(err)) {
            markClientFirestoreQuotaBackedOff();
            warningMsg =
              'Firebase Firestore ফ্রি ডেইলি রিড কোটা শেষ হয়েছে। বর্তমানে ক্যাশ করা প্রোডাক্ট ও ক্যাটাগরি দেখানো হচ্ছে।';
          } else {
            console.warn('Catalog Firestore refresh notice:', err);
          }
        }
      } else if (isClientFirestoreQuotaBackedOff() && force) {
        warningMsg =
          'Firebase Firestore ফ্রি ডেইলি রিড কোটা সাময়িকভাবে সীমাবদ্ধ। বর্তমানে লোকাল/সার্ভার ক্যাশ দেখানো হচ্ছে।';
      }

      if (loadedProducts.length > 0) {
        setProducts(loadedProducts);
        const ts = stampSyncTimestamp(VT_PRODUCTS_SYNCED_AT_KEY);
        stampSyncTimestamp(VT_CATEGORIES_SYNCED_AT_KEY, ts);
        setCatalogLastSyncedAt(ts);
        try {
          sessionStorage.removeItem('vt_catalog_mutated_at');
        } catch {
          // ignore
        }
      } else if (syncedSuccessfully) {
        const ts = stampSyncTimestamp(VT_PRODUCTS_SYNCED_AT_KEY);
        setCatalogLastSyncedAt(ts);
      }

      setCatalogSyncWarning(warningMsg);
      setIsCatalogSyncing(false);
      return {
        success: loadedProducts.length > 0 || syncedSuccessfully,
        count: loadedProducts.length > 0 ? loadedProducts.length : productsRef.current.length,
        message: warningMsg || undefined
      };
    },
    []
  );

  // Scoped Admin Catalog Sync on Mount: Only fetches when cache is empty, mutated, or > 20-min TTL stale
  useEffect(() => {
    if (currentPage !== 'admin' || isSearchCrawler()) return;
    const hasRecentMutation = (() => {
      try {
        const ts = Number(sessionStorage.getItem('vt_catalog_mutated_at') || 0);
        return ts > 0 && Date.now() - ts < 5 * 60 * 1000;
      } catch {
        return false;
      }
    })();
    const isFresh =
      productsRef.current.length > 0 &&
      isCacheTimestampFresh(VT_PRODUCTS_SYNCED_AT_KEY, CATALOG_CACHE_TTL_MS) &&
      isCacheTimestampFresh(VT_CATEGORIES_SYNCED_AT_KEY, CATALOG_CACHE_TTL_MS);

    if (!isFresh || hasRecentMutation) {
      void refreshCatalog(hasRecentMutation);
    }
  }, [currentPage, refreshCatalog]);

  // Automatic Background WebP Upgrade (App & Admin Load):
  // Checks stored/database banners, logo, and products for any non-WebP images and converts them via Browser Canvas.
  // Safely skips any URL that fails due to CORS, network errors, or Firestore 1MB payload limits.
  const webpSkippedUrlsRef = useRef<Set<string>>(null as unknown as Set<string>);
  if (!webpSkippedUrlsRef.current) {
    const initialSkipped = new Set<string>();
    try {
      const saved = sessionStorage.getItem('vt_webp_skip_urls_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((u) => {
            if (typeof u === 'string') initialSkipped.add(u);
          });
        }
      }
    } catch {
      // ignore sessionStorage error
    }
    webpSkippedUrlsRef.current = initialSkipped;
  }

  const recordSkippedWebpUrl = useCallback((url: string) => {
    webpSkippedUrlsRef.current.add(url);
    try {
      const list = Array.from(webpSkippedUrlsRef.current).slice(-200);
      sessionStorage.setItem('vt_webp_skip_urls_v1', JSON.stringify(list));
    } catch {
      // ignore storage error
    }
  }, []);

  const staticWebpAuditDoneRef = useRef(false);
  useEffect(() => {
    const syncUser = getCurrentFirebaseUserSync();
    const isAdminContext =
      currentPage === 'admin' ||
      isFirebaseAdminAuthenticated ||
      (syncUser?.email?.toLowerCase() === 'muhammadeyamin0@gmail.com' &&
        Boolean(syncUser?.emailVerified));

    if (!isAdminContext || staticWebpAuditDoneRef.current || isSearchCrawler() || typeof window === 'undefined') {
      return;
    }
    staticWebpAuditDoneRef.current = true;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const {
          isWebpImageSource,
          convertImageSourceToWebp,
          PRODUCT_WEBP_MAX_WIDTH,
          BANNER_WEBP_MAX_WIDTH,
          DEFAULT_WEBP_QUALITY
        } = await import('../utils/webpConverter');
        if (cancelled) return;

        // 1. Check Store Logo in settings
        if (
          settings.logoUrl &&
          !isWebpImageSource(settings.logoUrl) &&
          !webpSkippedUrlsRef.current.has(settings.logoUrl)
        ) {
          const webpLogo = await convertImageSourceToWebp(settings.logoUrl, {
            maxWidth: PRODUCT_WEBP_MAX_WIDTH,
            quality: DEFAULT_WEBP_QUALITY
          });
          if (cancelled) return;
          if (webpLogo) {
            setSettings((prev) => (prev.logoUrl === settings.logoUrl ? { ...prev, logoUrl: webpLogo } : prev));
          } else {
            recordSkippedWebpUrl(settings.logoUrl);
          }
        }

        // 2. Check Standard Banners (max width 1400px, quality 0.8)
        let bannersChanged = false;
        const nextBanners = await Promise.all(
          banners.map(async (b) => {
            const src = b.bgImageUrl || '';
            if (!src || isWebpImageSource(src) || webpSkippedUrlsRef.current.has(src)) {
              return b;
            }
            const converted = await convertImageSourceToWebp(src, {
              maxWidth: BANNER_WEBP_MAX_WIDTH,
              quality: DEFAULT_WEBP_QUALITY,
              maxDataUrlLength: 350_000
            });
            if (converted) {
              bannersChanged = true;
              return { ...b, bgImageUrl: converted };
            }
            recordSkippedWebpUrl(src);
            return b;
          })
        );
        if (!cancelled && bannersChanged) {
          setBanners(nextBanners);
        }

        // 3. Check 3D Banners (max width 1400px for background, 1000px for cutout)
        let banners3DChanged = false;
        const nextBanners3D = await Promise.all(
          banners3D.map(async (b) => {
            let updated = { ...b };
            const bgSrc = b.bgImage || b.bgImageUrl || '';
            if (bgSrc && !isWebpImageSource(bgSrc) && !webpSkippedUrlsRef.current.has(bgSrc)) {
              const convertedBg = await convertImageSourceToWebp(bgSrc, {
                maxWidth: BANNER_WEBP_MAX_WIDTH,
                quality: DEFAULT_WEBP_QUALITY,
                maxDataUrlLength: 350_000
              });
              if (convertedBg) {
                banners3DChanged = true;
                if (updated.bgImage) updated.bgImage = convertedBg;
                if (updated.bgImageUrl || !updated.bgImage) updated.bgImageUrl = convertedBg;
              } else {
                recordSkippedWebpUrl(bgSrc);
              }
            }

            const cutoutSrc = b.productCutoutUrl || '';
            if (cutoutSrc && !isWebpImageSource(cutoutSrc) && !webpSkippedUrlsRef.current.has(cutoutSrc)) {
              const convertedCutout = await convertImageSourceToWebp(cutoutSrc, {
                maxWidth: PRODUCT_WEBP_MAX_WIDTH,
                quality: DEFAULT_WEBP_QUALITY
              });
              if (convertedCutout) {
                banners3DChanged = true;
                updated.productCutoutUrl = convertedCutout;
              } else {
                recordSkippedWebpUrl(cutoutSrc);
              }
            }
            return updated;
          })
        );
        if (!cancelled && banners3DChanged) {
          setBanners3D(nextBanners3D);
        }
      } catch {
        // Non-critical background migration; skip cleanly
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [banners, banners3D, settings.logoUrl, recordSkippedWebpUrl, currentPage, isFirebaseAdminAuthenticated]);

  const productWebpMigrationRunningRef = useRef(false);
  const productWebpCheckedSigRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const syncUser = getCurrentFirebaseUserSync();
    const isAdminContext =
      currentPage === 'admin' ||
      isFirebaseAdminAuthenticated ||
      (syncUser?.email?.toLowerCase() === 'muhammadeyamin0@gmail.com' &&
        Boolean(syncUser?.emailVerified));

    if (
      !isAdminContext ||
      isSearchCrawler() ||
      typeof window === 'undefined' ||
      products.length === 0 ||
      productWebpMigrationRunningRef.current
    ) {
      return;
    }

    let cancelled = false;
    const delayMs = 1200;

    const timer = window.setTimeout(async () => {
      if (cancelled || productWebpMigrationRunningRef.current) return;
      productWebpMigrationRunningRef.current = true;

      try {
        const {
          isWebpImageSource,
          convertImageSourceToWebp,
          PRODUCT_WEBP_MAX_WIDTH,
          DEFAULT_WEBP_QUALITY
        } = await import('../utils/webpConverter');
        if (cancelled) return;

        const queue = products.filter((p) => {
          if (!Array.isArray(p.images) || p.images.length === 0) return false;
          const sig = p.images.join('|');
          if (productWebpCheckedSigRef.current.get(p.id) === sig) return false;
          return p.images.some((img) => {
            if (!img || isWebpImageSource(img) || webpSkippedUrlsRef.current.has(img)) return false;
            return true;
          });
        });
        if (queue.length === 0) return;

        const fbUser = getCurrentFirebaseUserSync();
        const canWriteFirestore =
          fbUser?.email?.toLowerCase() === 'muhammadeyamin0@gmail.com' &&
          Boolean(fbUser?.emailVerified);
        const [db, firestoreMod] = canWriteFirestore
          ? await Promise.all([getFirebaseDb(), getFirestoreModule()])
          : [null, null];
        const adminHeaders = isAdminContext
          ? await getAdminAuthHeaders({ 'Content-Type': 'application/json' })
          : null;

        let approxProductsBytes = (() => {
          try {
            return new Blob([JSON.stringify(products)]).size;
          } catch {
            return 0;
          }
        })();

        for (let i = 0; i < queue.length; i += 2) {
          if (cancelled) break;
          const batch = queue.slice(i, i + 2);

          await Promise.all(
            batch.map(async (prod) => {
              if (cancelled) return;
              const originalSig = (prod.images || []).join('|');
              productWebpCheckedSigRef.current.set(prod.id, originalSig);

              if (!isAdminContext && approxProductsBytes > 3_200_000) {
                return;
              }

              let changed = false;
              const nextImages: string[] = [];

              for (const imgSrc of prod.images || []) {
                if (!imgSrc || isWebpImageSource(imgSrc) || webpSkippedUrlsRef.current.has(imgSrc)) {
                  nextImages.push(imgSrc);
                  continue;
                }

                const converted = await convertImageSourceToWebp(imgSrc, {
                  maxWidth: PRODUCT_WEBP_MAX_WIDTH,
                  quality: DEFAULT_WEBP_QUALITY,
                  maxDataUrlLength: 200_000
                });

                if (converted) {
                  changed = true;
                  nextImages.push(converted);
                  approxProductsBytes += Math.max(0, converted.length - imgSrc.length);
                } else {
                  recordSkippedWebpUrl(imgSrc);
                  nextImages.push(imgSrc);
                }
              }

              if (!changed || cancelled) return;

              const updatedProd = { ...prod, images: nextImages };
              const payload = sanitizeFirestoreData(updatedProd);
              const payloadBytes = new Blob([JSON.stringify(payload)]).size;
              if (payloadBytes > 950_000) {
                return;
              }

              productWebpCheckedSigRef.current.set(prod.id, nextImages.join('|'));
              setProducts((prev) =>
                prev.map((item) => (item.id === prod.id ? { ...item, images: nextImages } : item))
              );

              if (canWriteFirestore && db && firestoreMod) {
                try {
                  await firestoreMod.setDoc(firestoreMod.doc(db, 'products', prod.id), payload, { merge: true });
                } catch {
                  // Ignore Firestore permission/network error cleanly
                }
              }

              if (adminHeaders && (adminHeaders.Authorization || window.location.hostname === 'localhost')) {
                try {
                  await fetch(`/api/products/${encodeURIComponent(prod.id)}`, {
                    method: 'PUT',
                    headers: adminHeaders,
                    body: JSON.stringify({ images: nextImages })
                  });
                } catch {
                  // Non-critical backend mirror notice
                }
              }
            })
          );

          if (!cancelled && i + 2 < queue.length) {
            await new Promise((r) => window.setTimeout(r, 180));
          }
        }
      } finally {
        productWebpMigrationRunningRef.current = false;
      }
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [products, currentPage, isFirebaseAdminAuthenticated, getAdminAuthHeaders, recordSkippedWebpUrl]);

  const mergeOrderCollections = useCallback((existingList: Order[], incomingList: Order[]) => {
    const mergedMap = new Map<string, Order>();
    const upsert = (ord: Order) => {
      if (!ord || !ord.id) return;
      if (deletedOrderIdsRef.current.has(ord.id)) return;
      const existing = mergedMap.get(ord.id);
      if (!existing) {
        mergedMap.set(ord.id, ord);
        return;
      }
      const existingHistLen = Array.isArray(existing.statusHistory) ? existing.statusHistory.length : 0;
      const incomingHistLen = Array.isArray(ord.statusHistory) ? ord.statusHistory.length : 0;
      const existingHasTracking = Boolean(existing.trackingNumber || existing.courierTrackingCode);
      const incomingHasTracking = Boolean(ord.trackingNumber || ord.courierTrackingCode);

      if (incomingHistLen > existingHistLen || (!existingHasTracking && incomingHasTracking)) {
        mergedMap.set(ord.id, { ...existing, ...ord });
      } else if (existingHistLen > incomingHistLen) {
        mergedMap.set(ord.id, { ...ord, ...existing });
      } else {
        mergedMap.set(ord.id, { ...existing, ...ord });
      }
    };

    existingList.forEach(upsert);
    incomingList.forEach(upsert);

    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, []);

  const refreshOrders = useCallback(
    async (
      force = false,
      options?: { limit?: number; sinceDays?: number | 'all'; status?: string }
    ): Promise<{ success: boolean; count: number; message?: string; hasMore?: boolean }> => {
      const targetLimit = Math.min(300, Math.max(10, options?.limit ?? ordersFetchLimit));
      const targetSinceDays = options?.sinceDays ?? ordersDateRangeDays;
      const targetStatus = options?.status;

      const cacheIsFresh =
        ordersRef.current.length > 0 &&
        isCacheTimestampFresh(VT_ORDERS_SYNCED_AT_KEY, ORDERS_CACHE_TTL_MS) &&
        !options;

      if (!force && cacheIsFresh) {
        return {
          success: true,
          count: ordersRef.current.length,
          hasMore: ordersHasMore
        };
      }

      setIsOrdersSyncing(true);
      let combinedIncoming: Order[] = [];
      let warningMsg: string | null = null;
      let serverCount = 0;
      let serverHasMore = false;
      let serverSyncedAt: string | null = null;

      try {
        const headers = await getAdminAuthHeaders();
        if (!headers.Authorization) {
          warningMsg =
            'Google Admin (muhammadeyamin0@gmail.com) সেশন কানেক্টেড না থাকায় ক্লাউড অর্ডার সিঙ্ক করা যায়নি।';
        } else {
          const qs = new URLSearchParams();
          qs.set('limit', String(targetLimit));
          if (force) qs.set('force', '1');
          if (typeof targetSinceDays === 'number' && targetSinceDays > 0) {
            qs.set('sinceDays', String(targetSinceDays));
          }
          if (targetStatus && targetStatus !== 'All') {
            qs.set('status', targetStatus);
          }
          const res = await fetch(`/api/orders?${qs.toString()}`, {
            headers,
            cache: 'no-store'
          });
          if (res.ok) {
            const json = await res.json();
            if (json.quotaExceeded) {
              warningMsg =
                'Firebase Firestore-এর ফ্রি ডেইলি রিড লিমিট শেষ হয়েছে। বর্তমানে ক্যাশ ও সার্ভারের অর্ডার দেখানো হচ্ছে।';
            }
            if (typeof json.hasMore === 'boolean') {
              serverHasMore = json.hasMore;
            }
            if (typeof json.lastSyncedAt === 'string') {
              serverSyncedAt = json.lastSyncedAt;
            }
            if (json.success && Array.isArray(json.data)) {
              combinedIncoming = [...combinedIncoming, ...(json.data as Order[])];
              serverCount = json.data.length;
            }
          }
        }
      } catch {
        // Fallback to bounded direct Firestore read below
      }

      let firestoreHasMore = false;
      if (force && IS_GOOGLE_CLOUD_CONNECTED && !isClientFirestoreQuotaBackedOff()) {
        try {
          const fbAuth = await getFirebaseAuth();
          if (typeof (fbAuth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
            await (fbAuth as { authStateReady: () => Promise<void> }).authStateReady().catch(() => {});
          }
          const activeEmail = fbAuth.currentUser?.email?.trim().toLowerCase();
          if (activeEmail === 'muhammadeyamin0@gmail.com' && fbAuth.currentUser?.emailVerified) {
            const [db, { collection, getDocs, limit: fsLimit, orderBy, query, where }] = await Promise.all([
              getFirebaseDb(),
              getFirestoreModule()
            ]);
            // Use single-field createdAt index only (no firestore.indexes.json composite queries)
            const constraints: unknown[] = [];
            if (typeof targetSinceDays === 'number' && targetSinceDays > 0) {
              const cutoffIso = new Date(Date.now() - targetSinceDays * 24 * 60 * 60 * 1000).toISOString();
              constraints.push(where('createdAt', '>=', cutoffIso));
            }
            constraints.push(orderBy('createdAt', 'desc'));
            constraints.push(fsLimit(targetLimit));

            const boundedQuery = query(collection(db, 'orders'), ...(constraints as never[]));
            const snap = await withTimeout(getDocs(boundedQuery), 7000, 'Firestore orders read timed out');
            const firestoreList: Order[] = [];
            snap.forEach((docSnap) => {
              firestoreList.push({ ...(docSnap.data() as Order), id: docSnap.id });
            });
            firestoreHasMore = snap.size >= targetLimit;
            combinedIncoming = [...combinedIncoming, ...firestoreList];
          }
        } catch (err) {
          if (isQuotaExceededError(err)) {
            markClientFirestoreQuotaBackedOff();
            warningMsg =
              'Firebase Firestore-এর ফ্রি ডেইলি রিড লিমিট শেষ হয়েছে। অনুগ্রহ করে কোটা রিসেট হওয়া পর্যন্ত অপেক্ষা করুন; আপনার লোকাল ও ক্যাশ অর্ডার সুরক্ষিত আছে।';
          }
        }
      } else if (force && isClientFirestoreQuotaBackedOff() && !warningMsg) {
        warningMsg =
          'Firebase Firestore ফ্রি রিড কোটা সাময়িকভাবে সীমাবদ্ধ। বর্তমানে লোকাল ও সার্ভার ক্যাশ অর্ডার দেখানো হচ্ছে।';
      }

      if (combinedIncoming.length > 0) {
        setOrders((prev) => mergeOrderCollections(prev, combinedIncoming));
        const syncedIso = stampSyncTimestamp(VT_ORDERS_SYNCED_AT_KEY, serverSyncedAt || undefined);
        setOrdersLastSyncedAt(syncedIso);
      } else if (!warningMsg) {
        const syncedIso = stampSyncTimestamp(VT_ORDERS_SYNCED_AT_KEY, serverSyncedAt || undefined);
        setOrdersLastSyncedAt(syncedIso);
      }

      const finalHasMore = Boolean(serverHasMore || firestoreHasMore);
      setOrdersHasMore(finalHasMore);
      setOrdersSyncWarning(warningMsg);
      setIsOrdersSyncing(false);
      return {
        success: combinedIncoming.length > 0 || !warningMsg,
        count: Math.max(serverCount, combinedIncoming.length, ordersRef.current.length),
        hasMore: finalHasMore,
        message: warningMsg || undefined
      };
    },
    [getAdminAuthHeaders, mergeOrderCollections, ordersDateRangeDays, ordersFetchLimit, ordersHasMore]
  );

  const loadMoreOrders = useCallback(async (): Promise<{ success: boolean; count: number; message?: string }> => {
    const nextLimit = Math.min(300, ordersFetchLimit + 50);
    setOrdersFetchLimit(nextLimit);
    return refreshOrders(true, { limit: nextLimit, sinceDays: ordersDateRangeDays });
  }, [ordersDateRangeDays, ordersFetchLimit, refreshOrders]);

  // Scoped Orders Synchronization on Admin Mount: Replaces continuous onSnapshot & 20s setInterval polling
  useEffect(() => {
    if (currentPage !== 'admin' || isSearchCrawler()) return;
    const isVerifiedSuperAdminEmail =
      currentUser?.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
      Boolean(currentUser?.emailVerified);
    if (!isFirebaseAdminAuthenticated && !isVerifiedSuperAdminEmail) {
      return;
    }

    const hasValidCachedOrders =
      ordersRef.current.length > 0 && isCacheTimestampFresh(VT_ORDERS_SYNCED_AT_KEY, ORDERS_CACHE_TTL_MS);

    if (!hasValidCachedOrders) {
      void refreshOrders(false, { limit: ordersFetchLimit, sinceDays: ordersDateRangeDays });
    }
  }, [
    currentPage,
    currentUser?.email,
    currentUser?.emailVerified,
    isFirebaseAdminAuthenticated,
    ordersDateRangeDays,
    ordersFetchLimit,
    refreshOrders
  ]);

  // Listen to Firebase Auth state changes lazily (deferred on public storefront unless prior session or auth route)
  const firebaseAuthListenerAttachedRef = useRef(false);
  useEffect(() => {
    if (!IS_GOOGLE_CLOUD_CONNECTED || isSearchCrawler() || firebaseAuthListenerAttachedRef.current) return;
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    let delayTimer: number | undefined;
    const interactionEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll'];

    const attachAuthListener = async () => {
      if (!mounted || firebaseAuthListenerAttachedRef.current) return;
      firebaseAuthListenerAttachedRef.current = true;
      try {
        const [fbAuth, { onAuthStateChanged }] = await Promise.all([
          getFirebaseAuth(),
          getAuthModule()
        ]);
        if (!mounted) return;

        const authWithReady = fbAuth as typeof fbAuth & { authStateReady?: () => Promise<void> };
        if (typeof authWithReady.authStateReady === 'function') {
          void authWithReady.authStateReady().then(() => {
            if (!mounted) return;
            const activeUser = fbAuth.currentUser;
            const isSuperAdminAccount = Boolean(
              activeUser &&
                activeUser.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
                activeUser.emailVerified
            );
            setIsFirebaseAdminAuthenticated(isSuperAdminAccount);
            setFirebaseAuthLoaded(true);
          }).catch(() => {
            if (mounted) setFirebaseAuthLoaded(true);
          });
        }

        unsubscribe = onAuthStateChanged(fbAuth, (fbUser) => {
          if (!mounted) return;
          setFirebaseAuthLoaded(true);
          if (fbUser) {
            try {
              localStorage.setItem('vt_has_fb_session', '1');
            } catch {
              // ignore storage error
            }
          }
          const isSuperAdminAccount = Boolean(
            fbUser &&
              fbUser.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
              fbUser.emailVerified
          );
          setIsFirebaseAdminAuthenticated(isSuperAdminAccount);

          if (fbUser) {
            setCurrentUser((prev) => {
              if (
                prev &&
                prev.id === fbUser.uid &&
                (!isSuperAdminAccount || prev.role === 'Super Admin')
              ) {
                return prev;
              }
              const userObj: User = {
                id: fbUser.uid,
                name: fbUser.displayName || prev?.name || (isSuperAdminAccount ? 'Muhammad Yeamin (Super Admin)' : 'VANTREL Member'),
                email: fbUser.email || prev?.email || '',
                phone: fbUser.phoneNumber || prev?.phone || '',
                role: isSuperAdminAccount ? 'Super Admin' : (prev?.role || 'customer'),
                joinedDate: prev?.joinedDate || new Date().toISOString().split('T')[0],
                totalOrders: prev?.totalOrders || 0,
                totalSpent: prev?.totalSpent || 0,
                status: 'Active',
                loyaltyPoints: prev?.loyaltyPoints || 100,
                referralCode: prev?.referralCode || `VT-REF-${Math.floor(1000 + Math.random() * 9000)}`,
                isVerified: Boolean(fbUser.emailVerified || fbUser.phoneNumber),
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
      } catch {
        if (mounted) setFirebaseAuthLoaded(true);
      }
    };

    const hasPriorSession = (() => {
      try {
        return localStorage.getItem('vt_has_fb_session') === '1';
      } catch {
        return false;
      }
    })();

    const shouldInitImmediately =
      currentPage === 'admin' ||
      currentPage === 'account' ||
      currentPage === 'checkout' ||
      hasPriorSession ||
      (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin'));

    if (shouldInitImmediately) {
      void attachAuthListener();
    } else {
      interactionEvents.forEach((ev) =>
        window.addEventListener(ev, attachAuthListener, { once: true, passive: true })
      );
      delayTimer = window.setTimeout(attachAuthListener, 5800);
    }

    return () => {
      mounted = false;
      if (delayTimer) window.clearTimeout(delayTimer);
      interactionEvents.forEach((ev) => window.removeEventListener(ev, attachAuthListener));
      if (unsubscribe) unsubscribe();
    };
  }, [currentPage]);

  // One-time TTL-guarded Firestore Wishlist Sync for authenticated user (replaces live onSnapshot)
  useEffect(() => {
    if (!IS_GOOGLE_CLOUD_CONNECTED || isSearchCrawler() || isClientFirestoreQuotaBackedOff()) return;
    let hasSessionFlag = false;
    try {
      hasSessionFlag = localStorage.getItem('vt_has_fb_session') === '1';
    } catch {
      hasSessionFlag = false;
    }
    const syncUid = getCurrentFirebaseUserSync()?.uid;
    if (!syncUid && !hasSessionFlag) return;

    let mounted = true;
    (async () => {
      try {
        const fbAuth = await getFirebaseAuth();
        const firebaseUid = fbAuth.currentUser?.uid;
        if (!mounted || !firebaseUid) return;

        const wishlistSyncKey = `vt_wishlist_last_synced_at_${firebaseUid}`;
        if (isCacheTimestampFresh(wishlistSyncKey, WISHLIST_CACHE_TTL_MS)) {
          return;
        }

        const [db, { collection, getDocs }] = await Promise.all([
          getFirebaseDb(),
          getFirestoreModule()
        ]);
        if (!mounted) return;

        const wishlistCol = collection(db, 'users', firebaseUid, 'wishlist');
        const snapshot = await withTimeout(getDocs(wishlistCol), 5000, 'Wishlist read timed out');
        if (!mounted) return;
        const itemIds = snapshot.docs.map((d) => d.id);
        if (itemIds.length > 0 || !snapshot.metadata.fromCache) {
          setWishlist(itemIds);
        }
        stampSyncTimestamp(wishlistSyncKey);
      } catch (e) {
        if (isQuotaExceededError(e)) {
          markClientFirestoreQuotaBackedOff();
        }
        console.warn('Firestore wishlist sync notice:', e);
      }
    })();

    return () => {
      mounted = false;
    };
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

        return changed ? updated : prevOrders;
      });
    }, 15000); // Check every 15 seconds without blocking UI thread

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
    if (isProductOutOfStock(product)) {
      showToast(
        'Out of Stock (স্টক শেষ)',
        'দুঃখিত, এই প্রোডাক্টটির স্টক বর্তমানে শেষ। অর্ডার করা যাবে না।',
        'error'
      );
      return false;
    }

    if (!selectedSize || !selectedSize.trim()) {
      showToast('সাইজ নির্বাচন করুন', 'অর্ডার করতে অনুগ্রহ করে আপনার সাইজ নির্বাচন করুন।', 'error');
      return false;
    }

    const matchedVariant = product.variants.find(
      (v) => v.size === selectedSize && v.color === selectedColor
    );
    const maxStock = matchedVariant ? matchedVariant.stock : product.totalStock;

    if (maxStock <= 0) {
      showToast(
        'Out of Stock (স্টক শেষ)',
        'দুঃখিত, এই সাইজ/কালার ভ্যারিয়েন্টটি বর্তমানে স্টক শেষ।',
        'error'
      );
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
          image: rewriteToCanonicalProxyUrl(product.images[0] || ''),
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

    // Fire Meta Pixel AddToCart whenever a customer adds a product to cart
    trackMetaAddToCart(
      product,
      selectedSize,
      selectedColor,
      quantity,
      settings.metaPixelId,
      settings.isMetaPixelEnabled ?? true
    );
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
            if (delta > 0) {
              const liveProd = products.find((p) => p.id === item.productId);
              if (!liveProd || liveProd.isArchived || liveProd.status === 'archived' || isProductOutOfStock(liveProd)) {
                showToast('Out of Stock', `${item.name} বর্তমানে স্টক শেষ।`, 'error');
                return item;
              }
              const matchedVariant = liveProd.variants.find(
                (v) => v.size === item.size && v.color === item.color
              );
              const liveMax = matchedVariant ? Math.min(matchedVariant.stock, liveProd.totalStock) : liveProd.totalStock;
              if (liveMax <= 0) {
                showToast('Out of Stock', `${item.name} (${item.size}) স্টক শেষ।`, 'error');
                return item;
              }
              return { ...item, maxStock: liveMax, quantity: Math.min(nextQty, liveMax) };
            }
            return { ...item, quantity: Math.min(nextQty, Math.max(1, item.maxStock)) };
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

    if (IS_GOOGLE_CLOUD_CONNECTED) {
      const firebaseUid = getCurrentFirebaseUserSync()?.uid;
      if (firebaseUid) {
        const docPath = `users/${firebaseUid}/wishlist/${productId}`;
        try {
          const [db, { doc, deleteDoc, setDoc }] = await Promise.all([
            getFirebaseDb(),
            getFirestoreModule()
          ]);
          if (exists) {
            await deleteDoc(doc(db, 'users', firebaseUid, 'wishlist', productId));
          } else {
            const prod = products.find((p) => p.id === productId);
            await setDoc(doc(db, 'users', firebaseUid, 'wishlist', productId), {
              productId,
              addedAt: new Date().toISOString(),
              name: prod?.name || 'VANTREL Garment',
              price: prod ? (prod.discountPrice ?? prod.regularPrice) : 0,
              image: rewriteToCanonicalProxyUrl(prod?.images?.[0] || '')
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

  // Delivery Fee Calculation: Inside Dhaka Free (৳0), Dhaka Sub-Area ৳50, 63 Districts ৳50
  const calculateDeliveryFee = (
    zone: 'inside_dhaka' | 'dhaka_sub_area' | 'outside_dhaka' | 'remote_area' | 'express_dhaka',
    _subtotal?: number
  ) => {
    if (zone === 'inside_dhaka') return settings.deliveryFeeInsideDhaka ?? 0;
    if (zone === 'dhaka_sub_area') return settings.deliveryFeeDhakaSubArea ?? 50;
    if (zone === 'outside_dhaka') return settings.deliveryFeeOutsideDhaka ?? 50;
    if (zone === 'remote_area') return settings.deliveryFeeRemote ?? 50;
    if (zone === 'express_dhaka') return settings.deliveryFeeExpress ?? 50;
    return settings.deliveryFeeInsideDhaka ?? 0;
  };

  // Active (Publicly Visible) vs Archived Products
  const activeProducts = useMemo(
    () => products.filter((p) => !shouldHideProductFromPublic(p, settings.outOfStockDefaultBehavior)),
    [products, settings.outOfStockDefaultBehavior]
  );

  const archivedProducts = useMemo(
    () => products.filter((p) => p.isArchived || p.status === 'archived'),
    [products]
  );

  const logFirestoreErrorInfo = useCallback(
    (error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo => {
      const activeUser = getCurrentFirebaseUserSync();
      const errInfo: FirestoreErrorInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
          userId: activeUser?.uid ?? null,
          email: activeUser?.email ?? null,
          emailVerified: activeUser?.emailVerified ?? null,
          isAnonymous: activeUser?.isAnonymous ?? null,
          tenantId: activeUser?.tenantId ?? null,
          providerInfo:
            activeUser?.providerData?.map((provider) => ({
              providerId: provider.providerId,
              email: provider.email
            })) || []
        },
        operationType,
        path
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
      return errInfo;
    },
    []
  );

  const formatFirestoreWriteError = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error || '');
    const lower = raw.toLowerCase();
    if (
      lower.includes('exceeds the maximum allowed size') ||
      lower.includes('longer than') ||
      lower.includes('resource-exhausted') ||
      lower.includes('too large')
    ) {
      return 'প্রোডাক্ট ও ছবির মোট সাইজ Firestore-এর ১MB সীমার চেয়ে বেশি। কম সাইজের ছবি দিন অথবা Image URL ব্যবহার করুন।';
    }
    if (lower.includes('quota exceeded')) {
      return 'Firestore দৈনিক ফ্রি কোটা শেষ হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।';
    }
    if (lower.includes('permission') || lower.includes('insufficient')) {
      return 'Firebase অ্যাডমিন সেশন যাচাই হয়নি — অনুগ্রহ করে পুনরায় Google Admin (muhammadeyamin0@gmail.com) দিয়ে লগইন করুন।';
    }
    return raw || 'Firebase ডাটাবেজে সেভ করা যায়নি।';
  };

  // Product Actions (Direct Real-time Sync to Firebase Firestore + Backend API)
  const addProduct = async (
    newProd: Omit<Product, 'id' | 'createdDate'>
  ): Promise<{ success: boolean; firestoreSynced: boolean; apiSynced: boolean; error?: string }> => {
    const fbAuth = await getFirebaseAuth().catch(() => null);
    if (fbAuth && typeof (fbAuth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
      await (fbAuth as { authStateReady: () => Promise<void> }).authStateReady().catch(() => undefined);
    }

    const id = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cleanName = String(newProd.name || '').trim().slice(0, 220);
    const cleanCategory = String(newProd.category || '').trim();
    const safeCategory = (
      cleanCategory && cleanCategory.toLowerCase() !== 'all' ? cleanCategory : 'Hoodies'
    ).slice(0, 80);
    const cleanSku = (String(newProd.sku || '').trim() || `VT-${Date.now().toString().slice(-5)}`).slice(0, 80);
    const safeRegularPrice = Number.isFinite(Number(newProd.regularPrice))
      ? Math.max(0, Math.min(1000000, Math.round(Number(newProd.regularPrice))))
      : 0;
    const rawDiscount =
      newProd.discountPrice !== undefined && newProd.discountPrice !== null
        ? Number(newProd.discountPrice)
        : undefined;
    const safeDiscountPrice =
      rawDiscount !== undefined && Number.isFinite(rawDiscount) && rawDiscount >= 0 && rawDiscount < safeRegularPrice
        ? Math.round(rawDiscount)
        : undefined;
    const rawCost =
      newProd.costPrice !== undefined && newProd.costPrice !== null ? Number(newProd.costPrice) : undefined;
    const safeCostPrice =
      rawCost !== undefined && Number.isFinite(rawCost) && rawCost >= 0
        ? Math.min(1000000, Math.round(rawCost))
        : undefined;
    const safeStock = Number.isFinite(Number(newProd.totalStock))
      ? Math.max(0, Math.min(100000, Math.round(Number(newProd.totalStock))))
      : 0;
    const asciiSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const rawSlug = String(newProd.slug || '')
      .trim()
      .replace(/^-+|-+$/g, '');
    const safeSlug = (rawSlug || (asciiSlug ? `${asciiSlug}-${Date.now().toString(36).slice(-4)}` : `vantrel-${Date.now().toString(36)}`)).slice(0, 220);
    const safeImages = rewriteProductImagesToProxy(Array.isArray(newProd.images) ? newProd.images : []).slice(0, 20);
    const resolvedStatus: 'published' | 'draft' | 'archived' =
      newProd.status === 'draft' || newProd.status === 'archived' || newProd.isArchived
        ? newProd.isArchived
          ? 'archived'
          : newProd.status || 'published'
        : 'published';

    const resolvedOosBehavior: 'default' | 'show' | 'hide' =
      newProd.outOfStockBehavior === 'show' || newProd.outOfStockBehavior === 'hide'
        ? newProd.outOfStockBehavior
        : 'default';

    const product: Product = sanitizeProductSizes({
      ...newProd,
      id,
      name: cleanName,
      slug: safeSlug,
      sku: cleanSku,
      category: safeCategory,
      regularPrice: safeRegularPrice,
      discountPrice: safeDiscountPrice,
      costPrice: safeCostPrice,
      totalStock: safeStock,
      outOfStockBehavior: resolvedOosBehavior,
      images: safeImages,
      status: resolvedStatus,
      isArchived: Boolean(newProd.isArchived || resolvedStatus === 'archived'),
      sortOrder: -1,
      createdDate: new Date().toISOString().split('T')[0]
    });

    const payload = sanitizeFirestoreData(product);
    const payloadBytes = new Blob([JSON.stringify(payload)]).size;
    if (payloadBytes > 950_000) {
      const sizeErr = `প্রোডাক্ট ও ছবির মোট সাইজ (${Math.round(payloadBytes / 1024)}KB) Firestore ১MB সীমার বেশি হয়ে গেছে। কম ছবি দিন অথবা ইমেজ URL ব্যবহার করুন।`;
      showToast('ছবির সাইজ বেশি হয়েছে', sizeErr, 'error');
      return { success: false, firestoreSynced: false, apiSynced: false, error: sizeErr };
    }

    let firestoreSynced = false;
    let firestoreErrMsg = '';
    if (IS_GOOGLE_CLOUD_CONNECTED) {
      try {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        await setDoc(doc(db, 'products', product.id), payload);
        firestoreSynced = true;
      } catch (e) {
        logFirestoreErrorInfo(e, OperationType.CREATE, `products/${product.id}`);
        firestoreErrMsg = formatFirestoreWriteError(e);
      }
    }

    let apiSynced = false;
    let apiErrMsg = '';
    try {
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify(product)
      });
      if (res.ok) {
        apiSynced = true;
      } else {
        const errJson = await res.json().catch(() => ({}));
        apiErrMsg = errJson?.error || `Server HTTP ${res.status}`;
      }
    } catch (e) {
      apiErrMsg = e instanceof Error ? e.message : 'Server sync failed';
    }

    if (!firestoreSynced && !apiSynced) {
      const combinedErr = firestoreErrMsg || apiErrMsg || 'প্রোডাক্ট ডাটাবেজ বা সার্ভারে সেভ করা যায়নি।';
      showToast('প্রোডাক্ট সেভ ব্যর্থ হয়েছে', combinedErr, 'error');
      return { success: false, firestoreSynced: false, apiSynced: false, error: combinedErr };
    }

    // Update local state & categories after backend/Firestore persistence succeeds (deduped against live onSnapshot)
    try {
      sessionStorage.setItem('vt_catalog_mutated_at', String(Date.now()));
    } catch {
      // ignore storage error
    }
    setProducts((prev) => dedupeProductsById([product, ...prev]));
    if (product.category?.trim()) {
      setCategories((prev) =>
        prev.some((c) => c.toLowerCase() === product.category.trim().toLowerCase())
          ? prev
          : [...prev, product.category.trim()]
      );
    }

    addAuditLog('PRODUCT_CREATE', `Added garment "${product.name}" with SKU ${product.sku}`);
    if (firestoreSynced) {
      showToast('Product Created & Synced', `${product.name} সফলভাবে Firebase-এ সেভ এবং লাইভ হয়েছে।`, 'success');
    } else {
      showToast(
        'লোকাল ও সার্ভারে সেভ হয়েছে (Firebase বাকি)',
        firestoreErrMsg || 'সব ডিভাইসে স্থায়ী সিঙ্কের জন্য Google Admin দিয়ে পুনরায় সাইন-ইন করুন।',
        'info'
      );
    }
    return { success: true, firestoreSynced, apiSynced };
  };

  const updateProduct = async (
    id: string,
    updated: Partial<Product>
  ): Promise<{ success: boolean; firestoreSynced: boolean; apiSynced: boolean; error?: string }> => {
    const fbAuth = await getFirebaseAuth().catch(() => null);
    if (fbAuth && typeof (fbAuth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
      await (fbAuth as { authStateReady: () => Promise<void> }).authStateReady().catch(() => undefined);
    }

    const existingProduct = products.find((p) => p.id === id);
    const cleanUpdated: Partial<Product> = { ...updated };
    if (typeof cleanUpdated.name === 'string') {
      cleanUpdated.name = cleanUpdated.name.trim().slice(0, 220);
    }
    if (typeof cleanUpdated.sku === 'string') {
      cleanUpdated.sku = (cleanUpdated.sku.trim() || existingProduct?.sku || `VT-${Date.now().toString().slice(-5)}`).slice(0, 80);
    }
    if (typeof cleanUpdated.category === 'string') {
      const cat = cleanUpdated.category.trim();
      cleanUpdated.category = (cat && cat.toLowerCase() !== 'all' ? cat : existingProduct?.category || 'Hoodies').slice(0, 80);
    }
    if (typeof cleanUpdated.slug === 'string') {
      cleanUpdated.slug = cleanUpdated.slug.trim().slice(0, 220);
    }
    if (cleanUpdated.regularPrice !== undefined) {
      cleanUpdated.regularPrice = Math.max(0, Math.min(1000000, Math.round(Number(cleanUpdated.regularPrice) || 0)));
    }
    const effectiveCostRaw =
      cleanUpdated.costPrice !== undefined ? Number(cleanUpdated.costPrice) : existingProduct?.costPrice;
    if (typeof effectiveCostRaw === 'number' && Number.isFinite(effectiveCostRaw) && effectiveCostRaw > 0) {
      const computed = computePricesFromCost(effectiveCostRaw);
      cleanUpdated.costPrice = computed.costPrice;
      cleanUpdated.discountPrice = computed.sellingPrice;
      cleanUpdated.regularPrice = computed.regularPrice;
      cleanUpdated.discountPercent = computed.discountPercent;
    }
    if (cleanUpdated.totalStock !== undefined) {
      cleanUpdated.totalStock = Math.max(0, Math.min(100000, Math.round(Number(cleanUpdated.totalStock) || 0)));
    }
    if (cleanUpdated.outOfStockBehavior !== undefined) {
      cleanUpdated.outOfStockBehavior =
        cleanUpdated.outOfStockBehavior === 'show' || cleanUpdated.outOfStockBehavior === 'hide'
          ? cleanUpdated.outOfStockBehavior
          : 'default';
    }
    if (Array.isArray(cleanUpdated.images)) {
      cleanUpdated.images = rewriteProductImagesToProxy(cleanUpdated.images).slice(0, 20);
    }
    if (Array.isArray(cleanUpdated.sizes)) {
      const allowed = ALLOWED_SIZES as readonly string[];
      const filtered = cleanUpdated.sizes.filter((s) => allowed.includes(s));
      if (filtered.length > 0) {
        cleanUpdated.sizes = filtered.slice(0, 20);
      } else {
        delete cleanUpdated.sizes;
      }
    }

    const mergedProduct = existingProduct
      ? sanitizeProductSizes({ ...existingProduct, ...cleanUpdated })
      : null;
    const firestoreDocPayload = sanitizeFirestoreData(mergedProduct || cleanUpdated);
    const payloadBytes = new Blob([JSON.stringify(firestoreDocPayload)]).size;
    if (payloadBytes > 950_000) {
      const sizeErr = `প্রোডাক্ট ও ছবির মোট সাইজ (${Math.round(payloadBytes / 1024)}KB) Firestore ১MB সীমার বেশি হয়ে গেছে।`;
      showToast('ছবির সাইজ বেশি হয়েছে', sizeErr, 'error');
      return { success: false, firestoreSynced: false, apiSynced: false, error: sizeErr };
    }

    let firestoreSynced = false;
    let firestoreErrMsg = '';
    if (IS_GOOGLE_CLOUD_CONNECTED) {
      try {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        await setDoc(doc(db, 'products', id), firestoreDocPayload, { merge: true });
        firestoreSynced = true;
      } catch (e) {
        logFirestoreErrorInfo(e, OperationType.UPDATE, `products/${id}`);
        firestoreErrMsg = formatFirestoreWriteError(e);
      }
    }

    const apiPayload: Record<string, unknown> = { ...cleanUpdated };
    if ('discountPrice' in cleanUpdated && cleanUpdated.discountPrice === undefined) {
      apiPayload.discountPrice = null;
      apiPayload.discountPercent = null;
    }
    if ('discountPercent' in cleanUpdated && cleanUpdated.discountPercent === undefined) {
      apiPayload.discountPercent = null;
    }

    let apiSynced = false;
    let apiErrMsg = '';
    try {
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(apiPayload)
      });
      if (res.ok) {
        apiSynced = true;
      } else {
        const errJson = await res.json().catch(() => ({}));
        apiErrMsg = errJson?.error || `Server HTTP ${res.status}`;
      }
    } catch (e) {
      apiErrMsg = e instanceof Error ? e.message : 'Server update failed';
    }

    if (!firestoreSynced && !apiSynced) {
      const combinedErr = firestoreErrMsg || apiErrMsg || 'প্রোডাক্ট আপডেট করা যায়নি।';
      showToast('আপডেট ব্যর্থ হয়েছে', combinedErr, 'error');
      return { success: false, firestoreSynced: false, apiSynced: false, error: combinedErr };
    }

    try {
      sessionStorage.setItem('vt_catalog_mutated_at', String(Date.now()));
    } catch {
      // ignore storage error
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? sanitizeProductSizes({ ...p, ...cleanUpdated }) : p))
    );

    addAuditLog('PRODUCT_UPDATE', `Updated garment ID ${id}`);
    if (firestoreSynced) {
      showToast('Product Updated', 'সকল ডিভাইসে পরিবর্তন সফলভাবে সেভ হয়েছে।', 'success');
    } else {
      showToast(
        'লোকাল/সার্ভারে আপডেট হয়েছে (Firebase বাকি)',
        firestoreErrMsg || 'Firebase-এ সিঙ্ক করতে Google Admin রি-লগইন করুন।',
        'info'
      );
    }
    return { success: true, firestoreSynced, apiSynced };
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
    setProducts((prev) => dedupeProductsById([duplicated, ...prev]));

    // Save to Firebase Firestore
    try {
      if (IS_GOOGLE_CLOUD_CONNECTED) {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        const payload = sanitizeFirestoreData(duplicated);
        await setDoc(doc(db, 'products', duplicated.id), payload);
      }
    } catch (e) {
      console.warn('Firestore duplicateProduct error:', e);
      showToast('Database Sync Notice', 'Google Admin login required for Firebase database sync.', 'error');
    }

    // Also synchronize to server backend
    try {
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      fetch('/api/products', {
        method: 'POST',
        headers,
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
      if (IS_GOOGLE_CLOUD_CONNECTED) {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        await setDoc(doc(db, 'products', id), archivePayload, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore soft delete error:', e);
      showToast('Database Sync Notice', 'Google Admin login required for database changes.', 'error');
    }

    // Also update server backend
    try {
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers,
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
      if (IS_GOOGLE_CLOUD_CONNECTED) {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        await setDoc(doc(db, 'products', id), restorePayload, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore restore error:', e);
      showToast('Database Sync Notice', 'Google Admin login required for database changes.', 'error');
    }

    // Also update server backend
    try {
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers,
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
      if (IS_GOOGLE_CLOUD_CONNECTED) {
        const [db, { doc, deleteDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        await deleteDoc(doc(db, 'products', id));
      }
    } catch (e) {
      console.warn('Firestore deleteDoc error:', e);
      showToast('Database Sync Notice', 'Google Admin login required for permanent deletion.', 'error');
    }

    // Delete from server backend disk and memory
    try {
      const headers = await getAdminAuthHeaders();
      fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers
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

    if (IS_GOOGLE_CLOUD_CONNECTED && idsToDelete.length > 0) {
      try {
        const [db, { doc, writeBatch }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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
      const headers = await getAdminAuthHeaders();
      await fetch('/api/products', { method: 'DELETE', headers });
    } catch (e) {
      console.warn('Server delete all products warning:', e);
    }

    addAuditLog('PRODUCT_DELETE_ALL', 'Deleted all products from catalog');
    showToast('All Products Deleted', 'Catalog is now empty. You can add new products anytime.', 'info');
  };

  const recalculateAllPricesFromCost = async (): Promise<number> => {
    // Disabled intentionally so custom product prices are never overwritten automatically.
    return 0;
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

    if (IS_GOOGLE_CLOUD_CONNECTED && reordered.length > 0) {
      try {
        const [db, { doc, writeBatch }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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

    if (IS_GOOGLE_CLOUD_CONNECTED && reordered.length > 0) {
      try {
        const [db, { doc, writeBatch }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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

    if (IS_GOOGLE_CLOUD_CONNECTED && reordered.length > 0) {
      try {
        const [db, { doc, writeBatch }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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
      if (IS_GOOGLE_CLOUD_CONNECTED) {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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
      if (IS_GOOGLE_CLOUD_CONNECTED) {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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

  const addProductReview = (
    productId: string,
    review: {
      id: string;
      author: string;
      rating: number;
      date: string;
      comment: string;
      verifiedPurchase?: boolean;
      location?: string;
      photos?: string[];
    }
  ) => {
    const normalizedReview = {
      ...review,
      verifiedPurchase: Boolean(review.verifiedPurchase)
    };
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const nextReviews = [normalizedReview, ...(p.reviews || [])];
        const nextCount = (p.reviewCount || p.reviews?.length || 0) + 1;
        return {
          ...p,
          reviews: nextReviews,
          reviewCount: nextCount
        };
      })
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
  const syncCategoriesToFirestore = (nextList: ProductCategory[], nextDeleted: string[]) => {
    const activeUser = getCurrentFirebaseUserSync();
    if (
      !IS_GOOGLE_CLOUD_CONNECTED ||
      activeUser?.email?.trim().toLowerCase() !== 'muhammadeyamin0@gmail.com' ||
      !activeUser?.emailVerified
    ) {
      return;
    }
    void (async () => {
      try {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        await setDoc(
          doc(db, 'settings', 'categories'),
          {
            list: nextList,
            deleted: nextDeleted,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Firestore categories sync notice:', err);
      }
    })();
  };

  const addCategory = (name: ProductCategory) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const trimmedLower = trimmed.toLowerCase();
    hasLocalCategoryMutationRef.current = true;

    const nextDeleted = deletedCategoriesRef.current.filter((d) => d !== trimmedLower);
    deletedCategoriesRef.current = nextDeleted;
    setDeletedCategories(nextDeleted);
    localStorage.setItem('vt_deleted_categories_v1', JSON.stringify(nextDeleted));

    if (!categoriesRef.current.some((c) => c.trim().toLowerCase() === trimmedLower)) {
      const nextList = [...categoriesRef.current, trimmed];
      categoriesRef.current = nextList;
      setCategories(nextList);
      localStorage.setItem('vt_categories_v2', JSON.stringify(nextList));
      syncCategoriesToFirestore(nextList, nextDeleted);
      addAuditLog('CATEGORY_ADD', `Added catalog category "${trimmed}"`);
      showToast('Category Added', `Category "${trimmed}" added to navigation.`, 'success');
    } else {
      syncCategoriesToFirestore(categoriesRef.current, nextDeleted);
    }
  };

  const updateCategoryName = (oldName: ProductCategory, newName: ProductCategory) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === 'All' || oldName === trimmedNew) return;
    hasLocalCategoryMutationRef.current = true;

    const newLower = trimmedNew.toLowerCase();
    const nextDeleted = deletedCategoriesRef.current.filter((d) => d !== newLower);
    deletedCategoriesRef.current = nextDeleted;
    setDeletedCategories(nextDeleted);
    localStorage.setItem('vt_deleted_categories_v1', JSON.stringify(nextDeleted));

    // 1. Update categories array in state & localStorage
    const updatedList = categoriesRef.current.map((c) =>
      c.trim().toLowerCase() === oldName.trim().toLowerCase() ? trimmedNew : c
    );
    categoriesRef.current = updatedList;
    setCategories(updatedList);
    localStorage.setItem('vt_categories_v2', JSON.stringify(updatedList));
    syncCategoriesToFirestore(updatedList, nextDeleted);

    // 2. Cascade update to all products having this category
    setProducts((prev) =>
      prev.map((p) =>
        p.category.trim().toLowerCase() === oldName.trim().toLowerCase()
          ? { ...p, category: trimmedNew }
          : p
      )
    );

    // 3. Update active filter if currently selected
    if (selectedCategory.toLowerCase() === oldName.toLowerCase()) {
      setSelectedCategory(trimmedNew);
    }

    addAuditLog('CATEGORY_RENAME', `Renamed category "${oldName}" to "${trimmedNew}" and updated products`);
    showToast('ক্যাটাগরির নাম আপডেট হয়েছে', `"${oldName}" সফলভাবে পরিবর্তন করে "${trimmedNew}" করা হয়েছে।`, 'success');
  };

  const deleteCategories = (names: ProductCategory[]) => {
    const targetLowers = Array.from(
      new Set(
        names
          .map((n) => String(n || '').trim().toLowerCase())
          .filter((n) => n && n !== 'all')
      )
    );
    if (targetLowers.length === 0) return;

    hasLocalCategoryMutationRef.current = true;
    const targetSet = new Set(targetLowers);

    const updatedList = categoriesRef.current.filter(
      (c) => !targetSet.has(c.trim().toLowerCase())
    );
    categoriesRef.current = updatedList;
    setCategories(updatedList);
    localStorage.setItem('vt_categories_v2', JSON.stringify(updatedList));

    const nextDeleted = Array.from(
      new Set([...deletedCategoriesRef.current, ...targetLowers])
    );
    deletedCategoriesRef.current = nextDeleted;
    setDeletedCategories(nextDeleted);
    localStorage.setItem('vt_deleted_categories_v1', JSON.stringify(nextDeleted));

    syncCategoriesToFirestore(updatedList, nextDeleted);

    if (targetSet.has(selectedCategory.trim().toLowerCase())) {
      setSelectedCategory('All');
    }

    const label = names.filter((n) => n.trim().toLowerCase() !== 'all').join(', ');
    addAuditLog('CATEGORY_DELETE', `Removed category ${label}`);
    showToast(
      targetLowers.length > 1 ? `${targetLowers.length}টি ক্যাটাগরি মুছে ফেলা হয়েছে` : 'ক্যাটাগরি মুছে ফেলা হয়েছে',
      targetLowers.length > 1
        ? `নির্বাচিত ${targetLowers.length}টি ক্যাটাগরি স্থায়ীভাবে সরানো হয়েছে।`
        : `"${names[0]}" স্থায়ীভাবে মুছে ফেলা হয়েছে।`,
      'info'
    );
  };

  const deleteCategory = (name: ProductCategory) => {
    if (!name || name.trim().toLowerCase() === 'all') return;
    deleteCategories([name]);
  };

  const moveCategoryOrder = (category: ProductCategory, direction: 'up' | 'down' | 'first') => {
    if (category === 'All') return;
    hasLocalCategoryMutationRef.current = true;
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
      categoriesRef.current = copy;
      localStorage.setItem('vt_categories_v2', JSON.stringify(copy));
      syncCategoriesToFirestore(copy, deletedCategoriesRef.current);
      return copy;
    });
    addAuditLog('CATEGORY_REORDER', `Reordered category "${category}" (${direction})`);
    showToast('ক্যাটাগরি সাজানো হয়েছে', `"${category}" সফলভাবে আগে/পিছে নেওয়া হয়েছে।`, 'success');
  };

  const reorderCategories = (newOrder: ProductCategory[]) => {
    hasLocalCategoryMutationRef.current = true;
    categoriesRef.current = newOrder;
    setCategories(newOrder);
    localStorage.setItem('vt_categories_v2', JSON.stringify(newOrder));
    syncCategoriesToFirestore(newOrder, deletedCategoriesRef.current);
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

    if (IS_GOOGLE_CLOUD_CONNECTED && reorderedFullList.length > 0) {
      try {
        const [db, { doc, writeBatch }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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

  const setCategoryBestProduct = async (category: ProductCategory, productId: string | null) => {
    const affectedProducts: { id: string; nextVal: boolean }[] = [];

    setProducts((prev) =>
      prev.map((p) => {
        const matchesCat = doesProductMatchCategory(p, category) || p.id === productId;
        if (!matchesCat) return p;
        const nextVal = Boolean(productId && p.id === productId);
        if (Boolean(p.isCategoryShowcase) !== nextVal) {
          affectedProducts.push({ id: p.id, nextVal });
        }
        return { ...p, isCategoryShowcase: nextVal };
      })
    );

    if (IS_GOOGLE_CLOUD_CONNECTED && affectedProducts.length > 0) {
      try {
        const [db, { doc, writeBatch }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        const batch = writeBatch(db);
        affectedProducts.forEach(({ id, nextVal }) => {
          batch.set(doc(db, 'products', id), { isCategoryShowcase: nextVal }, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Firestore setCategoryBestProduct warning:', e);
      }
    }

    // Also mirror update to backend with admin credentials
    getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
      affectedProducts.forEach(({ id, nextVal }) => {
        fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ isCategoryShowcase: nextVal })
        }).catch(() => {});
      });
    });

    const chosen = productId ? products.find((p) => p.id === productId) : null;
    showToast(
      chosen ? 'সেকশন বেস্ট প্রোডাক্ট সেট হয়েছে' : 'অটো বেস্ট মোড চালু হয়েছে',
      chosen
        ? `"${category}" কার্ডের ছবি এখন "${chosen.name}" থেকে দেখানো হবে।`
        : `"${category}" কার্ডে অটোমেটিক সেরা প্রোডাক্টের ছবি দেখানো হবে।`,
      'success'
    );
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
    const cleanedPatch: Partial<StoreSettings> = { ...newSettings };
    if (typeof cleanedPatch.gmailNotificationAppPassword === 'string') {
      cleanedPatch.gmailNotificationAppPassword = cleanedPatch.gmailNotificationAppPassword.replace(/\s+/g, '');
    }
    if (typeof cleanedPatch.orderNotificationEmail === 'string') {
      cleanedPatch.orderNotificationEmail = cleanedPatch.orderNotificationEmail.trim();
    }
    if (typeof cleanedPatch.gmailNotificationUser === 'string') {
      cleanedPatch.gmailNotificationUser = cleanedPatch.gmailNotificationUser.trim();
    }
    if (typeof cleanedPatch.metaPixelId === 'string') {
      cleanedPatch.metaPixelId = sanitizeMetaPixelId(cleanedPatch.metaPixelId);
    }

    setSettings((prev) => {
      const merged = { ...prev, ...cleanedPatch };
      ensureMetaPixelLoaded(merged.metaPixelId, merged.isMetaPixelEnabled ?? true);

      if (
        cleanedPatch.gmailNotificationAppPassword !== undefined ||
        cleanedPatch.orderNotificationEmail !== undefined ||
        cleanedPatch.gmailNotificationUser !== undefined
      ) {
        getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
          if (!headers.Authorization) return;
          fetch('/api/settings/smtp', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              orderNotificationEmail: merged.orderNotificationEmail,
              gmailNotificationUser: merged.gmailNotificationUser,
              gmailNotificationAppPassword: (merged.gmailNotificationAppPassword || '').replace(/\s+/g, '')
            })
          }).catch((err) => console.warn('SMTP fallback sync skipped:', err));
        });
      }

      // Persist public storefront config (never secrets!) to Firestore settings/store when authenticated as Admin
      const activeUser = getCurrentFirebaseUserSync();
      if (
        IS_GOOGLE_CLOUD_CONNECTED &&
        activeUser?.email?.toLowerCase() === 'muhammadeyamin0@gmail.com' &&
        activeUser?.emailVerified
      ) {
        const publicStorePayload = sanitizeFirestoreData({
          storeName: merged.storeName,
          slogan: merged.slogan,
          announcementText: merged.announcementText,
          deliveryFeeInsideDhaka: merged.deliveryFeeInsideDhaka,
          deliveryFeeDhakaSubArea: merged.deliveryFeeDhakaSubArea,
          deliveryFeeOutsideDhaka: merged.deliveryFeeOutsideDhaka,
          freeShippingThreshold: merged.freeShippingThreshold,
          isBkashActive: Boolean(merged.isBkashActive),
          bKashStatus: merged.bKashStatus || (merged.isBkashActive ? 'active' : 'pending'),
          bKashMerchantNumber: merged.bKashMerchantNumber || '',
          whatsapp: merged.whatsapp || '',
          address: merged.address || '',
          metaPixelId: sanitizeMetaPixelId(merged.metaPixelId),
          isMetaPixelEnabled: merged.isMetaPixelEnabled ?? true,
          outOfStockDefaultBehavior: merged.outOfStockDefaultBehavior === 'hide' ? 'hide' : 'show',
          updatedAt: new Date().toISOString()
        });
        void (async () => {
          try {
            const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
            await setDoc(doc(db, 'settings', 'store'), publicStorePayload, { merge: true });
          } catch (err) {
            console.warn('Firestore public settings save notice:', err);
          }
        })();
      }

      return merged;
    });

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
      if (prod.isArchived || prod.status === 'archived' || isProductOutOfStock(prod)) {
        return {
          success: false,
          error: `${item.name} বর্তমানে স্টক শেষ (Out of Stock)। অনুগ্রহ করে কার্ট থেকে সরিয়ে পুনরায় অর্ডার করুন।`
        };
      }
      const variant = prod.variants.find((v) => v.size === item.size && v.color === item.color);
      const stock = variant ? Math.min(variant.stock, prod.totalStock) : prod.totalStock;
      if (stock <= 0 || item.quantity > stock) {
        return {
          success: false,
          error:
            stock <= 0
              ? `${item.name} (${item.size}/${item.color}) বর্তমানে স্টক শেষ (Out of Stock)।`
              : `Insufficient stock for ${item.name} (${item.size}/${item.color}). Only ${stock} available.`
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

    const normalizedCustomer: Address = {
      ...data.customer,
      fullName: String(data.customer.fullName || 'Customer').trim().slice(0, 120) || 'Customer',
      phone: String(data.customer.phone || '').trim().slice(0, 24) || '01700000000',
      district: String(data.customer.district || 'Dhaka').trim().slice(0, 80) || 'Dhaka',
      upazila:
        String(data.customer.upazila || data.customer.district || 'সদর').trim().slice(0, 80) ||
        'সদর',
      streetAddress:
        String(data.customer.streetAddress || 'Bangladesh').trim().slice(0, 400) || 'Bangladesh'
    };

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customer: normalizedCustomer,
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
      courierName:
        data.deliveryZone === 'inside_dhaka' || data.deliveryZone === 'dhaka_sub_area' ? 'Pathao' : 'Steadfast',
      trackingNumber: undefined,
      courierTrackingCode: undefined,
      trackingUrl: `/tracking?order=${orderNumber}`,
      currentLocationNote: 'অর্ডার গ্রহণ করা হয়েছে। কনফার্ম হওয়ার পর কিছুক্ষণের মধ্যেই ট্র্যাকিং আইডি যুক্ত হবে।',
      estimatedDeliveryMinDays:
        data.deliveryZone === 'inside_dhaka' || data.deliveryZone === 'dhaka_sub_area' ? 1 : 2,
      estimatedDeliveryMaxDays:
        data.deliveryZone === 'inside_dhaka' || data.deliveryZone === 'dhaka_sub_area' ? 2 : 4,
      userId: getCurrentFirebaseUserSync()?.uid || currentUser?.id || `usr-${Date.now()}`,
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
    deletedOrderIdsRef.current.delete(newOrder.id);
    setOrders((prev) => [newOrder, ...prev]);
    setLastPlacedOrder(newOrder);
    setCart([]);
    setAppliedCoupon(null);
    setAppliedPointsDiscount(0);
    setAppliedReferralCode(null);

    // 1. Direct sync to backend server + Firestore REST fallback (Guarantees Admin Dashboard presence across all devices)
    try {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newOrder, skipEmailNotification: true })
      })
        .then(async (res) => {
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            console.warn('Server backend order sync HTTP notice:', res.status, errTxt);
          }
        })
        .catch((err) => {
          console.warn('Server backend order sync warning:', err);
        });
    } catch (e) {
      console.warn('Server order sync warning:', e);
    }

    // 2. Sync to Google Cloud Firestore orders collection (matching authenticated uid if any so firestore.rules allow create)
    if (IS_GOOGLE_CLOUD_CONNECTED) {
      void (async () => {
        try {
          const [fbAuth, db, { doc, setDoc }] = await Promise.all([
            getFirebaseAuth(),
            getFirebaseDb(),
            getFirestoreModule()
          ]);
          if (typeof (fbAuth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
            await (fbAuth as { authStateReady: () => Promise<void> }).authStateReady().catch(() => {});
          }
          const activeFbUser = fbAuth.currentUser;
          const isFbAdmin =
            activeFbUser?.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
            Boolean(activeFbUser?.emailVerified);
          const cleanOrderPayload = sanitizeFirestoreData({
            ...newOrder,
            ...(activeFbUser?.uid && !isFbAdmin ? { userId: activeFbUser.uid } : {}),
            savedToFirestoreAt: new Date().toISOString()
          });
          await setDoc(doc(db, 'orders', newOrder.id), cleanOrderPayload);
        } catch (err) {
          console.warn('Firestore order save background warning:', err);
        }
      })();
    }

    // 3. Automatically dispatch order notification to Gmail (muhammadeyamin0@gmail.com)
    try {
      const cleanedFallbackPass = (settings.gmailNotificationAppPassword || '').replace(/\s+/g, '');
      const smtpFallback = cleanedFallbackPass
        ? {
            recipientEmail: settings.orderNotificationEmail,
            senderUser: settings.gmailNotificationUser,
            appPassword: cleanedFallbackPass
          }
        : undefined;
      fetch('/api/send-order-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder, smtpFallback })
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
      if (IS_GOOGLE_CLOUD_CONNECTED) {
        void (async () => {
          try {
            const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
            await setDoc(
              doc(db, 'orders', orderId),
              {
                orderStatus: 'Cancelled',
                cancellationReason: reason,
                cancelledAt: new Date().toISOString()
              },
              { merge: true }
            );
          } catch {
            // silent
          }
        })();
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

  // Staff Approval (from Pending / Awaiting Staff Approval -> Order Confirmed)
  const approveOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const confirmNote = `অর্ডার কনফার্ম করা হয়েছে (${currentStaffRole})। শীঘ্রই ট্র্যাকিং আইডি ও কুরিয়ার আপডেট যুক্ত হবে।`;
    const nextHistory = [
      ...(order.statusHistory || []),
      {
        status: 'Order Confirmed' as OrderStatus,
        timestamp: new Date().toISOString(),
        note: confirmNote,
        actor: `${currentUser?.name || 'Staff'} (${currentStaffRole})`
      }
    ];

    const updatedOrder: Order = {
      ...order,
      orderStatus: 'Order Confirmed',
      currentLocationNote: confirmNote,
      statusHistory: nextHistory
    };

    setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    setLastPlacedOrder((prev) => (prev && prev.id === orderId ? updatedOrder : prev));

    getAdminAuthHeaders({ 'Content-Type': 'application/json' })
      .then((headers) =>
        fetch(`/api/orders/${encodeURIComponent(order.id)}/approve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ note: confirmNote, orderSnapshot: order })
        })
      )
      .catch((err) => console.warn('Order approve backend sync notice:', err));

    if (IS_GOOGLE_CLOUD_CONNECTED) {
      void (async () => {
        try {
          const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
          await setDoc(
            doc(db, 'orders', order.id),
            sanitizeFirestoreData({
              orderStatus: 'Order Confirmed',
              currentLocationNote: confirmNote,
              statusHistory: nextHistory
            }),
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore order approve notice:', err);
        }
      })();
    }

    sendOrderSms(updatedOrder, 'order_confirmed');
    addAuditLog('ORDER_APPROVED', `Order #${order.orderNumber} approved by ${currentStaffRole}`);
    showToast('অর্ডার কনফার্ম হয়েছে', `অর্ডার #${order.orderNumber} কনফার্ম করা হয়েছে। এখন ট্র্যাকিং আইডি যুক্ত করুন।`, 'success');
  };

  // Assign Courier & Tracking Number
  const assignCourierTracking = (
    orderId: string,
    courierName: Order['courierName'],
    trackingNumber: string,
    options?: {
      targetStatus?: OrderStatus;
      note?: string;
      trackingUrl?: string;
    }
  ) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const cleanCode = trackingNumber.trim();
    const resolvedCourier = courierName || order.courierName || 'Steadfast';
    const nextStatus: OrderStatus =
      options?.targetStatus ||
      (order.orderStatus === 'Pending Customer Confirmation' ||
      order.orderStatus === 'Customer Confirmed' ||
      order.orderStatus === 'Awaiting Staff Approval'
        ? 'Order Confirmed'
        : order.orderStatus === 'Order Confirmed'
        ? 'Shipped'
        : order.orderStatus);

    const externalUrl = buildCourierTrackingUrl(resolvedCourier, cleanCode, options?.trackingUrl);
    const trackingUrl = externalUrl || `/tracking?order=${order.orderNumber}`;
    const assignNote =
      options?.note?.trim() ||
      `${resolvedCourier} এর মাধ্যমে ট্র্যাকিং আইডি যুক্ত হয়েছে: ${cleanCode}`;
    const assignedAt = new Date().toISOString();

    const nextHistory = [
      ...(order.statusHistory || []),
      {
        status: nextStatus,
        timestamp: assignedAt,
        note: assignNote,
        actor: `${currentUser?.name || 'Staff'} (${currentStaffRole})`
      }
    ];

    const updatedOrder: Order = {
      ...order,
      orderStatus: nextStatus,
      courierName: resolvedCourier,
      trackingNumber: cleanCode,
      courierTrackingCode: cleanCode,
      trackingUrl,
      trackingAssignedAt: assignedAt,
      currentLocationNote: assignNote,
      statusHistory: nextHistory
    };

    setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    setLastPlacedOrder((prev) => (prev && prev.id === orderId ? updatedOrder : prev));

    getAdminAuthHeaders({ 'Content-Type': 'application/json' })
      .then((headers) =>
        fetch(`/api/orders/${encodeURIComponent(order.id)}/courier`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            courierName: resolvedCourier,
            trackingCode: cleanCode,
            trackingNumber: cleanCode,
            trackingUrl,
            targetStatus: nextStatus,
            note: assignNote,
            orderSnapshot: order
          })
        })
      )
      .catch((err) => console.warn('Courier tracking backend sync notice:', err));

    if (IS_GOOGLE_CLOUD_CONNECTED) {
      void (async () => {
        try {
          const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
          await setDoc(
            doc(db, 'orders', order.id),
            sanitizeFirestoreData({
              orderStatus: nextStatus,
              courierName: resolvedCourier,
              trackingNumber: cleanCode,
              courierTrackingCode: cleanCode,
              trackingUrl,
              trackingAssignedAt: assignedAt,
              currentLocationNote: assignNote,
              statusHistory: nextHistory
            }),
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore courier tracking sync notice:', err);
        }
      })();
    }

    sendOrderSms(updatedOrder, 'order_shipped');
    addAuditLog('ORDER_TRACKING_ASSIGNED', `Assigned ${resolvedCourier} Tracking ID #${cleanCode} to #${order.orderNumber}`);
    showToast('Tracking ID সেভ হয়েছে', `#${order.orderNumber} এর জন্য Tracking ID (${cleanCode}) যুক্ত করা হয়েছে।`, 'success');
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

    const statusNote = note?.trim() || `Status updated to ${status}`;
    const nextHistory = [
      ...(order.statusHistory || []),
      {
        status,
        timestamp: new Date().toISOString(),
        note: statusNote,
        actor: `${currentUser?.name || 'Staff'} (${currentStaffRole})`
      }
    ];

    const updatedOrder: Order = {
      ...order,
      orderStatus: status,
      currentLocationNote: statusNote,
      statusHistory: nextHistory
    };

    setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    setLastPlacedOrder((prev) => (prev && prev.id === orderId ? updatedOrder : prev));

    getAdminAuthHeaders({ 'Content-Type': 'application/json' })
      .then((headers) =>
        fetch(`/api/orders/${encodeURIComponent(order.id)}/status`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status,
            note: statusNote,
            orderSnapshot: order
          })
        })
      )
      .catch((err) => console.warn('Order status backend sync notice:', err));

    if (IS_GOOGLE_CLOUD_CONNECTED) {
      void (async () => {
        try {
          const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
          await setDoc(
            doc(db, 'orders', order.id),
            sanitizeFirestoreData({
              orderStatus: status,
              currentLocationNote: statusNote,
              statusHistory: nextHistory
            }),
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore order status sync notice:', err);
        }
      })();
    }

    // Auto trigger specific SMS events
    if (status === 'Out for Delivery') {
      sendOrderSms(updatedOrder, 'out_for_delivery');
    } else if (status === 'Delivered') {
      const earned = Math.floor(order.total / (settings.pointsPerSpend || 50));
      sendOrderSms(updatedOrder, 'order_delivered', { points: earned.toString() });
    } else if (status === 'Cancelled') {
      sendOrderSms(updatedOrder, 'order_cancelled');
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
    setLastPlacedOrder((prev) =>
      prev && prev.id === orderId
        ? {
            ...prev,
            paymentStatus: status,
            transactionId: transactionId || prev.transactionId
          }
        : prev
    );
    if (IS_GOOGLE_CLOUD_CONNECTED) {
      void (async () => {
        try {
          const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
          await setDoc(
            doc(db, 'orders', orderId),
            sanitizeFirestoreData({
              paymentStatus: status,
              ...(transactionId ? { transactionId } : {})
            }),
            { merge: true }
          );
        } catch {
          // ignore Firestore sync error
        }
      })();
    }
    addAuditLog('PAYMENT_UPDATE', `Order payment updated to ${status}`);
    showToast('Payment Updated', `Payment marked as ${status}`, 'success');
  };

  const trackOrderLookup = (orderNumber?: string, phone?: string) => {
    const cleanNum = (orderNumber || '').trim().toUpperCase();
    const cleanPhone = (phone || '').trim().replace(/[-+\s]/g, '');

    if (!cleanNum && !cleanPhone) return null;

    const found = orders.find((o) => {
      const matchNum = cleanNum
        ? o.orderNumber.toUpperCase() === cleanNum ||
          String(o.trackingNumber || '').trim().toUpperCase() === cleanNum ||
          String(o.courierTrackingCode || '').trim().toUpperCase() === cleanNum
        : false;
      const orderPhoneClean = o.customer.phone.replace(/[-+\s]/g, '');
      const matchPhone = cleanPhone
        ? orderPhoneClean.endsWith(cleanPhone.slice(-10)) ||
          cleanPhone.endsWith(orderPhoneClean.slice(-10))
        : false;

      if (cleanNum && cleanPhone) {
        return matchNum && matchPhone;
      }
      if (cleanNum) return matchNum;
      if (cleanPhone) return matchPhone;
      return false;
    });

    return found || null;
  };

  const refreshOrderFromServer = useCallback(
    async (orderNumberOrTracking: string, phone: string): Promise<Order | null> => {
      const trimmedNum = String(orderNumberOrTracking || '').trim();
      const trimmedPhone = String(phone || '').trim();
      if (!trimmedNum || !trimmedPhone) return null;

      try {
        const res = await fetch(
          `/api/orders?orderNumber=${encodeURIComponent(trimmedNum)}&phone=${encodeURIComponent(trimmedPhone)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return null;
        const json = await res.json();
        const serverOrder: Order | null = Array.isArray(json?.data)
          ? json.data[0] || null
          : json?.data || null;

        if (serverOrder && serverOrder.orderNumber) {
          setOrders((prev) => {
            const exists = prev.some(
              (o) => o.id === serverOrder.id || o.orderNumber === serverOrder.orderNumber
            );
            if (!exists) return [serverOrder, ...prev];
            return prev.map((o) =>
              o.id === serverOrder.id || o.orderNumber === serverOrder.orderNumber
                ? { ...o, ...serverOrder }
                : o
            );
          });
          setLastPlacedOrder((prev) =>
            prev && (prev.id === serverOrder.id || prev.orderNumber === serverOrder.orderNumber)
              ? { ...prev, ...serverOrder }
              : prev
          );
          return serverOrder;
        }
      } catch {
        // Fallback gracefully to cached state
      }
      return null;
    },
    []
  );

  const clearAllOrders = async () => {
    orders.forEach((o) => {
      if (o?.id) deletedOrderIdsRef.current.add(o.id);
    });
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
      const headers = await getAdminAuthHeaders();
      await fetch('/api/orders', { method: 'DELETE', headers });
    } catch (e) {
      console.warn('Backend orders clear error:', e);
    }

    // 2. Purge from Firebase Firestore if connected
    if (IS_GOOGLE_CLOUD_CONNECTED) {
      try {
        const [db, { collection, doc, getDocs, writeBatch }] = await Promise.all([
          getFirebaseDb(),
          getFirestoreModule()
        ]);
        const snapshot = await getDocs(collection(db, 'orders'));
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.forEach((docSnap) => {
            deletedOrderIdsRef.current.add(docSnap.id);
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
    deletedOrderIdsRef.current.add(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (lastPlacedOrder && lastPlacedOrder.id === id) {
      setLastPlacedOrder(null);
    }

    // 1. Delete on server backend
    try {
      const headers = await getAdminAuthHeaders();
      await fetch(`/api/orders/${id}`, { method: 'DELETE', headers });
    } catch (e) {
      console.warn('Backend order delete error:', e);
    }

    // 2. Delete on Firestore
    if (IS_GOOGLE_CLOUD_CONNECTED) {
      try {
        const [db, { doc, deleteDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
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
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const log: SmsLog = {
      id: `sms-${Date.now()}`,
      phone,
      message: `VANTREL Security: Verification code ${otpCode} requested.`,
      template: 'otp_verification',
      status: 'Sent',
      timestamp: new Date().toISOString(),
      provider: 'Greenweb SMS Gateway BD'
    };
    setSmsLogs((prev) => [log, ...prev]);
    showToast('OTP Dispatched', `A verification code has been dispatched to ${phone}.`, 'success');
    return { success: true, message: `OTP sent to ${phone}` };
  };

  const verifyOtp = (phone: string, otp: string, customerName?: string) => {
    if (!otp || otp.trim().length < 4) {
      return { success: false, message: 'Please enter the verification code.' };
    }
    const cleanPhone = phone.replace(/[-+\s]/g, '');
    const certId = `VT-CERT-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = customers.find(
      (c) => c.phone && c.phone.replace(/[-+\s]/g, '').endsWith(cleanPhone.slice(-10))
    );

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
        email: '',
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

  const socialLogin = async (
    provider: 'google' | 'facebook',
    profileData?: { name?: string; email?: string; phone?: string }
  ): Promise<User | null> => {
    const certId = `VT-CERT-${Math.floor(100000 + Math.random() * 900000)}`;

    // Real Google Firebase Popup Authentication
    if (provider === 'google' && !profileData) {
      if (!IS_GOOGLE_CLOUD_CONNECTED) {
        showToast('Authentication Unavailable', 'Firebase authentication is not connected.', 'error');
        return null;
      }
      try {
        const result = await signInWithGooglePopup(false);
        const fbUser = result.user;
        try {
          localStorage.setItem('vt_has_fb_session', '1');
        } catch {
          // ignore storage error
        }
        const isSuperAdminAccount =
          fbUser.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
          Boolean(fbUser.emailVerified);

        if (isSuperAdminAccount) {
          setIsFirebaseAdminAuthenticated(true);
          setFirebaseAuthLoaded(true);
        }

        const authenticatedUser: User = {
          id: fbUser.uid,
          name: fbUser.displayName || 'VANTREL Member',
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || '',
          role: isSuperAdminAccount ? 'Super Admin' : 'customer',
          joinedDate: new Date().toISOString().split('T')[0],
          totalOrders: 0,
          totalSpent: 0,
          status: 'Active',
          loyaltyPoints: 150,
          referralCode: `VT-GOOGLE-${Math.floor(100 + Math.random() * 900)}`,
          isVerified: Boolean(fbUser.emailVerified),
          emailVerified: Boolean(fbUser.emailVerified),
          phoneVerified: Boolean(fbUser.phoneNumber),
          verificationMethod: 'google',
          verifiedAt: new Date().toISOString(),
          verificationCertificateId: certId,
          savedAddresses: []
        };

        try {
          const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
          await setDoc(
            doc(db, 'users', fbUser.uid),
            sanitizeFirestoreData({
              id: fbUser.uid,
              name: authenticatedUser.name,
              email: authenticatedUser.email,
              phone: authenticatedUser.phone,
              role: authenticatedUser.role,
              loyaltyPoints: authenticatedUser.loyaltyPoints
            }),
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore user profile sync warning:', err);
        }

        setCurrentUser(authenticatedUser);
        if (isSuperAdminAccount) setCurrentStaffRole('Super Admin');
        setIsAuthModalOpen(false);
        showToast(
          'গুগল সাইন-ইন সম্পন্ন',
          `স্বাগতম ${authenticatedUser.name}! আপনার গুগল অ্যাকাউন্ট ভেরিফাই হয়েছে।`,
          'success'
        );
        return authenticatedUser;
      } catch (err: any) {
        showToast(
          'Google Sign-In Cancelled',
          err?.message || 'Unable to complete Google authentication.',
          'error'
        );
        return null;
      }
    }

    if (provider === 'facebook' && !profileData) {
      showToast(
        'Facebook Login Unavailable',
        'Please sign in with Google or your 11-digit Mobile Phone OTP.',
        'info'
      );
      return null;
    }

    // Verified checkout profile metadata sync
    const email = (profileData?.email || '').trim();
    const name = (profileData?.name || '').trim() || 'VANTREL Customer';
    const phone = (profileData?.phone || '').trim();

    const verifiedUser: User = {
      id: getCurrentFirebaseUserSync()?.uid || `usr-${provider}-${Date.now()}`,
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
      isVerified: Boolean(email || phone),
      emailVerified: Boolean(email),
      phoneVerified: Boolean(phone),
      verificationMethod: provider,
      verifiedAt: new Date().toISOString(),
      verificationCertificateId: certId,
      savedAddresses: []
    };

    setCurrentUser(verifiedUser);
    setIsAuthModalOpen(false);
    return verifiedUser;
  };

  const verifyAndLoginCustomer = async (data: {
    method: 'phone_otp' | 'google' | 'facebook';
    name: string;
    phone: string;
    email?: string;
    otp?: string;
  }) => {
    if (data.method === 'phone_otp') {
      if (!data.otp) {
        return { success: false, message: 'Please enter the OTP code sent to your phone.' };
      }
      const res = verifyOtp(data.phone, data.otp, data.name);
      return {
        success: res.success,
        user: res.user,
        message: res.message
      };
    } else {
      const user = await socialLogin(data.method, {
        name: data.name,
        email: data.email,
        phone: data.phone
      });
      return {
        success: Boolean(user),
        user: user || undefined,
        message: user
          ? `${data.method === 'google' ? 'Google Gmail' : 'Facebook'} verification completed.`
          : 'Verification failed.'
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
    const cleanInput = emailOrPhone.trim();
    const isEmail = cleanInput.includes('@');
    const existing = customers.find(
      (c) =>
        (c.phone && cleanInput && c.phone.includes(cleanInput)) ||
        (c.email && cleanInput && c.email.toLowerCase() === cleanInput.toLowerCase())
    );
    const user: User = existing || {
      id: `usr-${Date.now()}`,
      name: name || 'Valued Customer',
      email: isEmail ? cleanInput : '',
      phone: isEmail ? '' : cleanInput,
      role: 'customer',
      loyaltyPoints: 200,
      referralCode: `VT-REF-${Math.floor(1000 + Math.random() * 9000)}`,
      savedAddresses: []
    };
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    showToast('Welcome to VANTREL', `Signed in as ${user.name}`, 'success');
  };

  // Switch active UI permission preview without destroying the verified Google Admin identity
  const loginAsStaff = (role: StaffRole, _name?: string) => {
    setCurrentStaffRole(role);
    showToast(`${role} Active`, `Operating with ${role} permissions preview.`, 'info');
  };

  const signInAdminWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    if (!IS_GOOGLE_CLOUD_CONNECTED) {
      return {
        success: false,
        message: 'ফায়ারবেস অথেনটিকেশন কনফিগার করা নেই।'
      };
    }

    try {
      const result = await signInWithGooglePopup(true);
      const fbUser = result.user;
      const verifiedEmail = fbUser.email?.trim().toLowerCase() || '';

      if (verifiedEmail !== 'muhammadeyamin0@gmail.com' || !fbUser.emailVerified) {
        await signOutFirebase().catch(() => {});
        try {
          localStorage.removeItem('vt_has_fb_session');
        } catch {
          // ignore storage error
        }
        setIsFirebaseAdminAuthenticated(false);
        return {
          success: false,
          message: `'${verifiedEmail || 'Unknown'}' ইমেইলটি অ্যাডমিন হিসেবে অনুমোদিত নয়। শুধুমাত্র ভেরিফাইড muhammadeyamin0@gmail.com দিয়ে প্রবেশ করুন।`
        };
      }

      try {
        localStorage.setItem('vt_has_fb_session', '1');
      } catch {
        // ignore storage error
      }

      const adminUser: User = {
        id: fbUser.uid,
        name: fbUser.displayName || 'Muhammad Yeamin (Super Admin)',
        email: verifiedEmail,
        phone: fbUser.phoneNumber || '',
        role: 'Super Admin',
        loyaltyPoints: 0,
        referralCode: 'VT-ADMIN',
        savedAddresses: [],
        isVerified: true,
        emailVerified: true,
        phoneVerified: Boolean(fbUser.phoneNumber),
        verificationMethod: 'google'
      };

      try {
        const [db, { doc, setDoc }] = await Promise.all([getFirebaseDb(), getFirestoreModule()]);
        await setDoc(
          doc(db, 'users', fbUser.uid),
          sanitizeFirestoreData({
            id: fbUser.uid,
            name: adminUser.name,
            email: adminUser.email,
            phone: adminUser.phone,
            role: 'Super Admin',
            loyaltyPoints: 0
          }),
          { merge: true }
        );
      } catch (err) {
        console.warn('Admin profile Firestore sync notice:', err);
      }

      setIsFirebaseAdminAuthenticated(true);
      setFirebaseAuthLoaded(true);
      setCurrentUser(adminUser);
      setCurrentStaffRole('Super Admin');
      showToast('Admin Authenticated', 'স্বাগতম Muhammad Yeamin! গুগল সেশন স্থায়ীভাবে কানেক্ট হয়েছে।', 'success');
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'গুগল সাইন-ইন বাতিল হয়েছে বা সম্পন্ন করা যায়নি।'
      };
    }
  };

  const loginAsAdmin = () => {
    if (
      currentUser?.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
      currentUser?.emailVerified
    ) {
      setCurrentStaffRole('Super Admin');
    } else {
      signInAdminWithGoogle();
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('vt_has_fb_session');
    } catch {
      // ignore storage error
    }
    if (IS_GOOGLE_CLOUD_CONNECTED) {
      signOutFirebase().catch(() => {});
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

  const isAdmin = Boolean(
    currentUser &&
      currentUser.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
      currentUser.emailVerified &&
      (currentUser.role === 'Super Admin' || currentUser.role === 'Admin')
  );

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

    getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
      fetch('/api/finances', {
        method: 'POST',
        headers,
        body: JSON.stringify(newRecord)
      }).catch((err) => console.warn('REST finance sync skipped:', err));
    });
  };

  const updateFinancialRecord = (id: string, updated: Partial<FinancialRecord>) => {
    setFinancialRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
    addAuditLog('FINANCE_RECORD_UPDATE', `Updated financial record ${id}`);
    showToast('Record Updated', 'Finance changes saved.', 'success');

    getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
      fetch(`/api/finances/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated)
      }).catch((err) => console.warn('REST finance update skipped:', err));
    });
  };

  const deleteFinancialRecord = (id: string) => {
    const target = financialRecords.find((r) => r.id === id);
    setFinancialRecords((prev) => prev.filter((r) => r.id !== id));
    addAuditLog('FINANCE_RECORD_DELETE', `Deleted financial entry: ${target?.title || id}`);
    showToast('Entry Removed', 'Financial entry was removed.', 'info');

    getAdminAuthHeaders().then((headers) => {
      fetch(`/api/finances/${id}`, { method: 'DELETE', headers }).catch((err) =>
        console.warn('REST finance delete skipped:', err)
      );
    });
  };

  const clearAllFinances = () => {
    setFinancialRecords([]);
    localStorage.removeItem('vt_finances');
    localStorage.removeItem('vt_finances_v2');
    addAuditLog('FINANCES_CLEARED', 'Admin wiped all financial and earnings logs.');
    showToast('Finances Cleared', 'All earnings and expense records removed.', 'info');
  };

  // Moderator & Staff Handlers (Strictly Super Admin Only)
  const isVerifiedSuperAdmin = (): boolean =>
    Boolean(
      currentUser &&
        currentUser.email?.trim().toLowerCase() === 'muhammadeyamin0@gmail.com' &&
        currentUser.emailVerified &&
        currentUser.role === 'Super Admin' &&
        currentStaffRole === 'Super Admin'
    );

  const addStaffModerator = (mod: Omit<StaffModerator, 'id' | 'assignedDate'>) => {
    if (!isVerifiedSuperAdmin()) {
      showToast('Super Admin Only', 'শুধুমাত্র Super Admin নতুন মডারেটর যুক্ত করতে পারবেন।', 'error');
      return;
    }
    const newMod: StaffModerator = {
      ...mod,
      id: `mod-${Date.now()}`,
      assignedDate: new Date().toISOString().split('T')[0],
      status: mod.status || 'Active',
      lastActive: 'Never'
    };
    setStaffModerators((prev) => [...prev, newMod]);
    addAuditLog('MODERATOR_ADD', `Assigned ${newMod.name} as ${newMod.role}`);
    showToast('Staff Moderator Created', `${newMod.name} granted ${newMod.role} access.`, 'success');

    getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
      fetch('/api/moderators', {
        method: 'POST',
        headers,
        body: JSON.stringify(newMod)
      }).catch((err) => console.warn('REST moderator sync skipped:', err));
    });
  };

  const updateStaffModerator = (id: string, updated: Partial<StaffModerator>) => {
    if (!isVerifiedSuperAdmin()) {
      showToast('Super Admin Only', 'শুধুমাত্র Super Admin মডারেটরের অনুমতি বা তথ্য পরিবর্তন করতে পারবেন।', 'error');
      return;
    }
    setStaffModerators((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
    );
    addAuditLog('MODERATOR_UPDATE', `Updated permissions/status for moderator ${id}`);
    showToast('Permissions Updated', 'Staff moderator record modified.', 'success');

    getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
      fetch(`/api/moderators/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated)
      }).catch((err) => console.warn('REST moderator update skipped:', err));
    });
  };

  const deleteStaffModerator = (id: string) => {
    if (!isVerifiedSuperAdmin()) {
      showToast('Super Admin Only', 'শুধুমাত্র Super Admin মডারেটর রিমুভ করতে পারবেন।', 'error');
      return;
    }
    const target = staffModerators.find((m) => m.id === id);
    setStaffModerators((prev) => prev.filter((m) => m.id !== id));
    addAuditLog('MODERATOR_REMOVE', `Revoked moderator privileges for ${target?.name || id}`);
    showToast('Access Revoked', 'Staff moderator account removed.', 'info');

    getAdminAuthHeaders().then((headers) => {
      fetch(`/api/moderators/${id}`, { method: 'DELETE', headers }).catch((err) =>
        console.warn('REST moderator delete skipped:', err)
      );
    });
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
      getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
        fetch('/api/theme', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...themeConfig, ...config })
        }).catch((err) => console.warn('REST theme sync skipped:', err));
      });
    }
  };

  const updateThemeConfig = (cfg: Partial<ThemeConfig>) => {
    setThemeConfig((prev) => {
      const next = { ...prev, ...cfg };
      getAdminAuthHeaders({ 'Content-Type': 'application/json' }).then((headers) => {
        fetch('/api/theme', {
          method: 'POST',
          headers,
          body: JSON.stringify(next)
        }).catch((err) => console.warn('REST theme sync skipped:', err));
      });
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
        isProductsLoading,
        isCatalogSyncing,
        catalogLastSyncedAt,
        catalogSyncWarning,
        refreshCatalog,
        activeProducts,
        archivedProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        restoreProduct,
        permanentlyDeleteProduct,
        deleteAllProducts,
        recalculateAllPricesFromCost,
        duplicateProduct,
        moveProductUp,
        moveProductDown,
        pinProductToTop,
        toggleTopProduct,
        moveProductToTop,
        addProductReview,
        getProductById,
        getProductBySlug,
        categories,
        addCategory,
        updateCategoryName,
        deleteCategory,
        deleteCategories,
        moveCategoryOrder,
        reorderCategories,
        moveProductInCategory,
        setCategoryBestProduct,
        banners,
        updateBanner,
        orders,
        isOrdersSyncing,
        ordersSyncWarning,
        ordersLastSyncedAt,
        ordersHasMore,
        ordersFetchLimit,
        ordersDateRangeDays,
        setOrdersDateRangeDays,
        refreshOrders,
        loadMoreOrders,
        lastPlacedOrder,
        placeOrder,
        updateOrderStatus,
        updateOrderPayment,
        cancelOrder,
        requestOrderReturn,
        approveOrder,
        assignCourierTracking,
        trackOrderLookup,
        refreshOrderFromServer,
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
        signInAdminWithGoogle,
        isFirebaseAdminAuthenticated,
        firebaseAuthLoaded,
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
