const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const socketManager = require('./config/socketManager');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
}
if (process.env.LOCAL_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'development') {
  throw new Error('LOCAL_OTP_ENABLED is allowed only when NODE_ENV=development');
}
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
  throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5');
}

// Initialize Express app
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', trustProxyHops);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;
if (process.env.NODE_ENV === 'production' && configuredOrigins?.includes('*')) {
  throw new Error('CORS_ORIGIN must list explicit origins in production');
}
const corsOrigin = configuredOrigins || (process.env.NODE_ENV === 'development' ? true : false);
app.use(cors({ origin: corsOrigin }));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Payment-provider webhooks require the original raw request body for signatures.
const { handleWebhook } = require('./controllers/paymentController');
const { handleCashfreeWebhook } = require('./controllers/cashfreeController');
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), handleWebhook);
app.post('/api/payment/cashfree/webhook', express.raw({ type: 'application/json' }), handleCashfreeWebhook);

// Normal parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// API Health Check Endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🌯 Wrapchik Campus Food Ordering REST API is running!',
    status: 'ACTIVE',
    version: '1.0.0',
    timestamp: new Date(),
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/tables', require('./routes/tableRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/groups', require('./routes/groupOrderRoutes'));
app.use('/api/pickup-slots', require('./routes/pickupSlotRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));

// Seeder function
const seedInitialData = async () => {
  try {
    if (process.env.SEED_SAMPLE_CATALOGUE === 'true' && process.env.NODE_ENV !== 'development') {
      throw new Error('SEED_SAMPLE_CATALOGUE is allowed only in development');
    }
    const Category = require('./models/Category');
    const Product = require('./models/Product');
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');

    const catCount = await Category.countDocuments();
    if (catCount === 0 && process.env.SEED_SAMPLE_CATALOGUE === 'true') {
      console.log('[Seeder] Seeding initial Wrapchik categories and menu items...');

      const wrapsCat = await Category.create({ name: 'Wraps', imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600', displayOrder: 1 });
      const burgersCat = await Category.create({ name: 'Burgers', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600', displayOrder: 2 });
      const friesCat = await Category.create({ name: 'Fries & Sides', imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600', displayOrder: 3 });
      const drinksCat = await Category.create({ name: 'Drinks & Shakes', imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600', displayOrder: 4 });

      await Product.create([
        {
          name: 'Paneer Tikka Wrap',
          description: 'Grilled paneer cubes marinated in rich tandoori spices.',
          price: 120,
          imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600',
          categoryId: wrapsCat._id,
          isVeg: true,
          available: true,
        },
        {
          name: 'Classic Veg Cheese Burger',
          description: 'Juicy spiced veg patty topped with cheddar cheese.',
          price: 80,
          imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
          categoryId: burgersCat._id,
          isVeg: true,
          available: true,
        },
      ]);

      console.log('[Seeder] Default Wrapchik menu items successfully seeded!');
    }

    if (process.env.SEED_DEMO_ACCOUNTS === 'true') {
      const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD;
      const demoStudentPassword = process.env.DEMO_STUDENT_PASSWORD;
      if (demoAdminPassword && !(await User.findOne({ role: 'admin' }))) {
        await User.create({
          name: 'Wrapchik Shopkeeper Admin',
          email: process.env.DEMO_ADMIN_EMAIL || 'admin@wrapchik.com',
          phone: process.env.DEMO_ADMIN_PHONE || '+919999999999',
          passwordHash: await bcrypt.hash(demoAdminPassword, 12),
          role: 'admin',
        });
        console.log('[Seeder] Demo admin created.');
      }
      if (demoStudentPassword && !(await User.findOne({ email: process.env.DEMO_STUDENT_EMAIL || 'student@wrapchik.com' }))) {
        await User.create({
          name: 'Wrapchik Student',
          email: process.env.DEMO_STUDENT_EMAIL || 'student@wrapchik.com',
          phone: process.env.DEMO_STUDENT_PHONE || '+919999999998',
          passwordHash: await bcrypt.hash(demoStudentPassword, 12),
          role: 'student',
        });
        console.log('[Seeder] Demo student created.');
      }
    }

    const RestaurantSettings = require('./models/RestaurantSettings');
    await RestaurantSettings.getSettings();

    const Table = require('./models/Table');
    const tableCount = await Table.countDocuments();
    if (tableCount === 0) {
      const tables = [];
      for (let i = 1; i <= 8; i++) {
        tables.push({ tableNumber: i, label: `Table ${i}`, capacity: 4, qrCode: `wrapchik://dine-in?table=${i}` });
      }
      await Table.insertMany(tables);
      console.log('[Seeder] Default 8 dine-in tables created');
    }
  } catch (err) { throw err; }
};

// Error handler (last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: configuredOrigins || (process.env.NODE_ENV === 'development' ? '*' : false), methods: ['GET', 'POST'] },
});

// Initialize socket manager
socketManager.init(io);

// Require an authenticated, existing account before allowing room membership.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const User = require('./models/User');
    const user = await User.findById(decoded.id).select('_id role');
    if (!user) return next(new Error('Authentication required'));
    socket.data.userId = String(user._id);
    socket.data.role = user.role;
    return next();
  } catch (error) {
    return next(new Error('Authentication required'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  socket.join(`user_${userId}`);
  if (socket.data.role === 'admin') {
    socket.join('admin');
    socket.join('kitchen');
  }
  console.log(`[Socket.IO] User ${userId} connected`);
  socket.on('disconnect', () => console.log(`[Socket.IO] User ${userId} disconnected`));
});

const startServer = async () => {
  await connectDB();
  await seedInitialData();

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[Wrapchik Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      resolve();
    });
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`[Startup Error] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { app, httpServer, startServer };
