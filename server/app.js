/**
 * CareBridge Companion - Express Application Setup
 * This file demonstrates how all middleware, services, and routes integrate
 * 
 * Usage:
 *   const app = require('./app');
 *   const server = app.listen(process.env.PORT || 3000);
 */

// Load environment variables FIRST (before any other requires)
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Middleware
const {
  asyncHandler,
  handle404,
  errorHandler,
  requestErrorTracking
} = require('./middleware/errorHandler');

const { applyRateLimiters } = require('./middleware/rateLimiter');
const { checkCompanionAvailability, logAvailabilityStatus } = require('./middleware/availabilityCheck');
const { securitySanitizeMiddleware } = require('./middleware/sanitization');
const { securityHeadersMiddleware, getCORSConfig } = require('./middleware/securityHeaders');

// Services
// const AutomatedBriefingScheduler = require('./services/automatedBriefingScheduler'); // TODO: Re-enable after CompanionProfile model created
const healthCheckService = require('./services/healthCheckService');
const chatRoutes = require('./routes/chatRoutes');
const userRoutes = require('./routes/userRoutes');
const staffRoutes = require('./routes/staffRoutes');

// Logger
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// ========================================
// 1. BASIC MIDDLEWARE
// ========================================

// Security headers (HSTS, CSP, X-Frame-Options, etc.)
app.use(securityHeadersMiddleware());

// CORS with enhanced security configuration
app.use(cors(getCORSConfig()));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Input sanitization (XSS + NoSQL injection prevention)
app.use(securitySanitizeMiddleware({
  richTextFields: ['content', 'message', 'description', 'bio'],
  emailFields: ['email', 'emailAddress'],
  urlFields: ['url', 'website', 'photo', 'avatar']
}));

// Request logging and error tracking
app.use(requestErrorTracking);

// ========================================
// 1.5 STATIC FILES
// ========================================

// Serve static files from client directory
app.use(express.static(require('path').join(__dirname, '../client')));

// ========================================
// 2. RATE LIMITING
// ========================================

applyRateLimiters(app);

logger.info('Rate limiting middleware applied');

// ========================================
// 3. SECURITY & AVAILABILITY CHECKS
// ========================================

// Apply availability check middleware to chat routes
app.use('/api/chat', checkCompanionAvailability);
app.use('/api/chat', logAvailabilityStatus);

logger.info('Availability check middleware applied');

// ========================================
// 3.5 ENVIRONMENT VALIDATION
// ========================================

function validateEnvironment() {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    logger.warn('Some features may not work correctly. See .env.example for setup.');
  }

  // Warn about Ollama if enabled
  if (process.env.LLAMA_ENABLED === 'true') {
    logger.info('🤖 Llama 3.1 integration enabled');
    if (!process.env.LLAMA_API_URL) {
      logger.warn('⚠️ LLAMA_API_URL not set. Using default: http://localhost:11434');
    }
    logger.info('💡 TIP: Ensure Ollama is running with: ollama serve');
  }
}

validateEnvironment();

// ========================================
// 4. DATABASE CONNECTION
// ========================================

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carebridge-companion', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connected to MongoDB');
    return true;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error.message,
      uri: process.env.MONGODB_URI || 'default'
    });
    // Don't exit - allow graceful degradation
    return false;
  }
}

// ========================================
// 5. HEALTH CHECK ENDPOINT
// ========================================

// Simple health endpoint
app.get('/health', asyncHandler(async (req, res) => {
  res.json({ status: 'ok' });
}));

if (process.env.ENABLE_HEALTH_CHECK === 'true') {
  app.get('/health/detailed', asyncHandler(async (req, res) => {
    const health = await healthCheckService.getSystemHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  }));

  app.get('/metrics', asyncHandler(async (req, res) => {
    const metrics = await healthCheckService.getDetailedMetrics();
    res.json(metrics);
  }));

  logger.info('Detailed health check endpoints enabled');
}

// ========================================
// 6. API ROUTES (Placeholder)
// ========================================

/**
 * Authentication routes
 * Example: POST /api/auth/login
 */
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  // TODO: Implement authentication
  res.json({ message: 'Login endpoint' });
}));

/**
 * Chat routes with streaming and full conversation storage
 * Example: POST /api/chat, GET /api/chat/:sessionId
 * See server/routes/chatRoutes.js for complete documentation
 */
app.use('/', chatRoutes);

/**
 * User routes - authentication & cross-device sync
 * Example: POST /api/users/login, PUT /api/users/:userId/settings
 * See server/routes/userRoutes.js for complete documentation
 */
app.use('/api/users', userRoutes);

/**
 * Staff routes - authentication, account management, and role-based access
 * Example: POST /api/staff/login, POST /api/staff/register, GET /api/staff/profile
 * See server/routes/staffRoutes.js for complete documentation
 */
app.use('/api/staff', staffRoutes);

/**
 * Conversation routes - Staff dashboard data access
 * Example: GET /api/conversations, GET /api/conversations/:sessionId, POST /api/conversations/search
 * See server/routes/conversationRoutes.js for complete documentation
 */
const conversationRoutes = require('./routes/conversationRoutes');
app.use('/api/conversations', conversationRoutes);

logger.info('Chat routes enabled - streaming and full history storage active');
logger.info('User routes enabled - PIN/Password authentication and cross-device sync active');
logger.info('Staff routes enabled - Email/Username authentication and role-based access control active');
logger.info('Conversation routes enabled - Staff dashboard data access active');

/**
 * Briefing routes
 * Example: GET /api/briefings/:companionId
 */
app.get('/api/briefings/:companionId', asyncHandler(async (req, res) => {
  // TODO: Implement briefing retrieval
  res.json({ message: 'Briefing endpoint' });
}));

/**
 * Availability schedule routes
 * Example: GET /api/availability/:companionId
 */
app.get('/api/availability/:companionId', asyncHandler(async (req, res) => {
  // TODO: Implement availability retrieval
  res.json({ message: 'Availability endpoint' });
}));

/**
 * Admin routes
 * Example: GET /api/admin/incidents
 */
app.get('/api/admin/incidents', asyncHandler(async (req, res) => {
  // TODO: Implement incident log retrieval
  res.json({ message: 'Admin incidents endpoint' });
}));

// ========================================
// 7. 404 HANDLER
// ========================================

app.use(handle404);

// ========================================
// 8. ERROR HANDLER (Must be last)
// ========================================

app.use(errorHandler);

// ========================================
// 9. INITIALIZATION
// ========================================

/**
 * Initialize all services
 */
async function initializeServices() {
  try {
    // Connect to database
    const dbConnected = await connectDatabase();

    if (dbConnected) {
      // TODO: Initialize automated briefing scheduler after CompanionProfile model is created
      // const briefingScheduler = new AutomatedBriefingScheduler();
      // await briefingScheduler.initializeScheduler();
      // logger.info('Automated briefing scheduler initialized');
    }

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Error initializing services', {
      error: error.message
    });
  }
}

// ========================================
// 10. EXPORT & STARTUP
// ========================================

// Initialize on module load
initializeServices();

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  mongoose.connection.close();
  process.exit(0);
});

// Start server if this file is run directly
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server listening on port ${PORT}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/health`);
  logger.info(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
});

module.exports = app;
