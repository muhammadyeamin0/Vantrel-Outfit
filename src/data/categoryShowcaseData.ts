import { ProductCategory } from '../types';

export interface CategoryShowcaseItem {
  id: string;
  title: string;
  banglaTitle: string;
  count: number;
  categoryKey: ProductCategory;
  filterKeywords: string[];
  image: string;
  section: 'casual' | 'winter';
}

// 1. Casual & Shirts Strip (From Screenshot 1)
export const CASUAL_CATEGORIES: CategoryShowcaseItem[] = [
  {
    id: 'polo-shirt',
    title: 'Polo Shirt',
    banglaTitle: 'পোলো শার্ট',
    count: 465,
    categoryKey: 'Polo Shirts',
    filterKeywords: ['polo', 'collar', 'pique'],
    image: 'https://images.unsplash.com/photo-1625910513413-562a1fc8f813?auto=format&fit=crop&w=500&q=80',
    section: 'casual'
  },
  {
    id: 'drop-shoulder-tshirt',
    title: 'Drop Shoulder T-Shirt',
    banglaTitle: 'ড্রপ শোল্ডার টি-শার্ট',
    count: 471,
    categoryKey: 'T-Shirts',
    filterKeywords: ['drop shoulder', 'oversized', 'box tee'],
    image: '/src/assets/images/product_oversized_tee_1792588591424.jpg',
    section: 'casual'
  },
  {
    id: 'basic-tshirt',
    title: 'Basic T-Shirt',
    banglaTitle: 'বেসিক টি-শার্ট',
    count: 76,
    categoryKey: 'T-Shirts',
    filterKeywords: ['basic', 'crewneck', 'cotton tee'],
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=500&q=80',
    section: 'casual'
  },
  {
    id: 'print-shirt',
    title: 'Print Shirt',
    banglaTitle: 'প্রিন্ট শার্ট',
    count: 51,
    categoryKey: 'Shirts',
    filterKeywords: ['print', 'resort', 'floral', 'pattern'],
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=500&q=80',
    section: 'casual'
  },
  {
    id: 'solid-shirt',
    title: 'Solid Shirt',
    banglaTitle: 'সলিড শার্ট',
    count: 86,
    categoryKey: 'Shirts',
    filterKeywords: ['solid', 'classic', 'oxford', 'formal'],
    image: '/src/assets/images/bangladeshi_classic_shirt_1793107155017.jpg',
    section: 'casual'
  },
  {
    id: 'check-shirt',
    title: 'Check Shirt',
    banglaTitle: 'চেক শার্ট',
    count: 25,
    categoryKey: 'Shirts',
    filterKeywords: ['check', 'plaid', 'flannel', 'gingham'],
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=500&q=80',
    section: 'casual'
  }
];

// 2. Gent's Winter Grid (From Screenshot 2 - Total 384)
export const GENTS_WINTER_CATEGORIES: CategoryShowcaseItem[] = [
  {
    id: 'solid-print-hoodie',
    title: 'Solid & Print Hoodie',
    banglaTitle: 'সলিড ও প্রিন্ট হুডি',
    count: 168,
    categoryKey: 'Hoodies',
    filterKeywords: ['hoodie', 'pullover', 'print hoodie', 'fleece'],
    image: '/src/assets/images/product_premium_hoodie_1792588590406.jpg',
    section: 'winter'
  },
  {
    id: 'contrast-hoodie',
    title: 'Contrast Hoodie',
    banglaTitle: 'কনট্রাস্ট হুডি',
    count: 6,
    categoryKey: 'Hoodies',
    filterKeywords: ['contrast', 'colorblock', 'two tone'],
    image: '/src/assets/images/bangladeshi_hoodie_look_1793107183737.jpg',
    section: 'winter'
  },
  {
    id: 'veracity-jacket',
    title: 'Veracity Jacket',
    banglaTitle: 'ভার্সিটি জ্যাকেট',
    count: 0,
    categoryKey: 'Jackets',
    filterKeywords: ['varsity', 'bomber', 'baseball', 'veracity'],
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'denim-jacket',
    title: 'Denim Jacket',
    banglaTitle: 'ডেনিম জ্যাকেট',
    count: 0,
    categoryKey: 'Jackets',
    filterKeywords: ['denim jacket', 'jean jacket', 'trucker'],
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'sweeter',
    title: 'Sweeter',
    banglaTitle: 'সোয়েটার',
    count: 33,
    categoryKey: 'Sweater',
    filterKeywords: ['sweater', 'knit', 'wool', 'pullover'],
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'sweatshirts',
    title: 'Sweatshirts',
    banglaTitle: 'সোয়েটশার্টস',
    count: 90,
    categoryKey: 'Sweatshirt',
    filterKeywords: ['sweatshirt', 'crewneck', 'fleece'],
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'hoodie-set',
    title: 'Hoodie Set',
    banglaTitle: 'হুডি সেট',
    count: 0,
    categoryKey: 'Hoodies',
    filterKeywords: ['hoodie set', 'tracksuit', 'matching set'],
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'long-sleeve-tshirt',
    title: 'Long Sleeve T-Shirt',
    banglaTitle: 'লং স্লিভ টি-শার্ট',
    count: 51,
    categoryKey: 'Long Sleeve T-Shirt',
    filterKeywords: ['long sleeve', 'longsleeve tee', 'waffle'],
    image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'long-sleeve-set',
    title: 'Long Sleeve Set',
    banglaTitle: 'লং স্লিভ সেট',
    count: 20,
    categoryKey: 'Long Sleeve Set',
    filterKeywords: ['long sleeve set', 'loungewear', 'pajama set'],
    image: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'pant',
    title: 'Pant',
    banglaTitle: 'প্যান্ট',
    count: 5,
    categoryKey: 'Pants',
    filterKeywords: ['pant', 'pants', 'trousers', 'jeans', 'chinos'],
    image: '/src/assets/images/product_denim_cargo_1792588592254.jpg',
    section: 'winter'
  },
  {
    id: 'joggers-and-trouser',
    title: 'Joggers and trouser',
    banglaTitle: 'জগার্স ও ট্রাউজার',
    count: 11,
    categoryKey: 'Joggers and Trousers',
    filterKeywords: ['joggers', 'trouser', 'cargo', 'track pants'],
    image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  },
  {
    id: 'gents-winter-accessories',
    title: "Gent's Winter Accessories",
    banglaTitle: 'শীতের এক্সেসরিজ',
    count: 0,
    categoryKey: "Gent's Winter Accessories",
    filterKeywords: ['muffler', 'beanie', 'gloves', 'scarf', 'winter cap'],
    image: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=500&q=80',
    section: 'winter'
  }
];

// All categories merged for lookup
export const ALL_SHOWCASE_CATEGORIES = [...CASUAL_CATEGORIES, ...GENTS_WINTER_CATEGORIES];

// Only categories with count > 0 ("ekhan theke jegula 0 er base ace")
export const ACTIVE_IN_STOCK_CATEGORIES = ALL_SHOWCASE_CATEGORIES.filter((c) => c.count > 0);

// Zero count categories ("০ এর স্টক / আপকামিং ড্রপ")
export const UPCOMING_ZERO_CATEGORIES = ALL_SHOWCASE_CATEGORIES.filter((c) => c.count === 0);
