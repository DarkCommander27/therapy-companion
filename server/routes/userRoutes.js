/**
 * User Routes - Authentication & Cross-Device Sync
 * Handles PIN login, settings sync, and conversation history
 */

const express = require('express');
const router = express.Router();
const UserProfile = require('../models/UserProfile');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

// ============================================
// PIN AUTHENTICATION
// ============================================

/**
 * Login/Register with PIN
 * POST /api/users/login
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { userId, pin, deviceId, deviceName } = req.body;

  if (!userId || !pin) {
    return res.status(400).json({ error: 'userId and pin are required' });
  }

  // Find or create user profile
  let userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    // First time login - create new profile
    userProfile = new UserProfile({
      userId,
      pin,
      devices: [{
        deviceId: deviceId || `device-${Date.now()}`,
        deviceName: deviceName || 'Unknown Device',
        lastSeen: new Date()
      }]
    });

    await userProfile.save();
    logger.info(`✓ New user created - UserID: ${userId}`);
    
    return res.json({
      success: true,
      isNewUser: true,
      avatar: userProfile.avatar,
      theme: userProfile.theme,
      conversations: []
    });
  }

  // Verify PIN
  if (userProfile.pin !== pin) {
    logger.warn(`✗ Failed PIN attempt - UserID: ${userId}`);
    return res.status(401).json({ error: 'Invalid PIN' });
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
  logger.info(`✓ User login - UserID: ${userId}, Device: ${deviceName}`);

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
 */
router.get('/:userId/settings', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { pin } = req.query;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (userProfile.pin !== pin) {
    return res.status(401).json({ error: 'Invalid PIN' });
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
 */
router.put('/:userId/settings', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { pin, avatar, theme, displayName } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (userProfile.pin !== pin) {
    return res.status(401).json({ error: 'Invalid PIN' });
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
  const { pin } = req.query;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (userProfile.pin !== pin) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // Return conversation history
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
  const { sessionId, pin } = req.body;

  if (!pin || !sessionId) {
    return res.status(400).json({ error: 'pin and sessionId are required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (userProfile.pin !== pin) {
    return res.status(401).json({ error: 'Invalid PIN' });
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
// CHANGE PIN
// ============================================

/**
 * Change user PIN
 * POST /api/users/:userId/change-pin
 */
router.post('/:userId/change-pin', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { currentPin, newPin } = req.body;

  if (!currentPin || !newPin) {
    return res.status(400).json({ error: 'currentPin and newPin are required' });
  }

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (userProfile.pin !== currentPin) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  userProfile.pin = newPin;
  await userProfile.save();
  
  logger.info(`✓ PIN changed - UserID: ${userId}`);

  res.json({ success: true, message: 'PIN changed successfully' });
}));

module.exports = router;
