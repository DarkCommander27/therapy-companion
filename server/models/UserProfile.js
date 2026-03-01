/**
 * UserProfile Model
 * Stores user settings and preferences across devices
 */

const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  pin: {
    type: String,
    required: true
  },
  
  avatar: {
    type: String,
    default: '🤖'
  },
  
  theme: {
    type: String,
    default: 'ocean',
    enum: ['ocean', 'sunset', 'forest', 'lavender', 'mint', 'coral']
  },
  
  displayName: {
    type: String,
    default: null
  },
  
  lastLogin: {
    type: Date,
    default: Date.now
  },
  
  devices: [{
    deviceId: String,
    deviceName: String,
    lastSeen: Date
  }],
  
  conversationHistory: [{
    sessionId: String,
    dateCreated: Date,
    messageCount: Number,
    status: String // 'active', 'completed', 'flagged'
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('UserProfile', userProfileSchema);
