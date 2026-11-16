# Thapar Google sign-in

Student web sign-in uses Google Identity Services. The backend uses Google's official `google-auth-library` to verify signatures, issuer, audience and token expiry. It also requires `email_verified=true`, `hd=thapar.edu`, a matching `@thapar.edu` email, and a server-created, single-use nonce expiring after five minutes.

## Configure

1. Create a Google OAuth **Web application** client in Google Auth Platform.
2. Add `https://wrapchik.onrender.com` to **Authorized JavaScript origins**. The popup callback flow does not need a redirect URI.
3. Set the public client ID in Render's **wrapchik-api → Environment** as `GOOGLE_CLIENT_ID`, then deploy the API and frontend.
4. Use only basic identity/profile scopes. A client secret and Gmail SMTP are not needed for this flow.
5. Check the Google Auth Platform audience/publication settings before broad rollout. Workspace administrators may restrict third-party sign-in.

The frontend obtains the client ID from `GET /api/auth/google/config`; it does not need another build-time variable. Without a client ID, Google endpoints fail closed and the page displays an unavailable message.

## Account behavior

- Existing students are linked to their existing account only after Google verifies their Thapar email, preserving the user ID and order history. Subsequent logins are bound to Google's stable `sub` identifier.
- New students provide a phone number after Google verification. No account or app session exists until that form succeeds. The number is contact information, not a claim of SMS verification.
- Google signup always creates a `student`. Client-supplied roles, names and emails cannot change the verified identity.
- Google sign-in refuses administrator accounts. Administrators use their existing email/password through `POST /api/auth/admin/login`.
- With `GOOGLE_CLIENT_ID` configured, legacy student signup and email OTP endpoints are disabled; password login rejects students. Existing sessions are preserved until normal expiry.
- This change implements Google sign-in for the web deployment. Native clients display a link to the web sign-in page; native OAuth clients/builds require a separate integration.
- Administrator password recovery still uses the existing email delivery configuration.

## Release verification

Run `npm ci && npm test` in `backend`, and `npm ci && npm run build` in `frontend`. Authentication tests exercise cryptographic verification with test keys and mocked persistence without accessing production data. Complete an interactive login with an approved Thapar Google account to verify Google project/origin/Workspace settings end to end.
