/**
 * StaffProfile Model
 * Stores staff user accounts with email/username and password authentication
 * Uses bcrypt for password hashing and supports encryption utilities
 */

const mongoose = require('mongoose');
const { hashPassword, comparePassword, isBcryptHash } = require('../utils/encryption');

const staffProfileSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address']
  },
  
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscore, and hyphen']
  },
  
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false // Don't return password by default
  },
  
  firstName: String,
  lastName: String,
  
  role: {
    type: String,
    enum: ['staff', 'manager', 'admin'],
    default: 'staff'
  },
  
  facility: {
    type: String,
    required: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastLogin: {
    type: Date,
    default: null
  },
  
  devices: [{
    deviceId: String,
    deviceName: String,
    lastSeen: Date,
    ipAddress: String
  }],
  
  permissions: {
    viewConversations: { type: Boolean, default: true },
    flagConversations: { type: Boolean, default: true },
    manageFollowUps: { type: Boolean, default: true },
    viewAnalytics: { type: Boolean, default: false },
    manageUsers: { type: Boolean, default: false }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving (using bcrypt via encryption utilities)
staffProfileSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    // Use encryption utility for consistent password hashing across app
    this.password = await hashPassword(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords (using encryption utilities)
staffProfileSchema.methods.comparePassword = async function(plainPassword) {
  return await comparePassword(plainPassword, this.password);
};

module.exports = mongoose.model('StaffProfile', staffProfileSchema);
