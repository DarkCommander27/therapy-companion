/**
 * Security Headers Middleware
 * Implements HTTP security headers to prevent various attacks:
 * - HSTS (HTTP Strict Transport Security)
 * - CSP (Content Security Policy)
 * - X-Frame-Options (Clickjacking prevention)
 * - X-Content-Type-Options (MIME sniffing prevention)
 * - X-XSS-Protection (Legacy XSS filter)
 * - Referrer-Policy (Information leakage prevention)
 * - Permissions-Policy (Feature access control)
 */

const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * Configure Content Security Policy (CSP)
 * Prevents XSS attacks by controlling resource origins
 */
function getCSPConfig() {
  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Acceptable for development, should be removed in production
        "'unsafe-eval'"    // For some frameworks, remove if not needed
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Acceptable for inline styles
        'https://fonts.googleapis.com'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https:',
        'blob:'
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'data:'
      ],
      connectSrc: [
        "'self'",
        'https:' // Allow HTTPS connections only
      ],
      frameSrc: [
        "'self'"
      ],
      formAction: [
        "'self'"
      ],
      frameAncestors: [
        "'self'"
      ],
      baseUri: [
        "'self'"
      ],
      manifestSrc: [
        "'self'"
      ]
    },
    reportUri: process.env.CSP_REPORT_URI || '/api/security/csp-report'
  };
}

/**
 * Main security headers middleware using Helmet
 */
function securityHeadersMiddleware() {
  return helmet({
    // HSTS - Forces HTTPS for specified time
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true // For addition to HSTS preload list
    },

    // Content Security Policy
    contentSecurityPolicy: {
      directives: getCSPConfig().directives,
      reportUri: getCSPConfig().reportUri
    },

    // X-Frame-Options - Prevent clickjacking
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options - Prevent MIME sniffing
    noSniff: true,

    // X-XSS-Protection - Legacy XSS filter (redundant with CSP)
    xssFilter: {
      mode: 'block',
      reportUri: '/api/security/xss-report'
    },

    // Referrer-Policy - Control referrer information
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },

    // Permissions-Policy (formerly Feature-Policy)
    permissionsPolicy: {
      features: {
        accelerometer: ['self'],
        'ambient-light-sensor': ['self'],
        autoplay: ['self'],
        camera: ['self'],
        'encrypted-media': ['self'],
        fullscreen: ['self'],
        geolocation: ['self'],
        gyroscope: ['self'],
        magnetometer: ['self'],
        microphone: ['self'],
        midi: ['self'],
        payment: ['self'],
        usb: ['self'],
        vr: ['self'],
        'xr-spatial-tracking': ['self']
      }
    }
  });
}

/**
 * Custom security headers middleware
 */
function customSecurityHeaders() {
  return (req, res, next) => {
    // Disable server info exposure
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Powered-By', 'CareBridge-Companion');

    // Prevent clients from reading service worker
    res.setHeader('X-Service-Worker', 'nope');

    // Prevent access to certain resources from iframes
    res.setHeader('X-Frame-Options', 'DENY');

    // Don't allow prefetching to leak info
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Disable client-side caching for sensitive pages
    if (req.path.includes('/api/') && req.method !== 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Add timestamp header for audit trails
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Timestamp', new Date().toISOString());

    next();
  };
}

/**
 * Rate limit headers middleware
 * Adds rate limit info to response headers
 */
function rateLimitHeadersMiddleware() {
  return (req, res, next) => {
    // Only add if rate limit info is available
    if (req.rateLimit) {
      res.set('X-RateLimit-Limit', req.rateLimit.limit || '');
      res.set('X-RateLimit-Remaining', req.rateLimit.remaining || '');
      res.set('X-RateLimit-Reset', req.rateLimit.resetTime || '');
    }

    next();
  };
}

/**
 * CORS configuration
 */
function getCORSConfig() {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ];

  // Add production domains if env var is set
  if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
  }

  return {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS rejected request from origin: ${origin}`);
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
    maxAge: 86400 // 24 hours
  };
}

/**
 * Apply all security headers middleware
 */
function applySecurityHeaders(app) {
  // Core security headers via Helmet
  app.use(securityHeadersMiddleware());

  // Custom security headers
  app.use(customSecurityHeaders());

  // Rate limit headers
  app.use(rateLimitHeadersMiddleware());

  logger.info('✓ Security headers middleware applied');
}

/**
 * CSP violation reporting handler
 */
function handleCSPViolation(req, res) {
  const violation = req.body;

  logger.warn('CSP Violation:', {
    blockedURI: violation['blocked-uri'],
    violatedDirective: violation['violated-directive'],
    originalPolicy: violation['original-policy'],
    documentURI: violation['document-uri'],
    sourceFile: violation['source-file'],
    lineNumber: violation['line-number'],
    columnNumber: violation['column-number'],
    userAgent: req.headers['user-agent']
  });

  // You could log to monitoring service here
  res.status(204).send();
}

/**
 * XSS violation reporting handler
 */
function handleXSSViolation(req, res) {
  logger.warn('XSS Violation detected:', {
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
    ip: req.ip,
    path: req.path
  });

  res.status(204).send();
}

module.exports = {
  // Middleware functions
  securityHeadersMiddleware,
  customSecurityHeaders,
  rateLimitHeadersMiddleware,
  applySecurityHeaders,
  // Handlers
  handleCSPViolation,
  handleXSSViolation,
  // Configuration
  getCSPConfig,
  getCORSConfig
};
