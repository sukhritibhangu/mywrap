# Render deployment and temporary demo

Backend root: `wrapchik/backend`; build: `npm ci`; start: `npm start`.
Frontend root: `wrapchik/frontend`; build: `npm ci && npm run build`; publish: `dist`.
Add a rewrite from `/*` to `/index.html` on the static site.
Set backend `MONGO_URI` and a random `JWT_SECRET` (32+ characters). Keep these in Render, never in GitHub.
Set frontend `EXPO_PUBLIC_API_URL` to the deployed backend URL.
Online payments are unavailable until Razorpay credentials are configured.

## Temporary student demo

Enable backend `ENABLE_DEMO_LOGIN=true` and frontend `EXPO_PUBLIC_ENABLE_DEMO_LOGIN=true`.
Restart the backend and rebuild the frontend. The backend seeds a shared student account:

- Email: `demo@wrapchik.example`
- Password: `WrapchikDemo2026!`

The Try Demo button uses the regular password login and real student permissions; it never grants admin access.
This is a public, shared demo account. Use sample information only.
To retire it, set the frontend flag to false, rebuild, and delete the demo user from MongoDB (the backend flag controls creation, not deletion).

Signup and login now use email/password; contact phone numbers are retained for orders but OTP verification and SMS routes are removed.
Web sessions use browser storage; native sessions continue using SecureStore.

Validation: `cd wrapchik/backend && node --test` and `cd wrapchik/frontend && npm ci && npm run build`.
