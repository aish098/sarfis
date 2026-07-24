const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const couponRoutes = require('./routes/couponRoutes');
const companyRoutes = require('./routes/companyRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware for production diagnostics
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root Health Check & API Meta Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SaaS Admin Dashboard API',
    version: '1.0.0',
    status: 'ONLINE',
    message: 'Production-Ready SaaS Admin Dashboard API is running smoothly!',
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
