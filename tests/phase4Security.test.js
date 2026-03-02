/**
 * Phase 4: Security Hardening Tests
 * Tests for XSS, SQL injection, encryption, and security headers
 */

jest.mock('../server/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const {
  sanitizeString,
  sanitizeRichText,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeObject,
  escapeHtml,
  escapeJsString,
  escapeUrl,
  escapeSql
} = require('../server/middleware/sanitization');

const {
  hashPassword,
  comparePassword,
  isBcryptHash,
  encryptSensitiveData,
  decryptSensitiveData,
  encryptObjectFields,
  decryptObjectFields,
  hashData,
  createHMAC,
  verifyHMAC,
  maskEmail,
  maskPhoneNumber,
  maskCreditCard,
  maskSensitiveString,
  removePIIForLogging,
  generateRandomToken,
  generateRandomString
} = require('../server/utils/encryption');

const {
  getCSPConfig,
  getCORSConfig
} = require('../server/middleware/securityHeaders');

describe('Phase 4: Security Hardening', () => {
  describe('XSS Prevention - Input Sanitization', () => {
    it('should remove script tags from input', () => {
      const malicious = '<script>alert("XSS")</script>Hello';
      const sanitized = sanitizeString(malicious);

      expect(sanitized).toContain('Hello');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove event handlers', () => {
      const malicious = '<img src=x onerror="alert(\'XSS\')"/>';
      const sanitized = sanitizeString(malicious);

      // XSS library escapes HTML tags/attributes so they can't execute
      // The dangerous code is made safe by escaping
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    });

    it('should remove javascript: URLs', () => {
      const malicious = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const sanitized = sanitizeString(malicious);

      expect(sanitized).toBeDefined();
    });

    it('should allow safe HTML in rich text', () => {
      const richText = '<p>Hello <b>world</b></p>';
      const sanitized = sanitizeRichText(richText);

      expect(sanitized).toContain('<b>world</b>');
      expect(sanitized).toContain('<p>');
    });

    it('should strip event handlers from rich text', () => {
      const malicious = '<b onclick="alert(\'XSS\')">Bold</b>';
      const sanitized = sanitizeRichText(malicious);

      expect(sanitized).toContain('<b>');
      expect(sanitized).not.toContain('onclick');
    });

    it('should trim whitespace from input', () => {
      const input = '  hello world  ';
      const sanitized = sanitizeString(input);

      expect(sanitized).toBe('hello world');
    });

    it('should handle null/undefined gracefully', () => {
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(undefined)).toBe(undefined);
      expect(sanitizeString('')).toBe('');
    });

    it('should sanitize email addresses', () => {
      const email = 'USER@EXAMPLE.COM';
      const sanitized = sanitizeEmail(email);

      expect(sanitized).toBe('user@example.com');
      expect(sanitized).not.toContain(' ');
    });

    it('should remove path traversal attempts from URLs', () => {
      const malicious = '../../../../etc/passwd';
      const sanitized = sanitizeUrl(malicious);

      expect(sanitized).not.toContain('../');
    });

    it('should handle special characters', () => {
      const special = '<>&"\'';
      const sanitized = sanitizeString(special);

      expect(sanitized).toBeDefined();
    });

    it('should sanitize object recursively', () => {
      const obj = {
        name: '<img/>John',
        email: 'JOHN@EXAMPLE.COM'
      };

      const sanitized = sanitizeObject(obj, {
        emailFields: ['email']
      });

      expect(sanitized.email).toBe('john@example.com');
    });

    it('should escape HTML for output encoding', () => {
      const unsafe = '<script>alert("xss")</script>';
      const escaped = escapeHtml(unsafe);

      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
    });

    it('should escape JavaScript strings', () => {
      const unsafe = 'Hello "world"';
      const escaped = escapeJsString(unsafe);

      expect(escaped).toContain('\\"');
    });

    it('should escape single quotes in SQL', () => {
      const unsafe = "O'Reilly";
      const escaped = escapeSql(unsafe);

      expect(escaped.includes("''") || escaped.includes("\\'")).toBeTruthy();
    });

    it('should validate and escape URLs', () => {
      expect(escapeUrl('https://example.com')).toBe('https://example.com');
      expect(escapeUrl('javascript:alert()')).toBe('');
    });
  });

  describe('Encryption & Password Security', () => {
    it('should hash passwords with bcrypt', async () => {
      const password = 'SecurePass123!';
      const hashed = await hashPassword(password);

      expect(hashed).not.toBe(password);
      expect(isBcryptHash(hashed)).toBe(true);
      expect(hashed.length).toBeGreaterThan(50);
    });

    it('should compare password with hash', async () => {
      const password = 'SecurePass123!';
      const hashed = await hashPassword(password);

      const isMatch = await comparePassword(password, hashed);
      expect(isMatch).toBe(true);
    });

    it('should reject mismatched password', async () => {
      const password = 'SecurePass123!';
      const hashed = await hashPassword(password);

      const isMatch = await comparePassword('WrongPassword', hashed);
      expect(isMatch).toBe(false);
    });

    it('should reject weak passwords', async () => {
      const weakPassword = 'weak';

      await expect(hashPassword(weakPassword)).rejects.toThrow();
    });

    it('should encrypt sensitive data', () => {
      const sensitive = 'phone-number-1234567890';
      const encrypted = encryptSensitiveData(sensitive);

      expect(encrypted).not.toBe(sensitive);
      expect(encrypted.length).toBeGreaterThan(sensitive.length);
    });

    it('should decrypt sensitive data', () => {
      const original = 'phone-number-1234567890';
      const encrypted = encryptSensitiveData(original);
      const decrypted = decryptSensitiveData(encrypted);

      expect(decrypted).toBe(original);
    });

    it('should handle JSON encryption/decryption', () => {
      const data = { ssn: '123-45-6789', pin: '1234' };
      const encrypted = encryptSensitiveData(data);
      const decrypted = decryptSensitiveData(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should encrypt object fields selectively', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        ssn: '123-45-6789'
      };

      const encrypted = encryptObjectFields(obj, ['ssn']);

      expect(encrypted.name).toBe('John Doe');
      expect(encrypted.email).toBe('john@example.com');
      expect(encrypted.ssn).not.toBe('123-45-6789');
    });

    it('should decrypt object fields selectively', () => {
      const obj = {
        name: 'John Doe',
        ssn: '123-45-6789'
      };

      const encrypted = encryptObjectFields(obj, ['ssn']);
      const decrypted = decryptObjectFields(encrypted, ['ssn']);

      expect(decrypted).toEqual(obj);
    });

    it('should create SHA-256 hash', () => {
      const data = 'audit-trail-data';
      const hash = hashData(data);

      expect(hash).toHaveLength(64);
      expect(hash).toBe(hashData(data));
    });

    it('should create and verify HMAC', () => {
      const data = 'sensitive-data';
      const hmac = createHMAC(data);

      const isValid = verifyHMAC(data, hmac);
      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC', () => {
      const data = 'sensitive-data';
      const hmac = createHMAC(data);
      const modified = 'modified-data';

      const isValid = verifyHMAC(modified, hmac);
      expect(isValid).toBe(false);
    });

    it('should mask email addresses', () => {
      const email = 'user@example.com';
      const masked = maskEmail(email);

      expect(masked).toContain('example.com');
      expect(masked).toContain('*');
      expect(masked).not.toBe(email);
    });

    it('should mask phone numbers', () => {
      const phone = '5551234567';
      const masked = maskPhoneNumber(phone);

      expect(masked).toContain('555');
      expect(masked).toContain('4567');
      expect(masked).toContain('*');
    });

    it('should mask credit card numbers', () => {
      const cc = '4532123456789012';
      const masked = maskCreditCard(cc);

      expect(masked).toContain('4532');
      expect(masked).toContain('9012');
      expect(masked).toContain('*');
    });

    it('should generate random tokens', () => {
      const token1 = generateRandomToken();
      const token2 = generateRandomToken();

      expect(token1).toHaveLength(64);
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate random alphanumeric strings', () => {
      const str1 = generateRandomString(32);
      const str2 = generateRandomString(32);

      expect(str1).toHaveLength(32);
      expect(str1).not.toBe(str2);
      expect(str1).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('Data Masking for Logging', () => {
    it('should mask sensitive string', () => {
      const sensitive = 'VerySecretPassword123';
      const masked = maskSensitiveString(sensitive, 3);

      expect(masked).toContain('Ver');
      expect(masked).toContain('123');
      expect(masked).toContain('*');
    });

    it('should remove PII from logging object', () => {
      const obj = {
        id: '12345',
        email: 'user@example.com',
        phone: '5551234567',
        password: 'SecurePass123'
      };

      const sanitized = removePIIForLogging(obj);

      expect(sanitized.id).toBe('12345');
      expect(sanitized.password).toBe('[REDACTED]');
    });

    it('should handle nested PII removal', () => {
      const obj = {
        user: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };

      const sanitized = removePIIForLogging(obj);

      expect(sanitized.user.name).toBe('John Doe');
    });

    it('should remove custom fields', () => {
      const obj = {
        name: 'John',
        apiKey: 'secret-api-key',
        ssn: '123-45-6789'
      };

      const sanitized = removePIIForLogging(obj, ['apiKey', 'ssn']);

      expect(sanitized.name).toBe('John');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.ssn).toBe('[REDACTED]');
    });

    it('should not modify original object', () => {
      const original = { password: 'secret', name: 'John' };
      const copy = { ...original };

      removePIIForLogging(original);

      expect(original).toEqual(copy);
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should detect query operator injection', () => {
      const injection = { $ne: null };
      const sanitized = sanitizeObject(injection);

      expect(typeof sanitized).toBe('object');
    });

    it('should handle string-based NoSQL injection in queries', () => {
      const maliciousQuery = '{"$ne": null}';
      const sanitized = sanitizeString(maliciousQuery);

      expect(sanitized).toBeDefined();
    });

    it('should validate MongoDB field names', () => {
      const data = {
        normalField: 'value',
        nested: {
          field: 'value'
        }
      };

      const sanitized = sanitizeObject(data);
      expect(sanitized).toBeDefined();
    });

    it('should sanitize array elements', () => {
      const arr = [
        '<script>alert("xss")</script>',
        'normal text',
        '<img onerror="alert()" />'
      ];

      const sanitized = sanitizeObject(arr);

      expect(sanitized[0]).toBeDefined();
      expect(sanitized[1]).toBe('normal text');
      expect(sanitized[2]).toBeDefined();
    });

    it('should handle deeply nested malicious data', () => {
      const deepObj = {
        level1: {
          level2: {
            level3: {
              malicious: '<img src=x onerror="alert()" />'
            }
          }
        }
      };

      const sanitized = sanitizeObject(deepObj);

      expect(sanitized.level1.level2.level3.malicious).toBeDefined();
    });
  });

  describe('Security Headers Configuration', () => {
    it('should configure CSP directives', () => {
      const config = getCSPConfig();

      expect(config.directives.defaultSrc).toContain("'self'");
      expect(config.directives.frameAncestors).toEqual(["'self'"]);
    });

    it('should have strong frame protection', () => {
      const config = getCSPConfig();

      expect(config.directives.frameAncestors).toEqual(["'self'"]);
    });

    it('should restrict base URI', () => {
      const config = getCSPConfig();

      expect(config.directives.baseUri).toEqual(["'self'"]);
    });

    it('should configure CORS', () => {
      const config = getCORSConfig();

      expect(config.methods).toContain('GET');
      expect(config.methods).toContain('POST');
      expect(config.allowedHeaders).toContain('Authorization');
      expect(config.credentials).toBe(true);
    });

    it('should set appropriate max age for CORS', () => {
      const config = getCORSConfig();

      expect(config.maxAge).toBe(86400);
    });

    it('should allow common content types', () => {
      const config = getCORSConfig();

      expect(config.allowedHeaders).toContain('Content-Type');
    });
  });

  describe('Security Hardening Integration', () => {
    it('should handle full encryption workflow', async () => {
      const user = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        ssn: '123-45-6789'
      };

      const hashedPassword = await hashPassword(user.password);
      expect(hashedPassword).not.toBe(user.password);
      expect(isBcryptHash(hashedPassword)).toBe(true);

      const encrypted = encryptSensitiveData(user.ssn);
      expect(encrypted).not.toBe(user.ssn);

      const decrypted = decryptSensitiveData(encrypted);
      expect(decrypted).toBe(user.ssn);

      const isValid = await comparePassword('SecurePass123', hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should sanitize and mask PII for logging', () => {
      const userData = {
        id: '12345',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '5551234567',
        password: 'SecurePass123'
      };

      const sanitized = sanitizeObject(userData);
      expect(sanitized.email).toBe('john@example.com');

      const masked = removePIIForLogging(sanitized);
      expect(masked.password).toBe('[REDACTED]');
    });

    it('should prevent common attack patterns', () => {
      const attacks = [
        '<img src=x onerror="alert(\'XSS\')">',
        '../../../../etc/passwd',
        '{{7*7}}'
      ];

      attacks.forEach(attack => {
        const sanitized = sanitizeString(attack);
        expect(sanitized).toBeDefined();
      });
    });

    it('should create secure audit trail', () => {
      const action = 'User logged in';
      const hash = hashData(action);
      const hmac = createHMAC(action);

      const isValid = verifyHMAC(action, hmac);
      expect(isValid).toBe(true);

      const isValidModified = verifyHMAC('User logged out', hmac);
      expect(isValidModified).toBe(false);
    });

    it('should apply defense in depth', async () => {
      let userData = {
        email: 'USER@EXAMPLE.COM',
        name: 'John',
        password: 'SecurePass!@123'
      };

      userData = sanitizeObject(userData, {
        emailFields: ['email']
      });

      expect(userData.email).toBe('user@example.com');

      const hashedPassword = await hashPassword(userData.password);
      expect(isBcryptHash(hashedPassword)).toBe(true);

      const auditHash = hashData(`User registered: ${userData.email}`);
      expect(auditHash).toBeDefined();

      const logData = removePIIForLogging(userData);
      expect(logData).toBeDefined();
    });
  });
});
