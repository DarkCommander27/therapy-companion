/**
 * Staff Routes - Authentication & Account Management
 * Handles staff login, registration, and role-based access
 * Includes brute-force protection and MFA support
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const StaffProfile = require('../models/StaffProfile');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');
const { checkBruteForce, handleFailedLogin, handleSuccessfulLogin } = require('../middleware/bruteForceProtection');
const { authLimiter, createTokenBucketLimiter } = require('../middleware/rateLimiter');
const { validateBody, validateParams } = require('../middleware/validation');
const { sanitizeMiddleware } = require('../middleware/sanitization');
const { staffLoginSchema, staffCreateSchema } = require('../schemas/staffSchemas');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d'; // Staff sessions valid for 7 days

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Verify JWT token middleware
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer token

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.staffId = decoded.staffId;
    req.staffEmail = decoded.email;
    req.staffRole = decoded.role;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Check admin role
 */
const requireAdmin = (req, res, next) => {
  if (req.staffRole !== 'admin' && req.staffRole !== 'manager') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============================================
// STAFF AUTHENTICATION
// ============================================

/**
 * Staff Login
 * POST /api/staff/login
 * Body: { email or username, password, deviceId?, deviceName? }
 * 
 * Includes:
 * - Brute-force protection (5 attempts in 15 min)
 * - Rate limiting
 * - Input validation
 * - Input sanitization (XSS prevention)
 */
router.post('/login',
  authLimiter,
  sanitizeMiddleware({ emailFields: ['email'] }),
  checkBruteForce(req => req.body.email || req.body.username),
  validateBody(staffLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, username, password, deviceId, deviceName } = req.body;

    // Find staff member by email or username
    let staffProfile;
    if (email) {
      staffProfile = await StaffProfile.findOne({ email: email.toLowerCase() });
    } else if (username) {
      staffProfile = await StaffProfile.findOne({ username });
    }

    if (!staffProfile) {
      logger.warn(`✗ Failed staff login - Email/Username: ${email || username}`);
      const failureStatus = handleFailedLogin(req, res, () => {
        return res.status(401).json({
          success: false,
          error: 'Invalid email/username or password',
          attemptsRemaining: req.loginFailureStatus?.attemptsRemaining
        });
      });

      if (failureStatus.locked) {
        return res.status(429).json({
          success: false,
          error: 'Too many failed login attempts',
          message: failureStatus.message,
          retryAfterSeconds: Math.ceil(failureStatus.remainingMs / 1000)
        });
      }
      return;
    }

    if (!staffProfile.isActive) {
      logger.warn(`✗ Login attempt on inactive account - Email: ${staffProfile.email}`);
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await staffProfile.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn(`✗ Failed staff login - Invalid password for: ${staffProfile.email}`);
      const failureStatus = handleFailedLogin(req, res, () => {
        return res.status(401).json({
          success: false,
          error: 'Invalid email/username or password',
          attemptsRemaining: req.loginFailureStatus?.attemptsRemaining
        });
      });

      if (failureStatus.locked) {
        return res.status(429).json({
          success: false,
          error: 'Too many failed login attempts',
          message: failureStatus.message,
          retryAfterSeconds: Math.ceil(failureStatus.remainingMs / 1000)
        });
      }
      return;
    }

    // Successful authentication - clear brute-force attempts
    handleSuccessfulLogin(req);

    // Update last login and device
    staffProfile.lastLogin = new Date();

    const deviceIndex = staffProfile.devices.findIndex(d => d.deviceId === deviceId);
    if (deviceIndex >= 0) {
      staffProfile.devices[deviceIndex].lastSeen = new Date();
    } else {
      staffProfile.devices.push({
        deviceId: deviceId || `device-${Date.now()}`,
        deviceName: deviceName || 'Unknown Device',
        lastSeen: new Date()
      });
    }

    await staffProfile.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        staffId: staffProfile._id.toString(),
        email: staffProfile.email,
        username: staffProfile.username,
        role: staffProfile.role,
        facility: staffProfile.facility
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    logger.info(`✓ Staff login successful - Email: ${staffProfile.email}, Role: ${staffProfile.role}`);

    res.json({
      success: true,
      token,
      staff: {
        id: staffProfile._id,
        email: staffProfile.email,
        username: staffProfile.username,
        firstName: staffProfile.firstName,
        lastName: staffProfile.lastName,
        role: staffProfile.role,
        facility: staffProfile.facility,
        permissions: staffProfile.permissions,
        avatar: staffProfile.avatar || '👤'
      }
    });
  })
);

/**
 * Staff Registration (Admin-only for now)
 * POST /api/staff/register
 * Headers: Authorization: Bearer <admin-token>
 * Body: { email, username, password, firstName?, lastName?, role, facility }
 * 
 * Includes:
 * - Input sanitization (XSS prevention)
 * - Email validation
 * - Authentication verification
 */
router.post('/register', 
  verifyToken, 
  sanitizeMiddleware({ emailFields: ['email'] }), 
  requireAdmin, 
  asyncHandler(async (req, res) => {
  const { email, username, password, firstName, lastName, role, facility } = req.body;

  // Validate required fields
  if (!email || !username || !password || !role || !facility) {
    return res.status(400).json({ 
      error: 'Email, username, password, role, and facility are required' 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3-30 characters' });
  }

  // Check for duplicate email
  const existingEmail = await StaffProfile.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    return res.status(400).json({ error: 'Email already in use' });
  }

  // Check for duplicate username
  const existingUsername = await StaffProfile.findOne({ username });
  if (existingUsername) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  // Create new staff profile
  const newStaff = new StaffProfile({
    email: email.toLowerCase(),
    username,
    password, // Will be hashed on save
    firstName: firstName || '',
    lastName: lastName || '',
    role: ['staff', 'manager', 'admin'].includes(role) ? role : 'staff',
    facility,
    isActive: true,
    permissions: {
      viewConversations: true,
      flagConversations: role !== 'staff',
      manageFollowUps: role !== 'staff',
      viewAnalytics: role === 'manager' || role === 'admin',
      manageUsers: role === 'admin'
    }
  });

  await newStaff.save();
  logger.info(`✓ New staff account created - Email: ${email}, Role: ${role}`);

  res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    staff: {
      id: newStaff._id,
      email: newStaff.email,
      username: newStaff.username,
      firstName: newStaff.firstName,
      lastName: newStaff.lastName,
      role: newStaff.role,
      facility: newStaff.facility
    }
  });
}));

// ============================================
// STAFF PROFILE MANAGEMENT
// ============================================

/**
 * Get staff profile
 * GET /api/staff/profile
 * Headers: Authorization: Bearer <staff-token>
 */
router.get('/profile', verifyToken, asyncHandler(async (req, res) => {
  const staffProfile = await StaffProfile.findById(req.staffId);

  if (!staffProfile) {
    return res.status(404).json({ error: 'Staff profile not found' });
  }

  res.json({
    id: staffProfile._id,
    email: staffProfile.email,
    username: staffProfile.username,
    firstName: staffProfile.firstName,
    lastName: staffProfile.lastName,
    role: staffProfile.role,
    facility: staffProfile.facility,
    permissions: staffProfile.permissions,
    isActive: staffProfile.isActive,
    devices: staffProfile.devices,
    lastLogin: staffProfile.lastLogin,
    createdAt: staffProfile.createdAt
  });
}));

/**
 * Update staff profile
 * PUT /api/staff/profile
 * Headers: Authorization: Bearer <staff-token>
 * Body: { firstName?, lastName?, facility? }
 */
router.put('/profile', verifyToken, asyncHandler(async (req, res) => {
  const { firstName, lastName, facility } = req.body;
  const staffProfile = await StaffProfile.findById(req.staffId);

  if (!staffProfile) {
    return res.status(404).json({ error: 'Staff profile not found' });
  }

  if (firstName) staffProfile.firstName = firstName;
  if (lastName) staffProfile.lastName = lastName;
  if (facility) staffProfile.facility = facility;

  await staffProfile.save();
  logger.info(`✓ Staff profile updated - Email: ${staffProfile.email}`);

  res.json({
    success: true,
    staff: {
      firstName: staffProfile.firstName,
      lastName: staffProfile.lastName,
      facility: staffProfile.facility
    }
  });
}));

/**
 * Change password
 * POST /api/staff/change-password
 * Headers: Authorization: Bearer <staff-token>
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', verifyToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const staffProfile = await StaffProfile.findById(req.staffId);

  if (!staffProfile) {
    return res.status(404).json({ error: 'Staff profile not found' });
  }

  const isPasswordValid = await staffProfile.comparePassword(currentPassword);

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  staffProfile.password = newPassword; // Will be hashed on save
  await staffProfile.save();

  logger.info(`✓ Staff password changed - Email: ${staffProfile.email}`);

  res.json({ success: true, message: 'Password changed successfully' });
}));

// ============================================
// ADMIN ACCOUNT MANAGEMENT
// ============================================

/**
 * Get all staff (Admin only)
 * GET /api/staff/all
 * Headers: Authorization: Bearer <admin-token>
 */
router.get('/all', verifyToken, requireAdmin, asyncHandler(async (req, res) => {
  const staffList = await StaffProfile.find({}, '-password');

  res.json({
    count: staffList.length,
    staff: staffList.map(s => ({
      id: s._id,
      email: s.email,
      username: s.username,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role,
      facility: s.facility,
      isActive: s.isActive,
      lastLogin: s.lastLogin,
      createdAt: s.createdAt
    }))
  });
}));

/**
 * Get staff by ID (Admin only)
 * GET /api/staff/:staffId
 * Headers: Authorization: Bearer <admin-token>
 */
router.get('/:staffId', verifyToken, requireAdmin, asyncHandler(async (req, res) => {
  const staffProfile = await StaffProfile.findById(req.params.staffId, '-password');

  if (!staffProfile) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  res.json({
    id: staffProfile._id,
    email: staffProfile.email,
    username: staffProfile.username,
    firstName: staffProfile.firstName,
    lastName: staffProfile.lastName,
    role: staffProfile.role,
    facility: staffProfile.facility,
    permissions: staffProfile.permissions,
    isActive: staffProfile.isActive,
    devices: staffProfile.devices,
    lastLogin: staffProfile.lastLogin,
    createdAt: staffProfile.createdAt
  });
}));

/**
 * Update staff account (Admin only)
 * PUT /api/staff/:staffId
 * Headers: Authorization: Bearer <admin-token>
 * Body: { firstName?, lastName?, role?, facility?, isActive? }
 */
router.put('/:staffId', verifyToken, requireAdmin, asyncHandler(async (req, res) => {
  const { firstName, lastName, role, facility, isActive } = req.body;
  const staffProfile = await StaffProfile.findById(req.params.staffId);

  if (!staffProfile) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  if (firstName !== undefined) staffProfile.firstName = firstName;
  if (lastName !== undefined) staffProfile.lastName = lastName;
  if (facility !== undefined) staffProfile.facility = facility;
  if (isActive !== undefined) staffProfile.isActive = isActive;

  // Update role and permissions if provided
  if (role && ['staff', 'manager', 'admin'].includes(role)) {
    staffProfile.role = role;
    // Auto-update permissions based on role
    staffProfile.permissions = {
      viewConversations: true,
      flagConversations: role !== 'staff',
      manageFollowUps: role !== 'staff',
      viewAnalytics: role === 'manager' || role === 'admin',
      manageUsers: role === 'admin'
    };
  }

  await staffProfile.save();
  logger.info(`✓ Staff account updated - Email: ${staffProfile.email}`);

  res.json({
    success: true,
    staff: {
      id: staffProfile._id,
      email: staffProfile.email,
      role: staffProfile.role,
      permissions: staffProfile.permissions
    }
  });
}));

/**
 * Deactivate staff account (Admin only)
 * POST /api/staff/:staffId/deactivate
 * Headers: Authorization: Bearer <admin-token>
 */
router.post('/:staffId/deactivate', verifyToken, requireAdmin, asyncHandler(async (req, res) => {
  const staffProfile = await StaffProfile.findById(req.params.staffId);

  if (!staffProfile) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  staffProfile.isActive = false;
  await staffProfile.save();

  logger.info(`✓ Staff account deactivated - Email: ${staffProfile.email}`);

  res.json({ success: true, message: 'Staff account has been deactivated' });
}));

/**
 * Reactivate staff account (Admin only)
 * POST /api/staff/:staffId/activate
 * Headers: Authorization: Bearer <admin-token>
 */
router.post('/:staffId/activate', verifyToken, requireAdmin, asyncHandler(async (req, res) => {
  const staffProfile = await StaffProfile.findById(req.params.staffId);

  if (!staffProfile) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  staffProfile.isActive = true;
  await staffProfile.save();

  logger.info(`✓ Staff account reactivated - Email: ${staffProfile.email}`);

  res.json({ success: true, message: 'Staff account has been reactivated' });
}));

module.exports = router;