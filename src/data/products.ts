import type {
  Product,
  Coupon,
  StoreSettings,
  User,
  Order,
  FinancialRecord,
  StaffModerator,
  ThemeConfig,
  Banner3DConfig
} from '../types/index.ts';

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_COUPONS: Coupon[] = [
  {
    code: 'VANTREL10',
    type: 'percent',
    value: 10,
    minOrder: 1500,
    description: '10% off on all VANTREL orders above ৳1,500',
    expiryDate: '2026-12-31',
    isActive: true,
    usageLimitPerUser: 1,
    usedCount: 42
  },
  {
    code: 'VANTREL20',
    type: 'percent',
    value: 20,
    minOrder: 3500,
    description: '20% off for orders above ৳3,500',
    expiryDate: '2026-12-31',
    isActive: true,
    usageLimitPerUser: 1,
    usedCount: 28
  },
  {
    code: 'WELCOME500',
    type: 'fixed',
    value: 500,
    minOrder: 2500,
    description: '৳500 flat discount on your premier order',
    expiryDate: '2026-12-31',
    isActive: true,
    usageLimitPerUser: 1,
    usedCount: 65
  }
];

export const INITIAL_SETTINGS: StoreSettings = {
  storeName: 'VANTREL OUTFIT',
  slogan: 'Define Your Narrative.',
  logoUrl: '/assets/images/vantrel-logo.png',
  announcementText:
    'ঢাকায় সম্পূর্ণ ফ্রি ডেলিভারি (৳০)! · ঢাকা সাব-এরিয়া ও ৬৩ জেলায় মাত্র ৳৫০ ডেলিভারি · ক্যাশ অন ডেলিভারি',
  deliveryFeeInsideDhaka: 0,
  deliveryFeeDhakaSubArea: 50,
  deliveryFeeOutsideDhaka: 50,
  deliveryFeeRemote: 50,
  deliveryFeeExpress: 50,
  freeShippingThreshold: 0,
  confirmationWindowMinutes: 15, // Window to cancel before auto customer-confirmation
  phone: '',
  whatsapp: 'https://wa.me/message/E6PISGJZC63TA1',
  whatsappUrl: 'https://wa.me/message/E6PISGJZC63TA1',
  facebookUrl: 'https://www.facebook.com/vantreloutfit',
  instagramUrl: 'https://www.instagram.com/vantreloutfit',
  email: 'concierge@vantreloutfit.shop',
  address: 'Level 4, Road 11, Block D, Banani, Dhaka-1213, Bangladesh',
  bKashMerchantNumber: '01711234567',
  isBkashActive: false,
  bKashStatus: 'pending',
  nagadMerchantNumber: '01711234567',
  sslCommerzStoreId: 'vantrel_live',
  pointsPerSpend: 50, // 1 point per 50 BDT
  pointsRedeemRate: 1, // 1 point = 1 BDT
  referralRewardBDT: 200,
  refereeRewardBDT: 100,
  smsProvider: 'greenweb',
  smsApiKey: 'gw_live_demo_key_sec892',
  smsSenderId: 'VANTREL OUTFIT',
  orderNotificationEmail: 'muhammadeyamin0@gmail.com',
  gmailNotificationUser: 'muhammadeyamin0@gmail.com',
  gmailNotificationAppPassword: 'mnul thdc eztk hmfc'
};

export const INITIAL_CUSTOMERS: User[] = [
  {
    id: 'usr-001',
    name: 'Muhammad Yeamin',
    email: 'muhammadeyamin0@gmail.com',
    phone: '01711234567',
    role: 'customer',
    joinedDate: '2026-08-14',
    totalOrders: 4,
    totalSpent: 12450,
    status: 'Active',
    loyaltyPoints: 340,
    referralCode: 'VT-REF-YEAMIN',
    pointsHistory: [
      {
        id: 'pts-1',
        userId: 'usr-001',
        amount: 240,
        type: 'earn',
        balanceAfter: 240,
        date: '2026-08-15',
        description: 'Earned from Order VT-89102',
        orderNumber: 'VT-89102'
      },
      {
        id: 'pts-2',
        userId: 'usr-001',
        amount: 100,
        type: 'bonus',
        balanceAfter: 340,
        date: '2026-08-14',
        description: 'Welcome Registration Bonus'
      }
    ],
    privacySettings: {
      marketingSms: true,
      orderAlerts: true
    },
    isVerified: true,
    verificationMethod: 'phone_otp',
    phoneVerified: true,
    emailVerified: true,
    verifiedAt: '2026-08-14T10:00:00Z',
    verificationCertificateId: 'VT-CERT-884920',
    savedAddresses: []
  },
  {
    id: 'usr-002',
    name: 'Tahmidur Rahman',
    email: 'tahmid.rahman@gmail.com',
    phone: '01812345678',
    role: 'customer',
    joinedDate: '2026-09-02',
    totalOrders: 2,
    totalSpent: 5300,
    status: 'Active',
    loyaltyPoints: 106,
    referralCode: 'VT-REF-TAHMID',
    pointsHistory: [
      {
        id: 'pts-3',
        userId: 'usr-002',
        amount: 106,
        type: 'earn',
        balanceAfter: 106,
        date: '2026-09-03',
        description: 'Earned from Order VT-89190',
        orderNumber: 'VT-89190'
      }
    ],
    privacySettings: {
      marketingSms: true,
      orderAlerts: true
    },
    savedAddresses: []
  },
  {
    id: 'usr-003',
    name: 'Farhan Kabir',
    email: 'farhan.k@chattogram.com',
    phone: '01819998877',
    role: 'customer',
    joinedDate: '2026-09-18',
    totalOrders: 3,
    totalSpent: 9800,
    status: 'Active',
    loyaltyPoints: 196,
    referralCode: 'VT-REF-FARHAN',
    pointsHistory: [
      {
        id: 'pts-4',
        userId: 'usr-003',
        amount: 196,
        type: 'earn',
        balanceAfter: 196,
        date: '2026-09-20',
        description: 'Earned from Order VT-89241',
        orderNumber: 'VT-89241'
      }
    ],
    privacySettings: {
      marketingSms: false,
      orderAlerts: true
    },
    savedAddresses: []
  }
];

export const INITIAL_SMS_TEMPLATES: import('../types').SmsTemplate[] = [
  {
    id: 'tmpl-1',
    event: 'order_placed',
    name: 'Order Received Confirmation',
    template: 'VANTREL: Your order #{orderNumber} has been received. Total: ৳{total}. Confirmation window: 15 mins. Track: {trackingUrl}',
    isActive: true
  },
  {
    id: 'tmpl-2',
    event: 'order_confirmed',
    name: 'Staff Order Final Approval',
    template: 'VANTREL: Your order #{orderNumber} is confirmed by fulfillment team. Est Delivery: {deliveryEstimate}. Thank you for choosing VANTREL.',
    isActive: true
  },
  {
    id: 'tmpl-3',
    event: 'order_shipped',
    name: 'Courier Dispatch & Tracking',
    template: 'VANTREL: Your order #{orderNumber} has been handed to {courier}. Tracking ID: {trackingNumber}. Live status: {trackingUrl}',
    isActive: true
  },
  {
    id: 'tmpl-4',
    event: 'out_for_delivery',
    name: 'Out For Delivery (Courier Rider)',
    template: 'VANTREL: Rider is out for delivery with parcel #{orderNumber}. Payable amount: ৳{total}. Please keep payment ready.',
    isActive: true
  },
  {
    id: 'tmpl-5',
    event: 'order_delivered',
    name: 'Delivery Completion & Loyalty Points',
    template: 'VANTREL: Order #{orderNumber} delivered successfully! You earned {points} loyalty points. Define Your Narrative.',
    isActive: true
  },
  {
    id: 'tmpl-6',
    event: 'order_cancelled',
    name: 'Order Cancellation Notice',
    template: 'VANTREL: Order #{orderNumber} has been cancelled. Reserved stock has been released. Refund processed where applicable.',
    isActive: true
  },
  {
    id: 'tmpl-7',
    event: 'otp_verification',
    name: 'Phone OTP Authentication',
    template: 'VANTREL Security: Your one-time verification code is {otp}. Valid for 5 minutes. Do not share with anyone.',
    isActive: true
  }
];

export const INITIAL_SMS_LOGS: import('../types').SmsLog[] = [
  {
    id: 'sms-log-001',
    orderId: 'ord-001',
    orderNumber: 'VT-89241',
    phone: '01819998877',
    message: 'VANTREL: Your order #VT-89241 has been handed to Steadfast. Tracking ID: ST-DH-8921. Live status: /tracking',
    template: 'order_shipped',
    status: 'Sent',
    timestamp: '2026-10-18T14:32:00.000Z',
    provider: 'Greenweb SMS Gateway BD'
  },
  {
    id: 'sms-log-002',
    orderId: 'ord-002',
    orderNumber: 'VT-89190',
    phone: '01812345678',
    message: 'VANTREL: Your order #VT-89190 is confirmed by fulfillment team. Est Delivery: 24-48 Hours.',
    template: 'order_confirmed',
    status: 'Sent',
    timestamp: '2026-10-19T10:15:00.000Z',
    provider: 'Greenweb SMS Gateway BD'
  },
  {
    id: 'sms-log-003',
    phone: '01711234567',
    message: 'VANTREL Security: Your one-time verification code is 849201. Valid for 5 minutes.',
    template: 'otp_verification',
    status: 'Sent',
    timestamp: '2026-10-22T08:00:00.000Z',
    provider: 'Greenweb SMS Gateway BD'
  }
];

export const INITIAL_AUDIT_LOGS: import('../types').AuditLog[] = [
  {
    id: 'aud-001',
    timestamp: '2026-10-22T08:15:00.000Z',
    actor: 'Yeamin (Super Admin)',
    role: 'Super Admin',
    action: 'SYSTEM_SETTINGS_UPDATE',
    details: 'Configured automated 15-minute customer cancellation window and Greenweb SMS gateway.'
  },
  {
    id: 'aud-002',
    timestamp: '2026-10-22T07:30:00.000Z',
    actor: 'Rafiqul (Order Moderator)',
    role: 'Order Moderator',
    action: 'ORDER_APPROVED',
    details: 'Approved order #VT-89190 and moved from Awaiting Staff Approval to Order Confirmed.'
  },
  {
    id: 'aud-003',
    timestamp: '2026-10-21T18:45:00.000Z',
    actor: 'Kamrul (Product Moderator)',
    role: 'Product Moderator',
    action: 'INVENTORY_RESTOCK',
    details: 'Restocked +50 units of VANTREL Signature Heavyweight Pine Hoodie across all sizes.'
  }
];

export const INITIAL_BANNERS: import('../types').BannerConfig[] = [
  {
    id: 'ban-1',
    title: 'THE MONOCHROME ESSENTIALS',
    subtitle: 'Engineered from 420 GSM custom combed cotton for timeless metropolitan wear.',
    ctaText: 'EXPLORE DROP',
    ctaLink: 'shop',
    bgImageUrl: '/assets/images/hero_fashion_model_1792588588825.jpg',
    isActive: true
  },
  {
    id: 'ban-2',
    title: 'TAILORED ARCHITECTURAL LAYERS',
    subtitle: 'Minimalist silhouettes designed and crafted in Dhaka with double-needle reinforcement.',
    ctaText: 'VIEW LOOKBOOK',
    ctaLink: 'shop',
    bgImageUrl: '/assets/images/craftsmanship_factory_1792588594240.jpg',
    isActive: true
  }
];

export const INITIAL_ORDERS: Order[] = [];


export const INITIAL_FINANCIAL_RECORDS: FinancialRecord[] = [
  {
    id: 'fin-001',
    title: '420 GSM French Terry Fabric Roll Procurement',
    amount: 38000,
    type: 'expense',
    date: '2026-10-15',
    category: 'Product purchase or manufacturing costs',
    description: 'Procured 120 kg custom-milled combed ringspun French Terry cotton for winter hoodie batch.',
    createdAt: '2026-10-15T10:00:00.000Z'
  },
  {
    id: 'fin-002',
    title: 'VANTREL Embossed Matte Luxury Packaging & Poly Bags',
    amount: 4500,
    type: 'expense',
    date: '2026-10-18',
    category: 'Packaging',
    description: '500 units custom matte black apparel bags with biodegradable seals and brand cards.',
    createdAt: '2026-10-18T14:30:00.000Z'
  },
  {
    id: 'fin-003',
    title: 'Steadfast & Pathao Courier Prepaid Transit Charge',
    amount: 3200,
    type: 'expense',
    date: '2026-10-20',
    category: 'Delivery and courier charges',
    description: 'Prepaid parcel consignment shipping balance for 35 orders across Bangladesh.',
    createdAt: '2026-10-20T09:15:00.000Z'
  },
  {
    id: 'fin-004',
    title: 'Meta Sponsored Campaign — Winter Drop Reveal',
    amount: 6000,
    type: 'expense',
    date: '2026-10-21',
    category: 'Advertising',
    description: 'Targeted fashion awareness campaign across Dhaka, Chittagong, and Sylhet.',
    createdAt: '2026-10-21T18:00:00.000Z'
  },
  {
    id: 'fin-005',
    title: 'Corporate B2B Custom Polo Bulk Order',
    amount: 45000,
    type: 'income',
    date: '2026-10-22',
    category: 'Other income',
    description: 'Direct institutional supply contract for 25 custom embroidered collar polos.',
    createdAt: '2026-10-22T11:45:00.000Z'
  }
];

export const INITIAL_MODERATORS: StaffModerator[] = [
  {
    id: 'mod-001',
    name: 'Muhammad Yeamin',
    email: 'yeamin@vantrel.com',
    phone: '01711234567',
    role: 'Super Admin',
    status: 'Active',
    assignedDate: '2026-01-01',
    lastActive: 'Just now',
    canManageFinances: true
  },
  {
    id: 'mod-002',
    name: 'Rafiqul Islam',
    email: 'rafiqul@vantrel.com',
    phone: '01811223344',
    role: 'Order Moderator',
    status: 'Active',
    assignedDate: '2026-08-15',
    lastActive: '10 mins ago',
    canManageFinances: false
  },
  {
    id: 'mod-003',
    name: 'Kamrul Hasan',
    email: 'kamrul@vantrel.com',
    phone: '01922334455',
    role: 'Product Moderator',
    status: 'Active',
    assignedDate: '2026-09-01',
    lastActive: '1 hour ago',
    canManageFinances: false
  },
  {
    id: 'mod-004',
    name: 'Nusrat Jahan',
    email: 'nusrat@vantrel.com',
    phone: '01633445566',
    role: 'Finance Moderator',
    status: 'Active',
    assignedDate: '2026-09-20',
    lastActive: 'Yesterday',
    canManageFinances: true
  }
];

export const INITIAL_THEME: ThemeConfig = {
  preset: 'minimal-luxury',
  primaryColor: '#14221C',
  secondaryColor: '#202522',
  accentColor: '#FF762E',
  bgColor: '#F7F5EF',
  cardBg: '#FFFFFF',
  textColor: '#14221C',
  borderColor: '#E5E1D5',
  buttonRadius: 'rounded-xl',
  animationIntensity: 'normal'
};

export const INITIAL_3D_BANNERS: Banner3DConfig[] = [
  {
    id: 'b3d-001',
    badge: 'LIMITED AUTUMN / WINTER DROP',
    title: 'ARCHITECTURAL HEAVYWEIGHT SILHOUETTES',
    subtitle: 'Crafted from 420 GSM custom loopback French terry with double-needle structured drape.',
    description: 'Designed in Dhaka for cool evening layering. Features a structured double-lined hood, hidden phone kangaroo compartment, and tailored drop-shoulder proportions.',
    ctaText: 'SHOP THE DROP',
    ctaLink: 'shop',
    secondaryCtaText: 'LOOKBOOK',
    secondaryCtaLink: 'story',
    bgImageUrl: '/assets/images/hero_fashion_model_1792588588825.jpg',
    productCutoutUrl: '/assets/images/product_premium_hoodie_1792588590406.jpg',
    depthIntensity: 'deep',
    overlayOpacity: 0.45,
    isActive: true
  },
  {
    id: 'b3d-002',
    badge: 'ROYAL HERITAGE EDITION',
    title: 'THE ARTISAN JACQUARD PANJABI',
    subtitle: '100% fine Egyptian Giza cotton with hand-cut mother of pearl buttons.',
    description: 'Traditional grace meets contemporary minimalist streetwear cut. Breathable for Dhaka summer and festive occasions.',
    ctaText: 'DISCOVER PANJABI',
    ctaLink: 'shop',
    secondaryCtaText: 'FABRIC STORY',
    secondaryCtaLink: 'story',
    bgImageUrl: '/assets/images/craftsmanship_factory_1792588594240.jpg',
    productCutoutUrl: '/assets/images/product_minimal_tshirt_1792588591873.jpg',
    depthIntensity: 'ultra',
    overlayOpacity: 0.5,
    isActive: true
  },
  {
    id: 'b3d-003',
    badge: 'EVERYDAY OVERSIZED',
    title: 'RAW ARTISAN COMBED TEES',
    subtitle: '260 GSM breathable heavyweight jersey with reinforced rib collar that never sags.',
    description: 'Available in Ivory Cream, Pitch Black, and Forest Moss. Designed to be your daily uniform for years.',
    ctaText: 'BROWSE TEES',
    ctaLink: 'shop',
    bgImageUrl: '/assets/images/hero_fashion_model_1792588588825.jpg',
    productCutoutUrl: '/assets/images/product_oversized_tee_1792588591424.jpg',
    depthIntensity: 'subtle',
    overlayOpacity: 0.4,
    isActive: true
  }
];



