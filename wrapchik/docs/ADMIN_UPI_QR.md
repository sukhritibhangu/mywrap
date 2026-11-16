# Admin-managed UPI QR

1. Sign in using the existing administrator email and password.
2. Open **Settings → Customer Payments**.
3. Enter the outlet's official UPI ID and payee name.
4. Upload its QR image (PNG, JPEG or WebP, up to 512 KB), or provide a publicly reachable HTTPS image URL.
5. Scan the preview yourself and confirm it pays the same outlet and UPI account. Enable **UPI payment enabled**, then save.

The image is saved in MongoDB, not Render's temporary filesystem. Only the authenticated admin settings route can replace or remove it. Customers select **Pay via UPI**, then see the preset QR and the server-calculated order total. A preset QR may not encode an amount: the customer must enter the displayed exact total in their UPI app. The app does not open a second, separately generated payment destination when a preset image is selected.

The customer submits a transaction reference after paying. Payment remains pending until an administrator independently checks the outlet's actual receipt and approves it in the UPI claims section of the order desk. A screenshot or transaction reference alone is not confirmation.

Removing the preset restores the existing generated order-specific QR. Disabling UPI removes it from new checkout. No gateway account or image-hosting subscription is needed for uploaded QR images.

## Administrator credentials

The source defines `admin@wrapchik.com` only as a default demo seed email. A configured `DEMO_ADMIN_EMAIL` can override it, and an existing live account may use another address. There is no checked-in administrator password. A demo password is supplied through `DEMO_ADMIN_PASSWORD` only when deliberately seeding an account; MongoDB stores a bcrypt hash. Test credentials such as `admin@example.com` are mocked unit-test records, not live credentials.

The local `npm run admin:recover` script is deliberately limited to a development database on the local machine. It does not reset the Render/Atlas administrator. Recover the live account through its existing password-recovery flow if email delivery is configured, or perform an owner-controlled, targeted reset of that exact admin record. Do not enable demo seeding or create a second administrator to recover access.
