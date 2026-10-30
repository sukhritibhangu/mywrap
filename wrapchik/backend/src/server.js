const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const socketManager = require('./config/socketManager');

// Load environment variables
dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
}

// Initialize Express app
const app = express();
app.disable('x-powered-by');

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(v => v.trim())
      : true,
  })
);

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Razorpay webhook raw body BEFORE JSON parser
const { handleWebhook } = require('./controllers/paymentController');
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), handleWebhook);

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
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));

// Seeder function
const seedInitialData = async () => {
  try {
    const Category = require('./models/Category');
    const Product = require('./models/Product');
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');

    const seedImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Crect width=%22160%22 height=%22160%22 fill=%22%23fff3e0%22/%3E%3Ctext x=%2280%22 y=%22100%22 font-size=%2264%22 text-anchor=%22middle%22%3E%F0%9F%8C%AF%3C/text%3E%3C/svg%3E';
    const catCount = await Category.countDocuments();
    if (catCount === 0) {
      console.log('[Seeder] Seeding initial Wrapchik categories and menu items...');

      const wrapsCat = await Category.create({ imageUrl: seedImage, name: 'Wraps', displayOrder: 1 });
      const burgersCat = await Category.create({ imageUrl: seedImage, name: 'Burgers', displayOrder: 2 });
      const friesCat = await Category.create({ imageUrl: seedImage, name: 'Fries & Sides', displayOrder: 3 });
      const drinksCat = await Category.create({ imageUrl: seedImage, name: 'Drinks & Shakes', displayOrder: 4 });

      await Product.create([
        {
          name: 'Paneer Tikka Wrap',
          description: 'Grilled paneer cubes marinated in rich tandoori spices.',
          price: 120,
          categoryId: wrapsCat._id,
          imageUrl: seedImage,
          isVeg: true,
          available: true,
        },
        {
          name: 'Classic Veg Cheese Burger',
          description: 'Juicy spiced veg patty topped with cheddar cheese.',
          price: 80,
          categoryId: burgersCat._id,
          imageUrl: seedImage,
          isVeg: true,
          available: true,
        },
      ]);

      console.log('[Seeder] Default Wrapchik menu items successfully seeded!');
    }

    if (process.env.ENABLE_DEMO_LOGIN === 'true') {
      const email = 'demo@wrapchik.example';
      if (!(await User.findOne({ email }))) {
        await User.create({
          name: 'Demo Student',
          email,
          phone: '0000000000',
          passwordHash: await bcrypt.hash('WrapchikDemo2026!', 12),
          role: 'student',
        });
        console.log('[Seeder] Shared demo student created.');
      }
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
  } catch (err) {
    console.warn('[Seeder Error]:', err.message);
  }
};

// Seed only after the database connection is ready.
const databaseReady = connectDB().then(seedInitialData);

// Error handler (last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Initialize socket manager
socketManager.init(io);

// Socket.IO authentication
io.on('connection', (socket) => {
  const token = socket.handshake.query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      socket.userId = decoded.id;
      socket.join(`user_${decoded.id}`);

      const User = require('./models/User');
      User.findById(decoded.id).select('role').then(user => {
        if (user && user.role === 'admin') {
          socket.join('admin');
          socket.join('kitchen');
        }
      });
      console.log(`[Socket.IO] User ${decoded.id} connected`);
    } catch (err) {
      console.warn('[Socket.IO] Invalid token:', err.message);
    }
  }

  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`[Socket.IO] User ${socket.userId} disconnected`);
    }
  });
});

databaseReady.then(() => {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Wrapchik Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}).catch(error => {
  console.error('[Startup]', error.message);
  process.exit(1);
});
