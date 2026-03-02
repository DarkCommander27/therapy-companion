/**
 * Joi Validation Schemas for Staff APIs
 * 
 * Defines validation rules for:
 * - Staff login (email/password)
 * - Staff registration/creation
 * - Staff settings and permissions
 */

const Joi = require('joi');

// ============================================
// REUSABLE FIELD SCHEMAS
// ============================================

const emailSchema = Joi.string()
  .email()
  .lowercase()
  .trim()
  .required()
  .messages({
    'string.email': 'Must be a valid email address'
  });

const usernameSchema = Joi.string()
  .alphanum()
  .min(3)
  .max(30)
  .lowercase()
  .required()
  .messages({
    'string.alphanum': 'Username must contain only letters and numbers',
    'string.min': 'Username must be at least 3 characters',
    'string.max': 'Username cannot exceed 30 characters'
  });

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'
  });

const loginPasswordSchema = Joi.string()
  .min(6)
  .max(128)
  .required()
  .messages({
    'string.min': 'Password must be at least 6 characters',
    'string.max': 'Password cannot exceed 128 characters'
  });

const staffNameSchema = Joi.string()
  .trim()
  .min(2)
  .max(100)
  .pattern(/^[a-zA-Z\s'-]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes'
  });

const roleSchema = Joi.string()
  .valid('staff', 'supervisor', 'manager', 'admin')
  .required()
  .messages({
    'any.only': 'Invalid staff role'
  });

const facilityIdSchema = Joi.string()
  .alphanum()
  .min(5)
  .max(50)
  .required();

// ============================================
// STAFF LOGIN
// ============================================

const staffLoginSchema = Joi.object({
  email: emailSchema,
  password: loginPasswordSchema,
  rememberMe: Joi.boolean()
    .default(false)
    .optional(),
  twoFactorCode: Joi.string()
    .pattern(/^\d{6}$/)
    .optional()
    .messages({
      'string.pattern.base': '2FA code must be 6 digits'
    })
}).unknown(false)
  .messages({
    'object.unknown': 'Unknown property in login request'
  });

// ============================================
// STAFF REGISTRATION/CREATION
// ============================================

const staffCreateSchema = Joi.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  fullName: staffNameSchema,
  role: roleSchema,
  facilityId: facilityIdSchema,
  phone: Joi.string()
    .pattern(/^[\d+\s()-]{10,20}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  department: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional(),
  startDate: Joi.date()
    .iso()
    .max('now')
    .required()
    .messages({
      'date.max': 'Start date cannot be in the future'
    }),
  certifications: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .optional()
    .max(10),
  languages: Joi.array()
    .items(Joi.string().length(2).uppercase())
    .optional()
    .max(10),
  enableMFA: Joi.boolean()
    .default(false)
    .optional()
}).unknown(false);

// ============================================
// STAFF PROFILE UPDATE
// ============================================

const staffUpdateSchema = Joi.object({
  fullName: staffNameSchema.optional(),
  phone: Joi.string()
    .pattern(/^[\d+\s()-]{10,20}$/)
    .optional(),
  department: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional(),
  bio: Joi.string()
    .trim()
    .min(0)
    .max(500)
    .optional(),
  certifications: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .optional()
    .max(10),
  languages: Joi.array()
    .items(Joi.string().length(2).uppercase())
    .optional()
    .max(10),
  availability: Joi.object({
    status: Joi.string()
      .valid('available', 'busy', 'away', 'offline')
      .optional(),
    lastUpdated: Joi.date()
      .iso()
      .optional()
  }).optional()
}).min(1)
  .unknown(false)
  .messages({
    'object.min': 'At least one field must be provided for update'
  });

// ============================================
// STAFF PERMISSIONS & ROLE MANAGEMENT
// ============================================

const staffPermissionsSchema = Joi.object({
  staffId: Joi.string()
    .alphanum()
    .required(),
  canViewAllChildren: Joi.boolean().optional(),
  canEditChildren: Joi.boolean().optional(),
  canDeleteData: Joi.boolean().optional(),
  canGenerateReports: Joi.boolean().optional(),
  canManageStaff: Joi.boolean().optional(),
  canManageFacility: Joi.boolean().optional(),
  canAccessAuditLog: Joi.boolean().optional(),
  canModerateContent: Joi.boolean().optional(),
  assignedChildren: Joi.array()
    .items(Joi.string().alphanum().min(3).max(50))
    .optional(),
  assignedFacilities: Joi.array()
    .items(Joi.string().alphanum().min(5).max(50))
    .optional()
}).min(1)
  .unknown(false);

// ============================================
// PASSWORD CHANGE
// ============================================

const passwordChangeSchema = Joi.object({
  staffId: Joi.string()
    .alphanum()
    .required(),
  currentPassword: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  newPassword: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match'
    })
}).unknown(false);

// ============================================
// TWO-FACTOR AUTHENTICATION SETUP
// ============================================

const mfaSetupSchema = Joi.object({
  method: Joi.string()
    .valid('totp', 'sms', 'email')
    .required(),
  phoneNumber: Joi.string()
    .pattern(/^[\d+\s()-]{10,20}$/)
    .when('method', {
      is: 'sms',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Phone number is required for SMS 2FA'
    }),
  backupCodesCount: Joi.number()
    .integer()
    .min(5)
    .max(20)
    .default(10)
    .optional()
}).unknown(false);

const mfaVerifySchema = Joi.object({
  staffId: Joi.string()
    .alphanum()
    .required(),
  code: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Code must be 6 digits'
    })
}).unknown(false);

// ============================================
// SHIFT & AVAILABILITY MANAGEMENT
// ============================================

const shiftSchema = Joi.object({
  staffId: Joi.string()
    .alphanum()
    .required(),
  dayOfWeek: Joi.string()
    .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    .required(),
  startTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format'
    }),
  endTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format'
    }),
  recurring: Joi.boolean()
    .default(true)
    .optional(),
  notes: Joi.string()
    .trim()
    .max(500)
    .optional()
}).unknown(false);

// ============================================
// EXPORT SCHEMAS
// ============================================

module.exports = {
  // Authentication & onboarding
  staffLoginSchema,
  staffCreateSchema,
  
  // Profile management
  staffUpdateSchema,
  staffPermissionsSchema,
  
  // Security
  passwordChangeSchema,
  mfaSetupSchema,
  mfaVerifySchema,
  
  // Scheduling
  shiftSchema,
  
  // Individual field schemas
  emailSchema,
  usernameSchema,
  passwordSchema,
  staffNameSchema,
  roleSchema,
  facilityIdSchema
};
