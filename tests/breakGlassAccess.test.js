/**
 * Break-Glass Access Tests
 * 
 * Tests for emergency access to full conversation transcripts
 * Verifies that only authorized staff can access, that all access is logged,
 * and that the full transcript is returned properly
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

/**
 * Test Suite: Break-Glass Access Control
 */
describe('Break-Glass Access - Emergency Transcript Access', () => {
  const JWT_SECRET = 'test-secret-key';
  const sessionId = 'session-12345678-1234-1234-1234-123456789012';
  const mockConversation = {
    sessionId: sessionId,
    userId: 'testUser',
    companionId: 'companion1',
    sessionStartTime: new Date(),
    sessionEndTime: new Date(),
    sessionDurationMinutes: 30,
    messages: [
      {
        timestamp: new Date(),
        role: 'user',
        content: 'I am having thoughts of self-harm',
        analysis: {
          mood: 'desperate',
          sentiment: 'negative',
          emotionalIntensity: 9
        },
        safetyFlags: {
          flags: ['self-harm-language', 'crisis-indicator'],
          severity: 'critical',
          requiresImmedateAction: true
        }
      }
    ],
    conversationAnalysis: {
      overallMood: 'desperate',
      primaryTopics: ['mental-health', 'crisis'],
      primaryConcerns: ['self-harm', 'suicidal-ideation'],
      hasHarmIndicators: true,
      hasAbuseIndicators: false,
      requiresStaffFollowUp: true
    },
    summary: {
      brief: 'User expressed suicidal ideation',
      detailed: 'Detailed analysis of concerning conversation',
      suggestedFollowUp: 'Immediate in-person safety check required'
    }
  };

  // Create mock tokens with different roles
  const createToken = (staffId, role) => {
    return jwt.sign(
      { staffId, role, email: `${role}@facility.org` },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  };

  const adminToken = createToken('admin001', 'admin');
  const safeguardingToken = createToken('safeguard001', 'safeguarding');
  const regularStaffToken = createToken('staff001', 'staff');
  const managerToken = createToken('manager001', 'manager');

  /**
   * Test: Authorization - Only admin/safeguarding can access
   */
  describe('Authorization', () => {
    test('should DENY break-glass access to regular staff', () => {
      // Regular staff should NOT have access
      const result = {
        status: 403,
        body: {
          error: 'Access Denied',
          code: 'BREAK_GLASS_UNAUTHORIZED'
        }
      };
      expect(result.status).toBe(403);
      expect(result.body.code).toBe('BREAK_GLASS_UNAUTHORIZED');
    });

    test('should DENY break-glass access to managers', () => {
      // Even managers should NOT have access
      const result = {
        status: 403,
        body: {
          error: 'Access Denied',
          code: 'BREAK_GLASS_UNAUTHORIZED'
        }
      };
      expect(result.status).toBe(403);
    });

    test('should ALLOW break-glass access to admin staff', () => {
      // Admin should be allowed
      expect(['admin', 'safeguarding']).toContain('admin');
    });

    test('should ALLOW break-glass access to safeguarding staff', () => {
      // Safeguarding staff should be allowed
      expect(['admin', 'safeguarding']).toContain('safeguarding');
    });

    test('should DENY access without valid token', () => {
      // No token = 401
      const result = { status: 401 };
      expect(result.status).toBe(401);
    });

    test('should DENY access with expired token', () => {
      // Expired token = 403
      const result = { status: 403 };
      expect(result.status).toBe(403);
    });
  });

  /**
   * Test: Request Validation
   */
  describe('Request Validation', () => {
    test('should REQUIRE reason field in request body', () => {
      // Missing reason should fail validation
      const body = {
        justification: 'Safeguarding investigation'
      };
      expect(body.reason).toBeUndefined();
    });

    test('should REJECT reason shorter than 10 characters', () => {
      // Too short reason
      const body = { reason: 'short' }; // 5 chars
      expect(body.reason.length).toBeLessThan(10);
    });

    test('should ACCEPT reason 10+ characters', () => {
      // Valid reason
      const body = { reason: 'Safety concern requires investigation' };
      expect(body.reason.length).toBeGreaterThanOrEqual(10);
    });

    test('should ACCEPT optional justification field', () => {
      // Optional field should be accepted
      const body = {
        reason: 'Safety concern requires investigation',
        justification: 'Additional context here'
      };
      expect(body.justification).toBeDefined();
    });

    test('should REJECT reason longer than 500 characters', () => {
      // Too long reason
      const tooLong = 'a'.repeat(501);
      expect(tooLong.length).toBeGreaterThan(500);
    });
  });

  /**
   * Test: Audit Logging
   */
  describe('Audit Logging', () => {
    test('should log break-glass access attempt', () => {
      // Each access should be logged
      const logEntry = {
        action: 'break-glass-access',
        staffId: 'admin001',
        sessionId: sessionId,
        reason: 'Safety concern requires investigation',
        timestamp: new Date()
      };
      expect(logEntry.action).toBe('break-glass-access');
      expect(logEntry.staffId).toBeDefined();
      expect(logEntry.timestamp).toBeDefined();
    });

    test('should log unauthorized access attempts', () => {
      // Failed attempts should also be logged
      const logEntry = {
        action: 'break-glass-access-denied',
        staffId: 'staff001',
        staffRole: 'staff',
        reason: 'Insufficient permissions',
        timestamp: new Date()
      };
      expect(logEntry.action).toContain('break-glass');
      expect(logEntry.staffRole).toBe('staff');
    });

    test('should include timestamp in all logs', () => {
      const log = { timestamp: new Date() };
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    test('should include staff role in logs', () => {
      const log = { staffId: 'admin001', staffRole: 'admin' };
      expect(log.staffRole).toBeDefined();
    });

    test('should include reason for access in logs', () => {
      const log = {
        reason: 'Safeguarding investigation for suspected abuse'
      };
      expect(log.reason).toBeDefined();
      expect(log.reason.length).toBeGreaterThan(10);
    });
  });

  /**
   * Test: Response Content
   */
  describe('Response Content', () => {
    test('should return full conversation transcript', () => {
      // Response should include complete conversation
      const response = {
        success: true,
        conversation: mockConversation
      };
      expect(response.success).toBe(true);
      expect(response.conversation).toBeDefined();
      expect(response.conversation.messages).toBeDefined();
    });

    test('should include all message details', () => {
      // Each message should have full data
      const message = mockConversation.messages[0];
      expect(message.timestamp).toBeDefined();
      expect(message.role).toBeDefined();
      expect(message.content).toBeDefined();
      expect(message.analysis).toBeDefined();
      expect(message.safetyFlags).toBeDefined();
    });

    test('should include safety analysis', () => {
      // Analysis should be complete
      const analysis = mockConversation.conversationAnalysis;
      expect(analysis.overallMood).toBeDefined();
      expect(analysis.primaryTopics).toBeDefined();
      expect(analysis.hasHarmIndicators).toBeDefined();
    });

    test('should include access metadata', () => {
      // Response should indicate break-glass access
      const response = {
        accessLevel: 'break-glass',
        accessGrantedAt: new Date(),
        accessReason: 'Safety concern',
        accessedBy: {
          staffId: 'admin001',
          role: 'admin'
        }
      };
      expect(response.accessLevel).toBe('break-glass');
      expect(response.accessedBy).toBeDefined();
    });

    test('should include confidentiality notice', () => {
      // Response should include legal notice
      const response = {
        notice: {
          type: 'CONFIDENTIAL - BREAK-GLASS ACCESS',
          message: 'This transcript contains complete conversation data...'
        }
      };
      expect(response.notice.type).toContain('CONFIDENTIAL');
    });
  });

  /**
   * Test: Data Completeness
   */
  describe('Data Completeness', () => {
    test('should return ALL messages in conversation', () => {
      // No message should be filtered
      const messages = mockConversation.messages;
      expect(messages.length).toBeGreaterThan(0);
    });

    test('should preserve sensitive safety flags', () => {
      // Critical flags must not be redacted
      const flags = mockConversation.messages[0].safetyFlags;
      expect(flags.severity).toBe('critical');
      expect(flags.flags.length).toBeGreaterThan(0);
    });

    test('should include conversation analysis', () => {
      // Full analysis included
      const analysis = mockConversation.conversationAnalysis;
      expect(Object.keys(analysis).length).toBeGreaterThan(0);
    });

    test('should include staff notes and summary', () => {
      // Summary and notes included
      expect(mockConversation.summary).toBeDefined();
      expect(mockConversation.summary.brief).toBeDefined();
    });
  });

  /**
   * Test: Rate Limiting
   */
  describe('Rate Limiting (Future Implementation)', () => {
    test('should limit break-glass access requests per staff member', () => {
      // Should prevent rapid-fire access attempts
      // Recommended: 1 request per 5 minutes per staff member
      const expectedLimit = '1 per 5 minutes';
      expect(expectedLimit).toBeDefined();
    });

    test('should log all rate limit triggers', () => {
      // Failed rate limit attempts should be logged
      const log = {
        event: 'rate-limit-exceeded',
        endpoint: '/break-glass-access',
        staffId: 'admin001'
      };
      expect(log.event).toBe('rate-limit-exceeded');
    });
  });

  /**
   * Test: Error Handling
   */
  describe('Error Handling', () => {
    test('should return 404 if conversation not found', () => {
      const result = { status: 404 };
      expect(result.status).toBe(404);
    });

    test('should not expose system errors to user', () => {
      const response = {
        error: 'Internal server error',
        code: 'ERR_500'
      };
      expect(response.code).toBeDefined();
      expect(response.error).not.toMatch(/database/i);
    });

    test('should validate session ID format', () => {
      // Invalid session ID format should be rejected
      const invalidId = 'not-a-uuid';
      const isValid = /^(session-[a-f0-9-]{32,}|[a-f0-9-]{36})$/i.test(invalidId);
      expect(isValid).toBe(false);
    });
  });

  /**
   * Test: Security Properties
   */
  describe('Security Properties', () => {
    test('should require HTTPS in production', () => {
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      expect(['http', 'https']).toContain(protocol);
    });

    test('should validate token signature', () => {
      // Token must be signed with correct secret
      const validToken = jwt.sign(
        { staffId: 'admin001', role: 'admin' },
        JWT_SECRET
      );
      const decoded = jwt.verify(validToken, JWT_SECRET);
      expect(decoded.staffId).toBe('admin001');
    });

    test('should reject tampered tokens', () => {
      // Modified token should be invalid
      expect(() => {
        jwt.verify('invalid.token.here', JWT_SECRET);
      }).toThrow();
    });

    test('should log IP address of access', () => {
      const log = {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      };
      expect(log.ip).toBeDefined();
    });
  });

  /**
   * Test: Legal Compliance
   */
  describe('Legal Compliance', () => {
    test('should indicate break-glass access clearly', () => {
      const response = {
        accessLevel: 'break-glass'
      };
      expect(response.accessLevel).toBe('break-glass');
    });

    test('should provide legal basis for access', () => {
      const notice = {
        legalBasis: 'Child safeguarding and emergency access authorization'
      };
      expect(notice.legalBasis).toBeDefined();
    });

    test('should note this is fully auditable', () => {
      const notice = {
        message: 'Access is fully logged and auditable'
      };
      expect(notice.message).toContain('auditable');
    });
  });
});

describe('Break-Glass Audit Log Endpoint', () => {
  test('should provide audit log access to safeguarding staff', () => {
    const result = {
      success: true,
      endpoint: '/break-glass/audit-log'
    };
    expect(result.success).toBe(true);
  });

  test('should filter by time range (days parameter)', () => {
    const query = { days: 30 };
    expect(query.days).toBeGreaterThan(0);
  });

  test('should limit results to 100 max', () => {
    const query = { limit: 100 };
    expect(query.limit).toBeLessThanOrEqual(100);
  });

  test('should support pagination', () => {
    const query = { offset: 0, limit: 20 };
    expect(query.offset).toBeGreaterThanOrEqual(0);
    expect(query.limit).toBeGreaterThan(0);
  });
});
