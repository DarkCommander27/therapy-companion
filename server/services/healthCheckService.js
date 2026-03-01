/**
 * Health Check Service
 * Monitors system status and reports health metrics
 */

const mongoose = require('mongoose');

class HealthCheckService {
  constructor() {
    this.startTime = Date.now();
    this.checks = {
      database: { healthy: false, lastCheck: null, error: null },
      nlu: { healthy: false, lastCheck: null, error: null },
      email: { healthy: false, lastCheck: null, error: null },
      scheduler: { healthy: false, lastCheck: null, error: null }
    };
  }

  /**
   * Get overall system health
   */
  async getSystemHealth() {
    try {
      // Check database
      await this.checkDatabase();
      
      // Check NLU models
      await this.checkNLU();
      
      // Check email service
      await this.checkEmail();
      
      // Check scheduler
      await this.checkScheduler();

      // Calculate overall status
      const allHealthy = Object.values(this.checks).every(c => c.healthy);
      
      return {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        checks: this.checks,
        version: process.env.npm_package_version || 'unknown',
        environment: process.env.NODE_ENV || 'unknown'
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        checks: this.checks
      };
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    const startTime = Date.now();
    try {
      const mongoState = mongoose.connection.readyState;
      
      if (mongoState === 1) { // Connected
        this.checks.database = {
          healthy: true,
          lastCheck: new Date().toISOString(),
          error: null,
          responseTime: Date.now() - startTime
        };
      } else {
        this.checks.database = {
          healthy: false,
          lastCheck: new Date().toISOString(),
          error: `Database connection state: ${mongoState}`,
          responseTime: Date.now() - startTime
        };
      }
    } catch (error) {
      this.checks.database = {
        healthy: false,
        lastCheck: new Date().toISOString(),
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check NLU models availability
   */
  async checkNLU() {
    const startTime = Date.now();
    try {
      const useLocal = process.env.USE_LOCAL_INFERENCE === 'true';
      
      if (useLocal) {
        // Check if local model paths exist
        const fs = require('fs');
        const intentPath = process.env.INTENT_MODEL_PATH || './models/intent-recognition';
        const emotionPath = process.env.EMOTION_MODEL_PATH || './models/emotion-detection';
        
        const intentExists = fs.existsSync(intentPath);
        const emotionExists = fs.existsSync(emotionPath);
        
        if (intentExists && emotionExists) {
          this.checks.nlu = {
            healthy: true,
            lastCheck: new Date().toISOString(),
            error: null,
            type: 'local',
            responseTime: Date.now() - startTime
          };
        } else {
          this.checks.nlu = {
            healthy: false,
            lastCheck: new Date().toISOString(),
            error: `Missing local models (intent: ${intentExists}, emotion: ${emotionExists})`,
            type: 'local',
            responseTime: Date.now() - startTime
          };
        }
      } else {
        // Check remote API availability
        const nluUrl = process.env.NLU_API_URL;
        if (!nluUrl) {
          this.checks.nlu = {
            healthy: false,
            lastCheck: new Date().toISOString(),
            error: 'Remote NLU API URL not configured',
            type: 'remote',
            responseTime: Date.now() - startTime
          };
        } else {
          this.checks.nlu = {
            healthy: true,
            lastCheck: new Date().toISOString(),
            error: null,
            type: 'remote',
            responseTime: Date.now() - startTime
          };
        }
      }
    } catch (error) {
      this.checks.nlu = {
        healthy: false,
        lastCheck: new Date().toISOString(),
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check email service configuration
   */
  async checkEmail() {
    const startTime = Date.now();
    try {
      const emailService = process.env.EMAIL_SERVICE;
      const emailUser = process.env.EMAIL_USER;
      const emailPassword = process.env.EMAIL_PASSWORD;

      if (emailService && emailUser && emailPassword) {
        // Basic validation - assume healthy if configured
        // In production, consider doing a test send
        this.checks.email = {
          healthy: true,
          lastCheck: new Date().toISOString(),
          error: null,
          service: emailService,
          responseTime: Date.now() - startTime
        };
      } else {
        this.checks.email = {
          healthy: false,
          lastCheck: new Date().toISOString(),
          error: 'Email service not fully configured',
          responseTime: Date.now() - startTime
        };
      }
    } catch (error) {
      this.checks.email = {
        healthy: false,
        lastCheck: new Date().toISOString(),
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check scheduler service
   */
  async checkScheduler() {
    const startTime = Date.now();
    try {
      // Check if scheduler service is available
      const AutomatedBriefingScheduler = require('./automatedBriefingScheduler');
      
      if (AutomatedBriefingScheduler) {
        this.checks.scheduler = {
          healthy: true,
          lastCheck: new Date().toISOString(),
          error: null,
          responseTime: Date.now() - startTime
        };
      } else {
        this.checks.scheduler = {
          healthy: false,
          lastCheck: new Date().toISOString(),
          error: 'Scheduler service not loaded',
          responseTime: Date.now() - startTime
        };
      }
    } catch (error) {
      this.checks.scheduler = {
        healthy: false,
        lastCheck: new Date().toISOString(),
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get detailed metrics
   */
  async getDetailedMetrics() {
    const health = await this.getSystemHealth();
    
    return {
      ...health,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  /**
   * Reset health checks
   */
  resetChecks() {
    Object.keys(this.checks).forEach(key => {
      this.checks[key] = {
        healthy: false,
        lastCheck: null,
        error: null
      };
    });
  }
}

// Create singleton instance
const healthCheckService = new HealthCheckService();

module.exports = healthCheckService;
