# Wrapchik Setup Guide

Configure local development without changing current database records. Never paste secrets into chat or frontend source.

## Accounts and values

1. **Outlet UPI details** — optional; only needed if the outlet enables UPI. Obtain the outlet-approved UPI ID and payee label, then enter them in Admin → Settings → Customer Payments and enable UPI. The app generates an order-specific amount/reference QR, so no static QR image is needed. Do not use a personal UPI account without outlet authorization.
2. **Email delivery** — real OTP delivery requires backend Gmail SMTP settings (`SMTP_USER`, `SMTP_APP_PASSWORD`); Gmail App Passwords require Google 2-Step Verification. Resend (`RESEND_API_KEY`, `EMAIL_FROM`) is an optional fallback. Do not copy credentials into frontend files.
3. **Expo/EAS account** — required for cloud EAS builds. Keep the existing app identifiers and EAS project ID.
4. **Firebase project** — needed for Android push credentials if using push notifications in a production Android build.
5. **MongoDB Atlas or managed MongoDB** — only for hosted staging/production; local development can continue using local MongoDB.

## Backend configuration

In PowerShell, create `.env` only if it does not exist:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\backend'
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

No payment gateway variables are needed for current checkout. Preserve existing backend settings; keep this only if an app return URL is otherwise used:

```dotenv
APP_PUBLIC_URL=http://localhost:8081
```

`APP_PUBLIC_URL` should be reachable by the tester’s browser. Preserve `JWT_SECRET`, `MONGO_URI`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM` and existing values. `JWT_SECRET` must be at least 32 random characters. No Twilio or payment-gateway variables are needed for email OTP or new checkout.

## Frontend configuration

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

For laptop web, set in `frontend/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5000
```

For a phone on Wi-Fi, use the laptop’s LAN IPv4 address. For Android emulator use `http://10.0.2.2:5000`. These are public build-time values, not secrets. Restart Expo after changing `.env`.

## Start locally

1. Start MongoDB only if it is stopped.
2. Reuse the existing backend on port 5000. Check `http://localhost:5000/`; if it returns `ACTIVE`, do not start another process. Otherwise:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\backend'
npm ci
npm run dev
```

3. In a second PowerShell terminal:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
npm ci
npm start -- --web --port 8081
```

Open `http://localhost:8081`. If port 5000 already belongs to the active Wrapchik backend, keep using it; do not start a duplicate.

## New checkout payments

- In Admin → Settings → Customer Payments, enable Cash and/or UPI. Cash is enabled by default. UPI stays disabled until the administrator enters a valid outlet UPI ID and payee name and enables it.
- New UPI orders get an order-specific QR encoding the backend-calculated amount, payee, order ID/reference and note. On Android the standard `upi://pay` URI is handed to Android, which resolves an installed compatible UPI app. If no app opens, the customer can scan the QR from another device.
- UPI reference submission leaves payment pending. Admin → Kitchen & order desk → UPI claims requires actual outlet receipt verification. A reference or screenshot is not bank confirmation.
- For cash, use “Confirm cash received” only after cash is physically received. The backend records verifier ID and timestamp.
- Do not create fake successful orders/payments in the operating database. Use a separate development database for demonstrations.

## Native development build

UPI app launch uses the OS-level `upi://pay` scheme and does not require a gateway native SDK. QR scan remains available if Expo Go cannot launch an installed UPI application. When Android SDK/Java and a test device or emulator are ready:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
npx expo prebuild
npx expo run:android
```

These commands generate native project files and build/install a development app; they are separate from the cloud preview build in `DEPLOYMENT.md`. Existing app IDs and EAS project ID are preserved.

## Configuration still required

- No payment-provider account, key or webhook is required for current checkout.
- Real email delivery: configure Gmail SMTP credentials, or the optional Resend fallback, in `backend/.env`.
- Outlet UPI ID and payee name: **must be supplied and saved by outlet admin before enabling UPI**.
- Firebase push credentials: **not verified/configured**.
