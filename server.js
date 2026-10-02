require('dotenv').config();
const express = require('express');
const path = require('path');
const { init } = require('./database/init');
const { pool } = require('./config/db');

const app = express();

// Express 4 does not automatically forward rejected async route handlers.
// Wrap router methods before loading the project routes so a DB/API failure
// becomes a normal Express error response instead of an unhandled rejection.
const OriginalRouter = express.Router;
express.Router = function patchedRouter(...args) {
  const router = OriginalRouter.apply(express, args);
  for (const method of ['get','post','put','patch','delete','options','head','all']) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) => original(path, ...handlers.map((handler) => {
      if (typeof handler !== 'function' || handler.length >= 4) return handler;
      return function wrappedHandler(req, res, next) {
        try {
          return Promise.resolve(handler(req, res, next)).catch(next);
        } catch (err) {
          return next(err);
        }
      };
    }));
  }
  return router;
};

const port = Number(process.env.PORT) || 3000;
let dbReady = false;
let dbError = null;
let retryTimer = null;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

pool.on('error', (err) => {
  console.error('[DB POOL ERROR]', err.message);
  dbError = err;
});

// Health/status endpoint is available even while PostgreSQL is unavailable.
app.get('/api/shop-info', (_req, res) => {
  res.json({
    shop_name: process.env.SHOP_NAME || 'THE ONE Bakery',
    phone: process.env.SHOP_PHONE || '',
    line_url: process.env.SHOP_LINE_URL || ''
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    dbReady = true;
    dbError = null;
    res.json({ ok: true, service: 'THE ONE Bakery V7', database: 'connected', initialized: dbReady });
  } catch (err) {
    dbReady = false;
    dbError = err;
    res.status(503).json({ ok: false, service: 'THE ONE Bakery V7', database: 'disconnected', error: err.message });
  }
});

// Public routes/pages should still be reachable even if DB init is temporarily failing.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/production', require('./routes/production'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/inventory', require('./routes/inventory'));

// Unknown API endpoints should return JSON instead of the SPA page.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'ไม่พบ API endpoint นี้' });
});

// Central error handler: no route-level DB error should terminate Node.
app.use((err, req, res, _next) => {
  console.error('[API ERROR]', req.method, req.originalUrl, err);
  if (res.headersSent) return;
  const status = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
  res.status(status).json({
    error: 'เกิดข้อผิดพลาดในการประมวลผลคำขอ',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function initializeDatabase() {
  try {
    await init();
    dbReady = true;
    dbError = null;
    console.log('DATABASE READY');
  } catch (err) {
    dbReady = false;
    dbError = err;
    console.error('DATABASE INIT FAILED:', err.message);
    console.error('Server will stay running. Fix DATABASE_URL/PostgreSQL, then the app will retry automatically.');
    scheduleDatabaseRetry();
  }
}

function scheduleDatabaseRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    await initializeDatabase();
  }, 5000);
}

// Keep unexpected promise rejections from killing the development server.
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  // Do not process.exit() here. The server remains available for inspection.
});

const server = app.listen(port, () => {
  console.log(`THE ONE Bakery V7 running http://localhost:${port}`);
  initializeDatabase();
});

function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (retryTimer) clearTimeout(retryTimer);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
