/**
 * Joi Validation Schemas for User/Youth APIs
 * 
 * Defines validation rules for:
 * - User login (PIN/password authentication)
 * - Device registration
 * - Settings updates
 */

const Joi = require('joi');

// ============================================
// REUSABLE FIELD SCHEMAS
// ============================================

const userIdSchema = Joi.string()
  .alphanum()
  .min(3)
  .max(50)
  .required()
  .messages({
    'string.alphanum': 'User ID must contain only letters and numbers',
    'string.min': 'User ID must be at least 3 characters',
    'string.max': 'User ID cannot exceed 50 characters'
  });

const pinSchema = Joi.string()
  .pattern(/^\d{4}$/)
  .required()
  .messages({
    'string.pattern.base': 'PIN must be exactly 4 digits'
  });

const passwordSchema = Joi.string()
  .min(6)
  .max(128)
  .required()
  .messages({
    'string.min': 'Password must be at least 6 characters',
    'string.max': 'Password cannot exceed 128 characters'
  });

const deviceIdSchema = Joi.string()
  .alphanum()
  .min(5)
  .max(100)
  .optional();

const deviceNameSchema = Joi.string()
  .trim()
  .min(1)
  .max(100)
  .optional()
  .messages({
    'string.max': 'Device name cannot exceed 100 characters'
  });

// ============================================
// LOGIN VALIDATION
// ============================================

const userLoginSchema = Joi.object({
  userId: userIdSchema,
  pin: pinSchema.optional(),
  password: passwordSchema.optional(),
  deviceId: deviceIdSchema,
  deviceName: deviceNameSchema,
  rememberDevice: Joi.boolean()
    .default(false)
    .optional()
}).xor('pin', 'password')
  .messages({
    'object.xor': 'Either PIN or password must be provided, not both'
  })
  .unknown(false);

// ============================================
// DEVICE MANAGEMENT
// ============================================

const registerDeviceSchema = Joi.object({
  userId: userIdSchema,
  deviceId: deviceIdSchema.required(),
  deviceName: deviceNameSchema.required(),
  deviceType: Joi.string()
    .valid('mobile', 'tablet', 'desktop', 'laptop', 'other')
    .default('other')
    .optional(),
  osType: Joi.string()
    .valid('iOS', 'Android', 'Windows', 'macOS', 'Linux', 'other')
    .optional(),
  trustedDevice: Joi.boolean()
    .default(false)
    .optional()
}).unknown(false);

const removeDeviceSchema = Joi.object({
  userId: userIdSchema,
  deviceId: Joi.string()
    .alphanum()
    .min(5)
    .max(100)
    .required()
}).unknown(false);

// ============================================
// SETTINGS & PREFERENCES
// ============================================

const userSettingsSchema = Joi.object({
  userId: userIdSchema,
  notifications: Joi.object({
    enabled: Joi.boolean().default(true),
    dailyReminder: Joi.boolean().default(true),
    reminderTime: Joi.string()
      .pattern(/^\d{2}:\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Reminder time must be in HH:MM format'
      })
  }).optional(),
  privacy: Joi.object({
    allowMessageHistory: Joi.boolean().default(true),
    shareWithStaff: Joi.boolean().default(true),
    anonymousFeedback: Joi.boolean().default(false)
  }).optional(),
  language: Joi.string()
    .length(2)
    .uppercase()
    .default('EN')
    .optional()
    .messages({
      'string.length': 'Language code must be 2 characters (e.g., EN, ES)'
    }),
  theme: Joi.string()
    .valid('light', 'dark', 'auto')
    .default('auto')
    .optional(),
  accessibility: Joi.object({
    largeText: Joi.boolean().default(false),
    highContrast: Joi.boolean().default(false),
    screenReaderEnabled: Joi.boolean().default(false)
  }).optional()
}).unknown(false);

// ============================================
// CHECK-IN HISTORY
// ============================================

const checkInHistorySchema = Joi.object({
  userId: userIdSchema,
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50),
  from: Joi.date()
    .iso()
    .optional(),
  to: Joi.date()
    .iso()
    .optional(),
  includeSummaries: Joi.boolean()
    .default(false)
    .optional()
}).unknown(false);

// ============================================
// FEEDBACK/SURVEY
// ============================================

const feedbackSchema = Joi.object({
  userId: userIdSchema,
  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .required()
    .messages({
      'number.min': 'Rating must be between 1 and 5',
      'number.max': 'Rating must be between 1 and 5'
    }),
  comments: Joi.string()
    .trim()
    .min(0)
    .max(1000)
    .optional(),
  improveAreas: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .optional()
    .max(5),
  recommendFriend: Joi.boolean()
    .optional(),
  anonymous: Joi.boolean()
    .default(true)
    .optional()
}).unknown(false);

// ============================================
// EXPORT SCHEMAS
// ============================================

module.exports = {
  // Authentication
  userLoginSchema,
  
  // Device management
  registerDeviceSchema,
  removeDeviceSchema,
  
  // Settings
  userSettingsSchema,
  
  // History & feedback
  checkInHistorySchema,
  feedbackSchema,
  
  // Individual field schemas
  userIdSchema,
  pinSchema,
  passwordSchema,
  deviceIdSchema,
  deviceNameSchema
};
