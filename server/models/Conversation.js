const mongoose = require('mongoose');

/**
 * Conversation Schema - Full history of all messages between youth and companion
 * Stores complete audit trail for compliance, analysis, and context
 */
const ConversationSchema = new mongoose.Schema(
  {
    // User & Companion identification
    userId: {
      type: String,
      required: true,
      index: true, // For quick lookup by user
    },
    companionId: {
      type: String,
      required: true,
      default: 'carebridge-companion-01',
    },

    // Session metadata
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionStartTime: {
      type: Date,
      default: Date.now,
    },
    sessionEndTime: {
      type: Date,
      default: null,
    },
    sessionDurationMinutes: {
      type: Number,
      default: 0,
    },

    // Complete message history (full history = store everything)
    messages: [
      {
        _id: false, // Don't create separate ObjectId for each message
        role: {
          type: String,
          enum: ['user', 'assistant'],
          required: true,
        },
        content: {
          type: String,
          required: true,
          maxlength: 5000, // Reasonable max for single message
        },
        timestamp: {
          type: Date,
          default: Date.now,
          index: true,
        },

        // Metadata attached to each message
        metadata: {
          tokensUsed: {
            type: Number,
            default: 0,
          },
          processingTimeMs: {
            type: Number,
            default: 0,
          },
          modelVersion: {
            type: String,
            default: 'llama3.1',
          },
        },

        // Analysis for user messages only
        analysis: {
          mood: {
            type: String,
            enum: ['happy', 'sad', 'angry', 'anxious', 'neutral', 'hopeful', 'desperate', 'unknown'],
            default: 'unknown',
          },
          moodScore: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5,
          },
          sentiment: {
            type: String,
            enum: ['positive', 'neutral', 'negative'],
            default: 'neutral',
          },
          emotionalIntensity: {
            type: Number,
            min: 0,
            max: 1,
            default: 0,
          },
          topics: [String], // ['family', 'school', 'relationships', etc.]
          concerns: [String], // ['homesickness', 'bullying', etc.]
        },

        // Safety flags for EVERY message
        safetyFlags: {
          detected: {
            type: Boolean,
            default: false,
          },
          flags: [
            {
              type: String,
              enum: [
                'self-harm-mention',
                'suicide-ideation',
                'abuse-mention',
                'exploitation-concern',
                'substance-use',
                'violence-mention',
                'trafficking-indicator',
                'extreme-distress',
                'isolation-concern',
                'other',
              ],
            },
          ],
          severity: {
            type: String,
            enum: ['critical', 'high', 'medium', 'low'],
            default: 'low',
          },
          explanation: String, // Why this flag was raised
          requiresImmedateAction: {
            type: Boolean,
            default: false,
          },
        },
      },
    ],

    // Conversation-level analysis (updated as conversation progresses)
    conversationAnalysis: {
      overallMood: {
        type: String,
        default: 'neutral',
      },
      moodTrend: {
        type: String,
        enum: ['improving', 'declining', 'stable', 'fluctuating'],
        default: 'stable',
      },
      primaryTopics: [String],
      primaryConcerns: [String],
      hasHarmIndicators: {
        type: Boolean,
        default: false,
      },
      hasAbuseIndicators: {
        type: Boolean,
        default: false,
      },
      requiresStaffFollowUp: {
        type: Boolean,
        default: false,
      },
      crisicsDetected: [
        {
          type: String,
          timestamp: Date,
          severity: String,
        },
      ],
    },

    // Conversation summary (auto-generated for staff briefings)
    summary: {
      brief: String, // 1-2 sentence summary
      detailed: String, // 2-3 paragraph summary
      staffNotes: String, // Recommendations for staff
      suggestedFollowUp: String, // What to ask/do next
      generatedAt: Date,
      updatedAt: Date,
    },

    // Tags for easy filtering
    tags: {
      type: [String],
      default: [],
      // Examples: ['crisis', 'family-issue', 'suicide-risk', 'making-progress', 'holiday-stress']
    },

    // Flags for staff action
    flagsForStaffReview: [
      {
        flag: String,
        severity: String,
        addedAt: Date,
        acknowledged: {
          type: Boolean,
          default: false,
        },
        acknowledgedBy: String,
        acknowledgedAt: Date,
      },
    ],

    // Data retention & compliance
    dataRetention: {
      retentionDays: {
        type: Number,
        default: 90, // From facilityConfig
      },
      scheduledDeletionDate: Date,
      gdprCompliant: {
        type: Boolean,
        default: true,
      },
      hipaaCompliant: {
        type: Boolean,
        default: true,
      },
      isDeleted: {
        type: Boolean,
        default: false,
      },
      deletedAt: Date,
      deleteReason: String, // 'retention-policy', 'user-request', 'manual', etc.
    },

    // Facility context
    facilityId: String,
    facilityName: String,

    // Source & metadata
    source: {
      type: String,
      enum: ['mobile-app', 'web-app', 'testing', 'import'],
      default: 'mobile-app',
    },
    platform: String, // 'iOS', 'Android', 'Web', 'Test'
    appVersion: String,
  },
  {
    timestamps: true, // Auto createdAt, updatedAt
    collection: 'conversations',
  }
);

// === INDEXES FOR PERFORMANCE ===
ConversationSchema.index({ userId: 1, sessionStartTime: -1 }); // Get user's conversations
ConversationSchema.index({ companionId: 1, createdAt: -1 }); // Get companion's conversations
ConversationSchema.index({ 'messages.safetyFlags.detected': 1 }); // Find flagged conversations
ConversationSchema.index({ 'conversationAnalysis.hasHarmIndicators': 1 }); // Crisis conversations
ConversationSchema.index({ 'dataRetention.scheduledDeletionDate': 1 }); // Deletion job
ConversationSchema.index({ 'flagsForStaffReview.acknowledged': 1 }); // Staff follow-up

// === VIRTUAL FIELDS ===
ConversationSchema.virtual('messageCount').get(function () {
  return this.messages.length;
});

ConversationSchema.virtual('userMessageCount').get(function () {
  return this.messages.filter((m) => m.role === 'user').length;
});

ConversationSchema.virtual('assistantMessageCount').get(function () {
  return this.messages.filter((m) => m.role === 'assistant').length;
});

// === PRE-SAVE HOOKS ===
ConversationSchema.pre('save', function (next) {
  // Calculate session duration
  if (this.sessionEndTime && this.sessionStartTime) {
    this.sessionDurationMinutes = Math.round(
      (this.sessionEndTime - this.sessionStartTime) / 60000
    );
  }

  // Update conversation analysis
  if (this.messages.length > 0) {
    this.updateConversationAnalysis();
  }

  // Schedule deletion if needed
  if (this.dataRetention.retentionDays && !this.dataRetention.scheduledDeletionDate) {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + this.dataRetention.retentionDays);
    this.dataRetention.scheduledDeletionDate = deletionDate;
  }

  next();
});

// === INSTANCE METHODS ===

/**
 * Add a message to the conversation
 */
ConversationSchema.methods.addMessage = function (role, content, metadata = {}, analysis = {}) {
  const message = {
    role,
    content,
    timestamp: new Date(),
    metadata: {
      tokensUsed: metadata.tokensUsed || 0,
      processingTimeMs: metadata.processingTimeMs || 0,
      modelVersion: metadata.modelVersion || 'llama3.1',
    },
  };

  if (role === 'user' && analysis) {
    message.analysis = {
      mood: analysis.mood || 'unknown',
      moodScore: analysis.moodScore || 0.5,
      sentiment: analysis.sentiment || 'neutral',
      emotionalIntensity: analysis.emotionalIntensity || 0,
      topics: analysis.topics || [],
      concerns: analysis.concerns || [],
    };
  }

  this.messages.push(message);
  return this;
};

/**
 * Add safety flag to most recent message
 */
ConversationSchema.methods.addSafetyFlag = function (flags, severity = 'medium', explanation = '') {
  if (this.messages.length === 0) return this;

  const lastMessage = this.messages[this.messages.length - 1];
  lastMessage.safetyFlags.detected = true;
  lastMessage.safetyFlags.flags = Array.isArray(flags) ? flags : [flags];
  lastMessage.safetyFlags.severity = severity;
  lastMessage.safetyFlags.explanation = explanation;
  lastMessage.safetyFlags.requiresImmedateAction = severity === 'critical' || severity === 'high';

  // Mark conversation as needing follow-up if critical
  if (severity === 'critical') {
    this.conversationAnalysis.requiresStaffFollowUp = true;
  }

  return this;
};

/**
 * Get last N messages for context window
 */
ConversationSchema.methods.getContextWindow = function (windowSize = 10) {
  return this.messages.slice(-windowSize).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
};

/**
 * Update conversation-level analysis
 */
ConversationSchema.methods.updateConversationAnalysis = function () {
  const userMessages = this.messages.filter((m) => m.role === 'user');

  if (userMessages.length === 0) return this;

  // Calculate mood trend
  const recentMoods = userMessages.slice(-5).map((m) => m.analysis?.moodScore || 0.5);
  const avgMood = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length;
  const firstMood = recentMoods[0];
  const lastMood = recentMoods[recentMoods.length - 1];

  if (lastMood > firstMood + 0.2) {
    this.conversationAnalysis.moodTrend = 'improving';
  } else if (lastMood < firstMood - 0.2) {
    this.conversationAnalysis.moodTrend = 'declining';
  } else if (Math.max(...recentMoods) - Math.min(...recentMoods) > 0.3) {
    this.conversationAnalysis.moodTrend = 'fluctuating';
  } else {
    this.conversationAnalysis.moodTrend = 'stable';
  }

  // Collect all topics and concerns
  const allTopics = new Set();
  const allConcerns = new Set();
  let hasCrisis = false;

  userMessages.forEach((msg) => {
    msg.analysis?.topics?.forEach((t) => allTopics.add(t));
    msg.analysis?.concerns?.forEach((c) => allConcerns.add(c));
    if (msg.safetyFlags?.severity === 'critical') {
      hasCrisis = true;
    }
  });

  this.conversationAnalysis.primaryTopics = Array.from(allTopics);
  this.conversationAnalysis.primaryConcerns = Array.from(allConcerns);
  this.conversationAnalysis.hasHarmIndicators = this.messages.some(
    (m) =>
      m.safetyFlags?.flags?.some((f) =>
        ['self-harm-mention', 'suicide-ideation', 'extreme-distress'].includes(f)
      )
  );
  this.conversationAnalysis.hasAbuseIndicators = this.messages.some((m) =>
    m.safetyFlags?.flags?.some((f) =>
      ['abuse-mention', 'exploitation-concern', 'trafficking-indicator'].includes(f)
    )
  );
  this.conversationAnalysis.requiresStaffFollowUp = hasCrisis || this.conversationAnalysis.hasHarmIndicators;

  return this;
};

/**
 * Mark for staff review
 */
ConversationSchema.methods.flagForStaffReview = function (flag, severity = 'medium') {
  this.flagsForStaffReview.push({
    flag,
    severity,
    addedAt: new Date(),
  });
  return this;
};

/**
 * Acknowledge flag review
 */
ConversationSchema.methods.acknowledgeFlagReview = function (staffMemberId) {
  const unacknowledged = this.flagsForStaffReview.filter((f) => !f.acknowledged);
  unacknowledged.forEach((f) => {
    f.acknowledged = true;
    f.acknowledgedBy = staffMemberId;
    f.acknowledgedAt = new Date();
  });
  return this;
};

/**
 * Get mood progression over conversation
 */
ConversationSchema.methods.getMoodProgression = function () {
  return this.messages
    .filter((m) => m.role === 'user' && m.analysis)
    .map((m) => ({
      timestamp: m.timestamp,
      mood: m.analysis.mood,
      score: m.analysis.moodScore,
      intensity: m.analysis.emotionalIntensity,
    }));
};

/**
 * End session and calculate final metrics
 */
ConversationSchema.methods.endSession = function () {
  this.sessionEndTime = new Date();
  this.updateConversationAnalysis();
  return this;
};

/**
 * Soft delete for data retention
 */
ConversationSchema.methods.softDelete = function (reason = 'retention-policy') {
  this.dataRetention.isDeleted = true;
  this.dataRetention.deletedAt = new Date();
  this.dataRetention.deleteReason = reason;
  return this;
};

// === STATIC METHODS ===

/**
 * Get all conversations for a user
 */
ConversationSchema.statics.getUserConversations = function (userId, limit = 10) {
  return this.find({ userId, 'dataRetention.isDeleted': false })
    .sort({ sessionStartTime: -1 })
    .limit(limit)
    .select('userId sessionId sessionStartTime sessionDurationMinutes conversationAnalysis summary');
};

/**
 * Find conversations with safety concerns
 */
ConversationSchema.statics.getFlaggedConversations = function (limit = 20) {
  return this.find({
    'messages.safetyFlags.detected': true,
    'dataRetention.isDeleted': false,
  })
    .sort({ sessionStartTime: -1 })
    .limit(limit);
};

/**
 * Find conversations needing staff review
 */
ConversationSchema.statics.requiresStaffFollowUp = function () {
  return this.find({
    'conversationAnalysis.requiresStaffFollowUp': true,
    'flagsForStaffReview.acknowledged': false,
    'dataRetention.isDeleted': false,
  }).sort({ sessionStartTime: -1 });
};

/**
 * Cleanup expired conversations
 */
ConversationSchema.statics.deleteExpiredConversations = function () {
  const now = new Date();
  return this.updateMany(
    {
      'dataRetention.scheduledDeletionDate': { $lte: now },
      'dataRetention.isDeleted': false,
    },
    {
      'dataRetention.isDeleted': true,
      'dataRetention.deletedAt': now,
      'dataRetention.deleteReason': 'retention-policy',
    }
  );
};

module.exports = mongoose.model('Conversation', ConversationSchema);
