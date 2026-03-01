/**
 * User Routes - Authentication & Cross-Device Sync
 * Handles PIN/Password login, settings sync, and conversation history
 */

const express = require('express');
const router = express.Router();
const UserProfile = require('../models/UserProfile');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

// ============================================
// YOUTH USER AUTHENTICATION
// ============================================

/**
 * Login/Register with PIN or Password
 * POST /api/users/login
 * Body: { userId, pin?, password?, deviceId?, deviceName? }
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { userId, pin, password, deviceId, deviceName } = req.body;

  if (!userId || (!pin && !password)) {
    return res.status(400).json({ error: 'userId and either PIN or password are required' });
  }

  if (pin && pin.length !== 4) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }

  // Find or create user profile
  let userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    // First time login - create new profile
    if (pin) {
      userProfile = new UserProfile({
        userId,
        authentications: {
          pin: { enabled: true, value: pin }
        },
        devices: [{
          deviceId: deviceId || `device-${Date.now()}`,
          deviceName: deviceName || 'Unknown Device',
          lastSeen: new Date()
        }]
      });
    } else if (password) {
      userProfile = new UserProfile({
        userId,
        authentications: {
          password: { enabled: true, hash: password }
        },
        devices: [{
          deviceId: deviceId || `device-${Date.now()}`,
          deviceName: deviceName || 'Unknown Device',
          lastSeen: new Date()
        }]
      });
    } else {
      return res.status(400).json({ error: 'No authentication method provided' });
    }

    await userProfile.save();
    logger.info(`✓ New youth user created - UserID: ${userId}`);
    
    return res.json({
      success: true,
      isNewUser: true,
      avatar: userProfile.avatar,
      theme: userProfile.theme,
      conversations: []
    });
  }

  // Verify authentication
  let authenticated = false;

  if (pin && userProfile.authentications.pin.enabled) {
    authenticated = userProfile.authentications.pin.value === pin;
  } else if (password && userProfile.authentications.password.enabled) {
    authenticated = await userProfile.verifyPassword(password);
  } else if (pin && !userProfile.authentications.pin.enabled) {
    return res.status(401).json({ error: 'This account uses password, not PIN' });
  } else if (password && !userProfile.authentications.password.enabled) {
    return res.status(401).json({ error: 'This account uses PIN, not password' });
  }

  if (!authenticated) {
    logger.warn(`✗ Failed authentication attempt - UserID: ${userId}`);
    return res.status(401).json({ error: 'Invalid PIN or password' });
  }

  // Update last login and device
  userProfile.lastLogin = new Date();
  
  const deviceIndex = userProfile.devices.findIndex(d => d.deviceId === deviceId);
  if (deviceIndex >= 0) {
    userProfile.devices[deviceIndex].lastSeen = new Date();
  } else {
    userProfile.devices.push({
      deviceId: deviceId || `device-${Date.now()}`,
      deviceName: deviceName || 'Unknown Device',
      lastSeen: new Date()
    });
  }

  await userProfile.save();
  logger.info(`✓ Youth user login - UserID: ${userId}, Device: ${deviceName}`);

  res.json({
    success: true,
    isNewUser: false,
    avatar: userProfile.avatar,
    theme: userProfile.theme,
    displayName: userProfile.displayName,
    conversations: userProfile.conversationHistory || []
  });
}));

// ============================================
// USER SETTINGS SYNC
// ============================================

/**
 * Get user settings
 * GET /api/users/:userId/settings
 * Query: pin or password
 */
router.get('/:userId/settings', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { pin, password } = req.query;

  if (!pin && !password) {
    return res.status(400).json({ error: 'PIN or password is required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  let authenticated = false;
  if (pin) {
    authenticated = userProfile.authentications.pin.enabled && userProfile.authentications.pin.value === pin;
  } else if (password) {
    authenticated = userProfile.authentications.password.enabled && await userProfile.verifyPassword(password);
  }

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid PIN or password' });
  }

  res.json({
    avatar: userProfile.avatar,
    theme: userProfile.theme,
    displayName: userProfile.displayName,
    devices: userProfile.devices,
    conversations: userProfile.conversationHistory || []
  });
}));

/**
 * Update user settings
 * PUT /api/users/:userId/settings
 * Body: { pin or password, avatar?, theme?, displayName? }
 */
router.put('/:userId/settings', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { pin, password, avatar, theme, displayName } = req.body;

  if (!pin && !password) {
    return res.status(400).json({ error: 'PIN or password is required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  let authenticated = false;
  if (pin) {
    authenticated = userProfile.authentications.pin.enabled && userProfile.authentications.pin.value === pin;
  } else if (password) {
    authenticated = userProfile.authentications.password.enabled && await userProfile.verifyPassword(password);
  }

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid PIN or password' });
  }

  // Update settings
  if (avatar) userProfile.avatar = avatar;
  if (theme) userProfile.theme = theme;
  if (displayName) userProfile.displayName = displayName;
  userProfile.updatedAt = new Date();

  await userProfile.save();
  logger.info(`✓ Settings updated - UserID: ${userId}`);

  res.json({
    success: true,
    avatar: userProfile.avatar,
    theme: userProfile.theme,
    displayName: userProfile.displayName
  });
}));

// ============================================
// CONVERSATION HISTORY
// ============================================

/**
 * Get user's conversation history
 * GET /api/users/:userId/conversations
 */
router.get('/:userId/conversations', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { pin, password } = req.query;

  if (!pin && !password) {
    return res.status(400).json({ error: 'PIN or password is required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  let authenticated = false;
  if (pin) {
    authenticated = userProfile.authentications.pin.enabled && userProfile.authentications.pin.value === pin;
  } else if (password) {
    authenticated = userProfile.authentications.password.enabled && await userProfile.verifyPassword(password);
  }

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid PIN or password' });
  }

  res.json({
    conversations: userProfile.conversationHistory || []
  });
}));

/**
 * Add conversation to user history
 * POST /api/users/:userId/conversations
 */
router.post('/:userId/conversations', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { sessionId, pin, password } = req.body;

  if (!sessionId || (!pin && !password)) {
    return res.status(400).json({ error: 'sessionId and PIN or password are required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  let authenticated = false;
  if (pin) {
    authenticated = userProfile.authentications.pin.enabled && userProfile.authentications.pin.value === pin;
  } else if (password) {
    authenticated = userProfile.authentications.password.enabled && await userProfile.verifyPassword(password);
  }

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid PIN or password' });
  }

  // Check if conversation already exists
  const existingConv = userProfile.conversationHistory?.find(c => c.sessionId === sessionId);
  
  if (!existingConv) {
    if (!userProfile.conversationHistory) {
      userProfile.conversationHistory = [];
    }

    userProfile.conversationHistory.push({
      sessionId,
      dateCreated: new Date(),
      messageCount: 0,
      status: 'active'
    });

    await userProfile.save();
  }

  res.json({ success: true });
}));

// ============================================
// AUTHENTICATION METHODS MANAGEMENT
// ============================================

/**
 * Set password (for users with only PIN)
 * POST /api/users/:userId/set-password
 */
router.post('/:userId/set-password', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { pin, newPassword } = req.body;

  if (!pin || !newPassword) {
    return res.status(400).json({ error: 'PIN and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!userProfile.authentications.pin.enabled || userProfile.authentications.pin.value !== pin) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  userProfile.authentications.password.enabled = true;
  userProfile.authentications.password.hash = newPassword; // Will be hashed on save
  await userProfile.save();

  logger.info(`✓ Password set for user - UserID: ${userId}`);

  res.json({ success: true, message: 'Password has been set. You can now login with password.' });
}));

/**
 * Change password
 * POST /api/users/:userId/change-password
 */
router.post('/:userId/change-password', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isValid = await userProfile.verifyPassword(currentPassword);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid current password' });
  }

  userProfile.authentications.password.hash = newPassword;
  await userProfile.save();

  logger.info(`✓ Password changed - UserID: ${userId}`);

  res.json({ success: true, message: 'Password changed successfully' });
}));

/**
 * Change PIN
 * POST /api/users/:userId/change-pin
 */
router.post('/:userId/change-pin', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { currentPin, newPin } = req.body;

  if (!currentPin || !newPin || newPin.length !== 4) {
    return res.status(400).json({ error: 'Current PIN and new 4-digit PIN are required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!userProfile.authentications.pin.enabled || userProfile.authentications.pin.value !== currentPin) {
    return res.status(401).json({ error: 'Invalid current PIN' });
  }

  userProfile.authentications.pin.value = newPin;
  await userProfile.save();
  
  logger.info(`✓ PIN changed - UserID: ${userId}`);

  res.json({ success: true, message: 'PIN changed successfully' });
}));

module.exports = router;
