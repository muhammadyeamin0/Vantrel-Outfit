# Fix Plan: 15-Minute Countdown Timer & Automated Order Confirmation Engine

This implementation plan diagnoses and resolves the root causes preventing the 15-minute timer and auto-confirmation engine from functioning smoothly, ensuring orders automatically transition to **`Order Confirmed`** and dispatch email notifications to **`muhammadeyamin0@gmail.com`**.

---

## 1. Root Cause Analysis

Through codebase inspection, three critical issues were identified:
1. **Deadline Field Discrepancy**:
   - `StoreContext.tsx` (`placeOrder`) was setting `customerConfirmationDeadline` and `canCancelUntil`, but omitted `confirmationDeadline`.
   - In `server.ts`, the background cron check explicitly required `ord.confirmationDeadline && new Date(ord.confirmationDeadline).getTime() <= now`. Because `confirmationDeadline` was undefined on new orders, the server cron never triggered auto-confirmation.
2. **Server-Client State Overwrite**:
   - `StoreContext.tsx` syncs with `/api/orders` every 6 seconds. Because the server had not updated the order (due to issue #1), the server would overwrite the frontend status back to `'Pending Customer Confirmation'`, effectively resetting or canceling out the client timer.
3. **Component Re-Render Missing on Expiry**:
   - In `OrderConfirmationPage.tsx`, when the timer reached `00:00`, the code was mutating `order.orderStatus = 'Order Confirmed'` directly on the object reference rather than updating React state or StoreContext, leaving the UI in an un-updated state until manually reloaded.

---

## 2. Proposed Solution & Architecture

### A. Universal Deadline Normalization
In both `StoreContext.tsx` and `server.ts`:
- Ensure all 3 deadline aliases (`confirmationDeadline`, `canCancelUntil`, and `customerConfirmationDeadline`) are populated with the exact same ISO date string (`Date.now() + 15 * 60 * 1000`).
- When orders are received on the server, auto-normalize:
  ```typescript
  const deadline = ord.confirmationDeadline || ord.canCancelUntil || ord.customerConfirmationDeadline;
  ```

### B. Reliable Server-Side Auto-Confirmation Cron
In `server.ts`:
- Check every 5 seconds for orders where:
  - `(ord.orderStatus === 'Pending Customer Confirmation' || ord.orderStatus === 'Customer Confirmed')`
  - AND `new Date(deadline).getTime() <= Date.now()`
- Transition order to `'Order Confirmed'`, append status history, persist to `data/orders_store.json`.
- Dispatches confirmation email to `muhammadeyamin0@gmail.com` with complete order breakdown (products, sizes, colors, price, customer address).

### C. Immediate Endpoint Handling (`/api/orders/:id/auto-confirm`)
- Accept calls from both client timer expiry and background tasks.
- If order is in any pending state, update directly to `'Order Confirmed'`, save to disk, and send email.

### D. Reactive UI State in `OrderConfirmationPage.tsx` & `OrderTrackingPage.tsx`
- Introduce a reactive state `[currentStatus, setCurrentStatus]` initialized to `order.orderStatus`.
- When the timer reaches `00:00`, call `updateOrderStatus(order.id, 'Order Confirmed')` in `StoreContext`, call `/api/orders/${order.id}/auto-confirm`, and set `setCurrentStatus('Order Confirmed')` so the UI instantly displays the confirmed badge and message.

---

## 3. Verification & Testing Steps
1. Place a new test order via Checkout.
2. Verify that the 15-minute countdown starts at `15:00` and ticks down accurately second-by-second.
3. Verify that `/api/orders/:id/auto-confirm` responds with `success: true` and status `'Order Confirmed'`.
4. Verify that the server logs `📧 [GMAIL AUTO-CONFIRMATION DISPATCH]` targeting `muhammadeyamin0@gmail.com`.
5. Run `compile_applet` and `lint_applet` to ensure zero compilation or syntax errors.
