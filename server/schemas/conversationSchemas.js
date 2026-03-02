/**
 * Joi Validation Schemas for Conversation APIs
 * 
 * Defines validation rules for:
 * - Conversation list queries (pagination, filtering, sorting)
 * - Search requests (advanced multi-field search)
 * - Staff notes (add-note endpoint)
 * - Acknowledge requests
 */

const Joi = require('joi');

// ============================================
// REUSABLE FIELD SCHEMAS
// ============================================

const sessionIdSchema = Joi.string()
  .pattern(/^(session-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i)
  .required()
  .description('Valid session ID (UUID format, optionally prefixed with session-)');


const userIdSchema = Joi.string()
  .alphanum()
  .min(3)
  .max(50)
  .required()
  .description('Valid user ID (alphanumeric, 3-50 chars)');

const pageSchema = Joi.number()
  .integer()
  .min(1)
  .default(1)
  .description('Page number for pagination');

const limitSchema = Joi.number()
  .integer()
  .min(1)
  .max(100)
  .default(20)
  .description('Items per page (max 100)');

const sortBySchema = Joi.string()
  .valid('recent', 'oldest')
  .default('recent')
  .description('Sort order');

const moodSchema = Joi.string()
  .valid('happy', 'sad', 'angry', 'anxious', 'calm', 'neutral', 'hopeful', 'desperate')
  .description('Overall mood of the conversation');

const statusSchema = Joi.string()
  .valid('flagged', 'followup', 'active', 'completed', 'all')
  .optional()
  .description('Conversation status filter');

const severitySchema = Joi.string()
  .valid('critical', 'high', 'medium', 'low')
  .description('Flag severity level');

const textContentSchema = Joi.string()
  .trim()
  .min(1)
  .max(5000)
  .required()
  .description('Text content (1-5000 chars)');

const dateRangeSchema = Joi.object({
  start: Joi.date()
    .iso()
    .required()
    .description('Start date (ISO 8601)'),
  end: Joi.date()
    .iso()
    .min(Joi.ref('start'))
    .required()
    .description('End date (ISO 8601), must be >= start date')
}).description('Date range for filtering');

// ============================================
// CONVERSATION LIST QUERY VALIDATION
// ============================================

const conversationListSchema = Joi.object({
  page: pageSchema,
  limit: limitSchema,
  sortBy: sortBySchema,
  status: statusSchema,
  userId: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .optional()
    .description('Filter by user ID'),
  mood: moodSchema.optional(),
  tags: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .optional()
    .description('Filter by tags'),
  hasSafetyFlags: Joi.boolean()
    .optional()
    .description('Filter by presence of safety flags')
}).unknown(false)
  .description('Conversation list query parameters');

// ============================================
// CONVERSATION DETAIL RETRIEVAL
// ============================================

const conversationDetailSchema = Joi.object({
  sessionId: sessionIdSchema.required()
}).unknown(false)
  .description('Get conversation detail by sessionId');

// ============================================
// ADVANCED SEARCH SCHEMA
// ============================================

const conversationSearchSchema = Joi.object({
  page: pageSchema,
  limit: limitSchema,
  sortBy: sortBySchema,
  userId: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .optional(),
  mood: moodSchema.optional(),
  severity: severitySchema.optional(),
  topics: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .optional()
    .max(10)
    .description('Search topics (max 10)'),
  concerns: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .optional()
    .max(10)
    .description('Search concerns (max 10)'),
  messageContent: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .optional()
    .description('Search message content'),
  dateRange: dateRangeSchema.optional(),
  flagTypes: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .optional()
    .max(10)
    .description('Filter by flag types'),
  hasAbusiveContent: Joi.boolean()
    .optional()
    .description('Filter by abuse indicators'),
  requiresFollowup: Joi.boolean()
    .optional()
    .description('Filter by followup requirement'),
  isReviewed: Joi.boolean()
    .optional()
    .description('Filter by review status')
}).unknown(false)
  .description('Advanced search parameters');

// ============================================
// STAFF NOTE VALIDATION
// ============================================

const addNoteSchema = Joi.object({
  content: textContentSchema,
  visibility: Joi.string()
    .valid('staff-only', 'facility-wide', 'flagged-only')
    .default('staff-only')
    .optional()
    .description('Who can see this note'),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium')
    .optional()
    .description('Note priority level'),
  flagForReview: Joi.boolean()
    .default(false)
    .optional()
    .description('Flag this note for management review'),
  relatedFlags: Joi.array()
    .items(Joi.string().trim())
    .optional()
    .max(10)
    .description('Related flag IDs')
}).unknown(false)
  .description('Add staff note request body');

const noteParamsSchema = Joi.object({
  sessionId: sessionIdSchema
}).unknown(false);

// ============================================
// ACKNOWLEDGE VALIDATION
// ============================================

const acknowledgeSchema = Joi.object({
  acknowledgedBy: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .description('Staff member name'),
  timestamp: Joi.date()
    .iso()
    .optional()
    .max('now')
    .description('Acknowledgment timestamp')
}).unknown(false)
  .description('Acknowledge conversation request');

const acknowledgeParamsSchema = Joi.object({
  sessionId: sessionIdSchema
}).unknown(false);

// ============================================
// BATCH OPERATIONS
// ============================================

const batchAcknowledgeSchema = Joi.object({
  sessionIds: Joi.array()
    .items(Joi.string().pattern(/^session-[a-f0-9-]+$|^[a-f0-9-]{36}$/))
    .min(1)
    .max(100)
    .required()
    .description('Session IDs to acknowledge (max 100)'),
  batchNotes: Joi.string()
    .trim()
    .min(1)
    .max(2000)
    .optional()
    .description('Optional notes for all conversations')
}).unknown(false)
  .description('Batch acknowledge request');

const batchAddNoteSchema = Joi.object({
  sessionIds: Joi.array()
    .items(Joi.string().pattern(/^session-[a-f0-9-]+$|^[a-f0-9-]{36}$/))
    .min(1)
    .max(100)
    .required()
    .description('Session IDs to add notes to (max 100)'),
  content: textContentSchema,
  visibility: Joi.string()
    .valid('staff-only', 'facility-wide', 'flagged-only')
    .default('staff-only')
    .optional()
}).unknown(false)
  .description('Batch add note request');

// ============================================
// BREAK-GLASS ACCESS SCHEMA
// ============================================

const breakGlassAccessSchema = Joi.object({
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .trim()
    .description('Required reason for accessing full transcript (safeguarding investigation, safety concern, etc.)'),
  
  justification: Joi.string()
    .max(1000)
    .optional()
    .trim()
    .description('Additional context or justification for the access')
}).unknown(false)
  .description('Break-glass emergency access request');

// ============================================
// EXPORT SCHEMAS
// ============================================

module.exports = {
  // Query parameters
  conversationListSchema,
  conversationDetailSchema,
  conversationSearchSchema,
  
  // Request bodies
  addNoteSchema,
  noteParamsSchema,
  acknowledgeSchema,
  acknowledgeParamsSchema,
  breakGlassAccessSchema,
  batchAcknowledgeSchema,
  batchAddNoteSchema,
  
  // Individual field schemas (for reuse in other schemas)
  sessionIdSchema,
  userIdSchema,
  pageSchema,
  limitSchema,
  sortBySchema,
  moodSchema,
  statusSchema,
  severitySchema,
  textContentSchema,
  dateRangeSchema
};
