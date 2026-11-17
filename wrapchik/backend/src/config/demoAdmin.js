// Development-only demo administrator.
// The endpoint that uses this profile is hard-disabled outside NODE_ENV=development,
// so a production build can never issue an administrator session without a password.
const DEFAULT_DEMO_ADMIN = Object.freeze({
  name: 'Wrapchik Demo Admin',
  email: 'admin@wrapchik.com',
  password: 'WrapchikDemo123!',
  phone: '+919999999999',
});

const demoAdminEnabled = () =>
  process.env.NODE_ENV === 'development' && process.env.ENABLE_ADMIN_DEMO === 'true';

const demoAdminProfile = () => ({
  name: process.env.DEMO_ADMIN_NAME || DEFAULT_DEMO_ADMIN.name,
  email: String(process.env.DEMO_ADMIN_EMAIL || DEFAULT_DEMO_ADMIN.email).trim().toLowerCase(),
  phone: process.env.DEMO_ADMIN_PHONE || DEFAULT_DEMO_ADMIN.phone,
  password: process.env.DEMO_ADMIN_PASSWORD || DEFAULT_DEMO_ADMIN.password,
});

module.exports = {
  DEFAULT_DEMO_ADMIN,
  demoAdminEnabled,
  demoAdminProfile,
};
