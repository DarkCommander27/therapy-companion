/**
 * Validation Tests for Schemas and Middleware
 * 
 * Tests:
 * - Joi validation schemas for all APIs
 * - Validation middleware behavior
 * - Error message quality
 * - Data sanitization
 */

const Joi = require('joi');
const {
  conversationListSchema,
  conversationSearchSchema,
  addNoteSchema,
  noteParamsSchema,
  acknowledgeSchema,
  acknowledgeParamsSchema
} = require('../server/schemas/conversationSchemas');

const {
  userLoginSchema,
  staffCreateSchema,
  passwordChangeSchema
} = require('../server/schemas/userSchemas');

const {
  staffLoginSchema,
  mfaSetupSchema
} = require('../server/schemas/staffSchemas');

const {
  validateData,
  ValidationError
} = require('../server/middleware/validation');

describe('Conversation Schemas Validation', () => {
  describe('conversationListSchema', () => {
    it('should accept valid conversation list query parameters', () => {
      const data = {
        page: 1,
        limit: 20,
        sortBy: 'recent',
        status: 'flagged',
        userId: 'user123'
      };

      const result = validateData(data, conversationListSchema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should set default values for pagination', () => {
      const data = {};

      const result = validateData(data, conversationListSchema);
      expect(result.isValid).toBe(true);
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe('recent');
    });

    it('should reject invalid page number', () => {
      const data = { page: 0 };

      const result = validateData(data, conversationListSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('must be greater than or equal to 1');
    });

    it('should reject limit greater than 100', () => {
      const data = { limit: 150 };

      const result = validateData(data, conversationListSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be less than or equal to 100');
    });

    it('should reject invalid status', () => {
      const data = { status: 'invalid_status' };

      const result = validateData(data, conversationListSchema);
      expect(result.isValid).toBe(false);
    });

    it('should accept valid moods', () => {
      const validMoods = ['happy', 'sad', 'angry', 'anxious', 'calm', 'neutral', 'hopeful', 'desperate'];

      validMoods.forEach(mood => {
        const data = { mood };
        const result = validateData(data, conversationListSchema);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject non-alphanumeric userId', () => {
      const data = { userId: 'user@123!' };

      const result = validateData(data, conversationListSchema);
      expect(result.isValid).toBe(false);
    });

    it('should reject userId shorter than 3 chars', () => {
      const data = { userId: 'ab' };

      const result = validateData(data, conversationListSchema);
      expect(result.isValid).toBe(false);
    });
  });

  describe('conversationSearchSchema', () => {
    it('should accept advanced search with multiple filters', () => {
      const data = {
        userId: 'user123',
        mood: 'sad',
        severity: 'critical',
        topics: ['mental health', 'depression'],
        concerns: ['safety'],
        dateRange: {
          start: '2026-01-01T00:00:00Z',
          end: '2026-01-31T23:59:59Z'
        }
      };

      const result = validateData(data, conversationSearchSchema);
      expect(result.isValid).toBe(true);
    });

    it('should reject date range with end before start', () => {
      const data = {
        dateRange: {
          start: '2026-02-01T00:00:00Z',
          end: '2026-01-01T00:00:00Z'
        }
      };

      const result = validateData(data, conversationSearchSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be greater than or equal to');
    });

    it('should limit topics and concerns to max 10', () => {
      const data = {
        topics: Array(11).fill('topic'),
        concerns: Array(11).fill('concern')
      };

      const result = validateData(data, conversationSearchSchema);
      expect(result.isValid).toBe(false);
    });

    it('should accept message content search with 2+ chars', () => {
      const data = { messageContent: 'help' };

      const result = validateData(data, conversationSearchSchema);
      expect(result.isValid).toBe(true);
    });

    it('should reject message content search with 1 char', () => {
      const data = { messageContent: 'a' };

      const result = validateData(data, conversationSearchSchema);
      expect(result.isValid).toBe(false);
    });
  });

  describe('addNoteSchema', () => {
    it('should accept valid note with content', () => {
      const data = {
        content: 'This student needs immediate attention'
      };

      const result = validateData(data, addNoteSchema);
      expect(result.isValid).toBe(true);
    });

    it('should accept note with all optional fields', () => {
      const data = {
        content: 'Test note',
        visibility: 'staff-only',
        priority: 'high',
        flagForReview: true,
        relatedFlags: ['flag1', 'flag2']
      };

      const result = validateData(data, addNoteSchema);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty content', () => {
      const data = { content: '' };

      const result = validateData(data, addNoteSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('not allowed to be empty');
    });

    it('should reject content exceeding 5000 chars', () => {
      const data = {
        content: 'x'.repeat(5001)
      };

      const result = validateData(data, addNoteSchema);
      expect(result.isValid).toBe(false);
    });

    it('should set default visibility to staff-only', () => {
      const data = { content: 'Test note' };

      const result = validateData(data, addNoteSchema);
      expect(result.isValid).toBe(true);
      expect(result.data.visibility).toBe('staff-only');
    });

    it('should accept valid visibility levels', () => {
      const visibilities = ['staff-only', 'facility-wide', 'flagged-only'];

      visibilities.forEach(visibility => {
        const data = { content: 'Test', visibility };
        const result = validateData(data, addNoteSchema);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('acknowledgeSchema', () => {
    it('should accept acknowledgment with minimal data', () => {
      const data = {};

      const result = validateData(data, acknowledgeSchema);
      expect(result.isValid).toBe(true);
    });

    it('should accept acknowledgment with staff name and timestamp', () => {
      const data = {
        acknowledgedBy: 'John Smith',
        timestamp: '2026-03-01T12:00:00Z'
      };

      const result = validateData(data, acknowledgeSchema);
      expect(result.isValid).toBe(true);
    });

    it('should reject future timestamp', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const data = { timestamp: futureDate };

      const result = validateData(data, acknowledgeSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be less than or equal to');
    });

    it('should reject staff name longer than 100 chars', () => {
      const data = { acknowledgedBy: 'x'.repeat(101) };

      const result = validateData(data, acknowledgeSchema);
      expect(result.isValid).toBe(false);
    });
  });

  describe('noteParamsSchema & acknowledgeParamsSchema', () => {
    it('should accept valid session IDs', () => {
      const sessionIds = [
        'session-550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440000'
      ];

      sessionIds.forEach(id => {
        const data = { sessionId: id };
        
        // Test with noteParamsSchema
        let result = validateData(data, noteParamsSchema);
        expect(result.isValid).toBe(true);

        // Test with acknowledgeParamsSchema
        result = validateData(data, acknowledgeParamsSchema);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid session IDs', () => {
      const invalidIds = ['invalid-id', 'session-123', 'not-a-uuid', ''];

      invalidIds.forEach(id => {
        const data = { sessionId: id };
        const result = validateData(data, noteParamsSchema);
        expect(result.isValid).toBe(false);
      });
    });
  });
});

describe('User Schemas Validation', () => {
  describe('userLoginSchema', () => {
    it('should accept login with PIN', () => {
      const data = {
        userId: 'user123',
        pin: '1234',
        deviceId: 'device123',
        deviceName: 'My Phone'
      };

      const result = validateData(data, userLoginSchema);
      expect(result.isValid).toBe(true);
    });

    it('should accept login with password', () => {
      const data = {
        userId: 'user456',
        password: 'SecurePassword123',
        deviceId: 'device456'
      };

      const result = validateData(data, userLoginSchema);
      expect(result.isValid).toBe(true);
    });

    it('should reject login with both PIN and password', () => {
      const data = {
        userId: 'user123',
        pin: '1234',
        password: 'SecurePassword123'
      };

      const result = validateData(data, userLoginSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Either PIN or password');
    });

    it('should reject login with neither PIN nor password', () => {
      const data = {
        userId: 'user123',
        deviceId: 'device123'
      };

      const result = validateData(data, userLoginSchema);
      expect(result.isValid).toBe(false);
    });

    it('should reject PIN that is not 4 digits', () => {
      const invalidPins = ['123', '12345', 'abcd', '12ab'];

      invalidPins.forEach(pin => {
        const data = { userId: 'user123', pin, deviceId: 'device123' };
        const result = validateData(data, userLoginSchema);
        expect(result.isValid).toBe(false);
      });
    });

    it('should reject password shorter than 6 chars', () => {
      const data = {
        userId: 'user123',
        password: '12345',
        deviceId: 'device123'
      };

      const result = validateData(data, userLoginSchema);
      expect(result.isValid).toBe(false);
    });
  });
});

describe('Staff Schemas Validation', () => {
  describe('staffLoginSchema', () => {
    it('should accept valid staff login', () => {
      const data = {
        email: 'staff@facility.org',
        password: 'SecurePass123'
      };

      const result = validateData(data, staffLoginSchema);
      expect(result.isValid).toBe(true);
    });

    it('should accept login with 2FA code', () => {
      const data = {
        email: 'staff@facility.org',
        password: 'SecurePass123',
        twoFactorCode: '123456'
      };

      const result = validateData(data, staffLoginSchema);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidEmails = ['invalid', 'staff@', '@facility.org', 'staff @facility.org'];

      invalidEmails.forEach(email => {
        const data = { email, password: 'SecurePass123' };
        const result = validateData(data, staffLoginSchema);
        expect(result.isValid).toBe(false);
      });
    });

    it('should lowercase email automatically', () => {
      const data = {
        email: 'STAFF@FACILITY.ORG',
        password: 'SecurePass123'
      };

      const result = validateData(data, staffLoginSchema);
      expect(result.isValid).toBe(true);
      expect(result.data.email).toBe('staff@facility.org');
    });

    it('should reject 2FA code that is not 6 digits', () => {
      const invalidCodes = ['12345', '1234567', 'abcdef'];

      invalidCodes.forEach(code => {
        const data = {
          email: 'staff@facility.org',
          password: 'SecurePass123',
          twoFactorCode: code
        };

        const result = validateData(data, staffLoginSchema);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('mfaSetupSchema', () => {
    it('should accept TOTP setup without phone number', () => {
      const data = { method: 'totp' };

      const result = validateData(data, mfaSetupSchema);
      expect(result.isValid).toBe(true);
    });

    it('should require phone number for SMS setup', () => {
      const data = { method: 'sms' };

      const result = validateData(data, mfaSetupSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('required');
    });

    it('should accept SMS setup with valid phone number', () => {
      const data = {
        method: 'sms',
        phoneNumber: '+1-555-123-4567'
      };

      const result = validateData(data, mfaSetupSchema);
      expect(result.isValid).toBe(true);
    });

    it('should set default backup codes count to 10', () => {
      const data = { method: 'totp' };

      const result = validateData(data, mfaSetupSchema);
      expect(result.isValid).toBe(true);
      expect(result.data.backupCodesCount).toBe(10);
    });
  });
});

describe('Data Sanitization', () => {
  it('should trim whitespace from strings', () => {
    const data = {
      content: '   trimmed content   '
    };

    const result = validateData(data, addNoteSchema);
    expect(result.isValid).toBe(true);
    expect(result.data.content).toBe('trimmed content');
  });

  it('should reject unknown fields by default', () => {
    const data = {
      content: 'valid note',
      unknownField: 'should be rejected'
    };

    const result = validateData(data, addNoteSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('is not allowed');
  });
});

describe('Error Messages', () => {
  it('should provide clear validation error messages', () => {
    const data = { limit: 1000 };

    const result = validateData(data, conversationListSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toMatch(/must be less than or equal to/i);
  });

  it('should include field names in error messages', () => {
    const data = { userId: 'ab' };

    const result = validateData(data, conversationListSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].field).toBe('userId');
  });

  it('should support multiple validation errors', () => {
    const data = {
      page: -1,
      limit: 500,
      status: 'invalid_status'
    };

    const result = validateData(data, conversationListSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
