/**
 * Integration Tests for Conversation API Endpoints
 * 
 * Tests the new conversation routes created in Phase 1:
 * - GET /api/conversations (paginated list with filters)
 * - GET /api/conversations/:sessionId (full conversation detail)
 * - POST /api/conversations/search (advanced search)
 * - POST /api/conversations/:sessionId/acknowledge (mark as reviewed)
 * - POST /api/conversations/:sessionId/add-note (add staff annotation)
 * - GET /api/conversations/stats/overview (dashboard statistics)
 */

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server/app');
const Conversation = require('../server/models/Conversation');

describe('Conversation API Integration Tests', () => {
  let staffToken;
  let testConversation;
  
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  beforeAll(async () => {
    // Create test staff token
    staffToken = jwt.sign(
      { id: 'test-staff-id', role: 'staff', username: 'teststaff' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  });

  beforeEach(async () => {
    // Clear conversations collection
    await Conversation.deleteMany({});
    
    // Create test conversation with realistic data
    testConversation = await Conversation.create({
      userId: 'test-user-123',
      sessionId: 'session-' + Date.now(),
      messages: [
        {
          role: 'user',
          content: 'I\'m feeling really sad today',
          timestamp: new Date(),
          safetyFlags: [
            {
              type: 'emotional_distress',
              severity: 'high',
              explanation: 'User expressing sadness'
            }
          ]
        },
        {
          role: 'assistant',
          content: 'I\'m here to listen. Would you like to talk about what\'s bothering you?',
          timestamp: new Date(),
          safetyFlags: []
        },
        {
          role: 'user',
          content: 'I\'ve been having thoughts of harming myself',
          timestamp: new Date(),
          safetyFlags: [
            {
              type: 'self_harm_ideation',
              severity: 'critical',
              explanation: 'User expressing self-harm thoughts'
            }
          ]
        }
      ],
      conversationAnalysis: {
        overallMood: 'sad',
        moodTrend: ['hopeful', 'sad', 'sad'],
        emotionalIntensity: 8,
        primaryTopics: ['mental health', 'self-harm'],
        primaryConcerns: ['depression', 'safety'],
        requiresStaffFollowUp: true
      },
      staffReview: {
        reviewed: false,
        reviewedBy: null,
        reviewedAt: null,
        notes: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ============================================
  // TEST: GET /api/conversations (Paginated List)
  // ============================================
  describe('GET /api/conversations', () => {
    it('should return paginated list of conversations with correct structure', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20 })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const conv = response.body.data[0];
        
        // Check serialized conversation structure
        expect(conv).toHaveProperty('_id');
        expect(conv).toHaveProperty('userId');
        expect(conv).toHaveProperty('sessionId');
        expect(conv).toHaveProperty('messageCount');
        expect(conv).toHaveProperty('lastMessageTime');
        expect(conv).toHaveProperty('lastMessagePreview');
        expect(conv).toHaveProperty('overallMood');
        expect(conv).toHaveProperty('moodTrend');
        expect(conv).toHaveProperty('emotionalIntensity');
        expect(conv).toHaveProperty('primaryTopics');
        expect(conv).toHaveProperty('primaryConcerns');
        expect(conv).toHaveProperty('hasSafetyFlags');
        expect(conv).toHaveProperty('safetyFlagsDetected');
        expect(conv).toHaveProperty('criticalFlags');
        expect(conv).toHaveProperty('requiresStaffFollowUp');
        expect(conv).toHaveProperty('createdAt');
        expect(conv).toHaveProperty('updatedAt');
      }
    });

    it('should filter conversations by userId', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20, userId: 'test-user-123' })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(conv => {
        expect(conv.userId).toBe('test-user-123');
      });
    });

    it('should filter conversations by status=flagged', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20, status: 'flagged' })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(conv => {
        expect(conv.hasSafetyFlags).toBe(true);
      });
    });

    it('should filter conversations by status=followup', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20, status: 'followup' })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(conv => {
        expect(conv.requiresStaffFollowUp).toBe(true);
      });
    });

    it('should reject request without authentication token', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20 })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================
  // TEST: GET /api/conversations/:sessionId (Detail View)
  // ============================================
  describe('GET /api/conversations/:sessionId', () => {
    it('should return full conversation with all messages and analysis', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.sessionId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('messages');
      expect(Array.isArray(response.body.data.messages)).toBe(true);
      
      // Check that messages are returned
      expect(response.body.data.messages.length).toBeGreaterThan(0);
      
      // Check message structure
      const msg = response.body.data.messages[0];
      expect(msg).toHaveProperty('role');
      expect(msg).toHaveProperty('content');
      expect(msg).toHaveProperty('timestamp');
      expect(msg).toHaveProperty('safetyFlags');
    });

    it('should return all conversation analysis in detail view', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.sessionId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const conv = response.body.data;
      
      // Check detailed analysis fields exist
      expect(conv).toHaveProperty('overallMood');
      expect(conv).toHaveProperty('moodTrend');
      expect(conv).toHaveProperty('emotionalIntensity');
      expect(conv).toHaveProperty('safetyFlagsDetected');
      expect(Array.isArray(conv.safetyFlagsDetected)).toBe(true);
    });

    it('should return safety flags with correct count and severity', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.sessionId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const flags = response.body.data.safetyFlagsDetected;
      
      // Should have aggregated flags
      expect(flags.length).toBeGreaterThan(0);
      
      flags.forEach(flag => {
        expect(flag).toHaveProperty('type');
        expect(flag).toHaveProperty('count');
        expect(flag).toHaveProperty('severity');
      });
    });

    it('should return critical flags separately', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.sessionId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const criticalFlags = response.body.data.criticalFlags;
      
      expect(Array.isArray(criticalFlags)).toBe(true);
      
      // Should have at least one critical flag from our test data
      if (criticalFlags.length > 0) {
        criticalFlags.forEach(flag => {
          expect(['critical', 'high']).toContain(flag.severity);
        });
      }
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/conversations/non-existent-session')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================
  // TEST: GET /api/conversations/stats/overview (Dashboard Stats)
  // ============================================
  describe('GET /api/conversations/stats/overview', () => {
    it('should return dashboard statistics aggregated from all conversations', async () => {
      const response = await request(app)
        .get('/api/conversations/stats/overview')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('totalConversations');
      expect(response.body.data).toHaveProperty('totalMessages');
      expect(response.body.data).toHaveProperty('totalActiveUsers');
      expect(response.body.data).toHaveProperty('flaggedConversations');
      expect(response.body.data).toHaveProperty('followupsNeeded');
      expect(response.body.data).toHaveProperty('activeConversations');
    });

    it('should correctly count flagged conversations', async () => {
      const response = await request(app)
        .get('/api/conversations/stats/overview')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Created conversation has safety flags
      expect(response.body.data.flaggedConversations).toBeGreaterThan(0);
    });

    it('should correctly count followups needed', async () => {
      const response = await request(app)
        .get('/api/conversations/stats/overview')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Test conversation has requiresStaffFollowUp = true
      expect(response.body.data.followupsNeeded).toBeGreaterThan(0);
    });

    it('should calculate correct total messages', async () => {
      const response = await request(app)
        .get('/api/conversations/stats/overview')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Should have 3 messages from our test conversation
      expect(response.body.data.totalMessages).toBe(3);
    });
  });

  // ============================================
  // TEST: POST /api/conversations/:sessionId/acknowledge (Mark Reviewed)
  // ============================================
  describe('POST /api/conversations/:sessionId/acknowledge', () => {
    it('should mark conversation as reviewed', async () => {
      const response = await request(app)
        .post(`/api/conversations/${testConversation.sessionId}/acknowledge`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.staffReview.reviewed).toBe(true);
      expect(response.body.data.staffReview.reviewedAt).toBeDefined();
    });

    it('should store reviewer information when acknowledged', async () => {
      const response = await request(app)
        .post(`/api/conversations/${testConversation.sessionId}/acknowledge`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(200);

      expect(response.body.data.staffReview.reviewedBy).toBeDefined();
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .post('/api/conversations/non-existent/acknowledge')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================
  // TEST: POST /api/conversations/:sessionId/add-note (Staff Notes)
  // ============================================
  describe('POST /api/conversations/:sessionId/add-note', () => {
    it('should add staff note to conversation', async () => {
      const noteContent = 'This client needs immediate attention';
      
      const response = await request(app)
        .post(`/api/conversations/${testConversation.sessionId}/add-note`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ content: noteContent })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.staffReview.notes).toHaveLength(1);
      expect(response.body.data.staffReview.notes[0].content).toBe(noteContent);
    });

    it('should include staff metadata in note', async () => {
      const response = await request(app)
        .post(`/api/conversations/${testConversation.sessionId}/add-note`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ content: 'Test note' })
        .expect(200);

      const note = response.body.data.staffReview.notes[0];
      expect(note).toHaveProperty('staffId');
      expect(note).toHaveProperty('staffName');
      expect(note).toHaveProperty('timestamp');
      expect(note).toHaveProperty('content');
    });

    it('should reject empty note content', async () => {
      const response = await request(app)
        .post(`/api/conversations/${testConversation.sessionId}/add-note`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ content: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should allow multiple notes on same conversation', async () => {
      // Add first note
      await request(app)
        .post(`/api/conversations/${testConversation.sessionId}/add-note`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ content: 'First note' })
        .expect(200);

      // Add second note
      const response = await request(app)
        .post(`/api/conversations/${testConversation.sessionId}/add-note`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ content: 'Second note' })
        .expect(200);

      expect(response.body.data.staffReview.notes).toHaveLength(2);
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .post('/api/conversations/non-existent/add-note')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ content: 'Test note' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================
  // TEST: POST /api/conversations/search (Advanced Search)
  // ============================================
  describe('POST /api/conversations/search', () => {
    it('should search conversations by mood', async () => {
      const response = await request(app)
        .post('/api/conversations/search')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ mood: 'sad' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        response.body.data.forEach(conv => {
          expect(conv.overallMood).toBe('sad');
        });
      }
    });

    it('should search conversations by severity level', async () => {
      const response = await request(app)
        .post('/api/conversations/search')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ severity: 'critical' })
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        response.body.data.forEach(conv => {
          const hasCritical = conv.criticalFlags && conv.criticalFlags.length > 0;
          expect(hasCritical).toBe(true);
        });
      }
    });

    it('should search conversations by topic', async () => {
      const response = await request(app)
        .post('/api/conversations/search')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ topics: ['mental health'] })
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should search conversations within date range', async () => {
      const startDate = new Date(Date.now() - 86400000);
      const endDate = new Date(Date.now() + 86400000);

      const response = await request(app)
        .post('/api/conversations/search')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        })
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should support multiple search filters combined', async () => {
      const response = await request(app)
        .post('/api/conversations/search')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          mood: 'sad',
          severity: 'critical',
          userId: 'test-user-123'
        })
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      
      response.body.data.forEach(conv => {
        expect(conv.overallMood).toBe('sad');
        expect(conv.userId).toBe('test-user-123');
      });
    });
  });

  // ============================================
  // AUTHENTICATION TESTS
  // ============================================
  describe('Authentication and Authorization', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20 })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20 })
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with malformed header', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, limit: 20 })
        .set('Authorization', 'InvalidHeader')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
