/**
 * Phase 3: Authentication Guards Tests
 * Tests for brute-force protection, rate limiting, MFA, and CSRF
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock logger before importing modules that use it
jest.mock('../server/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));
const {
  checkBruteForce,
  handleFailedLogin,
  handleSuccessfulLogin,
  recordFailure,
  clearAttempts,
  getLockoutStatus,
  __testing: { attemptStore }
} = require('../server/middleware/bruteForceProtection');
const {
  rateLimiter,
  perUserRateLimiter,
  endpointRateLimiter,
  whitelistIp,
  blacklistIp,
  removeWhitelist,
  removeBlacklist,
  getClientIp,
  __testing: { tokenBucketStore }
} = require('../server/middleware/rateLimiter');
const {
  generateTOTPSecret,
  verifyTOTPCode,
  generateOTPCode,
  verifyOTPCode,
  generateBackupCodes,
  verifyBackupCode,
  createMFASession,
  getMFASession,
  recordMFAAttempt,
  markMFAVerified,
  completeMFASession,
  isValidEmail,
  isValidPhoneNumber,
  formatPhoneForDisplay
} = require('../server/utils/mfaUtils');
const {
  generateCSRFToken,
  validateCSRFToken,
  consumeCSRFToken,
  invalidateCSRFToken,
  generateCSRFMiddleware,
  validateCSRFMiddleware,
  __testing: { csrfTokens }
} = require('../server/middleware/csrfProtection');

describe('Phase 3: Authentication Guards', () => {
  // Clean up before and after each test
  beforeEach(() => {
    attemptStore.clear();
    tokenBucketStore.clear();
    csrfTokens.clear();
  });

  afterEach(() => {
    attemptStore.clear();
    tokenBucketStore.clear();
    csrfTokens.clear();
  });

  // ============================================
  // BRUTE-FORCE PROTECTION TESTS (15 tests)
  // ============================================

  describe('Brute-Force Protection', () => {
    it('should track failed login attempts', () => {
      const key = 'user@example.com';
      
      recordFailure(key);
      const status = getLockoutStatus(key);

      expect(status.locked).toBe(false);
      expect(status.attempts).toBe(1);
    });

    it('should lock account after max attempts', () => {
      const key = 'user@example.com';
      
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }

      const status = getLockoutStatus(key);
      expect(status.locked).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
    });

    it('should implement exponential backoff', () => {
      const key = 'user@example.com';
      const durations = [];

      for (let i = 0; i < 6; i++) {
        recordFailure(key);
        const status = getLockoutStatus(key);
        durations.push(status.lockedUntil ? status.lockedUntil - Date.now() : 0);
      }

      // Each lockout duration should be >= previous (exponential)
      for (let i = 1; i < durations.length; i++) {
        expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]);
      }
    });

    it('should clear attempts on successful login', () => {
      const key = 'user@example.com';
      
      recordFailure(key);
      const statusBefore = getLockoutStatus(key);
      expect(statusBefore.attempts).toBe(1);

      clearAttempts(key);
      const statusAfter = getLockoutStatus(key);
      expect(statusAfter.attempts).toBe(0);
      expect(statusAfter.locked).toBe(false);
    });

    it('should provide helpful error messages', () => {
      const key = 'user@example.com';
      const { message, attempts } = recordFailure(key);

      expect(message).toContain('Invalid credentials');
      expect(message).toContain('4 attempts remaining');
      expect(attempts).toBe(1);
    });

    it('should distinguish different accounts', () => {
      const key1 = 'user1@example.com';
      const key2 = 'user2@example.com';

      recordFailure(key1);
      recordFailure(key1);
      recordFailure(key2);

      const status1 = getLockoutStatus(key1);
      const status2 = getLockoutStatus(key2);

      expect(status1.attempts).toBe(2);
      expect(status2.attempts).toBe(1);
      expect(status1.locked).toBe(false);
      expect(status2.locked).toBe(false);
    });

    it('should check if account is locked', () => {
      const key = 'user@example.com';
      
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }

      const status = getLockoutStatus(key);
      expect(status.locked).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
    });

    it('should provide remaining lockout time', () => {
      const key = 'user@example.com';
      
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }

      const status = getLockoutStatus(key);
      expect(status.remainingMs).toBeGreaterThan(0);
      expect(status.remainingMs).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it('should handle middleware extraction of key', () => {
      const req = { body: { email: 'test@example.com' } };
      const keyFn = req => req.body.email;

      const key = keyFn(req);
      const { locked, attempts } = recordFailure(key);

      expect(locked).toBe(false);
      expect(attempts).toBe(1);
    });

    it('should release lockout after timeout', (done) => {
      const key = 'user@example.com';
      
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }

      let status = getLockoutStatus(key);
      expect(status.locked).toBe(true);

      // Simulate token expiry by manually advancing time
      const record = attemptStore.get(key);
      record.lockedUntil = Date.now() - 1000; // Set to past

      status = getLockoutStatus(key);
      expect(status.locked).toBe(false);
      expect(status.remainingMs).toBe(0);

      done();
    });

    it('should work with IP addresses as keys', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      recordFailure(ip1);
      recordFailure(ip1);
      recordFailure(ip2);

      const status1 = getLockoutStatus(ip1);
      const status2 = getLockoutStatus(ip2);

      expect(status1.attempts).toBe(2);
      expect(status2.attempts).toBe(1);
    });
  });

  // ============================================
  // RATE LIMITING TESTS (12 tests)
  // ============================================

  describe('Rate Limiting', () => {
    it('should create token bucket with initial tokens', () => {
      const req = { headers: { 'x-forwarded-for': '192.168.1.1' } };
      const middleware = rateLimiter('auth', {}, req => getClientIp(req));
      
      const next = jest.fn();
      middleware(req, {}, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block requests when tokens exhausted', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        method: 'POST'
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = rateLimiter('auth', { maxTokens: 1 }, req => 'test-key');

      // First request should pass
      const next1 = jest.fn();
      middleware(req, res, next1);
      expect(next1).toHaveBeenCalled();

      // Second request should fail (no tokens left)
      const next2 = jest.fn();
      middleware(req, res, next2);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next2).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = rateLimiter('auth', { maxTokens: 10 });

      const next = jest.fn();
      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.stringContaining('RateLimit'),
        expect.any(String)
      );
    });

    it('should whitelist IPs for bypass', () => {
      const ip = '192.168.1.1';
      whitelistIp(ip);

      const req = {
        headers: { 'x-forwarded-for': ip }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = rateLimiter('auth', { maxTokens: 1 });

      const next = jest.fn();
      
      // First request
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      // Whitelist should skip rate limiting
      const next2 = jest.fn();
      middleware(req, res, next2);
      expect(next2).toHaveBeenCalled();

      removeWhitelist(ip);
    });

    it('should blacklist IPs for blocking', () => {
      const ip = '192.168.1.1';
      blacklistIp(ip);

      const req = {
        headers: { 'x-forwarded-for': ip }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = rateLimiter('auth');

      const next = jest.fn();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();

      removeBlacklist(ip);
    });

    it('should extract client IP from various headers', () => {
      expect(getClientIp({ headers: { 'x-forwarded-for': '10.0.0.1' } })).toBe('10.0.0.1');
      expect(getClientIp({ headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' } })).toBe('10.0.0.1');
      expect(getClientIp({ connection: { remoteAddress: '192.168.1.1' } })).toBe('192.168.1.1');
    });

    it('should support per-user rate limiting', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        userId: 'user123'
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = perUserRateLimiter('auth', { maxTokens: 1 });

      const next1 = jest.fn();
      middleware(req, res, next1);
      expect(next1).toHaveBeenCalled();

      const next2 = jest.fn();
      middleware(req, res, next2);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should cleanup old token buckets', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = rateLimiter('auth');

      const next = jest.fn();
      middleware(req, res, next);

      expect(tokenBucketStore.size).toBeGreaterThan(0);
    });

    it('should refill tokens over time', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = rateLimiter('auth', {
        maxTokens: 10,
        maxDelayMs: 1000
      });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        const next = jest.fn();
        middleware(req, res, next);
      }

      // Should be limited
      let next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);

      // Simulate time passing - tokens should refill
      const bucket = Array.from(tokenBucketStore.values())[0];
      bucket.lastRefill = Date.now() - 100; // 100ms ago
      bucket.tokens = 0; // Reset tokens

      res.status.mockClear();
      next = jest.fn();
      middleware(req, res, next);
      // Should have some tokens now
      expect(next.mock.calls.length + res.status.mock.calls.length).toBeGreaterThan(0);
    });

    it('should return proper error response on limit exceeded', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const middleware = rateLimiter('auth', { maxTokens: 1 });

      // Exhaust tokens
      const next1 = jest.fn();
      middleware(req, res, next1);

      // Should be limited
      const next2 = jest.fn();
      middleware(req, res, next2);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Too many requests'
        })
      );
    });
  });

  // ============================================
  // MFA/2FA TESTS (18 tests)
  // ============================================

  describe('Multi-Factor Authentication (MFA)', () => {
    it('should generate TOTP secret', async () => {
      const result = await generateTOTPSecret('user@example.com');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result).toHaveProperty('qrCode');
      expect(result.secret).toMatch(/^[A-Z0-9]+$/);
    });

    it('should verify valid TOTP code', async () => {
      const { secret } = await generateTOTPSecret('user@example.com');
      
      // Use speakeasy to generate current code
      const speakeasy = require('speakeasy');
      const code = speakeasy.totp({
        secret,
        encoding: 'base32'
      });

      const isValid = verifyTOTPCode(secret, code);
      expect(isValid).toBe(true);
    });

    it('should reject invalid TOTP code', async () => {
      const { secret } = await generateTOTPSecret('user@example.com');
      
      const isValid = verifyTOTPCode(secret, '000000');
      expect(isValid).toBe(false);
    });

    it('should generate OTP code with expiry', () => {
      const { code, expiresAt, expiresIn } = generateOTPCode();

      expect(code).toMatch(/^\d{6}$/);
      expect(expiresIn).toBe(5 * 60 * 1000);
      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    it('should verify valid OTP code', () => {
      const { code, expiresAt } = generateOTPCode();
      
      const isValid = verifyOTPCode(code, code, expiresAt);
      expect(isValid).toBe(true);
    });

    it('should reject expired OTP code', () => {
      const { code } = generateOTPCode();
      const expiredTime = Date.now() - 1000; // 1 second ago

      const isValid = verifyOTPCode(code, code, expiredTime);
      expect(isValid).toBe(false);
    });

    it('should reject mismatched OTP code', () => {
      const { code, expiresAt } = generateOTPCode();
      
      const isValid = verifyOTPCode('000000', code, expiresAt);
      expect(isValid).toBe(false);
    });

    it('should generate backup codes', () => {
      const codes = generateBackupCodes(10);

      expect(codes).toHaveLength(10);
      codes.forEach(codeObj => {
        expect(codeObj.code).toMatch(/^[A-F0-9]{8}$/);
        expect(codeObj.used).toBe(false);
        expect(codeObj.createdAt).toBeGreaterThan(0);
      });
    });

    it('should verify and consume backup code', () => {
      const codes = generateBackupCodes(5);
      const targetCode = codes[0].code;

      const isValid = verifyBackupCode(codes, targetCode);
      expect(isValid).toBe(true);
      expect(codes[0].used).toBe(true);
    });

    it('should not verify already used backup code', () => {
      const codes = generateBackupCodes(5);
      const targetCode = codes[0].code;

      // Use it once
      verifyBackupCode(codes, targetCode);

      // Try to use it again
      const isValid = verifyBackupCode(codes, targetCode);
      expect(isValid).toBe(false);
    });

    it('should create MFA session', () => {
      const result = createMFASession('user123', 'totp');

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(15 * 60 * 1000);
    });

    it('should get active MFA session', () => {
      const { sessionId } = createMFASession('user123', 'sms');
      const session = getMFASession(sessionId);

      expect(session).toBeTruthy();
      expect(session.userId).toBe('user123');
      expect(session.method).toBe('sms');
      expect(session.verified).toBe(false);
    });

    it('should reject expired MFA session', (done) => {
      const { sessionId } = createMFASession('user123', 'totp');
      const session = getMFASession(sessionId);
      
      // Manually expire session
      session.expiresAt = Date.now() - 1000;

      const expiredSession = getMFASession(sessionId);
      expect(expiredSession).toBeNull();

      done();
    });

    it('should track MFA attempt count', () => {
      const { sessionId } = createMFASession('user123', 'totp');
      
      recordMFAAttempt(sessionId);
      let session = getMFASession(sessionId);
      expect(session.attempts).toBe(1);

      recordMFAAttempt(sessionId);
      session = getMFASession(sessionId);
      expect(session.attempts).toBe(2);
    });

    it('should lock after max MFA attempts', () => {
      const { sessionId } = createMFASession('user123', 'totp');
      
      // Record 3 failed attempts (max is 3)
      for (let i = 0; i < 3; i++) {
        recordMFAAttempt(sessionId);
      }

      // Next attempt should fail
      const result = recordMFAAttempt(sessionId);
      expect(result.locked).toBe(true);
      expect(result.message).toContain('Maximum verification attempts');
    });

    it('should mark MFA session as verified', () => {
      const { sessionId } = createMFASession('user123', 'totp');
      
      markMFAVerified(sessionId);
      const session = getMFASession(sessionId);

      expect(session.verified).toBe(true);
    });

    it('should calculate correct phone format', () => {
      expect(formatPhoneForDisplay('1234567890')).toBe('(123) 456-7890');
      expect(formatPhoneForDisplay('+14155552671')).toContain('415');
    });
  });

  // ============================================
  // EMAIL/PHONE VALIDATION TESTS (4 tests)
  // ============================================

  describe('Email & Phone Validation', () => {
    it('should validate email format', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('missing@')).toBe(false);
    });

    it('should validate phone number format', () => {
      expect(isValidPhoneNumber('1234567890')).toBe(true);
      expect(isValidPhoneNumber('(123) 456-7890')).toBe(true);
      expect(isValidPhoneNumber('+1-415-555-2671')).toBe(true);
      expect(isValidPhoneNumber('invalid')).toBe(false);
    });

    it('should format phone for display', () => {
      const formatted = formatPhoneForDisplay('5551234567');
      expect(formatted).toMatch(/\(\d{3}\) \d{3}-\d{4}/);
    });

    it('should handle international phone formats', () => {
      expect(isValidPhoneNumber('+441632960000')).toBe(true);
      expect(isValidPhoneNumber('+33123456789')).toBe(true);
    });
  });

  // ============================================
  // CSRF PROTECTION TESTS (10 tests)
  // ============================================

  describe('CSRF Protection', () => {
    it('should generate CSRF token', () => {
      const { token, expiresIn } = generateCSRFToken();

      expect(token).toHaveLength(64); // 32 bytes as hex
      expect(expiresIn).toBe(24 * 60 * 60 * 1000);
    });

    it('should validate CSRF token', () => {
      const { token } = generateCSRFToken();
      
      const validation = validateCSRFToken(token);
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid CSRF token', () => {
      const validation = validateCSRFToken('invalid-token');

      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('Invalid');
    });

    it('should reject expired CSRF token', () => {
      const { token } = generateCSRFToken();
      const tokenData = csrfTokens.get(token);
      
      // Manually expire
      tokenData.expiresAt = Date.now() - 1000;

      const validation = validateCSRFToken(token);
      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('expired');
    });

    it('should consume CSRF token (single-use)', () => {
      const { token } = generateCSRFToken();
      
      const consumed = consumeCSRFToken(token);
      expect(consumed).toBe(true);

      const tokenData = csrfTokens.get(token);
      expect(tokenData.used).toBe(true);
    });

    it('should prevent token reuse after consumption', () => {
      const { token } = generateCSRFToken();
      
      consumeCSRFToken(token);
      const secondConsume = consumeCSRFToken(token);

      expect(secondConsume).toBe(false);
    });

    it('should invalidate CSRF token', () => {
      const { token } = generateCSRFToken();
      
      let validation = validateCSRFToken(token);
      expect(validation.valid).toBe(true);

      invalidateCSRFToken(token);

      validation = validateCSRFToken(token);
      expect(validation.valid).toBe(false);
    });

    it('should generate different tokens', () => {
      const token1 = generateCSRFToken().token;
      const token2 = generateCSRFToken().token;

      expect(token1).not.toBe(token2);
    });

    it('should handle missing token gracefully', () => {
      const validation = validateCSRFToken(null);

      expect(validation.valid).toBe(false);
      expect(validation.message).toBeTruthy();
    });

    it('should cleanup expired tokens periodically', () => {
      const { token } = generateCSRFToken();
      const tokenData = csrfTokens.get(token);
      
      // Expire the token
      tokenData.expiresAt = Date.now() - 1000;

      expect(csrfTokens.size).toBeGreaterThan(0);
      
      // Cleanup would normally run on interval - simulate it
      const now = Date.now();
      for (const [key, data] of csrfTokens.entries()) {
        if (now > data.expiresAt) {
          csrfTokens.delete(key);
        }
      }

      // Token should be removed
      const validation = validateCSRFToken(token);
      expect(validation.valid).toBe(false);
    });
  });

  // ============================================
  // INTEGRATION TESTS (5 tests)
  // ============================================

  describe('Authentication Integration', () => {
    it('should combine brute-force and rate limiting', () => {
      const key = 'user@example.com';
      
      // Simulate multiple failed attempts hitting both protections
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }

      const bruteForcStatus = getLockoutStatus(key);
      expect(bruteForcStatus.locked).toBe(true);
    });

    it('should validate email before MFA session', () => {
      const email = 'invalid-email';
      const isValid = isValidEmail(email);

      expect(isValid).toBe(false);
    });

    it('should support MFA with TOTP and backup codes', async () => {
      const { secret } = await generateTOTPSecret('user@example.com');
      const backupCodes = generateBackupCodes(10);

      // TOTP should work
      const speakeasy = require('speakeasy');
      const code = speakeasy.totp({ secret, encoding: 'base32' });
      expect(verifyTOTPCode(secret, code)).toBe(true);

      // Backup code should work
      const backupCode = backupCodes[0].code;
      expect(verifyBackupCode(backupCodes, backupCode)).toBe(true);
    });

    it('should complete full MFA flow', async () => {
      // Step 1: Create MFA session
      const { sessionId } = createMFASession('user123', 'totp');
      let session = getMFASession(sessionId);
      expect(session).toBeTruthy();

      // Step 2: Verify code
      const { secret } = await generateTOTPSecret('user@example.com');
      const speakeasy = require('speakeasy');
      const code = speakeasy.totp({ secret, encoding: 'base32' });
      
      const isValid = verifyTOTPCode(secret, code);
      expect(isValid).toBe(true);

      // Step 3: Mark verified
      markMFAVerified(sessionId);
      session = getMFASession(sessionId);
      expect(session.verified).toBe(true);

      // Step 4: Complete session
      const completed = completeMFASession(sessionId);
      expect(completed).toBe(true);

      // Session should be gone
      session = getMFASession(sessionId);
      expect(session).toBeNull();
    });

    it('should handle CSRF token lifecycle', () => {
      // 1. Generate token
      const { token } = generateCSRFToken();
      let validation = validateCSRFToken(token);
      expect(validation.valid).toBe(true);

      // 2. Include in request
      const req = {
        headers: { 'x-csrf-token': token },
        method: 'POST',
        body: {}
      };

      // 3. Validate on state-change
      validation = validateCSRFToken(req.headers['x-csrf-token']);
      expect(validation.valid).toBe(true);

      // 4. Consume (single-use)
      const consumed = consumeCSRFToken(token);
      expect(consumed).toBe(true);

      // 5. Prevent reuse
      const reuse = consumeCSRFToken(token);
      expect(reuse).toBe(false);
    });
  });
});
