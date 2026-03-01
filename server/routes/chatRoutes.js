const express = require('express');
const router = express.Router();
const llamaService = require('../services/llamaService');
const ConversationManager = require('../services/ConversationManager');
const Conversation = require('../models/Conversation');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * POST /api/chat
 * Main chat endpoint with full conversation history storage and streaming support
 * 
 * Request body:
 * {
 *   "message": string (required) - User's message
 *   "sessionId": string (optional) - Existing session ID
 *   "userId": string (required) - Unique user identifier
 *   "companionId": string (optional) - Companion identifier
 * }
 * 
 * Response: Streaming text or full response with metadata
 */
router.post(
  '/api/chat',
  asyncHandler(async (req, res) => {
    const { message, sessionId, userId, companionId } = req.body;

    // === VALIDATION ===
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message cannot be empty',
        code: 'EMPTY_MESSAGE',
      });
    }

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID',
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        error: 'Message too long (max 2000 characters)',
        code: 'MESSAGE_TOO_LONG',
      });
    }

    // === CHECK MODEL AVAILABILITY ===
    if (!llamaService.isModelAvailable()) {
      logger.warn('Llama model unavailable - using fallback response');
      return res.status(503).json({
        error: 'AI model temporarily unavailable',
        fallback: true,
        response: "I'm here to listen. What's on your mind?",
        message: 'Model health check failed. Using template response.',
      });
    }

    try {
      // === GET OR CREATE CONVERSATION ===
      let conversation;

      if (sessionId) {
        // Load existing conversation
        conversation = await Conversation.findOne({
          sessionId,
          'dataRetention.isDeleted': false,
        });

        if (!conversation) {
          return res.status(404).json({
            error: 'Session not found',
            code: 'SESSION_NOT_FOUND',
          });
        }

        logger.info(`✓ Loaded existing conversation - SessionID: ${sessionId}`);
      } else {
        // Create new conversation
        const result = await ConversationManager.createConversation(userId, companionId);
        conversation = await Conversation.findOne({ sessionId: result.sessionId });
        logger.info(`✓ Created new conversation - SessionID: ${result.sessionId}`);
      }

      // === ANALYZE USER MESSAGE ===
      const mood = llamaService.extractMood(message);
      const safetyFlags = llamaService.detectSafetyFlags(message);

      // Log safety concerns immediately
      if (safetyFlags.detected) {
        logger.warn(
          `⚠️ SAFETY FLAG - SessionID: ${conversation.sessionId}, Severity: ${safetyFlags.severity}, Flags: ${safetyFlags.flags.join(', ')}`
        );

        // Alert staff immediately if critical
        if (safetyFlags.severity === 'critical') {
          logger.error(
            `🚨 CRITICAL SAFETY ALERT - UserID: ${userId}, SessionID: ${conversation.sessionId}`
          );
          // In production: Send immediate alert to safeguarding team
        }
      }

      // === SAVE USER MESSAGE ===
      const userMsgResult = await ConversationManager.addUserMessage(
        conversation.sessionId,
        message,
        {
          mood: mood.mood,
          moodScore: mood.score,
          sentiment: safetyFlags.detected ? 'negative' : 'neutral',
          emotionalIntensity: mood.score,
        },
        safetyFlags.detected ? safetyFlags : null
      );

      logger.debug(`✓ User message saved - SessionID: ${conversation.sessionId}`);

      // === GET CONTEXT WINDOW ===
      const contextWindow = await ConversationManager.getContextWindow(
        conversation.sessionId,
        10
      );

      // === GENERATE RESPONSE ===
      const generateStartTime = Date.now();

      // Check if client accepts streaming
      const acceptsStreaming = req.headers.accept === 'text/event-stream' || req.query.stream === 'true';

      if (acceptsStreaming && llamaService.streamEnabled) {
        // === STREAMING RESPONSE ===
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullResponse = '';
        let tokensGenerated = 0;

        await llamaService.generateResponse(message, contextWindow, async (chunk) => {
          fullResponse = chunk.fullResponse;
          tokensGenerated = chunk.tokenCount;

          // Send chunk to client
          res.write(
            `data: ${JSON.stringify({
              chunk: chunk.chunk,
              isDone: chunk.isDone,
              tokenCount: chunk.tokenCount,
            })}\n\n`
          );

          // If done, save to database
          if (chunk.isDone) {
            // Save assistant message
            const processingTime = Date.now() - generateStartTime;
            await ConversationManager.addAssistantMessage(conversation.sessionId, fullResponse, {
              tokensUsed: tokensGenerated,
              processingTimeMs: processingTime,
              modelVersion: 'llama3.1',
            });

            // Regenerate summary
            await ConversationManager.generateSummary(conversation.sessionId);

            logger.info(
              `✓ Streaming response complete - ${tokensGenerated} tokens in ${processingTime}ms`
            );

            // Send final metadata
            res.write(
              `data: ${JSON.stringify({
                done: true,
                sessionId: conversation.sessionId,
                processingTimeMs: processingTime,
                safetyFlags: safetyFlags.detected ? safetyFlags : null,
              })}\n\n`
            );

            res.end();
          }
        });
      } else {
        // === NON-STREAMING RESPONSE ===
        const llmResponse = await llamaService.generateResponse(message, contextWindow);

        // Validate response
        const validation = llamaService.validateResponse(llmResponse.response);
        if (!validation.isValid) {
          logger.warn(`Invalid response: ${validation.error}`);
          return res.status(500).json({
            error: 'Failed to generate valid response',
            fallback: true,
            response: "I'm here to listen. Can you tell me more about what you're feeling?",
          });
        }

        // Save assistant message
        await ConversationManager.addAssistantMessage(
          conversation.sessionId,
          llmResponse.response,
          {
            tokensUsed: llmResponse.tokenCount,
            processingTimeMs: llmResponse.processingTimeMs,
            modelVersion: 'llama3.1',
          }
        );

        // Regenerate summary
        await ConversationManager.generateSummary(conversation.sessionId);

        logger.info(
          `✓ Response generated - ${llmResponse.tokenCount} tokens in ${llmResponse.processingTimeMs}ms`
        );

        // === RETURN RESPONSE ===
        res.status(200).json({
          success: true,
          response: llmResponse.response,
          sessionId: conversation.sessionId,
          metadata: {
            userMessageId: userMsgResult.messageId,
            processingTimeMs: llmResponse.processingTimeMs,
            tokensUsed: llmResponse.tokenCount,
            mood: mood.mood,
            moodScore: mood.score,
            safetyFlags: safetyFlags.detected ? safetyFlags : null,
            timestamp: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error(`Chat error: ${error.message}`);

      // Fallback response
      return res.status(500).json({
        error: 'Failed to generate response',
        fallback: true,
        response:
          "I'm having trouble responding right now, but I'm here to listen. Can you tell me what's on your mind?",
        message: error.message,
      });
    }
  })
);

/**
 * POST /api/chat/start
 * Initialize a new chat session
 * 
 * Request body:
 * {
 *   "userId": string (required)
 *   "companionId": string (optional)
 * }
 * 
 * Response:
 * {
 *   "sessionId": string,
 *   "userId": string,
 *   "startTime": ISO date string
 * }
 */
router.post(
  '/api/chat/start',
  asyncHandler(async (req, res) => {
    const { userId, companionId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required',
      });
    }

    const result = await ConversationManager.createConversation(userId, companionId);

    res.status(201).json({
      success: true,
      ...result,
    });
  })
);

/**
 * GET /api/chat/:sessionId
 * Get conversation details and history
 */
router.get(
  '/api/chat/:sessionId',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const conversation = await Conversation.findOne({
      sessionId,
      'dataRetention.isDeleted': false,
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
      });
    }

    res.status(200).json({
      success: true,
      session: {
        sessionId: conversation.sessionId,
        userId: conversation.userId,
        startTime: conversation.sessionStartTime,
        endTime: conversation.sessionEndTime,
        duration: conversation.sessionDurationMinutes,
      },
      messages: conversation.messages,
      analysis: conversation.conversationAnalysis,
      summary: conversation.summary,
    });
  })
);

/**
 * POST /api/chat/:sessionId/end
 * End a conversation session
 */
router.post(
  '/api/chat/:sessionId/end',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const result = await ConversationManager.endConversation(sessionId);

    res.status(200).json({
      success: true,
      ...result,
    });
  })
);

/**
 * GET /api/chat/user/:userId
 * Get conversation history for a user
 */
router.get(
  '/api/chat/user/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit || '10');

    const conversations = await ConversationManager.getUserHistory(userId, limit);

    res.status(200).json({
      success: true,
      userId,
      conversations,
      count: conversations.length,
    });
  })
);

/**
 * GET /api/chat/flagged
 * Get all conversations with safety flags (staff endpoint)
 */
router.get(
  '/api/chat/flagged',
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit || '20');

    const flagged = await ConversationManager.getFlaggedConversations(limit);

    res.status(200).json({
      success: true,
      flagged,
      count: flagged.length,
    });
  })
);

/**
 * GET /api/chat/staff/followup
 * Get conversations requiring staff follow-up
 */
router.get(
  '/api/chat/staff/followup',
  asyncHandler(async (req, res) => {
    const pending = await ConversationManager.getStaffFollowUps();

    res.status(200).json({
      success: true,
      pending,
      count: pending.length,
    });
  })
);

/**
 * POST /api/chat/:sessionId/acknowledge
 * Staff acknowledges review of conversation
 */
router.post(
  '/api/chat/:sessionId/acknowledge',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { staffMemberId } = req.body;

    if (!staffMemberId) {
      return res.status(400).json({
        error: 'Staff member ID is required',
      });
    }

    const result = await ConversationManager.acknowledgeStaffReview(sessionId, staffMemberId);

    res.status(200).json({
      success: true,
      ...result,
    });
  })
);

/**
 * GET /api/chat/health
 * Health check for Llama model
 */
router.get('/api/chat/health', (req, res) => {
  const isHealthy = llamaService.isModelAvailable();
  const modelInfo = llamaService.getModelInfo();

  res.status(isHealthy ? 200 : 503).json({
    healthy: isHealthy,
    model: modelInfo.model,
    temperature: modelInfo.temperature,
    maxTokens: modelInfo.maxTokens,
    lastHealthCheck: modelInfo.lastHealthCheck,
    lastResponseTimeMs: modelInfo.lastResponseTimeMs,
  });
});

module.exports = router;
