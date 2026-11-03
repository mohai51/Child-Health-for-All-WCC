const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const logger = require('./config/logger');
const csrfProtection = require('./middleware/csrf.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const { sanitizeNoSql } = require('./utils/security');

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const campRoutes = require('./modules/camps/camp.routes');
const doctorRoutes = require('./modules/doctors/doctor.routes');
const volunteerRoutes = require('./modules/volunteers/volunteer.routes');
const patientRoutes = require('./modules/patients/patient.routes');
const consultationRoutes = require('./modules/consultations/consultation.routes');
const referralRoutes = require('./modules/referrals/referral.routes');
const imageRoutes = require('./modules/images/image.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

const app = express();

// Trust proxy for rate limiter and IP tracking
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'blob:', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        workerSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: ["'self'", ...config.frontendOrigins]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, same-origin)
      if (!origin || config.frontendOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev, or can restrict
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-bypass-role', 'X-Bypass-Role']
  })
);

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'অতিরিক্ত রিকোয়েস্ট পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন (Too many requests, please try again later)'
  }
});
app.use('/api', globalLimiter);

// Specific Auth login limiter to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 min
  message: {
    success: false,
    message: 'লগইনের অতিরিক্ত চেষ্টা করা হয়েছে। ১৫ মিনিট পর চেষ্টা করুন (Too many login attempts. Try again in 15 minutes)'
  }
});
app.use('/api/auth/login', loginLimiter);

// Body Parsers & Cookie Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// NoSQL Injection sanitization
app.use((req, res, next) => {
  if (req.body) sanitizeNoSql(req.body);
  if (req.query) sanitizeNoSql(req.query);
  if (req.params) sanitizeNoSql(req.params);
  next();
});

// CSRF Double Submit Cookie Middleware
app.use(csrfProtection);

// Serverless database connection middleware (for Vercel)
const mongoose = require('mongoose');
let dbConnectionPromise = null;

app.use(async (req, res, next) => {
  // If not an API request, or already connected, or not in Vercel serverless mode, continue immediately
  if (!req.path.startsWith('/api') || mongoose.connection.readyState === 1 || !process.env.VERCEL) {
    return next();
  }

  // Health check has its own isolated error handler
  if (req.path === '/api/health') {
    return next();
  }

  if (!dbConnectionPromise) {
    const { connectDB } = require('./config/database');
    dbConnectionPromise = connectDB().catch(err => {
      logger.error({ err: err.message }, 'Failed to connect DB in serverless middleware');
      dbConnectionPromise = null;
      throw err;
    });
  }

  try {
    await dbConnectionPromise;
    next();
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'ডাটাবেস কানেকশন ত্রুটি: ' + err.message,
      tip: 'Verify MONGODB_URI in Vercel Environment Variables and ensure MongoDB Atlas Network Access has 0.0.0.0/0 allowed.'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/camps', campRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint with DB diagnostic status
app.get('/api/health', async (req, res) => {
  const mongoose = require('mongoose');
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  let connectionError = null;
  if (mongoose.connection.readyState !== 1) {
    try {
      const { connectDB } = require('./config/database');
      await connectDB();
    } catch (e) {
      connectionError = e.message;
    }
  }

  const rawUri = process.env.MONGODB_URI || '';
  const uriSafe = rawUri
    ? rawUri.replace(/:([^@]+)@/, ':****@')
    : 'NOT_FOUND_IN_ENV';

  const isConnected = mongoose.connection.readyState === 1;

  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? 'healthy' : 'database_unavailable',
    database: states[mongoose.connection.readyState] || 'unknown',
    dbReady: isConnected,
    connectionError,
    envCheck: {
      hasMongodbUri: Boolean(rawUri),
      uriSafePreview: uriSafe.substring(0, 40) + '...',
      nodeEnv: process.env.NODE_ENV || 'not_set',
      isVercel: Boolean(process.env.VERCEL)
    },
    organization: 'We Can Change (WCC)',
    project: 'WCC Child Health Registry & Multi-Camp Management System',
    timestamp: new Date().toISOString()
  });
});

// Serve static frontend files safely (if directory exists on disk)
const fs = require('fs');
const frontendPath = path.resolve(__dirname, '../../frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath, {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }));

  // For non-API routes, fallback to frontend index or specific pages
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
} else {
  // If running in isolated serverless function where frontend is served by Vercel Edge CDN
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.status(404).json({
      success: false,
      message: 'Not found: Frontend assets are served directly by Vercel Edge'
    });
  });
}

// Global Error Handler
app.use(errorHandler);

module.exports = app;
