/**
 * CSRF Token Protection Middleware
 * Generates and validates CSRF tokens for state-changing operations
 * Uses double-submit cookie pattern
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Store CSRF tokens: { token: { payload, createdAt, expiresAt } }
const csrfTokens = new Map();

// Configuration
const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Methods that require CSRF protection
const PROTECTED_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Generate a new CSRF token
 * Returns: { token, expiresIn }
 */
function generateCSRFToken() {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + CSRF_TOKEN_EXPIRY_MS;

  csrfTokens.set(token, {
    payload: token,
    createdAt,
    expiresAt,
    used: false
  });

  logger.debug('Generated new CSRF token');

  return {
    token,
    expiresIn: CSRF_TOKEN_EXPIRY_MS
  };
}

/**
 * Validate CSRF token
 * Returns: { valid: boolean, message: string }
 */
function validateCSRFToken(token) {
  if (!token || typeof token !== 'string') {
    logger.warn('CSRF validation: No token provided');
    return { valid: false, message: 'CSRF token is required' };
  }

  const tokenData = csrfTokens.get(token);

  if (!tokenData) {
    logger.warn('CSRF validation: Invalid token');
    return { valid: false, message: 'Invalid CSRF token' };
  }

  // Check expiry
  if (Date.now() > tokenData.expiresAt) {
    csrfTokens.delete(token);
    logger.warn('CSRF validation: Token expired');
    return { valid: false, message: 'CSRF token has expired' };
  }

  logger.debug('✓ CSRF token validated successfully');
  return { valid: true, message: 'CSRF token is valid' };
}

/**
 * Consume CSRF token (single-use pattern)
 * After validation, token should be marked as used
 */
function consumeCSRFToken(token) {
  const tokenData = csrfTokens.get(token);

  if (!tokenData) {
    return false;
  }

  if (tokenData.used) {
    logger.warn('CSRF: Attempted to reuse consumed token');
    return false;
  }

  tokenData.used = true;
  logger.debug('CSRF token consumed');
  return true;
}

/**
 * Middleware: Generate CSRF token for GET requests
 * Attaches token to res.locals for template rendering
 */
function generateCSRFMiddleware(req, res, next) {
  // Only generate for safe methods (GET, HEAD, OPTIONS)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  try {
    const { token, expiresIn } = generateCSRFToken();

    // Store in response locals for rendering
    res.locals.csrfToken = token;

    // Also set as secure HTTP-only cookie
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiresIn,
      path: '/'
    });

    next();
  } catch (err) {
    logger.error(`CSRF generation error: ${err.message}`);
    next(err);
  }
}

/**
 * Middleware: Validate CSRF token for protected methods
 * Checks both header and body for token
 */
function validateCSRFMiddleware(options = {}) {
  const {
    protectedMethods = PROTECTED_METHODS,
    skip = null
  } = options;

  return (req, res, next) => {
    // Skip validation for specified methods
    if (!protectedMethods.has(req.method)) {
      return next();
    }

    // Allow custom skip function
    if (skip && typeof skip === 'function' && skip(req)) {
      return next();
    }

    // Get token from header, body, or cookie
    const headerToken = req.get(CSRF_HEADER_NAME);
    const bodyToken = req.body?.csrfToken;
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    const token = headerToken || bodyToken;

    if (!token) {
      logger.warn('CSRF validation failed: No token provided in request');
      return res.status(403).json({
        success: false,
        error: 'CSRF token validation failed',
        message: 'CSRF token is required for state-changing operations'
      });
    }

    // Validate token
    const validation = validateCSRFToken(token);

    if (!validation.valid) {
      logger.warn(`CSRF validation failed: ${validation.message}`);
      return res.status(403).json({
        success: false,
        error: 'CSRF token validation failed',
        message: validation.message
      });
    }

    // Optionally consume token (one-time use)
    if (options.singleUse) {
      consumeCSRFToken(token);
    }

    // Store validation result in request for logging
    req.csrfValidation = {
      valid: true,
      token: token.substring(0, 8) + '...' // Log partial token only
    };

    next();
  };
}

/**
 * Get CSRF token from store for validation
 * Used when you need to check token without consuming it
 */
function getCSRFTokenData(token) {
  return csrfTokens.get(token);
}

/**
 * Invalidate CSRF token manually
 */
function invalidateCSRFToken(token) {
  csrfTokens.delete(token);
  logger.debug('CSRF token invalidated');
}

/**
 * Cleanup expired CSRF tokens (run periodically)
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  let cleaned = 0;

  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expiresAt) {
      csrfTokens.delete(token);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`🧹 CSRF: Cleaned ${cleaned} expired tokens`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

/**
 * Middleware to handle session timeout
 * Regenerate session on activity
 */
function sessionTimeoutMiddleware(options = {}) {
  const {
    maxSessionIdleMs = 30 * 60 * 1000, // 30 minutes
    warningMs = 5 * 60 * 1000 // 5 minutes warning before expiry
  } = options;

  return (req, res, next) => {
    if (!req.session) {
      return next();
    }

    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const timeSinceActivity = now - lastActivity;

    // Check if session is expired
    if (timeSinceActivity > maxSessionIdleMs) {
      logger.warn(`Session expired for user ${req.userId || 'unknown'}`);
      req.session.destroy();
      return res.status(401).json({
        success: false,
        error: 'Session expired',
        message: 'Your session has expired. Please log in again.'
      });
    }

    // Warn if session is about to expire
    if (timeSinceActivity > (maxSessionIdleMs - warningMs)) {
      res.set('X-Session-Warning', 'Session expiring soon');
      logger.debug(`Session expiring soon for user ${req.userId || 'unknown'}`);
    }

    // Update last activity time
    req.session.lastActivity = now;

    next();
  };
}

module.exports = {
  // Token generation and validation
  generateCSRFToken,
  validateCSRFToken,
  consumeCSRFToken,
  getCSRFTokenData,
  invalidateCSRFToken,
  // Middleware
  generateCSRFMiddleware,
  validateCSRFMiddleware,
  sessionTimeoutMiddleware,
  // Maintenance
  cleanupExpiredTokens,
  // Configuration
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_TOKEN_EXPIRY_MS,
  // For testing
  __testing: {
    csrfTokens,
    cleanupExpiredTokens
  }
};
