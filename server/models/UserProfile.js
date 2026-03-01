/**
 * UserProfile Model
 * Stores user settings and preferences across devices
 * Supports both PIN and password authentication
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Authentication methods
  authentications: {
    pin: {
      enabled: { type: Boolean, default: false },
      value: String // 4-digit PIN
    },
    password: {
      enabled: { type: Boolean, default: false },
      hash: String // bcrypt hash
    }
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

// Hash password before saving
userProfileSchema.pre('save', async function(next) {
  if (this.authentications.password.hash && !this.authentications.password.hash.startsWith('$2')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.authentications.password.hash = await bcrypt.hash(this.authentications.password.hash, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Method to verify password
userProfileSchema.methods.verifyPassword = async function(password) {
  if (!this.authentications.password.enabled || !this.authentications.password.hash) {
    return false;
  }
  return await bcrypt.compare(password, this.authentications.password.hash);
};

module.exports = mongoose.model('UserProfile', userProfileSchema);
