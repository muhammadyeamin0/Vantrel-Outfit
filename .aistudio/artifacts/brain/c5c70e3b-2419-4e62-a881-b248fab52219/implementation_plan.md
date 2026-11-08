# VANTREL Order Synchronization, 15-Minute Cancellation, Policy Terms, and Search/AI Indexing

This comprehensive plan resolves order visibility in the admin panel, introduces a 15-minute customer order cancellation window with mandatory reason selection, embeds official delivery/return terms on confirmation and tracking pages, and configures complete crawling access for Google, Meta, Gemini, and AI engines while strictly securing the admin panel.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following confirmed decisions govern this implementation:
> - **Order Admin Reliability**: Triple-redundant order persistence (Express API `/api/orders` + Google Cloud Firestore `orders` + local storage backup) with bidirectional auto-reconciliation so that orders placed from any device or connection speed immediately appear in the Admin Dashboard.
> - **15-Minute Cancellation Flow**: Customers can cancel an order within 15 minutes of placement directly from both the Order Confirmation page and Order Tracking page. A mandatory cancellation reason must be selected from a modal dialog before cancellation is processed, automatically restoring product stock.
> - **Post-Order Notice**: The exact Bengali delivery and return conditions provided by the user will be highlighted in an authoritative warning card on both `OrderConfirmationPage.tsx` and `OrderTrackingPage.tsx`.
> - **AI & Search Crawler Access**: Complete `robots.txt` and dynamic `/sitemap.xml` allowing search engines and AI user agents (Googlebot, Google-Extended, Meta-ExternalAgent, FacebookExternalHit, GPTBot, ClaudeBot, PerplexityBot) to crawl all product details, images, and prices while strictly blocking `/admin*`.

---

## 1. Overview & Core Concept

1. **Guaranteed Order Delivery to Admin**:
   - Every order submitted via `CheckoutPage.tsx` will be dispatched synchronously to the server API (`/api/orders`), committed to Firestore, and backed up in `localStorage`.
   - The Admin Dashboard will run an automatic 10-second polling sync against `/api/orders` in addition to Firestore snapshot listeners, ensuring new orders trigger sound/visual alerts and appear in the order table immediately without manual page refreshes.

2. **15-Minute Customer Order Cancellation**:
   - Both `OrderConfirmationPage.tsx` and `OrderTrackingPage.tsx` will feature a live countdown timer showing remaining minutes and seconds within the 15-minute grace period.
   - When clicked, a modal prompts the customer to choose a mandatory reason:
     - ভুল সাইজ নির্বাচন করেছি (Wrong size selected)
     - ডেলিভারি ঠিকানা বা ফোন নম্বর পরিবর্তন করতে চাই (Need to change address or phone)
     - অন্য পণ্য অর্ডার করতে চাই (Want to order a different product)
     - অসাবধানতাবশত অতিরিক্ত অর্ডার হয়েছে (Accidental duplicate order)
     - অন্যান্য কারণ (Other reason with optional text)
   - Upon confirmation, order status updates to `'Cancelled'`, inventory stock is restored, and the admin panel is notified.

3. **Mandatory Delivery & Return Terms Display**:
   - Highlighted prominently on the Order Confirmation and Tracking pages:
     > **১. ডেলিভারি ম্যান উপস্থিত থাকাকালীন আপনাকে অবশ্যই পণ্যটি পরীক্ষা করতে হবে; কোনো ত্রুটি পাওয়া গেলে, অবিলম্বে ফেরতের জন্য বলুন।**
     >
     > **২. ডেলিভারি ম্যান চলে যাওয়ার পর আপনি যদি পণ্যটি ফেরত বা বিনিময় করতে চান, তাহলে আপনাকে অতিরিক্ত ডেলিভারি চার্জ দিতে হবে।**
     >
     > **কারণ: এই পণ্যগুলো ফেরত দিলে এর কভার ক্ষতিগ্রস্ত হয় এবং সেগুলো পুনরায় বিক্রয়ের অযোগ্য হয়ে পড়ে। তাই পণ্য ফেরত দেওয়া এড়িয়ে চলুন।**

4. **Search Engine & AI Crawler Support (Google, Meta, Gemini, ChatGPT)**:
   - Serve a public `/robots.txt` route permitting all web/AI agents (`Googlebot`, `Google-Extended`, `Meta-ExternalAgent`, `facebookexternalhit`, `GPTBot`, `ClaudeBot`, `PerplexityBot`, etc.) with `Allow: /` and `Disallow: /admin`.
   - Serve a dynamic `/sitemap.xml` route indexing all active products with image attachments, prices, and last modification dates.
   - Provide Product JSON-LD structured data and OpenGraph tags with BDT pricing and availability on product detail views.

---

## 2. User Experience & Visual Design

### 15-Minute Cancellation & Policy Flow

```
[Order Placed Successfully]
  ├── Redirects to Order Confirmation Page
  │     ├── Live 15-Minute Countdown Badge: "১৫ মিনিট এডিট ও বাতিল সময়সীমা: ১৪:৫২"
  │     ├── "অর্ডার বাতিল করুন" button
  │     └── Delivery & Return Policy Notice Card (Highlighted in warning amber/stone)
  │
  └── Customer Clicks "অর্ডার বাতিল করুন"
        ├── Cancellation Modal Opens
        ├── Requires selecting 1 of 5 predefined reasons
        ├── Clicks "বাতিল নিশ্চিত করুন"
        └── Order transitions to "Cancelled", stock restored, status updated in Admin
```

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Triple-Redundant Order Syncing**
  - *Chosen Approach*: When an order is placed, `checkout` sends a request to `/api/orders`, syncs to Firestore `orders`, and appends to local cache. In the Admin Dashboard, orders are merged and deduplicated by `orderNumber` across all sources.
  - *Why*: Solves the root cause of "sometimes orders don't appear in admin panel" caused by intermittent network drops or Firestore offline delays.
- **Decision 2: Mandatory Cancellation Reason Modal**
  - *Chosen Approach*: Disable the "Confirm Cancellation" button until a radio reason is selected.
  - *Why*: Directly satisfies the user's requirement ("Cancel with a mandatory cancellation reason selection") and provides store staff with audit logs explaining why the customer cancelled.
- **Decision 3: Server-Side Sitemap & Robots Endpoints**
  - *Chosen Approach*: Mount `/robots.txt` and `/sitemap.xml` directly in `server.ts` so search crawlers and AI bots receive valid XML and plain-text responses without running client-side React.
  - *Why*: Allows search engines, Meta crawlers, and AI systems (Gemini, ChatGPT) to fetch product catalogs directly via standard HTTP GET.

---

## 4. Technical Architecture & File Changes

```
┌─────────────────────────────────────────────────────────────┐
│                          server.ts                          │
│  - GET /robots.txt (Allows all crawlers, blocks /admin)     │
│  - GET /sitemap.xml (Dynamic product catalog & image XML)   │
│  - POST /api/orders (Synchronous order creation & audit)    │
│  - POST /api/orders/:id/cancel (Restores product stock)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│     StoreContext.tsx      │         │ OrderConfirmationPage.tsx │
│ - Dual-sync order fetcher │         │ & OrderTrackingPage.tsx   │
│ - cancelOrderWithReason() │         │ - 15-min countdown timer  │
│ - Auto-reconcile orders   │         │ - Cancellation modal      │
│                           │         │ - Delivery & return notice│
└───────────────────────────┘         └───────────────────────────┘
```

### Specific Files to Update:
1. **`server.ts`**:
   - Add `/robots.txt` route with `Disallow: /admin`.
   - Add `/sitemap.xml` route generating clean XML with all product slugs, titles, and images.
   - Enhance `/api/orders` to ensure resilient persistence.
2. **`src/context/StoreContext.tsx`**:
   - Add `cancelOrderWithReason(orderId: string, reason: string)` to handle reason logging and stock restoration.
   - Add periodic background polling (every 10s) from `/api/orders` so new orders immediately appear in Admin.
3. **`src/pages/OrderConfirmationPage.tsx`**:
   - Add live 15-minute countdown timer.
   - Add Cancellation Modal with mandatory reason selection.
   - Add the official Bengali delivery and return policy notice box.
4. **`src/pages/OrderTrackingPage.tsx`**:
   - Add the same 15-minute countdown timer and cancellation modal if the order was placed less than 15 minutes ago.
   - Display the official delivery and return policy notice box.
5. **`src/pages/AdminDashboard.tsx`**:
   - Display cancellation reasons in order details and audit logs.
   - Live order counter and audio/visual indicator when a new order arrives.
