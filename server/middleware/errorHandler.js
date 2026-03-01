/**
 * Error Handling Middleware
 * Centralized error handling for consistent responses and logging
 */

const logger = require('../utils/logger');

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found Handler
 */
function handle404(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint ${req.method} ${req.path} was not found`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Central error handler
 * Must be the last middleware mounted
 */
function errorHandler(err, req, res, next) {
  // Log error
  const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logger.error(`[${errorId}] ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.id,
    ip: req.ip,
    statusCode: err.statusCode || 500
  });

  // Determine status code
  const statusCode = err.statusCode || (err.status ? parseInt(err.status) : 500);
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Build response
  const response = {
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    errorId: errorId,
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (isDevelopment && err.stack) {
    response.stack = err.stack.split('\n');
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    response.statusCode = 400;
    response.details = err.details || {};
  } else if (err.name === 'UnauthorizedError') {
    response.statusCode = 401;
  } else if (err.name === 'ForbiddenError') {
    response.statusCode = 403;
  } else if (err.name === 'NotFoundError') {
    response.statusCode = 404;
  } else if (err.name === 'ConflictError') {
    response.statusCode = 409;
  } else if (err.name === 'RateLimitError') {
    response.statusCode = 429;
  } else if (err.name === 'MongoError' || err.name === 'MongooseError') {
    response.statusCode = 500;
    response.message = isDevelopment ? err.message : 'Database error';
  } else if (err.name === 'JsonWebTokenError') {
    response.statusCode = 401;
    response.message = 'Invalid or expired token';
  } else {
    response.statusCode = statusCode;
  }

  // Send response
  res.status(response.statusCode || statusCode).json(response);
}

/**
 * Request logging and error tracking middleware
 */
function requestErrorTracking(req, res, next) {
  // Track response
  const originalSend = res.send;
  let responseTime;

  res.send = function(data) {
    responseTime = Date.now() - req._startTime;
    
    // Log errors
    if (res.statusCode >= 400) {
      logger.warn(`[${req.method}] ${req.path} - ${res.statusCode} (${responseTime}ms)`, {
        user: req.user?.id,
        ip: req.ip
      });
    }

    return originalSend.call(this, data);
  };

  // Set start time
  req._startTime = Date.now();
  next();
}

/**
 * Validation error response helper
 */
function validationError(message, details = {}) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.statusCode = 400;
  error.details = details;
  return error;
}

/**
 * Authentication error response helper
 */
function unauthorizedError(message = 'Unauthorized') {
  const error = new Error(message);
  error.name = 'UnauthorizedError';
  error.statusCode = 401;
  return error;
}

/**
 * Authorization error response helper
 */
function forbiddenError(message = 'Forbidden') {
  const error = new Error(message);
  error.name = 'ForbiddenError';
  error.statusCode = 403;
  return error;
}

/**
 * Not found error response helper
 */
function notFoundError(resource = 'Resource') {
  const error = new Error(`${resource} not found`);
  error.name = 'NotFoundError';
  error.statusCode = 404;
  return error;
}

/**
 * Conflict error response helper
 */
function conflictError(message) {
  const error = new Error(message);
  error.name = 'ConflictError';
  error.statusCode = 409;
  return error;
}

module.exports = {
  asyncHandler,
  handle404,
  errorHandler,
  requestErrorTracking,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError
};
