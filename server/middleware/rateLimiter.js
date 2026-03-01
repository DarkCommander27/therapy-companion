/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP/user
 */

const rateLimit = require('express-rate-limit');

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Companion chat message limiter (stricter)
const companionChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.COMPANION_CHAT_RATE_LIMIT_MAX || 50, // Max 50 messages per 15 min
  message: 'Too many messages sent. Please wait before sending another message.',
  keyGenerator: (req) => {
    // Rate limit per user ID instead of IP
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip for non-chat endpoints
    return !req.path.includes('/chat') || req.method !== 'POST';
  }
});

// Auth endpoint limiter (very strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Max 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again after 15 minutes.',
  skipSuccessfulRequests: true,
  skip: (req) => {
    return !req.path.includes('/auth') || req.method !== 'POST';
  }
});

/**
 * Apply all rate limiters
 */
function applyRateLimiters(app) {
  app.use(globalLimiter);
  app.use(authLimiter);
  app.use(companionChatLimiter);
}

module.exports = {
  globalLimiter,
  companionChatLimiter,
  authLimiter,
  applyRateLimiters
};
