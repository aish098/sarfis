const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db/knex');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const couponRoutes = require('./routes/couponRoutes');
const companyRoutes = require('./routes/companyRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

// Trust Nginx Reverse Proxy Header
app.set('trust proxy', 1);

// Security Headers & Server Identification Masking
app.use(helmet());
app.disable('x-powered-by');

// Restricted CORS configuration
const allowedOrigin = process.env.ADMIN_FRONTEND_URL || '*';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

app.use(express.json());

// Global API Rate Limiter (100 requests per 15 minutes per IP)
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Global API rate limit exceeded. Please slow down your requests.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalApiLimiter);

// Request logging middleware for production diagnostics
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- OPERATIONAL OBSERVABILITY & HEALTH PROBES ---

// 1. Liveness Probe (Is server process responsive?)
app.get('/live', (req, res) => {
  res.status(200).json({
    status: 'ALIVE',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// 2. Readiness Probe (Is database query engine functional?)
app.get('/ready', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.status(200).json({
      status: 'READY',
      database: 'CONNECTED',
      timestamp: new Date()
    });
  } catch (dbErr) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      database: 'DISCONNECTED',
      error: dbErr.message,
      timestamp: new Date()
    });
  }
});

// 3. Comprehensive System Health Probe
app.get('/health', async (req, res) => {
  let dbStatus = 'DISCONNECTED';
  try {
    await db.raw('SELECT 1');
    dbStatus = 'CONNECTED';
  } catch (e) {}

  const memoryUsage = process.memoryUsage();
  res.status(200).json({
    name: 'SaaS Admin Dashboard API',
    version: '1.0.0',
    status: 'HEALTHY',
    database: dbStatus,
    uptime_seconds: Math.floor(process.uptime()),
    memory: {
      rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
      heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024)
    },
    node_version: process.version,
    timestamp: new Date()
  });
});

// Root Health Check & API Meta Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SaaS Admin Dashboard API',
    version: '1.0.0',
    status: 'ONLINE',
    security: 'JWT + Refresh Token Rotation, RBAC, Rate Limiting, Zod Schema Validation',
    timestamp: new Date()
  });
});

// Registered API Module Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Global 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'ROUTE_NOT_FOUND',
    message: `The requested endpoint '${req.method} ${req.url}' does not exist on this server.`
  });
});

// Centralized Error Handling Middleware
app.use(errorMiddleware);

module.exports = app;
