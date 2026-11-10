# Real-Time Admin Catalog Live Sync & Google/Meta Product Feed System

Implement instantaneous two-way synchronization for all admin panel product operations (Create, Edit, Delete, Restore, Reorder) across Firestore, backend server memory, and disk persistence, paired with automated Google Merchant Center XML and Meta (Facebook/Instagram) Catalog JSON/CSV feeds for universal ad and social commerce integration.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were selected based on the user's explicit choices:
> - **Real-Time Cross-Device Synchronization**: Every product mutation in the Admin Dashboard immediately synchronizes to Cloud Firestore, local state, and server disk (`data/products_store.json`), propagating live across all customer devices and admin screens without requiring browser refresh.
> - **Automated Google & Meta Product Feeds**: Live XML and JSON feeds (`/api/public/google-product-feed.xml` and `/api/public/products-feed.json`) dynamically serve full product catalogs (high-res images, BDT pricing, stock status, sizing, GSM descriptions, brand metadata, and direct product URLs) for Google Shopping and Meta Catalog Ads.
> - **Admin Feed Hub**: A dedicated "Marketing & Product Feeds" hub within the Admin Dashboard with 1-click URL copying for Google Merchant Center and Meta Commerce Manager, plus direct CSV catalog download.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Instant Everywhere Synchronization**: When an admin adds, edits, or deletes a product in the Admin Panel, the change updates immediately on all customer screens, mobile devices, server endpoints, and disk files without requiring a page refresh.
  2. **Universal Google & Meta Product Feeds**: Creates standardized product data feeds compatible with Google Merchant Center (RSS 2.0 / XML Google Shopping standard) and Meta Commerce Manager (JSON and CSV formats), including accurate product image links, prices in BDT, inventory availability, sizes, and detailed descriptions.
  3. **Admin Feed Control**: Displays direct feed URLs with one-click copy and quick test previews inside the Admin Panel.

- **Target Persona**: Store owners, marketing managers, and customers browsing the live shop across mobile and desktop.

---

## 2. User Experience & Visual Design

- **Admin Products & Feed Hub**:
  - In the Admin Dashboard (under Products / Marketing & Feeds), display a dedicated card for **Google Merchant Center & Meta Catalog Integration**.
  - Includes:
    - **Google Shopping XML Feed URL**: `https://www.vantreloutfit.shop/api/public/google-product-feed.xml` with a `[Copy Feed URL]` button.
    - **Meta / Facebook Catalog Feed URL**: `https://www.vantreloutfit.shop/api/public/products-feed.json` with a `[Copy Feed URL]` button.
    - **Direct CSV Catalog Export**: One-click download of the complete Meta/Facebook compatible CSV file.
    - Live indicator of active published products included in the feeds.
- **Real-Time Sync Feedback**:
  - Live toasts upon product creation, edit, or archive ("প্রোডাক্ট লাইভ আপডেট হয়েছে — সমস্ত ডিভাইসে সক্রিয়").
  - Seamless optimistic UI update in React state, followed by immediate background sync to Firestore and Express server.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Admin Panel & Customer UI                       │
│  (Add / Edit / Delete / Restore / Reorder Products in StoreContext)    │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ Optimistic State Update        │
                    ▼                                ▼
┌────────────────────────────────────┐  ┌────────────────────────────────┐
│      Firebase Firestore Cloud      │  │        Express API Server      │
│  Collection: `products/{id}`       │  │  POST/PUT/DELETE /api/products │
│  - Real-time `onSnapshot` listener │  │  - Updates in-memory catalog   │
│  - Instant push to all connected   │  │  - Writes to disk:             │
│    client browser sessions         │  │    `data/products_store.json`  │
└────────────────────────────────────┘  └───────────────┬────────────────┘
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼                                                             ▼
         ┌──────────────────────────────┐                              ┌──────────────────────────────┐
         │ Google Shopping XML Feed     │                              │ Meta Commerce JSON & CSV Feed│
         │ `/api/public/google-feed.xml`│                              │ `/api/public/products-feed`  │
         │ (RSS 2.0 with g:price,       │                              │ (Facebook / Instagram Ads    │
         │  g:image_link, g:availability│                              │  and Commerce Manager Ready) │
         └──────────────────────────────┘                              └──────────────────────────────┘
```

### Server & Client Sync Endpoints
1. **Server Storage (`data/products_store.json`)**:
   - Persists all products to disk so restarts never lose custom products added in admin.
   - Synchronizes `products` array on `POST /api/products`, `PUT /api/products/:id`, and `DELETE /api/products/:id`.
2. **Client Synchronizer (`StoreContext.tsx`)**:
   - `addProduct`: Saves to Firestore + calls `/api/products` (POST).
   - `updateProduct`: Saves to Firestore + calls `/api/products/:id` (PUT).
   - `deleteProduct` (archive) & `permanentlyDeleteProduct`: Updates Firestore + calls `/api/products/:id` (DELETE).
   - Firestore `onSnapshot` ensures that any change made by an admin on desktop updates the mobile phone or other devices instantaneously.
3. **Google & Meta Public Feeds**:
   - `GET /api/public/google-product-feed.xml`: Standard XML Google Merchant format with `<item>` elements (`g:id`, `g:title`, `g:description`, `g:link`, `g:image_link`, `g:price`, `g:availability`, `g:brand`, `g:condition`).
   - `GET /api/public/products-feed.json`: Enhanced Meta-compatible catalog JSON.
   - `GET /api/public/meta-catalog.csv`: Direct RFC-compliant CSV feed download for Facebook Commerce Manager.

---

## 4. Implementation Steps

1. **Server-Side Persistence & Live Product Feed Engine (`server.ts`)**:
   - Add `data/products_store.json` disk persistence for products (analogous to orders persistence).
   - Ensure `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id` update both in-memory state and disk.
   - Implement `GET /api/public/google-product-feed.xml` with Google Shopping XML standard.
   - Implement `GET /api/public/meta-catalog.csv` with standard Meta Commerce CSV headers (`id`, `title`, `description`, `availability`, `condition`, `price`, `link`, `image_link`, `brand`, `fb_product_category`).
   - Upgrade existing `GET /api/public/products-feed.json` with comprehensive variant, sizing, and pricing metadata.

2. **Client Store Context Dual-Sync (`StoreContext.tsx`)**:
   - In `addProduct`, `updateProduct`, `deleteProduct`, and `permanentlyDeleteProduct`, dispatch requests to both Firebase Firestore and Express backend endpoints.
   - Ensure Firestore real-time listener maintains client state perfectly synced across tabs and devices.

3. **Admin Dashboard Marketing & Feeds Integration UI (`AdminDashboard.tsx`)**:
   - Add a prominent, responsive "Google & Meta ক্যাটালগ ফিড (Live Product Feeds)" section under the Products management tab or Developer hub.
   - Provide direct 1-click copy buttons for Google XML feed, Meta JSON feed, and Meta CSV download with toast confirmation.
   - Display clear step-by-step Bengali guidelines on how to paste these URLs into Google Merchant Center and Facebook Commerce Manager.

4. **Testing & Verification**:
   - Test XML feed endpoint formatting and validity.
   - Test CSV feed generation.
   - Verify compile and lint checks pass cleanly.
