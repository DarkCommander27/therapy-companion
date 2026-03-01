/**
 * Facility Configuration Service
 * Centralizes and validates facility-specific configuration
 */

class FacilityConfigService {
  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load configuration from environment
   */
  loadConfiguration() {
    return {
      // Facility Information
      facility: {
        name: process.env.FACILITY_NAME || 'Unknown Facility',
        state: process.env.FACILITY_STATE || 'WV',
        timezone: process.env.FACILITY_TIMEZONE || 'America/New_York',
        adminEmail: process.env.MANDATORY_REPORTER_CONTACT || ''
      },

      // Alert Recipients
      alerts: {
        safetyRecipients: (process.env.SAFETY_ALERT_RECIPIENTS || '')
          .split(';')
          .map(e => e.trim())
          .filter(e => e),
        safeguardingRecipients: (process.env.SAFEGUARDING_ALERT_RECIPIENTS || '')
          .split(';')
          .map(e => e.trim())
          .filter(e => e),
        responseSLA: parseInt(process.env.ALERT_RESPONSE_SLA || '15', 10)
      },

      // Alert Thresholds
      thresholds: {
        critical: parseFloat(process.env.CRITICAL_ALERT_THRESHOLD || '0.9'),
        high: parseFloat(process.env.HIGH_ALERT_THRESHOLD || '0.7'),
        medium: parseFloat(process.env.MEDIUM_ALERT_THRESHOLD || '0.5')
      },

      // Rate Limiting
      rateLimit: {
        window: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        chatLimit: parseInt(process.env.COMPANION_CHAT_RATE_LIMIT_MAX || '50', 10)
      },

      // Data Retention
      retention: {
        conversations: parseInt(process.env.CONVERSATION_RETENTION_DAYS || '90', 10),
        briefings: parseInt(process.env.BRIEFING_RETENTION_DAYS || '365', 10),
        incidents: parseInt(process.env.INCIDENT_LOG_RETENTION_DAYS || '730', 10),
        auditLogs: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10)
      },

      // Features
      features: {
        transcriptExport: process.env.ENABLE_TRANSCRIPT_EXPORT === 'true',
        breakGlassAccess: process.env.ENABLE_BREAK_GLASS_ACCESS === 'true',
        healthCheck: process.env.ENABLE_HEALTH_CHECK === 'true'
      },

      // NLU Configuration
      nlu: {
        useLocal: process.env.USE_LOCAL_INFERENCE === 'true',
        modelsPath: process.env.NLU_MODELS_PATH || './models',
        remoteUrl: process.env.NLU_API_URL || null
      }
    };
  }

  /**
   * Validate critical configuration
   */
  validateConfiguration() {
    const errors = [];

    // Validate facility info
    if (!this.config.facility.name || this.config.facility.name === 'Unknown Facility') {
      errors.push('FACILITY_NAME not set in environment');
    }

    // Validate alert recipients
    if (this.config.alerts.safetyRecipients.length === 0) {
      errors.push('SAFETY_ALERT_RECIPIENTS not configured');
    }

    if (this.config.alerts.safeguardingRecipients.length === 0) {
      errors.push('SAFEGUARDING_ALERT_RECIPIENTS not configured');
    }

    // Validate thresholds
    if (this.config.thresholds.critical <= this.config.thresholds.high) {
      errors.push('Critical alert threshold must be higher than high threshold');
    }

    if (this.config.thresholds.high <= this.config.thresholds.medium) {
      errors.push('High alert threshold must be higher than medium threshold');
    }

    // Validate NLU
    if (this.config.nlu.useLocal && !this.config.nlu.modelsPath) {
      errors.push('NLU_MODELS_PATH required when USE_LOCAL_INFERENCE is true');
    }

    if (errors.length > 0) {
      console.warn('Configuration warnings:', errors);
    }
  }

  /**
   * Get alert recipients for a severity level
   */
  getAlertRecipients(type = 'safety') {
    if (type === 'safeguarding') {
      return this.config.alerts.safeguardingRecipients;
    }
    return this.config.alerts.safetyRecipients;
  }

  /**
   * Get alert threshold for a level
   */
  getThreshold(level = 'medium') {
    return this.config.thresholds[level] || this.config.thresholds.medium;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.config.features[feature] === true;
  }

  /**
   * Get retention period (days)
   */
  getRetentionDays(dataType = 'conversations') {
    return this.config.retention[dataType] || 90;
  }

  /**
   * Get complete configuration (for logging/debugging)
   */
  getConfiguration() {
    // Return safe copy without sensitive data
    return {
      facility: this.config.facility,
      alerts: {
        ...this.config.alerts,
        safetyRecipients: this.config.alerts.safetyRecipients.length,
        safeguardingRecipients: this.config.alerts.safeguardingRecipients.length
      },
      thresholds: this.config.thresholds,
      rateLimit: this.config.rateLimit,
      retention: this.config.retention,
      features: this.config.features,
      nlu: {
        ...this.config.nlu,
        remoteUrl: this.config.nlu.remoteUrl ? '***configured***' : 'not configured'
      }
    };
  }

  /**
   * Validate alert recipient email format
   */
  validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if facility is WV-specific
   */
  isWVFacility() {
    return (this.config.facility.state || '').toUpperCase() === 'WV';
  }

  /**
   * Get facility timezone offset
   */
  getTimezoneOffset() {
    // Simplified version - in production use moment-timezone
    const offset = {
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Los_Angeles': -8
    };
    return offset[this.config.facility.timezone] || -5;
  }
}

// Create singleton instance
const facilityConfig = new FacilityConfigService();

module.exports = facilityConfig;
