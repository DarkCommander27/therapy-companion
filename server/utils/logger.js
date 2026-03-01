/**
 * Logger Utility
 * Simple logging utility for consistent logging across the application
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = process.env.LOG_DIR || './logs';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.enableAuditLogging = process.env.ENABLE_AUDIT_LOGGING === 'true';
    
    // Create logs directory if it doesn't exist
    this.ensureLogDir();
    
    // Log levels with numeric values
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  log(level, message, metadata = {}) {
    // Check if this level should be logged
    if (this.levels[level] > this.levels[this.logLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...metadata
    };

    // Console output
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, metadata);
    } else if (level === 'warn') {
      console.warn(logMessage, metadata);
    } else if (level === 'debug') {
      console.debug(logMessage, metadata);
    } else {
      console.log(logMessage, metadata);
    }

    // File output
    this.writeToFile(level, logEntry);
  }

  writeToFile(level, logEntry) {
    try {
      const logFile = path.join(this.logDir, `${level}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(logFile, logLine, 'utf8');

      // Also write to combined log
      const combinedFile = path.join(this.logDir, 'combined.log');
      fs.appendFileSync(combinedFile, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }

  audit(action, resource, userId, details = {}) {
    if (!this.enableAuditLogging) return;

    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      resource,
      userId,
      ...details
    };

    try {
      const auditFile = path.join(this.logDir, 'audit.log');
      const auditLine = JSON.stringify(auditEntry) + '\n';
      fs.appendFileSync(auditFile, auditLine, 'utf8');
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
