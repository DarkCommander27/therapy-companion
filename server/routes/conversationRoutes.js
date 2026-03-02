/**
 * Conversation Routes - Staff Dashboard Data Access
 * Provides endpoints for staff to view, search, and manage conversations
 * Handles proper serialization of conversation data for UI consumption
 */

const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRequest, validateQuery, validateBody, validateParams } = require('../middleware/validation');
const { sanitizeMiddleware } = require('../middleware/sanitization');
const {
  conversationListSchema,
  conversationDetailSchema,
  conversationSearchSchema,
  addNoteSchema,
  noteParamsSchema,
  acknowledgeSchema,
  acknowledgeParamsSchema,
  breakGlassAccessSchema
} = require('../schemas/conversationSchemas');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ============================================
// MIDDLEWARE - VERIFY STAFF TOKEN
// ============================================

const verifyStaffToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.staffId = decoded.staffId;
    req.staffRole = decoded.role;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// DATA SERIALIZATION HELPERS
// ============================================

/**
 * Serialize conversation for dashboard display
 * Converts Mongoose doc to clean UI data
 */
function serializeConversation(doc) {
  const conv = doc.toObject ? doc.toObject() : doc;

  const lastMessage = conv.messages && conv.messages.length > 0 
    ? conv.messages[conv.messages.length - 1] 
    : null;

  return {
    sessionId: conv.sessionId,
    userId: conv.userId,
    companionId: conv.companionId,
    startTime: conv.sessionStartTime,
    endTime: conv.sessionEndTime,
    durationMinutes: conv.sessionDurationMinutes,
    messageCount: conv.messages?.length || 0,
    lastMessageTime: lastMessage?.timestamp,
    lastMessagePreview: lastMessage?.content?.substring(0, 100) || 'No messages',
    
    // Analysis & Mood
    overallMood: conv.conversationAnalysis?.overallMood || 'neutral',
    moodTrend: conv.conversationAnalysis?.moodTrend || 'stable',
    emotionalIntensity: calculateAverageIntensity(conv.messages),
    
    // Topics & Concerns
    primaryTopics: conv.conversationAnalysis?.primaryTopics || [],
    primaryConcerns: conv.conversationAnalysis?.primaryConcerns || [],
    tags: conv.tags || [],
    
    // Safety Analysis
    hasSafetyFlags: conv.conversationAnalysis?.hasHarmIndicators || false,
    hasAbuseIndicators: conv.conversationAnalysis?.hasAbuseIndicators || false,
    requiresStaffFollowUp: conv.conversationAnalysis?.requiresStaffFollowUp || false,
    
    // Critical info for alerts
    safetyFlagsDetected: extractSafetyFlags(conv.messages),
    criticalFlags: extractCriticalFlags(conv.messages),
    
    // Summary
    briefSummary: conv.summary?.brief || 'No summary available',
    detailedSummary: conv.summary?.detailed || '',
    suggestedFollowUp: conv.summary?.suggestedFollowUp || '',
    staffNotes: conv.summary?.staffNotes || '',
    
    // Staff review status
    flagsForReview: conv.flagsForStaffReview?.map(f => ({
      flag: f.flag,
      severity: f.severity,
      addedAt: f.addedAt,
      acknowledged: f.acknowledged,
      acknowledgedBy: f.acknowledgedBy,
      acknowledgedAt: f.acknowledgedAt,
      staffNotes: f.staffNotes
    })) || [],
  };
}

/**
 * Extract all safety flags from messages with severity
 */
function extractSafetyFlags(messages) {
  if (!messages || !Array.isArray(messages)) return [];
  
  const flags = {};
  
  messages.forEach(msg => {
    if (msg.safetyFlags?.flags && Array.isArray(msg.safetyFlags.flags)) {
      msg.safetyFlags.flags.forEach(flag => {
        if (!flags[flag]) {
          flags[flag] = {
            type: flag,
            count: 0,
            severity: msg.safetyFlags.severity,
            lastOccurred: msg.timestamp,
            requiresImmedateAction: msg.safetyFlags.requiresImmedateAction
          };
        }
        flags[flag].count++;
        flags[flag].lastOccurred = msg.timestamp;
      });
    }
  });
  
  return Object.values(flags);
}

/**
 * Extract only critical/high severity flags
 */
function extractCriticalFlags(messages) {
  if (!messages || !Array.isArray(messages)) return [];
  
  const critical = [];
  
  messages.forEach(msg => {
    if (msg.safetyFlags?.severity && ['critical', 'high'].includes(msg.safetyFlags.severity)) {
      critical.push({
        timestamp: msg.timestamp,
        severity: msg.safetyFlags.severity,
        flags: msg.safetyFlags.flags || [],
        explanation: msg.safetyFlags.explanation,
        requiresImmedateAction: msg.safetyFlags.requiresImmedateAction,
        messageContent: msg.content?.substring(0, 150)
      });
    }
  });
  
  return critical;
}

/**
 * Calculate average emotional intensity
 */
function calculateAverageIntensity(messages) {
  if (!messages || messages.length === 0) return 0;
  
  const sum = messages.reduce((acc, msg) => {
    return acc + (msg.analysis?.emotionalIntensity || 0);
  }, 0);
  
  return (sum / messages.length).toFixed(2);
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * GET /api/conversations
 * Paginated list of all conversations with filters
 * Query params: page=1, limit=20, userId=?, status=?, sortBy=recent
 */
router.get(
  '/',
  verifyStaffToken,
  validateQuery(conversationListSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, userId, status, sortBy = 'recent' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const queryLimit = Math.min(parseInt(limit), 100); // Max 100 per page

    // Build filter
    const filter = {};
    if (userId) {
      filter.userId = userId;
    }

    // Status filter
    if (status === 'flagged') {
      filter.$or = [
        { 'conversationAnalysis.hasHarmIndicators': true },
        { 'conversationAnalysis.hasAbuseIndicators': true }
      ];
    } else if (status === 'followup') {
      filter['conversationAnalysis.requiresStaffFollowUp'] = true;
    } else if (status === 'active') {
      filter.sessionEndTime = null;
    } else if (status === 'completed') {
      filter.sessionEndTime = { $ne: null };
    }

    // Execute query
    const total = await Conversation.countDocuments(filter);
    const conversations = await Conversation.find(filter)
      .sort(sortBy === 'recent' ? { sessionStartTime: -1 } : { sessionStartTime: 1 })
      .skip(skip)
      .limit(queryLimit)
      .lean();

    const serialized = conversations.map(serializeConversation);

    res.json({
      success: true,
      data: serialized,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / queryLimit),
        totalItems: total,
        itemsPerPage: queryLimit,
        hasNextPage: skip + queryLimit < total,
        hasPrevPage: page > 1
      }
    });
  })
);

/**
 * GET /api/conversations/:sessionId
 * Full conversation details with all messages
 */
router.get(
  '/:sessionId',
  verifyStaffToken,
  validateParams(conversationDetailSchema),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const serialized = serializeConversation(conversation);
    
    // Add full message thread
    serialized.messages = conversation.messages.map(msg => ({
      timestamp: msg.timestamp,
      role: msg.role,
      content: msg.content,
      mood: msg.analysis?.mood,
      sentiment: msg.analysis?.sentiment,
      emotionalIntensity: msg.analysis?.emotionalIntensity,
      safetyFlags: msg.safetyFlags?.flags,
      safetyExplanation: msg.safetyFlags?.explanation,
      topics: msg.analysis?.topics,
      concerns: msg.analysis?.concerns
    }));

    res.json({
      success: true,
      data: serialized
    });
  })
);

/**
 * POST /api/conversations/search
 * Advanced search with multiple filters
 * Body: { userId, dateRange, mood, topics, concerns, severity }
 * 
 * Includes:
 * - Input sanitization (XSS prevention)
 * - Advanced filtering
 * - Pagination
 */
router.post(
  '/search',
  verifyStaffToken,
  sanitizeMiddleware(),
  validateBody(conversationSearchSchema),
  asyncHandler(async (req, res) => {
    const { userId, dateFrom, dateTo, mood, topics, concerns, severity, page = 1, limit = 20 } = req.body;

    const filter = {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build dynamic filter
    if (userId) filter.userId = userId;
    
    if (dateFrom || dateTo) {
      filter.sessionStartTime = {};
      if (dateFrom) filter.sessionStartTime.$gte = new Date(dateFrom);
      if (dateTo) filter.sessionStartTime.$lte = new Date(dateTo);
    }

    if (mood) filter['conversationAnalysis.overallMood'] = mood;
    
    if (Array.isArray(topics) && topics.length > 0) {
      filter['conversationAnalysis.primaryTopics'] = { $in: topics };
    }
    
    if (Array.isArray(concerns) && concerns.length > 0) {
      filter['conversationAnalysis.primaryConcerns'] = { $in: concerns };
    }

    if (severity === 'critical') {
      filter['messages.safetyFlags.severity'] = 'critical';
    } else if (severity === 'high') {
      filter.$or = [
        { 'messages.safetyFlags.severity': 'critical' },
        { 'messages.safetyFlags.severity': 'high' }
      ];
    }

    const total = await Conversation.countDocuments(filter);
    const conversations = await Conversation.find(filter)
      .sort({ sessionStartTime: -1 })
      .skip(skip)
      .limit(Math.min(parseInt(limit), 100))
      .lean();

    const serialized = conversations.map(serializeConversation);

    res.json({
      success: true,
      data: serialized,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  })
);

/**
 * POST /api/conversations/:sessionId/acknowledge
 * Mark conversation flags as reviewed by staff
 * Body: { acknowledgedBy, timestamp }
 */
router.post(
  '/:sessionId/acknowledge',
  verifyStaffToken,
  validateParams(acknowledgeParamsSchema),
  validateBody(acknowledgeSchema),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { acknowledgedBy, timestamp } = req.body;

    const conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Mark all unacknowledged flags as acknowledged
    if (conversation.flagsForStaffReview) {
      conversation.flagsForStaffReview.forEach(flag => {
        if (!flag.acknowledged) {
          flag.acknowledged = true;
          flag.acknowledgedBy = acknowledgedBy || req.staffId;
          flag.acknowledgedAt = timestamp || new Date();
        }
      });
    }

    await conversation.save();
    logger.info(`✓ Conversation acknowledged - SessionID: ${sessionId}, StaffID: ${req.staffId}`);

    res.json({
      success: true,
      message: 'Conversation marked as reviewed',
      data: serializeConversation(conversation)
    });
  })
);

/**
 * POST /api/conversations/:sessionId/add-note
 * Add staff notes to a conversation
 * Body: { content, visibility, priority, flagForReview, relatedFlags }
 * 
 * Includes:
 * - Input sanitization with rich text allowed for notes
 * - Timestamp and priority tracking
 * - Flag association
 */
router.post(
  '/:sessionId/add-note',
  verifyStaffToken,
  sanitizeMiddleware({ richTextFields: ['content'] }),
  validateParams(noteParamsSchema),
  validateBody(addNoteSchema),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { content, visibility = 'staff-only', priority = 'medium', flagForReview = false, relatedFlags = [] } = req.body;

    const conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Add to staff notes in summary
    if (!conversation.summary.staffNotes) {
      conversation.summary.staffNotes = '';
    }
    
    const timestamp = new Date().toISOString();
    const noteEntry = {
      content,
      visibility,
      priority,
      timestamp,
      staffId: req.staffId,
      flagForReview,
      relatedFlags
    };
    
    conversation.summary.staffNotes += `\n[${timestamp}] [${priority.toUpperCase()}] ${content}`;
    conversation.summary.updatedAt = new Date();

    await conversation.save();
    logger.info(`✓ Note added to conversation - SessionID: ${sessionId}, Priority: ${priority}`, {
      staffId: req.staffId,
      sessionId,
      flagForReview
    });

    res.json({
      success: true,
      message: 'Note added successfully',
      data: {
        sessionId,
        noteAdded: noteEntry,
        staffNotes: conversation.summary.staffNotes
      }
    });
  })
);

/**
 * GET /api/conversations/stats/overview
 * Dashboard statistics
 */
router.get(
  '/stats/overview',
  verifyStaffToken,
  asyncHandler(async (req, res) => {
    const total = await Conversation.countDocuments();
    const flagged = await Conversation.countDocuments({
      $or: [
        { 'conversationAnalysis.hasHarmIndicators': true },
        { 'conversationAnalysis.hasAbuseIndicators': true }
      ]
    });
    const needsFollowup = await Conversation.countDocuments({
      'conversationAnalysis.requiresStaffFollowUp': true
    });
    const active = await Conversation.countDocuments({
      sessionEndTime: null
    });

    // Count unique users
    const uniqueUsers = await Conversation.collection.distinct('userId');

    // Count total messages
    const result = await Conversation.aggregate([
      { $group: { _id: null, totalMessages: { $sum: { $size: '$messages' } } } }
    ]);
    const totalMessages = result[0]?.totalMessages || 0;

    res.json({
      success: true,
      stats: {
        totalConversations: total,
        activeConversations: active,
        completedConversations: total - active,
        flaggedConversations: flagged,
        followupsNeeded: needsFollowup,
        totalActiveUsers: uniqueUsers.length,
        totalMessages: totalMessages,
        avgMessagesPerConversation: total > 0 ? (totalMessages / total).toFixed(1) : 0
      }
    });
  })
);

// ============================================
// BREAK-GLASS ACCESS - EMERGENCY ACCESS TO FULL TRANSCRIPTS
// ============================================

/**
 * POST /api/conversations/:sessionId/break-glass-access
 * 
 * Break-Glass Rule: Emergency access to full conversation transcript
 * 
 * Purpose: Allow authorized safeguarding/admin staff to access complete
 * conversation history in emergency situations (safety concerns, 
 * safeguarding investigations, etc.)
 * 
 * Requirements:
 * - User must have 'admin' or 'safeguarding' role
 * - Must provide reason for access (required)
 * - Access is heavily logged for audit purposes
 * - Rate limited to prevent abuse
 * 
 * Body: {
 *   reason: string (required) - Why this access is needed
 *   justification: string (optional) - Additional context
 * }
 * 
 * Returns: Complete conversation with all messages, analysis, and sensitive data
 */
router.post(
  '/:sessionId/break-glass-access',
  verifyStaffToken,
  validateParams(conversationDetailSchema),
  validateBody(breakGlassAccessSchema),
  // Check authorization: must be admin or safeguarding role
  (req, res, next) => {
    if (!req.staffRole || !['admin', 'safeguarding'].includes(req.staffRole)) {
      logger.warn(`🚨 BREAK-GLASS ACCESS DENIED - Unauthorized role attempt`, {
        staffId: req.staffId,
        staffRole: req.staffRole,
        sessionId: req.params.sessionId,
        reason: req.body?.reason,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only admin or safeguarding staff can access break-glass transcripts',
        code: 'BREAK_GLASS_UNAUTHORIZED'
      });
    }
    next();
  },
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { reason, justification } = req.body;
    const accessTimestamp = new Date();

    // Get full conversation without any serialization
    const conversation = await Conversation.findOne({ sessionId }).lean();

    if (!conversation) {
      logger.warn(`🚨 BREAK-GLASS - Conversation not found`, {
        sessionId,
        staffId: req.staffId,
        timestamp: accessTimestamp
      });
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // === LOG BREAK-GLASS ACCESS ===
    // This is critical for safeguarding accountability
    const breakGlassLog = {
      accessType: 'break-glass',
      sessionId: conversation.sessionId,
      userId: conversation.userId,
      staffId: req.staffId,
      staffRole: req.staffRole,
      timestamp: accessTimestamp,
      reason: reason,
      justification: justification || null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      conversationSummary: {
        startTime: conversation.sessionStartTime,
        endTime: conversation.sessionEndTime,
        messageCount: conversation.messages?.length || 0,
        durationMinutes: conversation.sessionDurationMinutes
      }
    };

    // Log to audit trail
    logger.audit(
      'break-glass-access',
      'conversation',
      conversation.sessionId,
      {
        staffId: req.staffId,
        reason: reason,
        justification: justification
      }
    );

    // Log as warning for security monitoring
    logger.warn(`🚨 BREAK-GLASS ACCESS GRANTED - Full transcript accessed`, breakGlassLog);

    // === RETURN FULL CONVERSATION TRANSCRIPT ===
    const fullTranscript = {
      success: true,
      accessLevel: 'break-glass',
      accessGrantedAt: accessTimestamp,
      accessReason: reason,
      accessJustification: justification,
      accessedBy: {
        staffId: req.staffId,
        role: req.staffRole
      },
      conversation: {
        // Session info
        sessionId: conversation.sessionId,
        userId: conversation.userId,
        companionId: conversation.companionId,
        sessionStartTime: conversation.sessionStartTime,
        sessionEndTime: conversation.sessionEndTime,
        sessionDurationMinutes: conversation.sessionDurationMinutes,

        // Full message history with all fields
        messages: conversation.messages?.map(msg => ({
          timestamp: msg.timestamp,
          role: msg.role,
          content: msg.content,
          // Analysis data
          analysis: msg.analysis,
          // Safety flags
          safetyFlags: msg.safetyFlags,
          // Metadata
          metadata: msg.metadata
        })) || [],

        // Conversation analysis
        analysis: conversation.conversationAnalysis,

        // Summary and notes
        summary: conversation.summary,

        // Flags for review
        flagsForStaffReview: conversation.flagsForStaffReview,

        // Data retention info
        dataRetention: conversation.dataRetention,

        // Full metadata
        metadata: conversation.metadata,

        // All tags
        tags: conversation.tags
      },

      // Safeguarding notice
      notice: {
        type: 'CONFIDENTIAL - BREAK-GLASS ACCESS',
        message: 'This transcript contains complete conversation data accessed under break-glass rule. Access is fully logged and auditable.',
        auditedBy: 'Safeguarding Team',
        legalBasis: 'Child safeguarding and emergency access authorization'
      }
    };

    // Send response
    res.status(200).json(fullTranscript);
  })
);

/**
 * GET /api/conversations/break-glass/audit-log
 * Get audit log of all break-glass accesses
 * Safeguarding/Admin only
 */
router.get(
  '/break-glass/audit-log',
  verifyStaffToken,
  (req, res, next) => {
    if (!req.staffRole || !['admin', 'safeguarding'].includes(req.staffRole)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only admin or safeguarding staff can view break-glass audit logs'
      });
    }
    next();
  },
  asyncHandler(async (req, res) => {
    const { days = 30, limit = 100, offset = 0 } = req.query;

    // In production, this would query from a dedicated audit log collection
    // For now, return info about audit logging
    res.json({
      success: true,
      message: 'Break-glass audit log endpoint',
      note: 'Full audit logs are stored in secure audit trail and accessible to authorized safeguarding staff only',
      filters: {
        daysBack: parseInt(days),
        maxResults: Math.min(parseInt(limit), 100),
        offset: parseInt(offset)
      },
      recommendation: 'All break-glass accesses are logged with timestamp, staff ID, reason, and full context for complete accountability'
    });
  })
);

module.exports = router;
