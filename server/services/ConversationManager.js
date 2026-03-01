const Conversation = require('../models/Conversation');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * ConversationManager - Manages chat sessions and conversation persistence
 * Handles: creating sessions, saving messages, loading context, generating summaries
 */
class ConversationManager {
  /**
   * Create a new conversation session
   */
  static async createConversation(userId, companionId = 'carebridge-companion-01', facilityId = null) {
    try {
      const sessionId = uuidv4();

      const conversation = new Conversation({
        userId,
        companionId,
        sessionId,
        facilityId,
        source: 'mobile-app',
      });

      await conversation.save();

      logger.info(`✓ New conversation created - SessionID: ${sessionId}, UserID: ${userId}`);

      return {
        sessionId: conversation.sessionId,
        userId: conversation.userId,
        companionId: conversation.companionId,
        startTime: conversation.sessionStartTime,
      };
    } catch (error) {
      logger.error(`Failed to create conversation: ${error.message}`);
      throw new Error(`Cannot create conversation: ${error.message}`);
    }
  }

  /**
   * Get active session - load from DB
   */
  static async getConversation(sessionId) {
    try {
      const conversation = Conversation.findOne({
        sessionId,
        'dataRetention.isDeleted': false,
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      return conversation;
    } catch (error) {
      logger.error(`Failed to load conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save user message to conversation
   */
  static async addUserMessage(sessionId, messageContent, analysis = {}, safetyFlags = null) {
    try {
      const conversation = await Conversation.findOne({
        sessionId,
        'dataRetention.isDeleted': false,
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      // Add the user message
      conversation.addMessage('user', messageContent, {}, analysis);

      // Add safety flags if detected
      if (safetyFlags && safetyFlags.detected) {
        conversation.addSafetyFlag(
          safetyFlags.flags,
          safetyFlags.severity,
          safetyFlags.explanation
        );
      }

      await conversation.save();

      logger.info(`✓ User message saved - SessionID: ${sessionId}`);

      return {
        messageId: conversation.messages.length - 1,
        timestamp: conversation.messages[conversation.messages.length - 1].timestamp,
        flagged: safetyFlags?.detected || false,
      };
    } catch (error) {
      logger.error(`Failed to save user message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save assistant message to conversation
   */
  static async addAssistantMessage(sessionId, messageContent, metadata = {}) {
    try {
      const conversation = await Conversation.findOne({
        sessionId,
        'dataRetention.isDeleted': false,
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      conversation.addMessage('assistant', messageContent, metadata);

      await conversation.save();

      logger.info(`✓ Assistant message saved - SessionID: ${sessionId}`);

      return {
        messageId: conversation.messages.length - 1,
        timestamp: conversation.messages[conversation.messages.length - 1].timestamp,
      };
    } catch (error) {
      logger.error(`Failed to save assistant message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent conversation history for context window
   * Limited to N messages to fit in model context
   */
  static async getContextWindow(sessionId, windowSize = 10) {
    try {
      const conversation = await Conversation.findOne({
        sessionId,
        'dataRetention.isDeleted': false,
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      const contextWindow = conversation.getContextWindow(windowSize);

      logger.debug(`✓ Context window loaded - ${contextWindow.length} messages`);

      return contextWindow;
    } catch (error) {
      logger.error(`Failed to load context window: ${error.message}`);
      throw error;
    }
  }

  /**
   * End conversation session
   * Calculates final metrics and prepares for briefing
   */
  static async endConversation(sessionId) {
    try {
      const conversation = await Conversation.findOne({
        sessionId,
        'dataRetention.isDeleted': false,
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      conversation.endSession();
      await conversation.save();

      logger.info(
        `✓ Conversation ended - SessionID: ${sessionId}, Duration: ${conversation.sessionDurationMinutes} min`
      );

      return {
        sessionId: conversation.sessionId,
        duration: conversation.sessionDurationMinutes,
        messageCount: conversation.messageCount,
        hasFlags: conversation.conversationAnalysis.requiresStaffFollowUp,
      };
    } catch (error) {
      logger.error(`Failed to end conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate AI-powered summary for staff briefing
   * Note: This would normally use Llama to summarize, but we provide template
   */
  static async generateSummary(sessionId) {
    try {
      const conversation = await Conversation.findOne({
        sessionId,
        'dataRetention.isDeleted': false,
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      // Build summary from conversation analysis
      const userMessages = conversation.messages.filter((m) => m.role === 'user');

      if (userMessages.length === 0) {
        return null;
      }

      // Extract key information
      const mood = conversation.conversationAnalysis.overallMood;
      const moodTrend = conversation.conversationAnalysis.moodTrend;
      const topics = conversation.conversationAnalysis.primaryTopics;
      const concerns = conversation.conversationAnalysis.primaryConcerns;
      const hasFlags = conversation.conversationAnalysis.requiresStaffFollowUp;

      // Build brief summary
      const brief = `Youth expressed ${mood} mood (${moodTrend}). ${
        topics.length > 0 ? `Topics: ${topics.join(', ')}.` : ''
      }${concerns.length > 0 ? ` Concerns: ${concerns.join(', ')}.` : ''}${
        hasFlags ? ' ⚠️ REQUIRES STAFF FOLLOW-UP' : ''
      }`;

      // Build detailed summary
      const detailed = `During this ${conversation.sessionDurationMinutes}-minute conversation, the youth discussed ${
        topics.length > 0 ? `${topics.join(', ')}` : 'various matters'
      }. Overall mood was ${mood} and trending ${moodTrend}. The conversation included ${
        conversation.messageCount
      } total messages. ${
        concerns.length > 0
          ? `Key concerns mentioned: ${concerns.join(', ')}. `
          : ''
      }${
        hasFlags
          ? 'This conversation includes safety flags that require staff review.'
          : 'No critical safety flags detected.'
      }`;

      // Build staff notes
      let staffNotes =
        'Check in with youth to:\n' +
        `- Validate their feelings about ${topics.length > 0 ? topics[0] : 'what they shared'}\n` +
        `- Explore solutions for ${concerns.length > 0 ? concerns[0] : 'their concerns'}\n` +
        `- Build on their strengths and progress\n`;

      if (hasFlags) {
        staffNotes += '\n⚠️ SAFETY ALERT: Review flagged content and follow facility protocols.';
      }

      // Compile summary
      const summary = {
        brief,
        detailed,
        staffNotes,
        suggestedFollowUp: `Follow up within 24 hours to check on ${topics.length > 0 ? topics[0] : 'this conversation'}.`,
        generatedAt: new Date(),
      };

      // Update conversation with summary
      conversation.summary = summary;
      await conversation.save();

      logger.info(`✓ Summary generated - SessionID: ${sessionId}`);

      return summary;
    } catch (error) {
      logger.error(`Failed to generate summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all flagged conversations for staff review
   */
  static async getFlaggedConversations(limit = 20) {
    try {
      const flagged = await Conversation.findFlaggedConversations(limit);

      logger.info(`✓ Retrieved ${flagged.length} flagged conversations`);

      return flagged.map((conv) => ({
        sessionId: conv.sessionId,
        userId: conv.userId,
        duration: conv.sessionDurationMinutes,
        flags: conv.messages
          .filter((m) => m.safetyFlags.detected)
          .map((m) => ({
            severity: m.safetyFlags.severity,
            flags: m.safetyFlags.flags,
            timestamp: m.timestamp,
          })),
        summary: conv.summary?.brief || '',
        requiresAction: conv.conversationAnalysis.requiresStaffFollowUp,
      }));
    } catch (error) {
      logger.error(`Failed to retrieve flagged conversations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's conversation history
   */
  static async getUserHistory(userId, limit = 10) {
    try {
      const conversations = await Conversation.getUserConversations(userId, limit);

      logger.info(`✓ Retrieved ${conversations.length} conversations for user ${userId}`);

      return conversations.map((conv) => ({
        sessionId: conv.sessionId,
        startTime: conv.sessionStartTime,
        duration: conv.sessionDurationMinutes,
        messageCount: conv.messages.length,
        mood: conv.conversationAnalysis.overallMood,
        summary: conv.summary?.brief,
      }));
    } catch (error) {
      logger.error(`Failed to retrieve user history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pending staff follow-ups
   */
  static async getStaffFollowUps() {
    try {
      const conversations = await Conversation.requiresStaffFollowUp();

      logger.info(`✓ Retrieved ${conversations.length} conversations requiring staff follow-up`);

      return conversations.map((conv) => ({
        sessionId: conv.sessionId,
        userId: conv.userId,
        duration: conv.sessionDurationMinutes,
        summary: conv.summary?.staffNotes,
        flagCount: conv.flagsForStaffReview.length,
        unacknowledgedCount: conv.flagsForStaffReview.filter((f) => !f.acknowledged).length,
      }));
    } catch (error) {
      logger.error(`Failed to retrieve staff follow-ups: ${error.message}`);
      throw error;
    }
  }

  /**
   * Acknowledge staff review
   */
  static async acknowledgeStaffReview(sessionId, staffMemberId) {
    try {
      const conversation = await Conversation.findOne({
        sessionId,
        'dataRetention.isDeleted': false,
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      conversation.acknowledgeFlagReview(staffMemberId);
      await conversation.save();

      logger.info(`✓ Staff review acknowledged - SessionID: ${sessionId}, StaffID: ${staffMemberId}`);

      return {
        sessionId,
        acknowledgedBy: staffMemberId,
        acknowledgedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to acknowledge review: ${error.message}`);
      throw error;
    }
  }

  /**
   * Soft delete conversation (data retention)
   */
  static async deleteConversation(sessionId, reason = 'retention-policy') {
    try {
      const conversation = await Conversation.findOne({ sessionId });

      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      conversation.softDelete(reason);
      await conversation.save();

      logger.info(`✓ Conversation marked for deletion - SessionID: ${sessionId}`);

      return {
        sessionId,
        deletedAt: conversation.dataRetention.deletedAt,
        reason: conversation.dataRetention.deleteReason,
      };
    } catch (error) {
      logger.error(`Failed to delete conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup expired conversations (batch operation)
   */
  static async cleanupExpiredConversations() {
    try {
      const result = await Conversation.deleteExpiredConversations();

      logger.info(`✓ Cleanup complete - ${result.modifiedCount} conversations deleted`);

      return {
        deletedCount: result.modifiedCount,
        completedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to cleanup conversations: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ConversationManager;
