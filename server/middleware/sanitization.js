/**
 * XSS & NoSQL Injection Sanitization Middleware
 * Cleans and escapes input to prevent malicious code injection
 * Applies to:
 * - HTML content (XSS)
 * - String values in database queries (NoSQL injection)
 * - URL parameters and headers
 */

const xss = require('xss');
const mongoSanitize = require('express-mongo-sanitize');
const validator = require('validator');
const logger = require('../utils/logger');

// XSS filter options - restrictive whitelist for content
const XSS_OPTIONS = {
  whiteList: {}, // No HTML tags allowed by default
  stripIgnoredTag: true,
  stripLeakage: true,
  onTagAttr: (tag, name, value) => {
    // Reject all attributes
    return '';
  }
};

// Lenient XSS for rich text content (allows basic formatting)
const RICH_TEXT_XSS_OPTIONS = {
  whiteList: {
    b: [],
    i: [],
    em: [],
    strong: [],
    br: [],
    p: [],
    ul: [],
    ol: [],
    li: [],
    a: ['href', 'title'],
    blockquote: [],
    code: [],
    pre: []
  },
  onTagAttr: (tag, name, value) => {
    // Only allow safe attributes
    if (tag === 'a' && name === 'href') {
      // Validate URL
      if (validator.isURL(value, { protocols: ['http', 'https'] })) {
        return `${name}="${xss.escapeAttrValue(value)}"`;
      }
      return '';
    }
    if ((tag === 'a' || tag === 'blockquote') && name === 'title') {
      return `${name}="${xss.escapeAttrValue(value)}"`;
    }
    return '';
  }
};

/**
 * Sanitize string input - removes all HTML/dangerous chars
 */
function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return input;
  }
  // Remove all HTML tags and dangerous characters
  return xss(input, XSS_OPTIONS).trim();
}

/**
 * Sanitize for rich text content - allows safe HTML formatting
 */
function sanitizeRichText(input) {
  if (!input || typeof input !== 'string') {
    return input;
  }
  // Allow safe HTML formatting
  return xss(input, RICH_TEXT_XSS_OPTIONS).trim();
}

/**
 * Sanitize email addresses
 */
function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return email;
  }
  return validator.normalizeEmail(email.toLowerCase());
}

/**
 * Sanitize URL/file path - removes malicious patterns
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  // Remove null bytes and control characters
  let cleaned = url.replace(/[\x00-\x1f\x7f]/g, '');
  // Remove path traversal attempts
  cleaned = cleaned.replace(/\.\.\//g, '').replace(/\.\.%2f/gi, '');
  return cleaned;
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj, options = {}) {
  const {
    richTextFields = [],
    emailFields = [],
    urlFields = []
  } = options;

  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (let key in sanitized) {
    const value = sanitized[key];

    if (emailFields.includes(key)) {
      sanitized[key] = sanitizeEmail(value);
    } else if (richTextFields.includes(key)) {
      sanitized[key] = sanitizeRichText(value);
    } else if (urlFields.includes(key)) {
      sanitized[key] = sanitizeUrl(value);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, options);
    }
  }

  return sanitized;
}

/**
 * Express middleware: Sanitize request body, query, and params
 */
function sanitizeMiddleware(options = {}) {
  const defaultOptions = {
    richTextFields: ['content', 'message', 'description', 'bio'],
    emailFields: ['email', 'emailAddress'],
    urlFields: ['url', 'website', 'photo', 'avatar'],
    ...options
  };

  return (req, res, next) => {
    try {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, defaultOptions);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, defaultOptions);
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params, defaultOptions);
      }

      logger.debug(`Sanitized request data - Body: ${JSON.stringify(req.body).length} bytes`);
      next();
    } catch (err) {
      logger.error(`Sanitization error: ${err.message}`);
      next(err);
    }
  };
}

/**
 * MongoDb/NoSQL injection prevention middleware
 * Already exported by express-mongo-sanitize
 */
function mongoSanitizeMiddleware() {
  return mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logger.warn(`NoSQL injection attempt detected in ${key}`);
    }
  });
}

/**
 * Combined XSS + NoSQL injection prevention middleware
 */
function securitySanitizeMiddleware(options = {}) {
  return [
    mongoSanitizeMiddleware(),
    sanitizeMiddleware(options)
  ];
}

/**
 * Escape HTML for output encoding (prevent stored XSS)
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  return validator.escape(text);
}

/**
 * Escape JavaScript strings (for template injection)
 */
function escapeJsString(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape URL for redirect safety (open redirect prevention)
 */
function escapeUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  // Only allow relative URLs or whitelisted domains
  if (url.startsWith('javascript:') || url.startsWith('data:')) {
    return '';
  }
  if (url.startsWith('//')) {
    return ''; // Protocol-relative URLs can be exploited
  }
  return validator.isURL(url) ? url : '';
}

/**
 * Escape SQL injection (for non-ORM database operations)
 * Note: Better to use parameterized queries in your ORM
 */
function escapeSql(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  return str
    .replace(/'/g, "''") // Escape single quotes
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

module.exports = {
  // Sanitization functions
  sanitizeString,
  sanitizeRichText,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeObject,
  // Middleware
  sanitizeMiddleware,
  mongoSanitizeMiddleware,
  securitySanitizeMiddleware,
  // Output encoding (XSS prevention for templates)
  escapeHtml,
  escapeJsString,
  escapeUrl,
  escapeSql,
  // Utilities
  xss,
  validator,
  // Options
  XSS_OPTIONS,
  RICH_TEXT_XSS_OPTIONS
};
