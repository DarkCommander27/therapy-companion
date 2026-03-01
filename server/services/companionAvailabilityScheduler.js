/**
 * Companion Availability Scheduler
 * Manages companion chat availability windows (e.g., disable during lights out, enable at breakfast)
 * Allows facilities to control when youth can access the companion based on facility schedule
 */

class CompanionAvailabilityScheduler {
  /**
   * Default availability schedule (all times in 24-hour format HH:MM)
   * Example: Lights out 21:00-07:00, available 07:00-21:00
   */
  static DEFAULT_SCHEDULE = {
    enabled: true,
    timeWindows: [
      {
        name: 'Morning - Breakfast',
        startTime: '07:00',
        endTime: '08:30',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // 0=Sunday through 6=Saturday
      },
      {
        name: 'Daytime - Activities',
        startTime: '08:30',
        endTime: '12:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
      },
      {
        name: 'Afternoon - Sessions',
        startTime: '12:00',
        endTime: '17:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
      },
      {
        name: 'Evening - Recreation',
        startTime: '17:00',
        endTime: '21:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
      }
    ],
    disabledWindows: [
      {
        name: 'Lights Out',
        startTime: '21:00',
        endTime: '07:00', // Spans across midnight
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
      }
    ]
  };

  /**
   * Check if companion is available right now
   * @param {Object} companionProfile - The companion's profile with availability settings
   * @returns {Object} { isAvailable: boolean, reason: string }
   */
  static isCompanionAvailable(companionProfile) {
    // If no schedule defined, use defaults
    const schedule = companionProfile.availabilitySchedule || this.DEFAULT_SCHEDULE;

    // If availability is disabled globally, return false
    if (!schedule.enabled) {
      return {
        isAvailable: false,
        reason: 'Companion is globally disabled'
      };
    }

    const now = new Date();
    const currentTime = this.formatTime(now);
    const dayOfWeek = now.getDay();

    // Check if currently in a disabled window
    const inDisabledWindow = (schedule.disabledWindows || []).some(window => {
      return this.isTimeInWindow(currentTime, dayOfWeek, window);
    });

    if (inDisabledWindow) {
      return {
        isAvailable: false,
        reason: 'Companion is disabled during this time (e.g., lights out)'
      };
    }

    // Check if currently in an enabled window
    const inEnabledWindow = (schedule.timeWindows || []).some(window => {
      return this.isTimeInWindow(currentTime, dayOfWeek, window);
    });

    if (inEnabledWindow) {
      return {
        isAvailable: true,
        reason: 'Companion is available'
      };
    }

    return {
      isAvailable: false,
      reason: 'Current time is outside available hours'
    };
  }

  /**
   * Check if a time is within a window
   * Handles windows that span midnight (e.g., 21:00-07:00)
   * @private
   */
  static isTimeInWindow(currentTime, dayOfWeek, window) {
    // Check if today is in the window's days
    if (!window.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    const [startHour, startMin] = window.startTime.split(':').map(Number);
    const [endHour, endMin] = window.endTime.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const currentMinutes = currentHour * 60 + currentMin;

    // If window spans midnight (end < start), handle specially
    if (endMinutes < startMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    // Normal case: end time is after start time
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Get next available time for companion
   * @param {Object} companionProfile - The companion's profile with availability settings
   * @returns {Object} { nextAvailableTime: Date, untilAvailable: string }
   */
  static getNextAvailableTime(companionProfile) {
    const schedule = companionProfile.availabilitySchedule || this.DEFAULT_SCHEDULE;

    if (!schedule.enabled) {
      return {
        nextAvailableTime: null,
        untilAvailable: 'Companion is globally disabled',
        isDisabled: true
      };
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check next 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);

      const dayOfWeek = checkDate.getDay();
      const enabledWindows = (schedule.timeWindows || []).filter(
        w => w.daysOfWeek.includes(dayOfWeek)
      );

      if (enabledWindows.length === 0) continue;

      // Get the earliest enabled window for this day
      const earliestWindow = enabledWindows.reduce((min, window) => {
        const windowStartMinutes = window.startTime.split(':').map(Number)
          .reduce((h, m, i) => h + (i === 0 ? h * 60 : m), 0);
        const minStartMinutes = min.startTime.split(':').map(Number)
          .reduce((h, m, i) => h + (i === 0 ? h * 60 : m), 0);
        return windowStartMinutes < minStartMinutes ? window : min;
      });

      const [hour, min] = earliestWindow.startTime.split(':').map(Number);
      const availableTime = new Date(checkDate);
      availableTime.setHours(hour, min, 0, 0);

      if (availableTime > now) {
        const diffMs = availableTime - now;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return {
          nextAvailableTime: availableTime,
          untilAvailable: `${hours}h ${minutes}m`,
          window: earliestWindow.name
        };
      }
    }

    return {
      nextAvailableTime: null,
      untilAvailable: 'No available times found in schedule'
    };
  }

  /**
   * Format current time as HH:MM
   * @private
   */
  static formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Update companion's availability schedule
   * @param {Object} companionId - The companion's ID
   * @param {Object} newSchedule - The new availability schedule
   */
  static async updateAvailabilitySchedule(companionId, newSchedule) {
    try {
      const CompanionProfile = require('../models/CompanionProfile');

      // Validate schedule format
      if (!this.validateSchedule(newSchedule)) {
        throw new Error('Invalid schedule format');
      }

      const updated = await CompanionProfile.findByIdAndUpdate(
        companionId,
        { availabilitySchedule: newSchedule },
        { new: true }
      );

      console.log(`Updated availability schedule for companion: ${companionId}`);
      return updated;
    } catch (error) {
      console.error('Error updating availability schedule:', error);
      throw error;
    }
  }

  /**
   * Validate schedule format
   * @private
   */
  static validateSchedule(schedule) {
    if (!schedule || typeof schedule !== 'object') return false;

    // Check basic structure
    if (typeof schedule.enabled !== 'boolean') return false;

    // Validate time windows format
    if (schedule.timeWindows && Array.isArray(schedule.timeWindows)) {
      for (const window of schedule.timeWindows) {
        if (!this.isValidTimeWindow(window)) return false;
      }
    }

    // Validate disabled windows format
    if (schedule.disabledWindows && Array.isArray(schedule.disabledWindows)) {
      for (const window of schedule.disabledWindows) {
        if (!this.isValidTimeWindow(window)) return false;
      }
    }

    return true;
  }

  /**
   * Validate individual time window
   * @private
   */
  static isValidTimeWindow(window) {
    if (!window.startTime || !window.endTime) return false;
    if (!this.isValidTimeFormat(window.startTime)) return false;
    if (!this.isValidTimeFormat(window.endTime)) return false;
    if (!Array.isArray(window.daysOfWeek)) return false;
    if (!window.daysOfWeek.every(d => d >= 0 && d <= 6)) return false;
    return true;
  }

  /**
   * Validate time format (HH:MM)
   * @private
   */
  static isValidTimeFormat(timeStr) {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(timeStr);
  }

  /**
   * Get availability status for display
   * @param {Object} companionProfile - The companion's profile
   * @returns {Object} Status information for UI/logging
   */
  static getAvailabilityStatus(companionProfile) {
    const availability = this.isCompanionAvailable(companionProfile);
    const nextAvailable = this.getNextAvailableTime(companionProfile);

    return {
      isAvailable: availability.isAvailable,
      currentStatus: availability.reason,
      nextAvailableTime: nextAvailable.nextAvailableTime,
      nextAvailableIn: nextAvailable.untilAvailable,
      nextWindow: nextAvailable.window
    };
  }
}

module.exports = CompanionAvailabilityScheduler;
