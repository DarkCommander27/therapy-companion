/**
 * Multi-Factor Authentication (MFA) Utilities
 * Supports:
 * - TOTP (Time-based One-Time Password) for authenticator apps
 * - Email/SMS OTP (One-Time Password)
 * - Backup codes
 * - Session management during MFA challenges
 */

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// Store for MFA sessions: { sessionId: { userId, method, attempts, createdAt, expiresAt } }
const mfaSessions = new Map();

// Configuration
const MFA_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MFA_SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const OTP_LENGTH = 6;
const MAX_MFA_ATTEMPTS = 3;
const BACKUP_CODE_COUNT = 10;

/**
 * Generate TOTP secret for setup
 * Returns: { secret, qrCode, manualEntry }
 */
async function generateTOTPSecret(email, issuer = 'CareBridge Companion') {
  try {
    const secret = speakeasy.generateSecret({
      name: `${issuer} (${email})`,
      issuer,
      length: 32
    });

    // Generate QR code for scanning
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    logger.debug(`Generated TOTP secret for ${email}`);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCode,
      manualEntry: secret.base32
    };
  } catch (err) {
    logger.error(`Failed to generate TOTP secret: ${err.message}`);
    throw err;
  }
}

/**
 * Verify TOTP code
 * accounts for time drift (±30 seconds)
 */
function verifyTOTPCode(secret, code, window = 1) {
  try {
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code.toString(),
      window // Allow 1 step before and after (30-second intervals)
    });

    if (isValid) {
      logger.debug('✓ TOTP code verified successfully');
    } else {
      logger.debug('✗ Invalid TOTP code');
    }

    return isValid;
  } catch (err) {
    logger.error(`TOTP verification failed: ${err.message}`);
    return false;
  }
}

/**
 * Generate OTP code (6 digits)
 * Used for SMS/Email verification
 */
function generateOTPCode() {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + MFA_CODE_EXPIRY_MS;

  return {
    code,
    expiresAt,
    expiresIn: MFA_CODE_EXPIRY_MS
  };
}

/**
 * Verify OTP code with expiry check
 */
function verifyOTPCode(providedCode, storedCode, expiresAt) {
  if (Date.now() > expiresAt) {
    logger.warn('OTP code expired');
    return false;
  }

  const isValid = providedCode.toString() === storedCode.toString();

  if (isValid) {
    logger.debug('✓ OTP code verified successfully');
  } else {
    logger.debug('✗ Invalid OTP code');
  }

  return isValid;
}

/**
 * Generate backup codes
 * Returns array of 10 single-use codes
 */
function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  const codes = [];

  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push({
      code,
      used: false,
      createdAt: Date.now()
    });
  }

  logger.debug(`Generated ${count} backup codes`);
  return codes;
}

/**
 * Verify and consume backup code
 */
function verifyBackupCode(backupCodes, providedCode) {
  const codeObj = backupCodes.find(b => b.code === providedCode.toUpperCase() && !b.used);

  if (codeObj) {
    codeObj.used = true;
    logger.info(`✓ Backup code verified (${codeObj.code})`);
    return true;
  }

  logger.warn(`✗ Invalid or already used backup code`);
  return false;
}

/**
 * Create MFA session (challenge)
 * Used when user initiates MFA verification
 */
function createMFASession(userId, method, options = {}) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + MFA_SESSION_EXPIRY_MS;

  const session = {
    sessionId,
    userId,
    method, // 'totp' | 'sms' | 'email'
    attempts: 0,
    maxAttempts: MAX_MFA_ATTEMPTS,
    createdAt,
    expiresAt,
    verified: false,
    ...options
  };

  mfaSessions.set(sessionId, session);

  logger.debug(`Created MFA session for user ${userId} (method: ${method})`);

  return {
    sessionId,
    expiresIn: MFA_SESSION_EXPIRY_MS
  };
}

/**
 * Get active MFA session
 */
function getMFASession(sessionId) {
  const session = mfaSessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check expiry
  if (Date.now() > session.expiresAt) {
    mfaSessions.delete(sessionId);
    logger.debug('MFA session expired');
    return null;
  }

  return session;
}

/**
 * Record MFA verification attempt
 */
function recordMFAAttempt(sessionId) {
  const session = getMFASession(sessionId);

  if (!session) {
    return { success: false, message: 'Invalid or expired MFA session', locked: false };
  }

  session.attempts += 1;

  if (session.attempts >= session.maxAttempts) {
    mfaSessions.delete(sessionId);
    logger.warn(`MFA maximum attempts exceeded for user ${session.userId}`);
    return {
      success: false,
      message: 'Maximum verification attempts exceeded. Please try again later.',
      locked: true,
      attemptsRemaining: 0
    };
  }

  return {
    success: true,
    attemptsRemaining: session.maxAttempts - session.attempts,
    locked: false
  };
}

/**
 * Mark MFA session as verified
 */
function markMFAVerified(sessionId) {
  const session = getMFASession(sessionId);

  if (!session) {
    return false;
  }

  session.verified = true;
  logger.info(`✓ MFA verified for user ${session.userId} (method: ${session.method})`);
  return true;
}

/**
 * Complete MFA session and cleanup
 */
function completeMFASession(sessionId) {
  const session = getMFASession(sessionId);

  if (!session) {
    return false;
  }

  if (!session.verified) {
    logger.warn(`Attempted to complete unverified MFA session`);
    return false;
  }

  mfaSessions.delete(sessionId);
  logger.debug(`Completed MFA session for user ${session.userId}`);
  return true;
}

/**
 * Clear MFA session
 */
function clearMFASession(sessionId) {
  mfaSessions.delete(sessionId);
  logger.debug(`Cleared MFA session`);
}

/**
 * Validate email address format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone) {
  // Accept various international formats
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone.toString().trim());
}

/**
 * Format phone number for display
 */
function formatPhoneForDisplay(phone) {
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    // US format: (XXX) XXX-XXXX
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

/**
 * Cleanup expired MFA sessions (run periodically)
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of mfaSessions.entries()) {
    if (now > session.expiresAt) {
      mfaSessions.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`🧹 MFA: Cleaned ${cleaned} expired sessions`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

module.exports = {
  // TOTP
  generateTOTPSecret,
  verifyTOTPCode,
  // OTP
  generateOTPCode,
  verifyOTPCode,
  // Backup codes
  generateBackupCodes,
  verifyBackupCode,
  // MFA sessions
  createMFASession,
  getMFASession,
  recordMFAAttempt,
  markMFAVerified,
  completeMFASession,
  clearMFASession,
  // Validation
  isValidEmail,
  isValidPhoneNumber,
  formatPhoneForDisplay,
  // Cleanup
  cleanupExpiredSessions,
  // Constants
  MFA_CODE_EXPIRY_MS,
  MFA_SESSION_EXPIRY_MS,
  OTP_LENGTH,
  MAX_MFA_ATTEMPTS,
  BACKUP_CODE_COUNT,
  // For testing
  __testing: {
    mfaSessions,
    cleanupExpiredSessions
  }
};
