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

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    slug: 'essential-oversized-t-shirt',
    name: 'Essential Oversized T-Shirt',
    tagline: 'Premium heavyweight combed cotton with relaxed drop shoulders and boxy drape.',
    description: 'Premium quality oversized t-shirt made with 100% cotton. Comfortable, breathable and perfect for everyday wear. Featuring architectural double-needle hem stitching and a 1.25" non-sag ribbed collar.',
    category: 'T-Shirts',
    subCategory: 'Heavyweight Streetwear',
    brand: 'VANTREL',
    sku: 'VT-TS-101',
    regularPrice: 1650,
    discountPrice: 1250,
    discountPercent: 24,
    images: [
      '/assets/aistudio/bbbdd9b6c4ab32413590d25052fec04a0c0a000330301ac6c4dc3a486d928cd5_d56a8fd1.png',
      '/src/assets/images/product_oversized_tee_1792588591424.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Black', hex: '#1C1C1E' },
      { name: 'Cream', hex: '#D9D4C7' },
      { name: 'Charcoal', hex: '#4D5154' }
    ],
    variants: [
      { id: 'v1-m-bk', size: 'M', color: 'Black', colorHex: '#1C1C1E', stock: 25, sku: 'VT-TS-101-M-BK' },
      { id: 'v1-l-bk', size: 'L', color: 'Black', colorHex: '#1C1C1E', stock: 30, sku: 'VT-TS-101-L-BK' },
      { id: 'v1-xl-bk', size: 'XL', color: 'Black', colorHex: '#1C1C1E', stock: 18, sku: 'VT-TS-101-XL-BK' },
      { id: 'v1-xxl-bk', size: 'XXL', color: 'Black', colorHex: '#1C1C1E', stock: 10, sku: 'VT-TS-101-XXL-BK' }
    ],
    fabric: '100% Cotton (260 GSM Heavyweight Jersey)',
    gsm: 260,
    fit: 'Oversized Boxy Silhouette',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-wearing-a-hoodie-in-a-studio-41132-large.mp4',
    measurements: {
      S: { chest: 40, length: 27, sleeve: 8.5, shoulder: 19 },
      M: { chest: 42, length: 28, sleeve: 9, shoulder: 20 },
      L: { chest: 44, length: 29, sleeve: 9.5, shoulder: 21 },
      XL: { chest: 46, length: 30, sleeve: 10, shoulder: 22 },
      XXL: { chest: 48, length: 31, sleeve: 10.5, shoulder: 23 }
    },
    care: [
      '100% Cotton',
      'Oversized Fit',
      'Premium Stitching',
      'Machine Washable'
    ],
    tags: ['T-Shirts', 'Drop Shoulder T-Shirt', 'Basic T-Shirt', 'Popular'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.8,
    reviewCount: 124,
    reviews: [
      {
        id: 'rev-1',
        author: 'Tahmidur Rahman',
        rating: 5,
        date: '2026-10-20',
        comment: '100% cotton fabric feels super premium. Boxy fit is on point.',
        verifiedPurchase: true,
        location: 'Dhaka'
      }
    ],
    totalStock: 98,
    createdDate: '2026-10-01'
  },
  {
    id: 'prod-002',
    slug: 'minimal-logo-t-shirt',
    name: 'Minimal Logo T-Shirt',
    tagline: 'Clean aesthetic with subtle VANTREL tonal chest logo and ultra-soft ringspun cotton.',
    description: 'Everyday refined minimalism. Clean front face with tonal micro-embroidered VANTREL insignia. Engineered with pre-shrunk combed cotton that retains structure wash after wash.',
    category: 'T-Shirts',
    subCategory: 'Minimalist Daily',
    brand: 'VANTREL',
    sku: 'VT-TS-102',
    regularPrice: 1450,
    discountPrice: 1150,
    discountPercent: 21,
    images: [
      '/src/assets/images/product_minimal_white_tee_1793118980970.jpg',
      '/src/assets/images/product_oversized_tee_1792588591424.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'White', hex: '#FAF8F5' },
      { name: 'Charcoal', hex: '#37383B' },
      { name: 'Black', hex: '#161618' }
    ],
    variants: [
      { id: 'v2-m-wh', size: 'M', color: 'White', colorHex: '#FAF8F5', stock: 24, sku: 'VT-TS-102-M-WH' },
      { id: 'v2-l-wh', size: 'L', color: 'White', colorHex: '#FAF8F5', stock: 28, sku: 'VT-TS-102-L-WH' },
      { id: 'v2-xl-wh', size: 'XL', color: 'White', colorHex: '#FAF8F5', stock: 15, sku: 'VT-TS-102-XL-WH' },
      { id: 'v2-xxl-wh', size: 'XXL', color: 'White', colorHex: '#FAF8F5', stock: 8, sku: 'VT-TS-102-XXL-WH' }
    ],
    fabric: '240 GSM 100% Combed Ringspun Cotton',
    gsm: 240,
    fit: 'Standard Relaxed Fit',
    measurements: {
      S: { chest: 39, length: 27, sleeve: 8.5, shoulder: 18.5 },
      M: { chest: 41, length: 28, sleeve: 9, shoulder: 19.5 },
      L: { chest: 43, length: 29, sleeve: 9.5, shoulder: 20.5 },
      XL: { chest: 45, length: 30, sleeve: 10, shoulder: 21.5 },
      XXL: { chest: 47, length: 31, sleeve: 10.5, shoulder: 22.5 }
    },
    care: [
      'Machine wash cold',
      'Do not iron directly on logo print',
      'Tumble dry low'
    ],
    tags: ['T-Shirts', 'Basic T-Shirt', 'Polo Shirt', 'Popular'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 86,
    totalStock: 87,
    createdDate: '2026-10-02'
  },
  {
    id: 'prod-003',
    slug: 'cargo-pants',
    name: 'Cargo Pants',
    tagline: 'Tailored utility cargo pants with 6 reinforced pockets and articulated knee seams.',
    description: 'Constructed from heavy-duty 320 GSM cotton ripstop canvas. Designed with a tailored straight leg, elasticated inner waistband, and deep cargo bellows pockets.',
    category: 'Pants',
    subCategory: 'Utility Streetwear',
    brand: 'VANTREL',
    sku: 'VT-PA-103',
    regularPrice: 2950,
    discountPrice: 2350,
    discountPercent: 20,
    images: [
      '/src/assets/images/product_denim_cargo_1792588592254.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Black', hex: '#1E1F22' },
      { name: 'Khaki', hex: '#3B4134' },
      { name: 'Grey', hex: '#565759' }
    ],
    variants: [
      { id: 'v3-30-bk', size: 'M', color: 'Black', colorHex: '#1E1F22', stock: 10, sku: 'VT-PA-103-30-BK' },
      { id: 'v3-32-bk', size: 'L', color: 'Black', colorHex: '#1E1F22', stock: 25, sku: 'VT-PA-103-32-BK' },
      { id: 'v3-34-bk', size: 'XL', color: 'Black', colorHex: '#1E1F22', stock: 20, sku: 'VT-PA-103-34-BK' },
      { id: 'v3-36-bk', size: 'XXL', color: 'Black', colorHex: '#1E1F22', stock: 8, sku: 'VT-PA-103-36-BK' }
    ],
    fabric: '320 GSM 100% Cotton Canvas Ripstop',
    fit: 'Straight Relaxed Leg with Ankle Adjuster',
    measurements: {
      30: { waist: 30, hip: 39, length: 40, thigh: 24 },
      32: { waist: 32, hip: 41, length: 41, thigh: 25 },
      34: { waist: 34, hip: 43, length: 42, thigh: 26 },
      36: { waist: 36, hip: 45, length: 42.5, thigh: 27 }
    },
    care: ['Machine wash cold', 'Wash inside out', 'Hang to dry'],
    tags: ['Pants', 'Pant', 'Joggers and trouser', 'Cargo', 'Popular'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.8,
    reviewCount: 94,
    totalStock: 63,
    createdDate: '2026-09-25'
  },
  {
    id: 'prod-004',
    slug: 'signature-hoodie',
    name: 'Signature Hoodie',
    tagline: '420 GSM custom loopback French terry with double-needle tailoring and lined hood.',
    description: 'An architectural everyday essential designed for cool Dhaka evenings and effortless urban styling. Crafted from custom-milled 420 GSM loopback cotton, featuring a double-lined structured hood and seamless kangaroo pocket.',
    category: 'Hoodies',
    subCategory: 'Heavyweight Fleece',
    brand: 'VANTREL',
    sku: 'VT-HD-104',
    regularPrice: 3450,
    discountPrice: 2850,
    discountPercent: 17,
    images: [
      '/src/assets/images/product_premium_hoodie_1792588590406.jpg',
      '/src/assets/images/editorial_cream_hoodie_1793118980188.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Charcoal', hex: '#3E4044' },
      { name: 'Forest Pine', hex: '#1F2E26' }
    ],
    variants: [
      { id: 'v4-m-bk', size: 'M', color: 'Black', colorHex: '#111111', stock: 24, sku: 'VT-HD-104-M-BK' },
      { id: 'v4-l-bk', size: 'L', color: 'Black', colorHex: '#111111', stock: 20, sku: 'VT-HD-104-L-BK' },
      { id: 'v4-xl-bk', size: 'XL', color: 'Black', colorHex: '#111111', stock: 14, sku: 'VT-HD-104-XL-BK' },
      { id: 'v4-xxl-bk', size: 'XXL', color: 'Black', colorHex: '#111111', stock: 6, sku: 'VT-HD-104-XXL-BK' }
    ],
    fabric: '420 GSM 100% Combed Ringspun Cotton French Terry',
    gsm: 420,
    fit: 'Relaxed Drop-Shoulder Oversized Silhouette',
    measurements: {
      S: { chest: 44, length: 27.5, sleeve: 24, shoulder: 20 },
      M: { chest: 46, length: 28.5, sleeve: 24.5, shoulder: 21 },
      L: { chest: 48, length: 29.5, sleeve: 25, shoulder: 22 },
      XL: { chest: 50, length: 30.5, sleeve: 25.5, shoulder: 23 },
      XXL: { chest: 52, length: 31.5, sleeve: 26, shoulder: 24 }
    },
    care: ['Machine wash cold inside-out', 'Do not tumble dry', 'Warm iron on reverse'],
    tags: ['Hoodies', 'Solid & Print Hoodie', 'Contrast Hoodie', 'Sweater', 'Sweatshirts', 'Winter Collection', 'Popular'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 152,
    totalStock: 76,
    createdDate: '2026-10-05'
  },
  {
    id: 'prod-005',
    slug: 'classic-panjabi',
    name: 'Classic Panjabi',
    tagline: 'Modern mandarin collar ethnic silhouette tailored from breathable linen-cotton.',
    description: 'A contemporary rethinking of traditional Bangladeshi formalwear. Made from a refined blend of organic linen and long-staple cotton with concealed side pockets and mother-of-pearl buttons.',
    category: 'Panjabi',
    subCategory: 'Classic Ethnic',
    brand: 'VANTREL',
    sku: 'VT-PJ-105',
    regularPrice: 2450,
    discountPrice: 1950,
    discountPercent: 20,
    images: [
      '/src/assets/images/product_panjabi_casual_1792588592268.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Beige', hex: '#EAE6DD' },
      { name: 'Black', hex: '#141416' },
      { name: 'Olive', hex: '#444C3D' }
    ],
    variants: [
      { id: 'v5-38-bg', size: 'M', color: 'Beige', colorHex: '#EAE6DD', stock: 10, sku: 'VT-PJ-105-38-BG' },
      { id: 'v5-40-bg', size: 'L', color: 'Beige', colorHex: '#EAE6DD', stock: 20, sku: 'VT-PJ-105-40-BG' },
      { id: 'v5-42-bg', size: 'XL', color: 'Beige', colorHex: '#EAE6DD', stock: 18, sku: 'VT-PJ-105-42-BG' },
      { id: 'v5-44-bg', size: 'XXL', color: 'Beige', colorHex: '#EAE6DD', stock: 8, sku: 'VT-PJ-105-44-BG' }
    ],
    fabric: '65% Premium Cotton, 35% Belgian Flax Linen',
    fit: 'Tailored Semi-Slim Cut',
    measurements: {
      38: { chest: 40, length: 40, sleeve: 24, shoulder: 17.5 },
      40: { chest: 42, length: 42, sleeve: 24.5, shoulder: 18.5 },
      42: { chest: 44, length: 44, sleeve: 25, shoulder: 19.5 },
      44: { chest: 46, length: 46, sleeve: 25.5, shoulder: 20.5 }
    },
    care: ['Gentle wash', 'Medium steam iron while damp'],
    tags: ['Panjabi', 'Traditional Wear', 'Popular'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 5.0,
    reviewCount: 78,
    totalStock: 56,
    createdDate: '2026-10-06'
  },
  {
    id: 'prod-overcoat-005',
    slug: 'vantrel-merino-wool-blend-overcoat',
    name: 'VANTREL Forest Green Double-Breasted Trench Overcoat',
    tagline: 'Structured tailored overcoat inspired by architectural outerwear minimalism.',
    description: 'A statement outerwear piece featuring structured peaked lapels, deep welt pockets, and a clean belted waistline. Lined with silky cupro for smooth layering over hoodies or tailored shirts.',
    category: 'Jackets',
    subCategory: 'Tailored Outerwear',
    brand: 'VANTREL',
    sku: 'VT-JK-005',
    regularPrice: 7500,
    discountPrice: 6200,
    discountPercent: 17,
    images: [
      '/src/assets/images/hero_fashion_yeamin_1792588589630.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Forest Emerald', hex: '#14221C' },
      { name: 'Camel Tan', hex: '#B59468' }
    ],
    variants: [
      { id: 'v5-m-fe', size: 'M', color: 'Forest Emerald', colorHex: '#14221C', stock: 8, sku: 'VT-JK-005-M-FE' },
      { id: 'v5-l-fe', size: 'L', color: 'Forest Emerald', colorHex: '#14221C', stock: 6, sku: 'VT-JK-005-L-FE' }
    ],
    fabric: '70% Wool, 30% Cashmere-Feel Polyester with 100% Cupro Lining',
    fit: 'Relaxed Tailored Longline Cut',
    care: [
      'Dry clean only',
      'Store in provided VANTREL breathable garment bag',
      'Steam iron only'
    ],
    tags: ['Luxury', 'Winter', 'Overcoat', 'Formal'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: false,
    rating: 4.9,
    reviewCount: 14,
    reviews: [
      {
        id: 'rev-6',
        author: 'Maisha Anam',
        rating: 5,
        date: '2026-10-18',
        comment: 'Astonishing silhouette. The color in real life is deep and luxurious. International designer quality.',
        verifiedPurchase: true,
        location: 'Dhaka'
      }
    ],
    totalStock: 19,
    createdDate: '2026-10-09'
  },
  {
    id: 'prod-006',
    slug: 'vantrel-oxford-relaxed-casual-shirt',
    name: 'VANTREL Oxford Weave Everyday Relaxed Shirt',
    tagline: '100% yarn-dyed organic pinpoint Oxford cotton with curved hemline.',
    description: 'A versatile wardrobe cornerstone that moves seamlessly from creative studio meetings to weekend hangouts. Cut in a contemporary relaxed fit with mother-of-pearl buttons, a reinforced back yoke box pleat, and clean single-chest pocket.',
    category: 'Shirts',
    subCategory: 'Oxford Cotton',
    brand: 'VANTREL',
    sku: 'VT-SH-006',
    regularPrice: 2200,
    discountPrice: 1850,
    discountPercent: 16,
    images: [
      '/src/assets/images/product_panjabi_casual_1792588592268.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Chalk White', hex: '#FDFCFA' },
      { name: 'Sky Chambray', hex: '#B8CEDB' },
      { name: 'Olive Green', hex: '#2F3C31' }
    ],
    variants: [
      { id: 'v6-m-cw', size: 'M', color: 'Chalk White', colorHex: '#FDFCFA', stock: 22, sku: 'VT-SH-006-M-CW' },
      { id: 'v6-l-cw', size: 'L', color: 'Chalk White', colorHex: '#FDFCFA', stock: 18, sku: 'VT-SH-006-L-CW' },
      { id: 'v6-xl-cw', size: 'XL', color: 'Chalk White', colorHex: '#FDFCFA', stock: 10, sku: 'VT-SH-006-XL-CW' }
    ],
    fabric: '100% Long-Staple Combed Cotton Pinpoint Oxford',
    fit: 'Modern Relaxed Casual Fit',
    care: ['Warm machine wash with like colors', 'Tumble dry low', 'Warm iron while damp'],
    tags: ['Office', 'Casual', 'Oxford', 'Minimalist'],
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: true,
    rating: 4.7,
    reviewCount: 31,
    totalStock: 62,
    createdDate: '2026-09-15'
  },
  {
    id: 'prod-007',
    slug: 'vantrel-heavyweight-cargo-pants',
    name: 'VANTREL Tactical Utility Canvas Relaxed Cargo Pants',
    tagline: '320 GSM rugged cotton ripstop with articulated knee darts and 6 deep utility pockets.',
    description: 'Designed for utilitarian aesthetics and functional durability. Features deep side bellows pockets with magnetic closures, adjustable cinch cuffs at the ankle, and an elasticated rear waistband for tailored comfort.',
    category: 'Pants',
    subCategory: 'Utility Cargo',
    brand: 'VANTREL',
    sku: 'VT-PA-007',
    regularPrice: 2950,
    discountPrice: 2450,
    discountPercent: 17,
    images: [
      '/src/assets/images/product_denim_cargo_1792588592254.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Dark Charcoal', hex: '#202522' },
      { name: 'Military Khaki', hex: '#6B6858' }
    ],
    variants: [
      { id: 'v7-30-dc', size: 'M', color: 'Dark Charcoal', colorHex: '#202522', stock: 10, sku: 'VT-PA-007-30-DC' },
      { id: 'v7-32-dc', size: 'L', color: 'Dark Charcoal', colorHex: '#202522', stock: 25, sku: 'VT-PA-007-32-DC' },
      { id: 'v7-34-dc', size: 'XL', color: 'Dark Charcoal', colorHex: '#202522', stock: 20, sku: 'VT-PA-007-34-DC' },
      { id: 'v7-36-dc', size: 'XXL', color: 'Dark Charcoal', colorHex: '#202522', stock: 7, sku: 'VT-PA-007-36-DC' }
    ],
    fabric: '320 GSM 100% Cotton Canvas Ripstop',
    fit: 'Relaxed Tapered Fit with Ankle Cinch',
    care: ['Machine wash cold', 'Wash with similar colors', 'Do not bleach'],
    tags: ['Streetwear', 'Cargo', 'Utility', 'Pants'],
    isFeatured: false,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.8,
    reviewCount: 43,
    totalStock: 62,
    createdDate: '2026-10-04'
  },
  {
    id: 'prod-008',
    slug: 'vantrel-heavyweight-tote-bag',
    name: 'VANTREL Artisan Heavyweight 16oz Canvas Tote',
    tagline: 'Reinforced cross-stitch handles with internal laptop sleeve and zipper pocket.',
    description: 'An everyday companion for work, travel, and campus life. Built from durable 16oz untreated cotton canvas with reinforced box-stitching, inner water bottle sleeve, and embossed VANTREL leather insignia tag.',
    category: 'Accessories',
    subCategory: 'Canvas Bags',
    brand: 'VANTREL',
    sku: 'VT-AC-008',
    regularPrice: 1200,
    discountPrice: 950,
    discountPercent: 21,
    images: [
      '/src/assets/images/product_oversized_tee_1792588591424.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Natural Ecru', hex: '#F2EEE5' },
      { name: 'Forest Noir', hex: '#14221C' }
    ],
    variants: [
      { id: 'v8-os-ne', size: 'M', color: 'Natural Ecru', colorHex: '#F2EEE5', stock: 40, sku: 'VT-AC-008-OS-NE' },
      { id: 'v8-os-fn', size: 'M', color: 'Forest Noir', colorHex: '#14221C', stock: 25, sku: 'VT-AC-008-OS-FN' }
    ],
    fabric: '16oz Heavy Unbleached Cotton Canvas',
    fit: '20L Capacity (Fits up to 16-inch laptops)',
    care: ['Spot clean with damp cloth', 'Do not machine wash or soak'],
    tags: ['Accessories', 'Bags', 'Eco-friendly'],
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 19,
    totalStock: 65,
    createdDate: '2026-09-20'
  },
  {
    id: 'prod-009',
    slug: 'vantrel-royal-jacquard-slim-panjabi',
    name: 'VANTREL Royal Jacquard Festive Slim-Fit Panjabi',
    tagline: 'Custom woven jacquard cotton with understated luster and metal engraved snap buttons.',
    description: 'An immaculate ethnic silhouette designed for Eid and festive evening occasions in Bangladesh. Crafted from 100% fine combed jacquard cotton with subtle micro-geometric patterns, tailored cuffs, and side slit pockets.',
    category: 'Panjabi',
    subCategory: 'Royal Festive',
    brand: 'VANTREL',
    sku: 'VT-PJ-009',
    regularPrice: 3800,
    discountPrice: 3250,
    discountPercent: 14,
    images: [
      '/src/assets/images/product_panjabi_casual_1792588592268.jpg'
    ],
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-wearing-a-hoodie-in-a-studio-41132-large.mp4',
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Onyx Midnight', hex: '#1C1C1E' },
      { name: 'Pure Chalk White', hex: '#FDFCFA' },
      { name: 'Royal Emerald', hex: '#14221C' }
    ],
    variants: [
      { id: 'v9-38-om', size: 'M', color: 'Onyx Midnight', colorHex: '#1C1C1E', stock: 12, sku: 'VT-PJ-009-38-OM' },
      { id: 'v9-40-om', size: 'L', color: 'Onyx Midnight', colorHex: '#1C1C1E', stock: 24, sku: 'VT-PJ-009-40-OM' },
      { id: 'v9-42-om', size: 'XL', color: 'Onyx Midnight', colorHex: '#1C1C1E', stock: 18, sku: 'VT-PJ-009-42-OM' },
      { id: 'v9-44-om', size: 'XXL', color: 'Onyx Midnight', colorHex: '#1C1C1E', stock: 8, sku: 'VT-PJ-009-44-OM' }
    ],
    fabric: '100% Organic Micro-Jacquard Combed Cotton (Preshrunk)',
    gsm: 210,
    fit: 'Tailored Semi-Slim Ethnic Fit',
    measurements: {
      '38': { chest: 40, length: 40, sleeve: 24.5, shoulder: 17.5 },
      '40': { chest: 42, length: 42, sleeve: 25, shoulder: 18 },
      '42': { chest: 44, length: 44, sleeve: 25.5, shoulder: 18.5 },
      '44': { chest: 46, length: 45, sleeve: 26, shoulder: 19 }
    },
    care: [
      'Gentle cold wash with mild detergent',
      'Medium steam iron while damp',
      'Do not wring or tumble dry'
    ],
    tags: ['Panjabi', 'Festive', 'Traditional', 'Eid'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 34,
    reviews: [
      {
        id: 'rev-901',
        author: 'Saadman Sakib',
        rating: 5,
        date: '2026-10-19',
        comment: 'Wore this for an engagement party. The subtle jacquard texture is ultra classy. 40 size fit me impeccably.',
        verifiedPurchase: true,
        location: 'Dhaka',
        photos: ['/src/assets/images/product_panjabi_casual_1792588592268.jpg']
      }
    ],
    totalStock: 62,
    createdDate: '2026-10-15'
  },
  {
    id: 'prod-010',
    slug: 'vantrel-womens-boxy-cropped-crewneck',
    name: "VANTREL Women's 380 GSM Heavy Boxy Crop Crewneck",
    tagline: 'Drop shoulder relaxed feminine cut with wide ribbed hem and cuffs.',
    description: "An architectural everyday essential cut specifically for women. Featuring an exaggerated drop-shoulder drape, raw-look reinforced seam details, and heavyweight loopback fleece that drapes with minimalist elegance.",
    category: 'Women',
    subCategory: 'Crop Loungewear',
    brand: 'VANTREL',
    sku: 'VT-WM-010',
    regularPrice: 2600,
    discountPrice: 2150,
    discountPercent: 17,
    images: [
      '/src/assets/images/product_oversized_tee_1792588591424.jpg'
    ],
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-wearing-a-hoodie-in-a-studio-41132-large.mp4',
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Oatmeal Heather', hex: '#DED8CB' },
      { name: 'Forest Noir', hex: '#14221C' }
    ],
    variants: [
      { id: 'v10-m-oh', size: 'M', color: 'Oatmeal Heather', colorHex: '#DED8CB', stock: 15, sku: 'VT-WM-010-M-OH' },
      { id: 'v10-l-oh', size: 'L', color: 'Oatmeal Heather', colorHex: '#DED8CB', stock: 8, sku: 'VT-WM-010-L-OH' }
    ],
    fabric: '380 GSM 100% Combed Ringspun Cotton French Terry',
    gsm: 380,
    fit: 'Boxy Cropped Silhouette with Drop Shoulders',
    measurements: {
      XS: { chest: 40, length: 19.5, sleeve: 22, shoulder: 19 },
      S: { chest: 42, length: 20.5, sleeve: 22.5, shoulder: 20 },
      M: { chest: 44, length: 21.5, sleeve: 23, shoulder: 21 },
      L: { chest: 46, length: 22.5, sleeve: 23.5, shoulder: 22 }
    },
    care: [
      'Machine wash cold gentle cycle',
      'Wash inside out',
      'Dry flat in shade'
    ],
    tags: ['Women', 'Streetwear', 'Cropped', 'Heavyweight'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: false,
    rating: 4.8,
    reviewCount: 16,
    reviews: [
      {
        id: 'rev-1001',
        author: 'Nabila Farzana',
        rating: 5,
        date: '2026-10-18',
        comment: 'Finally a brand doing real heavyweight cotton for women in BD! Sits so well above high-waist pants.',
        verifiedPurchase: true,
        location: 'Dhaka'
      }
    ],
    totalStock: 53,
    createdDate: '2026-10-12'
  },
  {
    id: 'prod-011',
    slug: 'vantrel-junior-heavy-cotton-hoodie',
    name: 'VANTREL Junior 340 GSM Heavy Cotton Pullover Hoodie',
    tagline: 'Kid-friendly ultra-soft brushed interior with no-pinch metal-free aglets.',
    description: 'Miniature version of our signature heavyweight hoodie designed specifically for youngsters. Zero itchy seams, brushed organic fleece lining, and reinforced double elbows for playtime durability.',
    category: 'Kids',
    subCategory: 'Junior Streetwear',
    brand: 'VANTREL',
    sku: 'VT-KD-011',
    regularPrice: 1900,
    discountPrice: 1550,
    discountPercent: 18,
    images: [
      '/src/assets/images/product_premium_hoodie_1792588590406.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Pine Green', hex: '#14221C' },
      { name: 'Warm Cream', hex: '#F7F5EF' }
    ],
    variants: [
      { id: 'v11-46-pg', size: 'M', color: 'Pine Green', colorHex: '#14221C', stock: 15, sku: 'VT-KD-011-46-PG' },
      { id: 'v11-68-pg', size: 'L', color: 'Pine Green', colorHex: '#14221C', stock: 20, sku: 'VT-KD-011-68-PG' },
      { id: 'v11-810-pg', size: 'XL', color: 'Pine Green', colorHex: '#14221C', stock: 18, sku: 'VT-KD-011-810-PG' },
      { id: 'v11-1012-pg', size: 'XXL', color: 'Pine Green', colorHex: '#14221C', stock: 12, sku: 'VT-KD-011-1012-PG' }
    ],
    fabric: '340 GSM 100% Organic Combed Ringspun Cotton (Anti-Pilling)',
    gsm: 340,
    fit: 'Comfort Regular Fit for Growing Kids',
    measurements: {
      '4-6Y': { chest: 30, length: 18, sleeve: 16, shoulder: 13 },
      '6-8Y': { chest: 32, length: 19.5, sleeve: 17.5, shoulder: 14 },
      '8-10Y': { chest: 34, length: 21, sleeve: 19, shoulder: 15 },
      '10-12Y': { chest: 36, length: 22.5, sleeve: 20.5, shoulder: 16 }
    },
    care: [
      'Machine wash warm',
      'Safe for tumble drying low',
      'Do not bleach'
    ],
    tags: ['Kids', 'Junior', 'Hoodie', 'Organic Cotton'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 22,
    totalStock: 65,
    createdDate: '2026-10-10'
  },
  {
    id: 'prod-012',
    slug: 'vantrel-sherpa-thermal-overshirt',
    name: 'VANTREL Sherpa-Lined Thermal Heavy Overshirt',
    tagline: '450 GSM winter fleece exterior with plush faux-shearling lining for chilly evenings.',
    description: 'Engineered for crisp winter nights in Bangladesh. Can be worn as a structured jacket or an overshirt. Features dual button-flap chest pockets, snap front placket, and deep hand-warmer side welt pockets.',
    category: 'Winter Collection',
    subCategory: 'Sherpa Outerwear',
    brand: 'VANTREL',
    sku: 'VT-WN-012',
    regularPrice: 4200,
    discountPrice: 3450,
    discountPercent: 18,
    images: [
      '/src/assets/images/hero_fashion_yeamin_1792588589630.jpg'
    ],
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-wearing-a-hoodie-in-a-studio-41132-large.mp4',
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Dark Moss', hex: '#2A342B' },
      { name: 'Charcoal Black', hex: '#202522' }
    ],
    variants: [
      { id: 'v12-m-dm', size: 'M', color: 'Dark Moss', colorHex: '#2A342B', stock: 16, sku: 'VT-WN-012-M-DM' },
      { id: 'v12-l-dm', size: 'L', color: 'Dark Moss', colorHex: '#2A342B', stock: 14, sku: 'VT-WN-012-L-DM' },
      { id: 'v12-xl-dm', size: 'XL', color: 'Dark Moss', colorHex: '#2A342B', stock: 6, sku: 'VT-WN-012-XL-DM' }
    ],
    fabric: '450 GSM Thermal Cotton-Poly Fleece with Deep Pile Sherpa Lining',
    gsm: 450,
    fit: 'Relaxed Layering Fit',
    measurements: {
      S: { chest: 45, length: 29, sleeve: 24.5, shoulder: 20 },
      M: { chest: 47, length: 30, sleeve: 25, shoulder: 21 },
      L: { chest: 49, length: 31, sleeve: 25.5, shoulder: 22 },
      XL: { chest: 51, length: 32, sleeve: 26, shoulder: 23 }
    },
    care: [
      'Machine wash cold gentle cycle',
      'Air dry flat',
      'Do not iron sherpa fleece directly'
    ],
    tags: ['Winter', 'Sherpa', 'Overshirt', 'Warm', 'Heavyweight'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 5.0,
    reviewCount: 27,
    totalStock: 44,
    createdDate: '2026-10-14'
  },
  {
    id: 'prod-013',
    slug: 'vantrel-signature-knit-ribbed-crewneck-sweater',
    name: 'VANTREL Signature Knit Ribbed Crewneck Sweater',
    tagline: 'Pure Australian Merino blend with architectural ribbing and thermo-regulating comfort.',
    description: 'An essential for sophisticated winter elegance in Bangladesh. Spun from fine-gauge merino-cotton blend, offering insulating warmth without bulk. Features ribbed collar, cuffs, and hem engineered to resist warping.',
    category: 'Sweater',
    subCategory: 'Knitwear',
    brand: 'VANTREL',
    sku: 'VT-SW-013',
    regularPrice: 2850,
    discountPrice: 2450,
    discountPercent: 14,
    images: [
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1000&q=80'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Oatmeal Heather', hex: '#D2C8B8' },
      { name: 'Forest Pine', hex: '#14221C' },
      { name: 'Pitch Black', hex: '#181A19' }
    ],
    variants: [
      { id: 'v13-m-oh', size: 'M', color: 'Oatmeal Heather', colorHex: '#D2C8B8', stock: 25, sku: 'VT-SW-013-M-OH' },
      { id: 'v13-l-oh', size: 'L', color: 'Oatmeal Heather', colorHex: '#D2C8B8', stock: 20, sku: 'VT-SW-013-L-OH' },
      { id: 'v13-xl-oh', size: 'XL', color: 'Oatmeal Heather', colorHex: '#D2C8B8', stock: 10, sku: 'VT-SW-013-XL-OH' }
    ],
    fabric: '70% Australian Merino Blend, 30% Combed Ringspun Cotton',
    fit: 'Modern Regular Fit',
    care: ['Hand wash cold or gentle machine wool cycle', 'Dry flat', 'Do not wring'],
    tags: ['Sweater', 'Winter', 'Merino', 'Knitwear', 'Best Collection'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 31,
    totalStock: 70,
    createdDate: '2026-10-22'
  },
  {
    id: 'prod-014',
    slug: 'vantrel-minimalist-drop-shoulder-fleece-sweatshirt',
    name: 'VANTREL Minimalist Drop-Shoulder Heavy Fleece Sweatshirt',
    tagline: '380 GSM brushed interior fleece with clean tonal high-density chest embroidery.',
    description: 'Designed for effortless Dhaka street style. Custom milled 380 GSM heavyweight cotton fleece with an ultra-soft brushed peach skin interior. Double-needle coverstitched seams for lifetime durability.',
    category: 'Sweatshirt',
    subCategory: 'Streetwear Fleece',
    brand: 'VANTREL',
    sku: 'VT-SS-014',
    regularPrice: 2600,
    discountPrice: 2200,
    discountPercent: 15,
    images: [
      'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Charcoal Shadow', hex: '#202522' },
      { name: 'Sage Moss', hex: '#4A5B4C' }
    ],
    variants: [
      { id: 'v14-m-cs', size: 'M', color: 'Charcoal Shadow', colorHex: '#202522', stock: 22, sku: 'VT-SS-014-M-CS' },
      { id: 'v14-l-cs', size: 'L', color: 'Charcoal Shadow', colorHex: '#202522', stock: 18, sku: 'VT-SS-014-L-CS' },
      { id: 'v14-xl-cs', size: 'XL', color: 'Charcoal Shadow', colorHex: '#202522', stock: 10, sku: 'VT-SS-014-XL-CS' }
    ],
    fabric: '380 GSM 100% Combed Heavy Cotton Fleece',
    gsm: 380,
    fit: 'Relaxed Drop-Shoulder Fit',
    care: ['Machine wash cold inside-out', 'Tumble dry low or air dry'],
    tags: ['Sweatshirt', 'Fleece', 'Heavyweight', 'Winter', 'Best Collection'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.8,
    reviewCount: 19,
    totalStock: 62,
    createdDate: '2026-10-23'
  },
  {
    id: 'prod-015',
    slug: 'vantrel-240-gsm-combed-cotton-long-sleeve-tshirt',
    name: 'VANTREL 240 GSM Combed Cotton Long Sleeve T-Shirt',
    tagline: 'High-density heavyweight jersey with 1.2" snug ribbed wrist cuffs that never sag.',
    description: 'An architectural everyday base-layer. Engineered from 240 GSM single-jersey combed cotton with bio-wash silicone finishing for supreme touch and non-sheer structural drape.',
    category: 'Long Sleeve T-Shirt',
    subCategory: 'Heavyweight Long Sleeve',
    brand: 'VANTREL',
    sku: 'VT-LST-015',
    regularPrice: 1650,
    discountPrice: 1350,
    discountPercent: 18,
    images: [
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1000&q=80'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Off-White Ivory', hex: '#EDE8D5' },
      { name: 'Forest Pine', hex: '#14221C' },
      { name: 'Pitch Black', hex: '#181A19' }
    ],
    variants: [
      { id: 'v15-m-iv', size: 'M', color: 'Off-White Ivory', colorHex: '#EDE8D5', stock: 30, sku: 'VT-LST-015-M-IV' },
      { id: 'v15-l-iv', size: 'L', color: 'Off-White Ivory', colorHex: '#EDE8D5', stock: 25, sku: 'VT-LST-015-L-IV' },
      { id: 'v15-xl-iv', size: 'XL', color: 'Off-White Ivory', colorHex: '#EDE8D5', stock: 15, sku: 'VT-LST-015-XL-IV' }
    ],
    fabric: '240 GSM 100% Combed Ringspun Bio-Washed Cotton',
    gsm: 240,
    fit: 'Tailored Boxy Fit',
    care: ['Machine wash warm', 'Do not tumble dry'],
    tags: ['Long Sleeve', 'T-Shirt', 'Combed Cotton', 'Daily Wear', 'Best Collection'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 42,
    totalStock: 90,
    createdDate: '2026-10-24'
  },
  {
    id: 'prod-016',
    slug: 'vantrel-dual-tone-heavy-waffle-long-sleeve-set',
    name: 'VANTREL Dual-Tone Heavy Waffle Long Sleeve Lounge Set',
    tagline: 'Matching waffle knit long sleeve top and relaxed tapered cuffed lounge pants.',
    description: 'The pinnacle of luxury home and winter street lounge co-ords. Features 320 GSM thermal honeycomb waffle fabric that traps heat while maintaining maximum airflow and drape.',
    category: 'Long Sleeve Set',
    subCategory: 'Co-ord Sets',
    brand: 'VANTREL',
    sku: 'VT-LSS-016',
    regularPrice: 4200,
    discountPrice: 3650,
    discountPercent: 13,
    images: [
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Muted Taupe', hex: '#8A8275' },
      { name: 'Deep Olive', hex: '#2A342B' }
    ],
    variants: [
      { id: 'v16-m-mt', size: 'M', color: 'Muted Taupe', colorHex: '#8A8275', stock: 14, sku: 'VT-LSS-016-M-MT' },
      { id: 'v16-l-mt', size: 'L', color: 'Muted Taupe', colorHex: '#8A8275', stock: 18, sku: 'VT-LSS-016-L-MT' },
      { id: 'v16-xl-mt', size: 'XL', color: 'Muted Taupe', colorHex: '#8A8275', stock: 10, sku: 'VT-LSS-016-XL-MT' }
    ],
    fabric: '320 GSM 100% Thermal Honeycomb Cotton Waffle',
    gsm: 320,
    fit: 'Relaxed Tailored Two-Piece Set',
    care: ['Gentle cycle wash cold', 'Lay flat to dry to preserve knit shape'],
    tags: ['Long Sleeve Set', 'Co-ord', 'Waffle', 'Lounge', 'Best Collection'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 5.0,
    reviewCount: 16,
    totalStock: 42,
    createdDate: '2026-10-24'
  },
  {
    id: 'prod-017',
    slug: 'vantrel-relaxed-pleated-chino-tailored-pants',
    name: 'VANTREL Relaxed Pleated Chino Tailored Pants',
    tagline: 'High-density cotton twill with front single pleat and subtle tapered ankle break.',
    description: 'An elevated pant designed to pair seamlessly with VANTREL sweaters and oversized tees. Features double-button waistband fastening, genuine YKK brass zipper, deep side welt pockets, and rear flap pockets.',
    category: 'Pants',
    subCategory: 'Tailored Trousers',
    brand: 'VANTREL',
    sku: 'VT-PNT-017',
    regularPrice: 2950,
    discountPrice: 2550,
    discountPercent: 14,
    images: [
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1000&q=80'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Dark Moss Khaki', hex: '#3E4438' },
      { name: 'Charcoal Black', hex: '#202522' }
    ],
    variants: [
      { id: 'v17-30-dm', size: 'M', color: 'Dark Moss Khaki', colorHex: '#3E4438', stock: 10, sku: 'VT-PNT-017-30-DM' },
      { id: 'v17-32-dm', size: 'L', color: 'Dark Moss Khaki', colorHex: '#3E4438', stock: 18, sku: 'VT-PNT-017-32-DM' },
      { id: 'v17-34-dm', size: 'XL', color: 'Dark Moss Khaki', colorHex: '#3E4438', stock: 16, sku: 'VT-PNT-017-34-DM' },
      { id: 'v17-36-dm', size: 'XXL', color: 'Dark Moss Khaki', colorHex: '#3E4438', stock: 8, sku: 'VT-PNT-017-36-DM' }
    ],
    fabric: '280 GSM 98% Combed Cotton Twill, 2% Elastane Flex',
    gsm: 280,
    fit: 'Relaxed Tapered Pleated Cut',
    care: ['Machine wash cold inside-out', 'Warm iron'],
    tags: ['Pants', 'Chino', 'Pleated', 'Formal Casual', 'Best Collection'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.8,
    reviewCount: 23,
    totalStock: 52,
    createdDate: '2026-10-25'
  },
  {
    id: 'prod-018',
    slug: 'vantrel-heavyweight-urban-cargo-joggers-and-trousers',
    name: 'VANTREL Heavyweight Urban Cargo Joggers and Trousers',
    tagline: 'Dual-utility cargo bellows pockets with custom metal hardware and elasticated ankle cinch.',
    description: 'Designed for rugged urban mobility. Combines the refined drape of tailored trousers with the street-ready utility of joggers. Equipped with 6 tactical pockets and an adjustable drawcord waistband.',
    category: 'Joggers and Trousers',
    subCategory: 'Tactical Streetwear',
    brand: 'VANTREL',
    sku: 'VT-JOG-018',
    regularPrice: 2750,
    discountPrice: 2350,
    discountPercent: 15,
    images: [
      '/src/assets/images/product_denim_cargo_1792588592254.jpg'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Tactical Forest Pine', hex: '#14221C' },
      { name: 'Onyx Black', hex: '#1C1E1D' }
    ],
    variants: [
      { id: 'v18-m-tf', size: 'M', color: 'Tactical Forest Pine', colorHex: '#14221C', stock: 15, sku: 'VT-JOG-018-M-TF' },
      { id: 'v18-l-tf', size: 'L', color: 'Tactical Forest Pine', colorHex: '#14221C', stock: 22, sku: 'VT-JOG-018-L-TF' },
      { id: 'v18-xl-tf', size: 'XL', color: 'Tactical Forest Pine', colorHex: '#14221C', stock: 18, sku: 'VT-JOG-018-XL-TF' },
      { id: 'v18-xxl-tf', size: 'XXL', color: 'Tactical Forest Pine', colorHex: '#14221C', stock: 8, sku: 'VT-JOG-018-XXL-TF' }
    ],
    fabric: '340 GSM Heavy Cotton Canvas Weave with Soft Pre-wash',
    gsm: 340,
    fit: 'Tapered Utility Jogger Fit',
    care: ['Machine wash cold', 'Do not tumble dry'],
    tags: ['Joggers and Trousers', 'Joggers', 'Cargo', 'Tactical', 'Best Collection'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 37,
    totalStock: 63,
    createdDate: '2026-10-25'
  },
  {
    id: 'prod-019',
    slug: 'vantrel-gents-merino-wool-winter-accessories-combo',
    name: 'VANTREL Gents Merino Wool Winter Muffler, Cap & Touch Gloves Set',
    tagline: '3-Piece matching gentlemen winter accessory bundle crafted from ultra-soft spun wool.',
    description: 'Keep warm throughout winter travels with this essential 3-piece gift set. Includes a 180cm fringeless rib-knit muffler, a structured turn-up beanie cap, and smartphone touch-screen conductive gloves.',
    category: 'Gents Winter Accessories',
    subCategory: 'Winter Accessories',
    brand: 'VANTREL',
    sku: 'VT-ACC-019',
    regularPrice: 2100,
    discountPrice: 1750,
    discountPercent: 17,
    images: [
      'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=1000&q=80'
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Charcoal Black', hex: '#202522' },
      { name: 'Forest Moss', hex: '#14221C' },
      { name: 'Camel Tan', hex: '#B89B72' }
    ],
    variants: [
      { id: 'v19-os-cb', size: 'M', color: 'Charcoal Black', colorHex: '#202522', stock: 25, sku: 'VT-ACC-019-OS-CB' },
      { id: 'v19-os-fm', size: 'M', color: 'Forest Moss', colorHex: '#14221C', stock: 20, sku: 'VT-ACC-019-OS-FM' },
      { id: 'v19-os-ct', size: 'M', color: 'Camel Tan', colorHex: '#B89B72', stock: 15, sku: 'VT-ACC-019-OS-CT' }
    ],
    fabric: '80% Fine Spun Wool, 20% Anti-Pilling Acrylic',
    fit: 'Universal Ergonomic Fit',
    care: ['Hand wash cold with wool detergent', 'Dry flat away from direct heat'],
    tags: ['Gents Winter Accessories', 'Muffler', 'Beanie', 'Gloves', 'Gift Set', 'Best Collection'],
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: true,
    rating: 5.0,
    reviewCount: 45,
    totalStock: 60,
    createdDate: '2026-10-26'
  }
];

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
  storeName: 'VANTREL',
  slogan: 'Define Your Narrative.',
  announcementText: '✨ VANTREL LUXURY MENSWEAR | INSIDE DHAKA ৳70 · OUTSIDE DHAKA ৳120 | COD & bKash',
  deliveryFeeInsideDhaka: 70,
  deliveryFeeOutsideDhaka: 120,
  deliveryFeeRemote: 140,
  deliveryFeeExpress: 110,
  freeShippingThreshold: 3000,
  confirmationWindowMinutes: 15, // Window to cancel before auto customer-confirmation
  phone: '',
  whatsapp: 'https://wa.me/message/E6PISGJZC63TA1',
  whatsappUrl: 'https://wa.me/message/E6PISGJZC63TA1',
  facebookUrl: 'https://www.facebook.com/share/18qNnMStUm/',
  email: 'concierge@vantrel.com',
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
  smsSenderId: 'VANTREL',
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
    bgImageUrl: '/src/assets/images/hero_fashion_model_1792588588825.jpg',
    isActive: true
  },
  {
    id: 'ban-2',
    title: 'TAILORED ARCHITECTURAL LAYERS',
    subtitle: 'Minimalist silhouettes designed and crafted in Dhaka with double-needle reinforcement.',
    ctaText: 'VIEW LOOKBOOK',
    ctaLink: 'shop',
    bgImageUrl: '/src/assets/images/craftsmanship_factory_1792588594240.jpg',
    isActive: true
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'VT-89241',
    customer: {
      fullName: 'Muhammad Yeamin',
      phone: '01711234567',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Banani',
      streetAddress: 'House 42, Road 11, Block D, Banani'
    },
    items: [
      {
        id: 'item-1',
        productId: 'prod-001',
        name: 'VANTREL Signature Heavyweight Pine Hoodie',
        slug: 'vantrel-heavyweight-pine-hoodie',
        image: '/src/assets/images/product_premium_hoodie_1792588590406.jpg',
        size: 'L',
        color: 'Forest Pine',
        price: 2650,
        regularPrice: 3200,
        quantity: 1,
        maxStock: 20,
        sku: 'VT-HD-001-L-FP'
      }
    ],
    subtotal: 2650,
    deliveryFee: 70,
    deliveryCharge: 70,
    total: 2720,
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'Pending',
    orderStatus: 'Awaiting Staff Approval',
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    customerConfirmationDeadline: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    confirmationDeadline: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    statusHistory: [
      {
        status: 'Pending Customer Confirmation',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        note: 'Order placed by customer via Cash on Delivery'
      },
      {
        status: 'Awaiting Staff Approval',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        note: '15-min customer cancellation window elapsed. Pushed to staff review.'
      }
    ]
  },
  {
    id: 'ord-102',
    orderNumber: 'VT-89190',
    customer: {
      fullName: 'Tahmidur Rahman',
      phone: '01812345678',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Uttara',
      streetAddress: 'Sector 4, Road 12, Uttara, Dhaka'
    },
    items: [
      {
        id: 'item-2',
        productId: 'prod-002',
        name: 'Minimalist Heavy Cotton Oversized Tee',
        slug: 'minimalist-heavy-cotton-oversized-tee',
        image: '/src/assets/images/product_minimal_tshirt_1792588591873.jpg',
        size: 'M',
        color: 'Off-White Ivory',
        price: 1350,
        regularPrice: 1600,
        quantity: 2,
        maxStock: 30,
        sku: 'VT-TS-002-M-IV'
      }
    ],
    subtotal: 2700,
    deliveryFee: 70,
    deliveryCharge: 70,
    total: 2770,
    paymentMethod: 'bKash',
    paymentStatus: 'Paid',
    orderStatus: 'Order Confirmed',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    statusHistory: [
      {
        status: 'Order Confirmed',
        timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        note: 'Payment verified via bKash Merchant Gateway. Approved by staff.'
      }
    ]
  }
];

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
    bgImageUrl: '/src/assets/images/hero_fashion_model_1792588588825.jpg',
    productCutoutUrl: '/src/assets/images/product_premium_hoodie_1792588590406.jpg',
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
    bgImageUrl: '/src/assets/images/craftsmanship_factory_1792588594240.jpg',
    productCutoutUrl: '/src/assets/images/product_minimal_tshirt_1792588591873.jpg',
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
    bgImageUrl: '/src/assets/images/hero_fashion_model_1792588588825.jpg',
    productCutoutUrl: '/src/assets/images/product_oversized_tee_1792588591424.jpg',
    depthIntensity: 'subtle',
    overlayOpacity: 0.4,
    isActive: true
  }
];



