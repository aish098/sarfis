const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request & Error Logger
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function(data) {
    if (res.statusCode >= 400) {
      console.error(`[ERROR] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Body:`, JSON.stringify(data, null, 2));
    }
    return oldJson.call(this, data);
  };
  console.log(`[REST] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/companies', require('./routes/company.routes'));
app.use('/api/accounts', require('./routes/account.routes'));
app.use('/api/journal', require('./routes/journal.routes'));
app.use('/api/ledger', require('./routes/ledger.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api', require('./routes/employee.routes'));
app.use('/api', require('./routes/notification.routes'));

// ERP Modules (Now includes Analytics)
app.use('/api', require('./routes/erp.routes'));
app.use('/api', require('./routes/voucher.routes'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend', 'dist', 'index.html'));
  });
}

app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to SARFIS API' });
});

module.exports = app;
