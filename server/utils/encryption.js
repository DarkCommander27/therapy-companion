/**
 * Encryption Utilities
 * Handles:
 * - Password hashing (bcrypt)
 * - Sensitive data encryption/decryption (AES-256)
 * - One-way hashing for audit trails
 * - Data masking for PII
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const logger = require('../utils/logger');

// Configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const ALGORITHM = 'aes-256-cbc';

// ============================================
// PASSWORD HASHING (Bcrypt)
// ============================================

/**
 * Hash password with bcrypt
 * Includes salt rounds for security
 */
async function hashPassword(password) {
  try {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashed = await bcrypt.hash(password, salt);

    logger.debug('Password hashed successfully');
    return hashed;
  } catch (err) {
    logger.error(`Password hashing failed: ${err.message}`);
    throw err;
  }
}

/**
 * Compare plain password with hashed password
 */
async function comparePassword(plainPassword, hashedPassword) {
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (err) {
    logger.error(`Password comparison failed: ${err.message}`);
    return false;
  }
}

/**
 * Check if password string looks like bcrypt hash
 */
function isBcryptHash(str) {
  // Bcrypt hashes start with $2a$, $2b$, or $2y$
  return /^\$2[aby]\$\d{2}\$/.test(str);
}

// ============================================
// SENSITIVE DATA ENCRYPTION (AES-256)
// ============================================

/**
 * Encrypt sensitive data with AES-256
 * Returns: encrypted data as hex string
 */
function encryptSensitiveData(data) {
  try {
    if (!data) return null;

    // Convert to string if not already
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);

    // Use CryptoJS for AES encryption
    const encrypted = CryptoJS.AES.encrypt(stringData, ENCRYPTION_KEY).toString();

    logger.debug('Data encrypted successfully');
    return encrypted;
  } catch (err) {
    logger.error(`Encryption failed: ${err.message}`);
    throw err;
  }
}

/**
 * Decrypt sensitive data (AES-256)
 */
function decryptSensitiveData(encryptedData) {
  try {
    if (!encryptedData) return null;

    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    // Try to parse as JSON, fall back to string
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (err) {
    logger.error(`Decryption failed: ${err.message}`);
    throw err;
  }
}

/**
 * Encrypt object properties selectively
 */
function encryptObjectFields(obj, fieldsToEncrypt = []) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const encrypted = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (encrypted[field]) {
      encrypted[field] = encryptSensitiveData(encrypted[field]);
    }
  }

  return encrypted;
}

/**
 * Decrypt object properties selectively
 */
function decryptObjectFields(obj, fieldsToDecrypt = []) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const decrypted = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (decrypted[field]) {
      decrypted[field] = decryptSensitiveData(decrypted[field]);
    }
  }

  return decrypted;
}

// ============================================
// HASHING (One-way - for audit trails)
// ============================================

/**
 * Create SHA-256 hash (for audit trails, not passwords)
 * @warning Do NOT use for passwords, use hashPassword() instead
 */
function hashData(data) {
  try {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  } catch (err) {
    logger.error(`Hash creation failed: ${err.message}`);
    throw err;
  }
}

/**
 * Create HMAC for integrity verification
 */
function createHMAC(data, secret = ENCRYPTION_KEY) {
  try {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  } catch (err) {
    logger.error(`HMAC creation failed: ${err.message}`);
    throw err;
  }
}

/**
 * Verify HMAC integrity
 */
function verifyHMAC(data, hmac, secret = ENCRYPTION_KEY) {
  try {
    const computed = createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(computed)
    );
  } catch (err) {
    logger.error(`HMAC verification failed: ${err.message}`);
    return false;
  }
}

// ============================================
// DATA MASKING (PII Protection)
// ============================================

/**
 * Mask email address for logging/display
 * Example: user@example.com → u***@example.com
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return email;
  }
  const [local, domain] = email.split('@');
  const masked = local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1);
  return `${masked}@${domain}`;
}

/**
 * Mask phone number for logging/display
 * Example: 5551234567 → 555****4567
 */
function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return phone;
  }
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return phone;
  
  const start = cleaned.substring(0, 3);
  const end = cleaned.substring(cleaned.length - 4);
  return `${start}****${end}`;
}

/**
 * Mask credit card number
 * Example: 4532123456789012 → 4532****9012
 */
function maskCreditCard(cc) {
  if (!cc || typeof cc !== 'string') {
    return cc;
  }
  const cleaned = cc.replace(/\D/g, '');
  if (cleaned.length < 4) return cc;
  
  const start = cleaned.substring(0, 4);
  const end = cleaned.substring(cleaned.length - 4);
  return `${start}****${end}`;
}

/**
 * Mask generic sensitive string (keep first/last char, hide middle)
 */
function maskSensitiveString(str, showChars = 3) {
  if (!str || typeof str !== 'string' || str.length <= showChars * 2) {
    return str;
  }
  const start = str.substring(0, showChars);
  const end = str.substring(str.length - showChars);
  const masked = '*'.repeat(Math.max(1, str.length - showChars * 2));
  return `${start}${masked}${end}`;
}

/**
 * Remove PII from object for logging
 */
function removePIIForLogging(obj, fieldsToRemove = []) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = { ...obj };

  // Default sensitive fields to redact
  const defaultFields = [
    'password', 'pin', 'secret', 'token', 'mfaSecret',
    'email', 'phone', 'ssn', 'creditCard', 'bankAccount'
  ];

  const allFields = [...new Set([...defaultFields, ...fieldsToRemove])];

  for (const field of allFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// ============================================
// RANDOM TOKEN GENERATION
// ============================================

/**
 * Generate cryptographically secure random token
 */
function generateRandomToken(length = 32) {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (err) {
    logger.error(`Random token generation failed: ${err.message}`);
    throw err;
  }
}

/**
 * Generate random string (alphanumeric)
 */
function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  // Password hashing
  hashPassword,
  comparePassword,
  isBcryptHash,
  // Sensitive data encryption
  encryptSensitiveData,
  decryptSensitiveData,
  encryptObjectFields,
  decryptObjectFields,
  // Hashing & HMAC
  hashData,
  createHMAC,
  verifyHMAC,
  // Data masking
  maskEmail,
  maskPhoneNumber,
  maskCreditCard,
  maskSensitiveString,
  removePIIForLogging,
  // Token generation
  generateRandomToken,
  generateRandomString,
  // Constants
  BCRYPT_ROUNDS,
  ALGORITHM
};
