# VANTREL OUTFIT — Firestore Security Specification (Eight Pillars)

## 1. Roles & Authorization Model
- **Super Admin (Owner)**: Verified Google Sign-In with email `muhammadeyamin0@gmail.com` (`request.auth.token.email_verified == true`), or explicit document in `/admins/{uid}` (not user-writable).
- **Authenticated Customer**: Signed in via Firebase Auth (`request.auth != null`). Identified by `request.auth.uid`.
- **Public Visitor (Unauthenticated)**: Storefront browsing (products, categories, coupons validation, storefront settings) and guest COD checkout order submission.

## 2. Collection Rules & Invariants
- **Global Default Deny**: `match /{document=**} { allow read, write: if false; }`
- **`/products/{productId}`**:
  - Public read (`get`, `list`) for storefront catalog browsing and `/api/products`.
  - Create, Update, Delete: Strictly `isAdmin()` with `isValidId(productId)` and strict field type/range validation (`name`, `sku`, `category`, `regularPrice >= 0`, `totalStock >= 0`, bounded strings/lists).
- **`/orders/{orderId}`**:
  - `get`, `list`: Strictly `isAdmin()` or owner (`isAuthenticated() && resource.data.userId == request.auth.uid`). Eliminates PII leakage across customers.
  - `create`: `isValidId(orderId)` + strict order schema (`orderNumber` matching `^VT-`, positive totals, non-empty items list, valid customer map, initial pending status only). If signed in, `userId == request.auth.uid` (unless Admin).
  - `update`: `isAdmin()` (with valid fields) OR owner/same-session authenticated customer cancelling only within allowed fields (`orderStatus` -> `'Cancelled'` / `'Cancellation Requested'` / `'Return Requested'`).
  - `delete`: Strictly `isAdmin()`.
- **`/coupons/{couponId}`**:
  - `get`, `list`: Public read (`true`) so active promo codes can be validated during checkout.
  - `create`, `update`, `delete`: Strictly `isAdmin()` with field validation (`code`, `type`, `value >= 0`, `minOrder >= 0`, `isActive`).
- **`/users/{userId}`**:
  - `get`, `create`, `update`: Strictly owner (`isOwner(userId)`) or `isAdmin()`. Users **cannot** self-assign or escalate `role` (`'Super Admin'`, `'Admin'`, etc.) — user-created profiles must enforce `role == 'customer'`, and updates cannot change `role` unless `isAdmin()`.
  - `list`, `delete`: Strictly `isAdmin()`.
- **`/users/{userId}/wishlist/{productId}`**:
  - `get`, `list`, `create`, `update`, `delete`: Strictly `isOwner(userId)` or `isAdmin()`, validating `productId` and `addedAt`.
- **`/settings/{settingId}`**:
  - `get`, `list`: Public read (`true`) for delivery charges & store metadata.
  - `create`, `update`, `delete`: Strictly `isAdmin()`.
- **`/admins/{adminId}`**:
  - `get`: `isOwner(adminId) || isAdmin()`.
  - `list`, `create`, `update`, `delete`: `false` (provisioned out-of-band only).
- **`/test/{docId}`**:
  - `get`: `isAdmin()`.
  - `list`, `write`: `false`.
