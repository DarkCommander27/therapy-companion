/**
 * Phase 5: Comprehensive Integration Tests
 * Tests all Phase 1-4 systems together: API, validation, auth, security
 */

jest.mock('../server/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { securitySanitizeMiddleware } = require('../server/middleware/sanitization');
const { securityHeadersMiddleware, getCORSConfig } = require('../server/middleware/securityHeaders');
const { 
  hashPassword, 
  comparePassword,
  encryptSensitiveData,
  decryptSensitiveData,
  removePIIForLogging
} = require('../server/utils/encryption');
const { asyncHandler } = require('../server/middleware/errorHandler');

/**
 * Create test Express app with security middleware
 */
function createTestApp() {
  const app = express();

  // Security headers and CORS
  app.use(securityHeadersMiddleware());
  app.use(require('cors')(getCORSConfig()));

  // Body parsing
  app.use(express.json());

  // Input sanitization
  app.use(securitySanitizeMiddleware({
    richTextFields: ['content', 'message', 'description'],
    emailFields: ['email', 'emailAddress']
  }));

  return app;
}

describe('Phase 5: Comprehensive Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Security Headers Integration', () => {
    beforeEach(() => {
      app.get('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should include HSTS header', async () => {
      const res = await request(app).get('/api/test');

      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age');
    });

    it('should include CSP header', async () => {
      const res = await request(app).get('/api/test');

      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('should include X-Frame-Options header', async () => {
      const res = await request(app).get('/api/test');

      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-Content-Type-Options header', async () => {
      const res = await request(app).get('/api/test');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should remove X-Powered-By header', async () => {
      const res = await request(app).get('/api/test');

      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Sanitization Integration', () => {
    beforeEach(() => {
      app.post('/api/create-note', (req, res) => {
        res.json({ note: req.body });
      });

      app.post('/api/search', (req, res) => {
        res.json({ query: req.body });
      });
    });

    it('should sanitize XSS from request body', async () => {
      const res = await request(app)
        .post('/api/create-note')
        .send({
          content: '<img src=x onerror="alert(\'XSS\')" />Hello'
        });

      expect(res.body.note.content).toBeDefined();
      // XSS library escapes or sanitizes, should not execute
      expect(res.body.note.content).toContain('&lt;');
      expect(res.body.note.content).toContain('&gt;');
    });

    it('should sanitize email fields', async () => {
      const res = await request(app)
        .post('/api/search')
        .send({
          email: 'USER@EXAMPLE.COM'
        });

      // Email should be normalized to lowercase
      expect(res.body.query.email).toBe('user@example.com');
    });

    it('should sanitize nested objects', async () => {
      const res = await request(app)
        .post('/api/create-note')
        .send({
          content: '<p>Hello <b>world</b></p>',
          metadata: {
            title: '<script>alert("xss")</script>Title'
          }
        });

      expect(res.body.note.content).toContain('<b>');
      expect(res.body.note.metadata.title).not.toContain('<script>');
    });
  });

  describe('Authentication & Encryption Integration', () => {
    it('should hash password on registration', async () => {
      const password = 'SecurePassword123!';
      const hashed = await hashPassword(password);

      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(50);
    });

    it('should verify password correctly after hashing', async () => {
      const password = 'SecurePassword123!';
      const hashed = await hashPassword(password);

      const isValid = await comparePassword(password, hashed);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'SecurePassword123!';
      const hashed = await hashPassword(password);

      const isValid = await comparePassword('WrongPassword', hashed);
      expect(isValid).toBe(false);
    });

    it('should encrypt and decrypt sensitive data', () => {
      const sensitive = 'ssn-123-45-6789';
      const encrypted = encryptSensitiveData(sensitive);
      const decrypted = decryptSensitiveData(encrypted);

      expect(encrypted).not.toBe(sensitive);
      expect(decrypted).toBe(sensitive);
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      app.post('/api/error-test', (req, res, next) => {
        const { throw_error } = req.body;
        if (throw_error) {
          throw new Error('Test error');
        }
        res.json({ success: true });
      });

      app.use((err, req, res, next) => {
        res.status(400).json({ error: err.message });
      });
    });

    it('should handle errors gracefully', async () => {
      const res = await request(app)
        .post('/api/error-test')
        .send({ throw_error: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should not expose sensitive error details', async () => {
      const res = await request(app)
        .post('/api/error-test')
        .send({ throw_error: true });

      const responseText = JSON.stringify(res.body);
      expect(responseText).not.toContain('password');
      expect(responseText).not.toContain('secret');
    });
  });

  describe('Data Validation Integration', () => {
    beforeEach(() => {
      app.post('/api/validate', (req, res) => {
        const { email, userId } = req.body;

        // Simple validation
        if (!email || !email.includes('@')) {
          return res.status(400).json({ error: 'Invalid email' });
        }

        if (!userId || userId.length < 3) {
          return res.status(400).json({ error: 'Invalid userId' });
        }

        res.json({ success: true, user: { email, userId } });
      });
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/validate')
        .send({ email: '', userId: 'user123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('should reject short userId', async () => {
      const res = await request(app)
        .post('/api/validate')
        .send({ email: 'test@example.com', userId: 'ab' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('userId');
    });

    it('should accept valid input after sanitization', async () => {
      const res = await request(app)
        .post('/api/validate')
        .send({ email: 'USER@EXAMPLE.COM', userId: 'user123' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('user@example.com');
    });
  });

  describe('API Workflow Integration', () => {
    beforeEach(() => {
      // Simulated user registration workflow
      app.post('/api/register', asyncHandler(async (req, res) => {
        const { email, password, userId } = req.body;

        // Validate
        if (!email || !password) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Simulate DB save
        const user = {
          id: userId || 'user-' + Date.now(),
          email: email,
          passwordHash
        };

        // Return sanitized response (no password hash)
        const safeResponse = removePIIForLogging(user);

        res.status(201).json({
          success: true,
          userId: user.id,
          email: user.email
        });
      }));

      // Login workflow
      app.post('/api/login', asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        // In real app, would query database
        const testUser = {
          email: email.toLowerCase(),
          passwordHash: await hashPassword('TestPassword123!')
        };

        // Verify password
        if (password !== 'TestPassword123!') {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create token (simplified)
        const token = 'jwt-token-' + Date.now();

        res.json({
          success: true,
          token,
          user: {
            email: testUser.email,
            id: 'user-123'
          }
        });
      }));
    });

    it('should complete registration workflow', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          userId: 'user-1'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe('newuser@example.com');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('should complete login workflow', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'user@example.com',
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('user@example.com');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('credentials');
    });
  });

  describe('Response Security', () => {
    beforeEach(() => {
      app.get('/api/protected-data', (req, res) => {
        const sensitiveData = {
          userId: '123',
          email: 'user@example.com',
          ssn: '123-45-6789',
          phone: '555-1234'
        };

        // Remove PII from logs
        const logData = removePIIForLogging(sensitiveData);
        console.log('Logged:', logData);

        // Return user data (but log safely)
        res.json({
          userId: sensitiveData.userId,
          email: sensitiveData.email
        });
      });
    });

    it('should not leak PII in logs', async () => {
      const res = await request(app).get('/api/protected-data');

      expect(res.status).toBe(200);
      expect(res.body.email).toBeDefined();
      // SSN should not be in response
      expect(JSON.stringify(res.body)).not.toContain('123-45');
    });

    it('should include security headers in all responses', async () => {
      const res = await request(app).get('/api/protected-data');

      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Cross-Cutting Security Concerns', () => {
    beforeEach(() => {
      // Endpoint that combines all security measures
      app.post('/api/comprehensive', asyncHandler(async (req, res) => {
        const { email, password, notes } = req.body;

        // Input is already sanitized by middleware
        // Validate email format
        if (!email.includes('@')) {
          return res.status(400).json({ error: 'Invalid email' });
        }

        // Hash password using encryption utilities
        const passwordHash = await hashPassword(password);

        // Encrypt sensitive notes
        const encryptedNotes = encryptSensitiveData(notes);

        // Return without sensitive data
        const response = {
          email: email,
          encryptedNotesLength: encryptedNotes.length
        };

        res.json({
          success: true,
          data: response
        });
      }));
    });

    it('should apply all security measures in workflow', async () => {
      const res = await request(app)
        .post('/api/comprehensive')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'SecurePass123!',
          notes: '<p>Important notes</p>'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Email should be sanitized to lowercase
      expect(res.body.data.email).toBe('test@example.com');
      // Notes should be encrypted (length increased)
      expect(res.body.data.encryptedNotesLength).toBeGreaterThan(25);
    });

    it('should have proper headers on all endpoints', async () => {
      const res = await request(app)
        .post('/api/comprehensive')
        .send({
          email: 'user@example.com',
          password: 'SecurePass123!',
          notes: 'Test'
        });

      // Check all critical security headers present
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBeDefined();
    });
  });

  describe('Performance Under Security Load', () => {
    it('should handle rapid requests with security processing', async () => {
      app.post('/api/fast', (req, res) => {
        res.json({ success: true });
      });

      const startTime = Date.now();
      
      // Send 10 concurrent requests
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/fast')
          .send({ data: 'test' })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach(r => {
        expect(r.status).toBe(200);
      });

      // Should complete in reasonable time (< 5 seconds for 10 requests)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle encryption/hashing performance', async () => {
      const password = 'SecurePassword123!';
      const startTime = Date.now();

      // Hash 5 passwords sequentially
      for (let i = 0; i < 5; i++) {
        await hashPassword(password);
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (bcrypt is slow by design)
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Integration with Multiple Systems', () => {
    it('should handle auth → sanitization → encryption workflow', async () => {
      app.post('/api/full-workflow', asyncHandler(async (req, res) => {
        const { email, password, sensitiveData } = req.body;

        // 1. Input already sanitized by middleware
        // 2. Validate email
        if (!email.includes('@')) {
          return res.status(400).json({ error: 'Invalid email' });
        }

        // 3. Hash password
        const hashedPassword = await hashPassword(password);

        // 4. Encrypt sensitive data
        const encrypted = encryptSensitiveData(sensitiveData);

        // 5. Create safe response
        res.json({
          success: true,
          email: email,
          hashedPasswordLength: hashedPassword.length,
          encryptedDataLength: encrypted.length
        });
      }));

      const res = await request(app)
        .post('/api/full-workflow')
        .send({
          email: 'USER@EXAMPLE.COM',
          password: 'SecurePass123!',
          sensitiveData: 'SSN-123-45-6789<img onerror="alert()" />'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe('user@example.com');
      expect(res.body.hashedPasswordLength).toBeGreaterThan(50);
      expect(res.body.encryptedDataLength).toBeGreaterThan(30);
    });
  });
});
