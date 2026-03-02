/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP/user with token bucket algorithm
 * Integrates with brute-force protection for auth endpoints
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Get client IP from request
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.connection.remoteAddress || req.ip || 'unknown';
}

// Store for rate limit data with token bucket algorithm
const tokenBucketStore = new Map();

/**
 * Token bucket rate limiter implementation
 * More flexible than simple counter-based limiting
 */
function createTokenBucketLimiter(options = {}) {
  const {
    maxTokens = 100,
    refillRatePerSecond = 1,
    windowMs = 60 * 1000,
    keyGenerator = getClientIp,
    handler = null,
    skip = null
  } = options;

  return (req, res, next) => {
    if (skip && skip(req)) {
      return next();
    }

    const key = typeof keyGenerator === 'function' ? keyGenerator(req) : keyGenerator;
    const now = Date.now();

    // Initialize or refill bucket
    let bucket = tokenBucketStore.get(key);
    if (!bucket) {
      bucket = {
        tokens: maxTokens,
        lastRefill: now
      };
      tokenBucketStore.set(key, bucket);
    } else {
      // Refill tokens based on elapsed time
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd = (timePassed / 1000) * refillRatePerSecond;
      bucket.tokens = Math.min(bucket.tokens + tokensToAdd, maxTokens);
      bucket.lastRefill = now;
    }

    // Check if request can proceed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      req.tokenBucketRemaining = Math.floor(bucket.tokens);
      return next();
    }

    // Rate limit exceeded
    const resetAfterSeconds = Math.ceil((1 - bucket.tokens) / refillRatePerSecond);
    logger.warn(`⚠ Token bucket limit exceeded for ${key}: ${maxTokens} req/${windowMs}ms`);

    if (handler && typeof handler === 'function') {
      return handler(req, res, resetAfterSeconds);
    }

    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfterSeconds: resetAfterSeconds,
      message: `Rate limit exceeded. Please try again in ${resetAfterSeconds} seconds.`
    });
  };
}

/**
 * Standalone token bucket limiter for testing
 */
const tokenBucketMiddleware = createTokenBucketLimiter;
const rateLimiter = createTokenBucketLimiter;

// ============================================
// EXPRESS-RATE-LIMIT LIMITERS (for compatibility)
// ============================================

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health';
  },
  handler: (req, res) => {
    logger.warn(`Global rate limit exceeded from ${getClientIp(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the global rate limit. Please try again later.'
    });
  }
});

// Auth endpoint limiter (very strict)
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Max 10 attempts per 5 minutes
  message: 'Too many login attempts, please try again after 5 minutes.',
  keyGenerator: (req) => {
    // Rate limit per email + IP combination
    const email = req.body?.email || req.body?.username || '';
    const ip = getClientIp(req);
    return `auth:${email}:${ip}`;
  },
  skipSuccessfulRequests: false,
  skip: (req) => {
    return req.method !== 'POST' || (!req.path.includes('/login') && !req.path.includes('/register'));
  },
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded from ${getClientIp(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many login attempts',
      message: 'Too many failed attempts. Please try again after 5 minutes.',
      retryAfterSeconds: 300
    });
  }
});

// Companion chat message limiter (stricter)
const companionChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.COMPANION_CHAT_RATE_LIMIT_MAX || 30,
  message: 'Too many messages. Please wait before sending another.',
  keyGenerator: (req) => {
    // Rate limit per user ID instead of IP
    return req.userId || req.user?.id || getClientIp(req);
  },
  skip: (req) => {
    return req.method !== 'POST' || !req.path.includes('/chat');
  },
  handler: (req, res) => {
    logger.warn(`Chat rate limit exceeded for user ${req.userId || getClientIp(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many messages',
      message: 'You are sending messages too quickly. Please wait before sending another.'
    });
  }
});

// Search endpoint limiter
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: process.env.SEARCH_RATE_LIMIT_MAX || 30,
  keyGenerator: (req) => {
    return req.userId || req.staffId || getClientIp(req);
  },
  skip: (req) => {
    return req.method !== 'POST' || !req.path.includes('/search');
  },
  handler: (req, res) => {
    logger.warn(`Search rate limit exceeded for ${req.userId || getClientIp(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many search requests',
      message: 'You are searching too frequently. Please wait before searching again.',
      retryAfterSeconds: 60
    });
  }
});

/**
 * Apply all rate limiters to app
 */
function applyRateLimiters(app) {
  app.use('/api/staff/login', authLimiter);
  app.use('/api/users/login', authLimiter);
  app.use('/api/staff/register', authLimiter);
  app.use('/api/conversations/search', searchLimiter);
  app.use('/api/chat', companionChatLimiter);
  // Global limiter last (catches everything else)
  app.use(globalLimiter);
}

/**
 * Create a per-user rate limiter
 * Usage: router.get('/search', perUserRateLimiter('search'), ...)
 */
function perUserRateLimiter(limitType = 'global', options = {}) {
  return createTokenBucketLimiter({
    ...options,
    keyGenerator: (req) => {
      // Use userId if authenticated, fall back to IP
      const userId = req.userId || req.staffId || req.user?.id;
      const clientIp = getClientIp(req);
      return userId ? `user:${userId}:${limitType}` : `ip:${clientIp}:${limitType}`;
    }
  });
}

/**
 * Create endpoint-specific rate limiter
 * Usage: router.get('/api/endpoint', endpointRateLimiter('endpoint', 50, 60000), ...)
 */
function endpointRateLimiter(endpoint, maxRequests, windowMs) {
  return createTokenBucketLimiter({
    maxTokens: maxRequests,
    windowMs,
    keyGenerator: (req) => `endpoint:${endpoint}:${getClientIp(req)}`
  });
}

/**
 * Cleanup old token bucket records periodically
 */
function cleanupTokenBuckets() {
  const now = Date.now();
  const maxAgeMs = 60 * 60 * 1000; // 1 hour

  for (const [key, bucket] of tokenBucketStore.entries()) {
    if (now - bucket.lastRefill > maxAgeMs) {
      tokenBucketStore.delete(key);
    }
  }
}

setInterval(cleanupTokenBuckets, 30 * 60 * 1000); // Cleanup every 30 minutes

module.exports = {
  globalLimiter,
  companionChatLimiter,
  authLimiter,
  searchLimiter,
  applyRateLimiters,
  createTokenBucketLimiter,
  rateLimiter,
  perUserRateLimiter,
  endpointRateLimiter,
  getClientIp,
  // For testing
  __testing: {
    tokenBucketStore,
    cleanupTokenBuckets
  }
};
