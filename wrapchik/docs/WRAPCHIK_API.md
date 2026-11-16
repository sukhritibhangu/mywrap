# Wrapchik API Reference

Base path: `/api`. JSON API routes use the standard `{ success, message?, ... }` response shape where applicable. Authenticated requests use `Authorization: Bearer <JWT>`. Admin routes require a persisted `admin` role. This route inventory is derived from source. On 2026-11-09, read-only `GET /` and `GET /api/products` requests both returned HTTP 200; live email OTP and database write behavior were not verified.

## Public and account routes

| Route | Access | Purpose |
|---|---|---|
| `GET /` | Public | API health response (outside `/api`). |
| `GET /api/categories` | Public | Menu categories. |
| `GET /api/products` | Public | Search/filter/sort menu products. Search is treated as literal text; price range is validated. |
| `GET /api/products/popular` | Public | Up to four available items ranked from paid orders in the prior 30 days. Empty data returns an empty list. |
| `GET /api/products/:id` | Public | Product details/options. |
| `GET /api/settings` | Public | Outlet settings needed by checkout. |
| `GET /api/tables/available` | Public | Dine-in availability without admin reservation details. |
| `GET /api/pickup-slots` | Public | Available scheduled takeaway slots when enabled. |
| `GET /api/coupons/available` | Public | Active offer discovery; cart/customer eligibility is checked separately. |
| `/api/auth/register`, `/login`, `/otp/send`, `/otp/verify` | Public, rate limited | Registration requests a signup code for an exact `@thapar.edu` address; the student account is created only after `SIGNUP` OTP verification. Password login and OTP login remain domain-independent for existing users, including admins. OTP payloads use email; local OTP must only be enabled in development. |
| `/api/auth/me`, `/profile`, `/favourites` | Authenticated | Own account/profile/favourites. |
| `POST /api/coupons/validate` | Authenticated | Backend eligibility quote against current product prices. |
| `/api/orders` | Authenticated | Create order, read own orders/details, cancel eligible unpaid order, request reorder data. |
| `/api/notifications` | Authenticated | Read own notifications and mark own notifications read. |
| `/api/issues` | Authenticated | Submit/list own support issues; submission requires ownership of a completed order. |
| `/api/groups` | Authenticated | Group lobby metadata. Group detail reads are restricted to joined members; this is not shared-cart checkout. |

## Administrator routes

All `/api/admin/*` routes require `protect` and `adminOnly`.

- `GET /api/admin/orders`, `PUT /api/admin/orders/:id/status`
- `GET /api/admin/analytics?period=today|7d|30d`
- `GET /api/admin/issues`, `PUT /api/admin/issues/:id/resolve`
- Product create/update/availability/delete under `/api/products`.
- Category create/update/delete under `/api/categories`.
- Table list/create/update under `/api/tables`.
- `PUT /api/settings`.
- Coupon list/create/update under `/api/coupons`.

## Payment routes

- `POST /api/payment/create`, `/verify`, `/outcome` require the order owner.
- `POST /api/payment/counter-confirm` requires an administrator.
- `POST /api/payment/webhook` is provider-to-server and verifies Razorpay's signature over the raw request body. Use Razorpay test mode until test reconciliation and webhook replay behavior are verified.
- Online orders cannot enter kitchen preparation before server-confirmed payment. Browser checkout is not supported by the native Razorpay module. Refunds are not implemented.

## Data/financial rules

- Client-supplied prices and discounts are not accepted as authoritative. The backend reloads products and options and stores order-time item snapshots.
- Coupon quote is informational; order creation rechecks dates, minimum subtotal and usage limits atomically.
- Scheduled pickup availability is informational; order creation revalidates operating hours, lead time and slot capacity atomically.
- Payment state is independent from order state. A client dismissal does not prove payment failure or success.

Deployment and environment setup guidance is in the repository's `DEPLOYMENT.md` and `SETUP.md`.

## Completion sprint endpoints and verification — 2026-11-07

- `POST /api/auth/password/reset/otp/send` and `/verify` provide email OTP password recovery. Email payloads use `email`; real delivery requires backend Resend configuration. Responses are generic for missing accounts when delivery is configured.
- `POST /api/payment/reconcile` is authenticated and owner-scoped; it fetches provider payment state to resolve pending/failed attempts. It does not accept client-side success as proof.
- Razorpay webhook handling validates HMAC and event ID, records a sanitized event in `WebhookEvent`, and acknowledges already processed duplicates. The event ledger has durable uniqueness and processing leases.
- Live read-only verification on 2026-11-07: `GET /` ACTIVE, `GET /api/products` HTTP 200 (5 items), Socket.IO polling handshake HTTP 200. No order, payment, cancellation or admin mutation endpoint was exercised in this check.
