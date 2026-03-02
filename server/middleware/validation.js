/**
 * Validation Middleware
 * 
 * Centralized request validation using Joi schemas
 * Supports validation of query, body, and params
 */

const logger = require('../utils/logger');

/**
 * Creates validation middleware for a specific schema
 * 
 * @param {object} schemas - Object with { query?, body?, params? } Joi schemas
 * @param {object} options - Validation options
 * @returns {function} Express middleware function
 */
function validateRequest(schemas = {}, options = {}) {
  const {
    stripUnknown = true,
    abortEarly = false,
    allowUnknown = false,
    language = 'en'
  } = options;

  return async (req, res, next) => {
    try {
      const validationErrors = {};
      const joiOptions = {
        stripUnknown,
        abortEarly,
        allowUnknown,
        language,
        errors: {
          wrap: { label: false }
        }
      };

      // Validate query parameters
      if (schemas.query) {
        const { error, value } = schemas.query.validate(req.query, joiOptions);
        if (error) {
          validationErrors.query = error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message,
            type: d.type
          }));
        } else {
          req.query = value;
        }
      }

      // Validate request body
      if (schemas.body) {
        const { error, value } = schemas.body.validate(req.body, joiOptions);
        if (error) {
          validationErrors.body = error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message,
            type: d.type
          }));
        } else {
          req.body = value;
        }
      }

      // Validate URL parameters
      if (schemas.params) {
        const { error, value } = schemas.params.validate(req.params, joiOptions);
        if (error) {
          validationErrors.params = error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message,
            type: d.type
          }));
        } else {
          req.params = value;
        }
      }

      // If there are validation errors, return 400
      if (Object.keys(validationErrors).length > 0) {
        logger.warn('Validation error', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
          ip: req.ip
        });

        return res.status(400).json({
          success: false,
          error: 'Request validation failed',
          validationErrors
        });
      }

      // Store schema info for debugging/logging
      req.validatedWith = {
        query: !!schemas.query,
        body: !!schemas.body,
        params: !!schemas.params
      };

      next();
    } catch (err) {
      logger.error('Validation middleware error', {
        message: err.message,
        stack: err.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

/**
 * Validates only query parameters
 * 
 * @param {Joi.Schema} schema - Joi schema for query
 * @param {object} options - Validation options
 * @returns {function} Express middleware
 */
function validateQuery(schema, options = {}) {
  return validateRequest({ query: schema }, options);
}

/**
 * Validates only request body
 * 
 * @param {Joi.Schema} schema - Joi schema for body
 * @param {object} options - Validation options
 * @returns {function} Express middleware
 */
function validateBody(schema, options = {}) {
  return validateRequest({ body: schema }, options);
}

/**
 * Validates only URL parameters
 * 
 * @param {Joi.Schema} schema - Joi schema for params
 * @param {object} options - Validation options
 * @returns {function} Express middleware
 */
function validateParams(schema, options = {}) {
  return validateRequest({ params: schema }, options);
}

/**
 * Chaining validation helper
 * Used to validate multiple parts sequentially
 * 
 * @param {...function} middlewares - Validation middlewares to chain
 * @returns {array} Array of middleware functions
 */
function chain(...middlewares) {
  return middlewares.filter(m => m);
}

/**
 * Sanitization helper - removes null/undefined values
 */
function sanitizeInput(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== '') {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Coerces string booleans to actual booleans
 */
function coerceBooleans(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const coerced = { ...data };
  for (const [key, value] of Object.entries(coerced)) {
    if (value === 'true') coerced[key] = true;
    if (value === 'false') coerced[key] = false;
  }
  return coerced;
}

/**
 * Creates a custom validation error
 */
class ValidationError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}

/**
 * Validates data against a schema (for non-middleware use)
 * 
 * @param {*} data - Data to validate
 * @param {Joi.Schema} schema - Joi schema
 * @param {object} options - Validation options
 * @returns {object} { isValid: boolean, data: *, errors: array }
 */
function validateData(data, schema, options = {}) {
  const { error, value } = schema.validate(data, {
    stripUnknown: true,
    abortEarly: false,
    ...options
  });

  if (error) {
    return {
      isValid: false,
      data: null,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
        type: d.type
      }))
    };
  }

  return {
    isValid: true,
    data: value,
    errors: []
  };
}

// ============================================
// EXPORT MIDDLEWARE
// ============================================

module.exports = {
  validateRequest,
  validateQuery,
  validateBody,
  validateParams,
  chain,
  sanitizeInput,
  coerceBooleans,
  validateData,
  ValidationError
};
