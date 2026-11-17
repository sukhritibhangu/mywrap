# 🌯 WRAPCHIK — Full-Stack Campus Food Ordering & Shop Management Application

Wrapchik is an MVP designed for a college campus food outlet. It replaces slow, manual WhatsApp menu ordering with a digital ordering platform for students and a real-time shop management dashboard for shopkeepers.

---

## 📌 Problem Statement
At campus food outlets like **Wrapchik**, students currently have to manually check WhatsApp catalogs, send manual messages, wait in long counter queues, and handle cash transactions manually.

This causes:
- Slow ordering and long counter queues
- Inconvenient menu browsing & lack of search/filter capabilities
- Absence of cart management and dynamic price customization
- Lack of order tracking & pickup notifications
- Manual and error-prone order management for shopkeepers
- No centralized order history or revenue reporting
- Communication friction regarding item availability

---

## 💡 Solution
Wrapchik provides a unified digital ordering platform:

### 🎓 Student Flow:
`Open App ➔ Register/Login ➔ Browse Menu ➔ Search/Filter ➔ View Product & Customize ➔ Add to Cart ➔ Checkout ➔ Cash at Counter / outlet-verified UPI QR ➔ Order Confirmation ➔ Live Order Tracker ➔ Pickup Order`

### 👨‍🍳 Shopkeeper/Admin Flow:
`Admin Login ➔ Dashboard ➔ Receive Live Order ➔ Accept/Reject ➔ Start Preparing ➔ Mark Ready for Pickup ➔ Complete Order ➔ Manage Inventory & Toggle Availability ➔ View Sales Analytics`

---

## 🔥 Features

### Student App Features:
- **Branded Splash & Onboarding**: Smooth welcome intro with tagline *"Fresh. Fast. Flavorful."*
- **Authentication**: JWT-based login/signup with bcrypt password hashing.
- **Dynamic Home & Search**: Real-time menu search, category filtering, and Veg/Non-Veg toggles.
- **Product Customization**: Dynamic price recalculation for add-ons (extra cheese, sauces).
- **Persistent Cart Management**: Quantity adjustment, item removal, and subtotal/GST breakdown.
- **Payments**: New orders use Cash at Counter with administrator receipt confirmation or order-specific UPI QR with manual outlet verification. Historical Cashfree and Razorpay orders remain readable and their backend verification code is retained.
- **Live Visual Order Tracker**: Stepper timeline (`PLACED` ➔ `ACCEPTED` ➔ `PREPARING` ➔ `READY` ➔ `COMPLETED`).
- **Order History & Favourites**: Past order receipts and quick re-order support.

### Admin/Shopkeeper Features:
- **Real-Time Order Desk**: Instant notification of new orders with Accept & Reject controls.
- **Order State Machine**: Enforces valid status transitions to prevent accidental state changes.
- **Live Inventory Manager**: Quick `Available ON/OFF` switch to instantly hide out-of-stock items from students.
- **Product & Category CRUD**: Full creation, pricing update, description editing, and deletion.
- **Revenue Analytics**: Live dashboard reporting today's revenue, order volume, and pending counts.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Mobile Frontend** | React Native, Expo Router, React Hooks, Context API |
| **Backend REST API** | Node.js, Express.js |
| **Database** | MongoDB, Mongoose ODM |
| **Authentication** | JSON Web Tokens (JWT), bcryptjs |
| **Payments** | Backend-generated UPI intent QR and admin-verified cash/UPI; legacy gateway code retained for old orders |
| **Image Storage** | Cloudinary |
| **Push Notifications** | Expo Notifications |

---

## 📐 System Architecture

```text
                  STUDENT APP                               ADMIN INTERFACE
            React Native + Expo Router                   Admin Dashboard
                         │                                     │
                         └─────────────────┬───────────────────┘
                                           │ REST API (HTTPS/JSON)
                                           ▼
                                    BACKEND REST API
                                  Node.js + Express.js
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
       MongoDB Atlas               UPI QR / Cash                Cloudinary
     Database (Mongoose)          Manual Verification           Image Storage
```

---

## 🗄 Database Schema (Mongoose)

- `User`: `_id`, `name`, `email`, `phone`, `passwordHash`, `role` (`student`/`admin`), `favourites`
- `Category`: `_id`, `name`, `imageUrl`, `displayOrder`
- `Product`: `_id`, `name`, `description`, `price`, `categoryId`, `imageUrl`, `isVeg`, `available`, `customizations`
- `Order`: `_id`, `userId`, `orderNumber`, `items` (snapshot of name, price, quantity, customizations), `subtotal`, `taxAndFees`, `totalAmount`, `paymentStatus`, `orderStatus`
- `Payment`: `_id`, `orderId`, `userId`, `gatewayOrderId`, `gatewayPaymentId`, `gatewaySignature`, `amount`, `status`

---

## 📡 REST API Documentation

### Auth Endpoints (`/api/auth`)
- `POST /api/auth/register`: Register student or admin account
- `POST /api/auth/login`: Authenticate credentials & return JWT
- `GET /api/auth/me`: Get current user profile

### Product Endpoints (`/api/products`)
- `GET /api/products`: Get products (`?search=`, `?category=`, `?veg=true`, `?available=true`)
- `GET /api/products/:id`: Get product details
- `POST /api/products`: [Admin] Create product
- `PUT /api/products/:id`: [Admin] Update product
- `PATCH /api/products/:id/availability`: [Admin] Quick toggle availability ON/OFF
- `DELETE /api/products/:id`: [Admin] Delete product

### Order Endpoints (`/api/orders`)
- `POST /api/orders`: Validate prices server-side & create pending order
- `GET /api/orders/my`: Get student's order history
- `GET /api/orders/:id`: Get order details & tracking status
- `POST /api/orders/:id/cancel`: Cancel order if status is `PLACED`

### Payment Endpoints (`/api/payment`)
- `POST /api/payment/create`, `/verify`, `/cashfree/create`, `/cashfree/reconcile`, `/cashfree/webhook`: Legacy gateway endpoints retained for old orders; unavailable from new checkout
- `POST /api/payment/upi/submit`: Submit a UPI transaction reference (payment remains pending)
- `GET /api/payment/upi/pending`, `POST /api/payment/upi/:id/review`: [Admin] Review UPI payment claims
- `GET /api/payment/upi/:orderId/instructions`: Fetch a server-calculated amount and per-order UPI payment URI
- `POST /api/payment/counter-confirm`: [Admin] Record counter cash receipt

### Admin Endpoints (`/api/admin`)
- `GET /api/admin/orders`: Fetch all orders with status filter
- `PUT /api/admin/orders/:id/status`: Update order state in state machine
- `GET /api/admin/analytics`: Get revenue and order analytics

New order creation accepts only `COUNTER` (cash) and `UPI_QR`. Cash remains pending until an administrator confirms receipt. UPI remains pending after reference submission until an administrator verifies the actual receipt. Gateway endpoints and schema values remain only to preserve historical orders; they are not offered in new checkout.

---

## 🚀 Run on Windows

### Prerequisites

- Node.js and npm (the checked workspace uses Node 24 and npm 11).
- MongoDB running locally on port 27017, or a MongoDB connection string.
- Expo Go for browsing the app on a phone. Android UPI handoff uses the standard `upi://pay` URI and the operating system resolves installed compatible apps; QR scanning remains available if no app opens.
- Local development email OTP is available when explicitly enabled. Real OTP delivery uses Resend email configured on the backend.

The backend package is in `backend/` and the Expo app is in `frontend/`. Install dependencies from each package directory with `npm ci`; each has its own lockfile.

### 1. Start MongoDB

Start your local MongoDB service (the installed service may require an Administrator PowerShell or the Windows Services app), or set `MONGO_URI` in `backend/.env` to a MongoDB connection string. If the installed service is stopped, this command starts it with its existing data directory from an Administrator PowerShell:

```powershell
Start-Process 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe' -ArgumentList '--config "C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg"' -WindowStyle Hidden
```

Check the local service with `Test-NetConnection 127.0.0.1 -Port 27017`; `TcpTestSucceeded` must be `True` before starting the API. The local default is `mongodb://127.0.0.1:27017/wrapchik`. The backend seeds a small menu and tables after the database connects. The project does not bundle MongoDB.

### 2. Start the backend

In a PowerShell terminal:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\backend'
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Edit `backend/.env` once before the first run: set a unique random `JWT_SECRET` of at least 32 characters. For local email OTP without sending email, set `NODE_ENV=development` and `LOCAL_OTP_ENABLED=true`; the short-lived code is returned only to the development app response and is never logged. For real delivery, configure `SMTP_USER` and `SMTP_APP_PASSWORD` in the backend `.env` (Gmail App Password); Gmail SMTP takes precedence over the optional Resend fallback. Never put email credentials in the frontend.

When the server is ready, its health endpoint is `http://localhost:5000/`.

### 3. Start the frontend

Open a second PowerShell terminal. For Expo Go on a phone, replace `192.168.1.10` with the laptop's Wi-Fi IPv4 address:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
npm ci
$env:EXPO_PUBLIC_API_URL = 'http://192.168.1.10:5000'
npm start
```

The API base URL must not include `/api`; the app appends it. For web on the laptop, use `http://localhost:5000` and run `npm run web -- --port 19006`. For the Android emulator, use `http://10.0.2.2:5000`. A physical phone and laptop must be on the same network, and the Windows firewall must allow the selected port.

### Environment variables

`backend/.env.example` lists supported settings with placeholders. Create or edit `backend/.env` without replacing an existing file. Real email OTP uses backend-only Gmail SMTP settings (`SMTP_USER`, `SMTP_APP_PASSWORD`); optional Resend fallback uses `RESEND_API_KEY` and `EMAIL_FROM`. No payment-provider credentials are required for new checkout. An administrator configures the outlet's official UPI ID and payee name in Admin Settings, then enables UPI; the backend generates an amount-and-order-specific QR. Cash can be enabled or disabled there too. Do not commit `.env` files or put private credentials in the Expo frontend.

OTP sign-in, signup verification, and password recovery use email. Phone numbers remain required profile data for compatibility with existing accounts; they are not used for OTP delivery.

### Recover local administrator access

In a PowerShell terminal, with the local MongoDB service running:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\backend'
npm run admin:recover
```

The command is restricted to `NODE_ENV=development` and a local MongoDB URI. It lists existing admin email addresses locally, requires you to enter and confirm the exact target email, then prompts for a new password without displaying it. Passwords must contain at least 12 characters, including a letter and a number. It resets an existing administrator only; it will not promote a student or create a second admin. If the local database has no admin, it asks for the details to create the first one. It does not reset or delete any other database data. Sign in using the email and password you selected; email OTP can use the local development code while enabled.

The checked-in frontend `.env.example` is a template only. Set `EXPO_PUBLIC_API_URL` for the target device/network as described above.

---

## 🧪 Quick Demo Credentials

The admin demo is development-only and uses disposable local data.

1. In `backend/.env`, set `ENABLE_ADMIN_DEMO=true` and restart the backend. The seeder creates a verified demo administrator (`admin@wrapchik.com` by default).
2. Open **Admin sign in** in the app and press **Enter demo admin** — no password is sent from the app.
3. Prefer typing credentials manually? Use `admin@wrapchik.com` / `WrapchikDemo123!` unless you overrode `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`.

The server refuses to start with `ENABLE_ADMIN_DEMO=true` outside `NODE_ENV=development`. Never enable demo accounts on production or staging data.

---

## 👥 Team Members
Developed for campus food outlet digital transformation learning & deployment.

## Project guides

- [Local setup](SETUP.md)
- [Deployment preparation](DEPLOYMENT.md)
- [API reference](docs/WRAPCHIK_API.md)
