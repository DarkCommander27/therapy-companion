/**
 * Companion Availability Middleware
 * Checks if companion is available before allowing chat access
 * Uses CompanionAvailabilityScheduler to enforce facility schedules
 */

const CompanionAvailabilityScheduler = require('../services/companionAvailabilityScheduler');

/**
 * Middleware to check if companion is available for the requesting youth
 * Returns 403 if companion is unavailable with next available time
 */
async function checkCompanionAvailability(req, res, next) {
  try {
    // Skip check for non-chat endpoints
    if (!req.path.includes('/chat') || req.method !== 'POST') {
      return next();
    }

    const userId = req.user?.id || req.body?.userId;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Missing user ID',
        message: 'Cannot check availability without user information'
      });
    }

    // Get companion profile with availability schedule
    const CompanionProfile = require('../models/CompanionProfile');
    const companionProfile = await CompanionProfile.findOne({ userId });

    if (!companionProfile) {
      return res.status(404).json({
        error: 'Companion profile not found',
        message: 'Youth companion profile could not be located'
      });
    }

    // Check if companion is available
    const availability = CompanionAvailabilityScheduler.isCompanionAvailable(companionProfile);

    if (!availability.isAvailable) {
      // Get next available time for helpful message
      const nextTime = CompanionAvailabilityScheduler.getNextAvailableTime(companionProfile);

      return res.status(403).json({
        error: 'Companion unavailable',
        reason: availability.reason,
        nextAvailableTime: nextTime.nextAvailableTime,
        nextAvailableIn: nextTime.untilAvailable,
        nextWindow: nextTime.window || 'Unknown',
        message: `The companion is not available right now. Next available: ${nextTime.untilAvailable}`
      });
    }

    // Store availability status in request for logging
    req.companionAvailable = true;
    req.availabilityStatus = CompanionAvailabilityScheduler.getAvailabilityStatus(companionProfile);

    next();
  } catch (error) {
    console.error('Error checking companion availability:', error);
    // Don't fail hard - log but allow request to continue
    // Availability check failure shouldn't block access
    req.companionAvailable = true; // Default to available if check fails
    next();
  }
}

/**
 * Middleware to log availability status after response
 */
function logAvailabilityStatus(req, res, next) {
  // Hook into response.json to log after sending
  const originalJson = res.json;
  
  res.json = function(data) {
    if (req.companionAvailable === false && res.statusCode === 403) {
      console.log(`[Availability Check] User ${req.user?.id} blocked - Companion unavailable`);
    }
    return originalJson.call(this, data);
  };

  next();
}

module.exports = {
  checkCompanionAvailability,
  logAvailabilityStatus
};
