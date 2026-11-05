export type ProductCategory =
  | 'All'
  | 'Polo Shirt'
  | 'Polo Shirts'
  | 'Drop Shoulder T-Shirt'
  | 'Basic T-Shirt'
  | 'Print Shirt'
  | 'Solid Shirt'
  | 'Check Shirt'
  | 'Solid & Print Hoodie'
  | 'Contrast Hoodie'
  | 'Veracity Jacket'
  | 'Denim Jacket'
  | 'Sweater'
  | 'Sweeter'
  | 'Sweatshirt'
  | 'Sweatshirts'
  | 'Hoodie Set'
  | 'Long Sleeve T-Shirt'
  | 'Long Sleeve Set'
  | 'Pants'
  | 'Pant'
  | 'Joggers and Trousers'
  | 'Joggers and trouser'
  | 'Gents Winter Accessories'
  | "Gent's Winter Accessories"
  | 'Men'
  | 'Women'
  | 'Panjabi'
  | 'Kids'
  | 'New Arrivals'
  | 'Winter Collection'
  | 'T-Shirts'
  | 'Shirts'
  | 'Hoodies'
  | 'Jackets'
  | 'Jeans'
  | 'Traditional Wear'
  | 'Accessories'
  | (string & {});

export const ALLOWED_SIZES = ['M', 'L', 'XL', 'XXL'] as const;
export type ProductSize = (typeof ALLOWED_SIZES)[number];

export interface ProductVariant {
  id: string;
  size: string; // 'M' | 'L' | 'XL' | 'XXL'
  color: string; // e.g. 'Forest Green', 'Ivory Cream', 'Charcoal Black'
  colorHex: string;
  stock: number;
  sku: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number; // 1 to 5
  date: string;
  comment: string;
  verifiedPurchase: boolean;
  location?: string;
  photos?: string[];
}

export interface ProductMeasurements {
  chest?: number; // inches
  length: number; // inches
  sleeve?: number; // inches
  shoulder?: number; // inches
  waist?: number; // inches
  hip?: number; // inches
  thigh?: number; // inches
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ProductCategory;
  subCategory: string;
  brand: string;
  sku: string;
  regularPrice: number;
  discountPrice?: number;
  discountPercent?: number;
  images: string[];
  videoUrl?: string;
  sizes: string[];
  colors: { name: string; hex: string }[];
  variants: ProductVariant[];
  fabric: string;
  gsm?: number;
  fit: string;
  care: string[];
  tags: string[];
  measurements?: Record<string, ProductMeasurements>;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  isTopProduct?: boolean;
  sortOrder?: number;
  costPrice?: number;
  status?: 'published' | 'draft' | 'archived';
  rating: number;
  reviewCount: number;
  reviews?: Review[];
  totalStock: number;
  createdDate?: string;
}

export interface CartItem {
  id: string; // unique item entry id (productId + size + color)
  productId: string;
  name: string;
  slug: string;
  image: string;
  size: string;
  color: string;
  price: number;
  regularPrice: number;
  quantity: number;
  maxStock: number;
  sku: string;
}

export interface Address {
  fullName: string;
  phone: string;
  altPhone?: string; // Brother's or relative alternative mobile number (মাস্ট)
  brotherPhone?: string;
  email?: string;
  division: string;
  district: string;
  upazila: string;
  unionOrWard?: string;
  streetAddress: string; // House / Road / Landmark / Area address (মাস্ট)
  brotherAddress?: string; // Brother's or handover person address where product will be delivered (মাস্ট)
  deliveryRecipientDetails?: string;
  notes?: string;
}

// Complete 16-Stage Order Lifecycle requested
export type OrderStatus =
  | 'Pending Customer Confirmation'
  | 'Customer Confirmed'
  | 'Awaiting Staff Approval'
  | 'Order Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancellation Requested'
  | 'Cancelled'
  | 'Return Requested'
  | 'Returned'
  | 'Refund Pending'
  | 'Refunded'
  | 'Failed Delivery';

export type PaymentMethod =
  | 'Cash on Delivery (COD)'
  | 'Cash on Delivery'
  | 'bKash'
  | 'Nagad'
  | 'Rocket'
  | 'Credit/Debit Card'
  | 'SSLCommerz'
  | 'Partial Advance Payment (bKash Delivery Charge)';

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  actor?: string;
}

export interface PartialPaymentInfo {
  advanceAmount: number; // Delivery fee paid in advance (৳80 or ৳150)
  remainingDue: number; // Remaining product subtotal payable upon delivery
  trxId?: string;
  isAdvancePaid: boolean;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. VT-89241
  customer: Address;
  items: CartItem[];
  subtotal: number;
  discount?: number;
  discountAmount?: number;
  couponCode?: string;
  pointsDiscount?: number;
  loyaltyPointsRedeemed?: number;
  referralDiscount?: number;
  deliveryZone?: 'inside_dhaka' | 'outside_dhaka' | 'remote_area' | 'express_dhaka';
  deliveryFee?: number;
  deliveryCharge?: number;
  total: number;
  paymentMethod: PaymentMethod | string;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  partialPayment?: PartialPaymentInfo;
  orderStatus: OrderStatus;
  createdAt: string;
  customerConfirmationDeadline?: string; // ISO String (e.g. 15 minutes after order)
  confirmationDeadline?: string;
  canCancelUntil?: string; // ISO String
  cancellationReason?: string;
  returnReason?: string;
  courierName?: 'Pathao' | 'Steadfast' | 'Paperfly' | 'RedX' | 'eCourier' | 'In-House';
  trackingNumber?: string;
  courierTrackingCode?: string;
  trackingUrl?: string;
  estimatedDeliveryMinDays?: number;
  estimatedDeliveryMaxDays?: number;
  statusHistory: OrderStatusHistoryItem[];
  userId?: string;
  isVerifiedCustomer?: boolean;
  verificationMethod?: 'phone_otp' | 'google' | 'facebook' | 'email';
  verifiedAt?: string;
  verificationCertificateId?: string;
  contractConfirmed?: boolean;
  contractAgreedAt?: string;
}

export interface Coupon {
  id?: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number; // e.g. 10 for 10%, or 300 for 300 BDT
  minOrder: number;
  description: string;
  expiryDate: string;
  isActive: boolean;
  usageLimitPerUser?: number;
  usedCount?: number;
  applicableCategory?: ProductCategory | 'All';
  maxDiscount?: number;
}

export interface StoreSettings {
  storeName: string;
  slogan: string;
  logoUrl?: string;
  announcementText: string;
  deliveryFeeInsideDhaka: number;
  deliveryFeeOutsideDhaka: number;
  deliveryFeeRemote: number;
  deliveryFeeExpress: number;
  freeShippingThreshold: number;
  confirmationWindowMinutes: number; // Window to cancel before auto-confirm
  customerConfirmationWindowMinutes?: number;
  phone: string;
  whatsapp: string;
  whatsappUrl?: string;
  facebookUrl?: string;
  email: string;
  address: string;
  bKashMerchantNumber: string;
  isBkashActive?: boolean;
  bKashStatus?: 'pending' | 'active' | 'disabled';
  nagadMerchantNumber: string;
  sslCommerzStoreId?: string;
  pointsPerSpend: number; // e.g. 1 point per 50 BDT
  pointsRedeemRate: number; // e.g. 1 point = 1 BDT
  referralRewardBDT: number; // e.g. 200 BDT
  refereeRewardBDT: number; // e.g. 100 BDT
  smsProvider: 'greenweb' | 'bulksmsbd' | 'sslwireless' | 'twilio' | 'simulator';
  smsApiKey?: string;
  smsSenderId?: string;
  orderNotificationEmail?: string;
  gmailNotificationUser?: string;
  gmailNotificationAppPassword?: string;
}

export type StaffRole =
  | 'Super Admin'
  | 'Admin'
  | 'Order Moderator'
  | 'Product Moderator'
  | 'Finance Moderator'
  | 'Content Moderator'
  | 'Customer Support';

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  amount: number; // positive for earn, negative for redeem
  type: 'earn' | 'redeem' | 'bonus' | 'reversal';
  balanceAfter: number;
  date: string;
  description: string;
  orderNumber?: string;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerCode: string;
  refereeName: string;
  refereePhone: string;
  status: 'registered' | 'ordered' | 'rewarded';
  rewardAmount: number;
  date: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole | 'customer' | 'admin';
  savedAddresses?: Address[];
  joinedDate?: string;
  totalOrders?: number;
  totalSpent?: number;
  status?: 'Active' | 'Inactive';
  loyaltyPoints: number;
  referralCode: string;
  referredBy?: string;
  pointsHistory?: LoyaltyTransaction[];
  privacySettings?: {
    marketingSms: boolean;
    orderAlerts: boolean;
  };
  isVerified?: boolean;
  verificationMethod?: 'phone_otp' | 'google' | 'facebook' | 'email';
  phoneVerified?: boolean;
  emailVerified?: boolean;
  verifiedAt?: string;
  verificationCertificateId?: string;
}

export interface SmsLog {
  id: string;
  orderId?: string;
  orderNumber?: string;
  phone?: string;
  recipientPhone?: string;
  message: string;
  template?: string;
  templateKey?: string;
  status: 'Sent' | 'Failed' | 'Pending' | 'Delivered';
  timestamp?: string;
  dispatchedAt?: string;
  provider: string;
}

export interface SmsTemplate {
  id: string;
  event: 'order_placed' | 'order_confirmed' | 'order_shipped' | 'out_for_delivery' | 'order_delivered' | 'order_cancelled' | 'otp_verification';
  name: string;
  template: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: StaffRole | string;
  action: string;
  details: string;
}

export interface BannerConfig {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  bgImageUrl: string;
  isActive: boolean;
}

export type FinancialRecordType = 'income' | 'expense' | 'Income' | 'Expense';

export type FinancialCategory =
  | 'Product purchase or manufacturing costs'
  | 'Manufacturing'
  | 'Packaging'
  | 'Delivery and courier charges'
  | 'Courier'
  | 'Advertising'
  | 'Ads & Marketing'
  | 'Website expenses'
  | 'Website & Tech'
  | 'Office & Rent'
  | 'Salaries'
  | 'Photography'
  | 'Product Sales'
  | 'Wholesale'
  | 'Other operating expenses'
  | 'Other income'
  | 'Other'
  | string;

export interface FinancialRecord {
  id: string;
  title: string;
  amount: number; // in BDT (৳)
  type: FinancialRecordType;
  date: string; // YYYY-MM-DD
  category: FinancialCategory;
  description?: string;
  referenceNo?: string;
  isCustomCategory?: boolean;
  createdAt?: string;
}

export interface StaffModerator {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: 'Active' | 'Suspended';
  assignedDate: string;
  lastActive?: string;
  canManageFinances?: boolean;
  permissions?: string[];
}

export type ThemePreset =
  | 'minimal-luxury'
  | 'black-gold'
  | 'black-and-gold'
  | 'modern-streetwear'
  | 'clean-white'
  | 'dark-cinematic'
  | 'seasonal-collection';

export interface ThemeConfig {
  preset: ThemePreset;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  cardBg: string;
  textColor: string;
  borderColor: string;
  buttonRadius: string;
  animationIntensity: 'subtle' | 'normal' | 'cinematic';
}

export interface Banner3DConfig {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description?: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  bgImageUrl?: string;
  bgImage?: string;
  productCutoutUrl?: string;
  depthIntensity?: 'subtle' | 'deep' | 'ultra';
  layerDepth?: number;
  lighting?: 'warm' | 'cool' | 'neon' | 'ambient';
  overlayOpacity?: number;
  isActive: boolean;
}


