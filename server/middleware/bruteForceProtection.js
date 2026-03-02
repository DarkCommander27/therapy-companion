/**
 * Brute Force Protection Middleware
 * Tracks failed login attempts and implements exponential backoff lockouts
 * Uses in-memory storage (can be upgraded to Redis for distributed systems)
 */

const logger = require('../utils/logger');

// Store for failed attempts: { key: { attempts, lastAttempt, lockedUntil } }
const attemptStore = new Map();

// Configuration
const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 15 * 60 * 1000; // 15 minutes
const RESET_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Calculate lockout duration based on attempt count
 * Exponential backoff: 1s → 2s → 4s → 8s → 16s → 15min
 */
function calculateLockoutDuration(failureCount) {
  if (failureCount >= MAX_ATTEMPTS) {
    return Math.min(INITIAL_DELAY_MS * Math.pow(2, failureCount - 1), MAX_DELAY_MS);
  }
  return 0;
}

/**
 * Check if an IP/email combo is currently locked out
 */
function isLocked(key) {
  const record = attemptStore.get(key);
  if (!record) return false;

  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    return true;
  }

  return false;
}

/**
 * Get lockout status and remaining time
 */
function getLockoutStatus(key) {
  const record = attemptStore.get(key);
  if (!record) {
    return { locked: false, remainingMs: 0, attempts: 0 };
  }

  const now = Date.now();
  const locked = record.lockedUntil && record.lockedUntil > now;
  const remainingMs = locked ? record.lockedUntil - now : 0;

  return {
    locked,
    remainingMs,
    attempts: record.attempts,
    lockedUntil: record.lockedUntil
  };
}

/**
 * Record a failed login attempt
 * Returns: { locked, remainingMs, attempts, message }
 */
function recordFailure(key) {
  const record = attemptStore.get(key) || {
    attempts: 0,
    lastAttempt: Date.now(),
    lockedUntil: null
  };

  record.attempts += 1;
  record.lastAttempt = Date.now();

  const lockoutDuration = calculateLockoutDuration(record.attempts);
  if (lockoutDuration > 0) {
    record.lockedUntil = Date.now() + lockoutDuration;
  }

  attemptStore.set(key, record);

  const status = getLockoutStatus(key);
  logger.debug(`🔒 Brute-force: ${key} - Attempt ${record.attempts}/${MAX_ATTEMPTS}, locked: ${status.locked}`);

  return {
    locked: status.locked,
    remainingMs: status.remainingMs,
    attempts: record.attempts,
    message: status.locked
      ? `Too many failed attempts. Please try again in ${Math.ceil(status.remainingMs / 1000)} seconds.`
      : `Invalid credentials. ${MAX_ATTEMPTS - record.attempts} attempts remaining.`
  };
}

/**
 * Clear failed attempts for a key (successful login)
 */
function clearAttempts(key) {
  attemptStore.delete(key);
  logger.debug(`✓ Brute-force: Attempts cleared for ${key}`);
}

/**
 * Middleware: Check for brute-force lockout
 * Usage: router.post('/login', checkBruteForce('email'), ...)
 *
 * @param {Function} keyFn - Function to extract key from req (e.g., req => req.body.email)
 * @param {Object} options - Configuration options
 */
function checkBruteForce(keyFn, options = {}) {
  const opts = {
    maxAttempts: options.maxAttempts || MAX_ATTEMPTS,
    delayMs: options.delayMs || INITIAL_DELAY_MS,
    maxDelayMs: options.maxDelayMs || MAX_DELAY_MS
  };

  return (req, res, next) => {
    const key = typeof keyFn === 'function' ? keyFn(req) : keyFn;

    if (!key) {
      logger.warn('⚠ Brute-force middleware: No key provided');
      return next();
    }

    const status = getLockoutStatus(key);

    if (status.locked) {
      logger.warn(`🚫 Brute-force: Account locked for ${key}`);
      return res.status(429).json({
        success: false,
        error: 'Too many failed login attempts',
        retryAfterSeconds: Math.ceil(status.remainingMs / 1000),
        message: `Please try again in ${Math.ceil(status.remainingMs / 1000)} seconds.`
      });
    }

    // Store key for use in route handlers
    req.bruteForceKey = key;
    next();
  };
}

/**
 * Middleware: Handle failed login (call after auth failure)
 * Usage: After checking password fails
 */
function handleFailedLogin(req, res, next) {
  if (!req.bruteForceKey) {
    return next();
  }

  const status = recordFailure(req.bruteForceKey);

  if (status.locked) {
    return res.status(429).json({
      success: false,
      error: 'Too many failed login attempts',
      retryAfterSeconds: Math.ceil(status.remainingMs / 1000),
      attempts: status.attempts,
      message: status.message
    });
  }

  // Don't block on first failures, but return 401 with attempt count
  req.loginFailureStatus = status;
  next();
}

/**
 * Middleware: Clear attempts on successful login (call in route handler)
 * Usage: After successful authentication
 */
function handleSuccessfulLogin(req) {
  if (req.bruteForceKey) {
    clearAttempts(req.bruteForceKey);
  }
}

/**
 * Cleanup expired records (run periodically)
 */
function cleanupExpiredRecords() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of attemptStore.entries()) {
    // Remove if last attempt was > 1 hour ago
    if (now - record.lastAttempt > RESET_INTERVAL_MS) {
      attemptStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`🧹 Brute-force: Cleaned ${cleaned} expired records`);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredRecords, 10 * 60 * 1000);

module.exports = {
  checkBruteForce,
  handleFailedLogin,
  handleSuccessfulLogin,
  recordFailure,
  clearAttempts,
  getLockoutStatus,
  isLocked,
  cleanupExpiredRecords,
  // For testing
  __testing: {
    attemptStore,
    calculateLockoutDuration
  }
};
