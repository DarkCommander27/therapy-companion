/**
 * Automated Briefing Scheduler
 * Generates briefings on a schedule (daily, weekly, etc.)
 */

const cron = require('node-cron');
const CompanionProfile = require('../models/CompanionProfile');
const CompanionBriefingService = require('./companionBriefingService');
const IncidentLog = require('../models/IncidentLog');

class AutomatedBriefingScheduler {
  constructor() {
    this.briefingService = new CompanionBriefingService();
    this.scheduledJobs = new Map();
  }

  /**
   * Initialize all scheduled tasks
   */
  async initializeScheduler() {
    console.log('Initializing automated briefing scheduler...');

    try {
      // Get all companion profiles
      const companions = await CompanionProfile.find()
        .populate('therapistProfile.assignedTherapistId');

      companions.forEach(companion => {
        this.scheduleCompanionBriefings(companion);
      });

      console.log(`Scheduled briefings for ${companions.length} companions`);
    } catch (error) {
      console.error('Failed to initialize scheduler:', error);
    }
  }

  /**
   * Schedule briefings for a specific companion
   */
  scheduleCompanionBriefings(companion) {
    const companionId = companion._id.toString();

    // Schedule daily briefing at 9 AM
    const dailyJob = cron.schedule('0 9 * * *', async () => {
      await this.generateDailyBriefing(companion);
    });

    // Schedule weekly briefing every Monday at 8 AM
    const weeklyJob = cron.schedule('0 8 * * 1', async () => {
      await this.generateWeeklyBriefing(companion);
    });

    // Store job references
    this.scheduledJobs.set(`${companionId}-daily`, dailyJob);
    this.scheduledJobs.set(`${companionId}-weekly`, weeklyJob);

    console.log(`Scheduled briefings for companion: ${companion.companionName}`);
  }

  /**
   * Generate daily briefing
   */
  async generateDailyBriefing(companion) {
    try {
      console.log(`\n[${new Date().toLocaleString()}] Generating daily briefing for ${companion.companionName}`);

      const therapistId = companion.therapistProfile.assignedTherapistId;

      // Check if there's been activity in last 24 hours
      const hasActivity = await this.checkRecentActivity(companion.userId, 'last_24h');

      if (!hasActivity) {
        console.log(`  - No recent activity, skipping daily briefing`);
        return;
      }

      // Generate briefing
      const briefing = await this.briefingService.generateBriefing(
        companion._id,
        therapistId,
        'last_24h'
      );

      // Check if briefing has critical content
      if (briefing.briefType === 'alert' || briefing.briefType === 'detailed') {
        // Send notification to therapist
        await this.notifyTherapist(
          therapistId,
          companion.companionName,
          briefing
        );
      }

      console.log(`  ✓ Daily briefing generated (Type: ${briefing.briefType})`);
    } catch (error) {
      console.error(`Failed to generate daily briefing for ${companion.companionName}:`, error);
    }
  }

  /**
   * Generate weekly briefing
   */
  async generateWeeklyBriefing(companion) {
    try {
      console.log(`\n[${new Date().toLocaleString()}] Generating weekly briefing for ${companion.companionName}`);

      const therapistId = companion.therapistProfile.assignedTherapistId;

      // Generate briefing
      const briefing = await this.briefingService.generateBriefing(
        companion._id,
        therapistId,
        'last_7d'
      );

      // Always notify for weekly briefing
      await this.notifyTherapist(
        therapistId,
        companion.companionName,
        briefing,
        true // forceNotification
      );

      // Generate weekly summary statistics
      const stats = await this.generateWeeklyStats(companion);

      console.log(`  ✓ Weekly briefing generated`);
      console.log(`  - Sessions: ${stats.totalSessions}`);
      console.log(`  - Incidents: ${stats.totalIncidents}`);
      console.log(`  - Trend: ${stats.trend}`);

    } catch (error) {
      console.error(`Failed to generate weekly briefing for ${companion.companionName}:`, error);
    }
  }

  /**
   * Check if there's been activity in timespan
   */
  async checkRecentActivity(userId, timespan) {
    try {
      const dateRange = this.calculateDateRange(timespan);
      const Conversation = require('../models/Conversation');

      const conversation = await Conversation.findOne({
        userId,
        updatedAt: { $gte: dateRange.start, $lte: dateRange.end }
      });

      return !!conversation;
    } catch (error) {
      console.error('Error checking recent activity:', error);
      return false;
    }
  }

  /**
   * Generate weekly statistics
   */
  async generateWeeklyStats(companion) {
    try {
      const dateRange = this.calculateDateRange('last_7d');

      // Get conversations
      const Conversation = require('../models/Conversation');
      const conversations = await Conversation.find({
        userId: companion.userId,
        createdAt: { $gte: dateRange.start, $lte: dateRange.end }
      });

      // Count messages
      const totalMessages = conversations.reduce((sum, c) =>
        sum + (c.messages ? c.messages.length : 0), 0
      );

      // Get incidents
      const incidents = await IncidentLog.find({
        userId: companion.userId,
        createdAt: { $gte: dateRange.start, $lte: dateRange.end }
      });

      // Calculate trend
      const trend = this.calculateTrend(incidents);

      return {
        totalSessions: conversations.length,
        totalMessages,
        totalIncidents: incidents.length,
        criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
        trend
      };
    } catch (error) {
      console.error('Error generating weekly stats:', error);
      return {
        totalSessions: 0,
        totalMessages: 0,
        totalIncidents: 0,
        criticalIncidents: 0,
        trend: 'unknown'
      };
    }
  }

  /**
   * Notify therapist of new briefing
   */
  async notifyTherapist(therapistId, companionName, briefing, forceNotification = false) {
    try {
      const nodemailer = require('nodemailer');

      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      // Get therapist email
      const User = require('../models/User');
      const therapist = await User.findById(therapistId, 'email username');

      if (!therapist) {
        console.log('Therapist not found');
        return;
      }

      // Determine if notification is needed
      const needsNotification = forceNotification || 
        briefing.briefType === 'alert' || 
        briefing.briefType === 'detailed';

      if (!needsNotification) {
        console.log('  - No therapist notification needed');
        return;
      }

      // Build email
      const emailContent = this.buildBriefingEmail(companionName, briefing);

      await transporter.sendMail({
        to: therapist.email,
        subject: `${companionName}'s Therapy Companion Briefing - ${briefing.timespan.label}`,
        html: emailContent
      });

      console.log(`  ✓ Notified therapist: ${therapist.email}`);
    } catch (error) {
      console.error('Error notifying therapist:', error);
    }
  }

  /**
   * Build briefing email HTML
   */
  buildBriefingEmail(companionName, briefing) {
    const briefTypeColors = {
      'alert': '#d32f2f',
      'detailed': '#f57c00',
      'standard': '#1976d2',
      'minimal': '#388e3c'
    };

    const color = briefTypeColors[briefing.briefType] || '#1976d2';

    return `
      <html>
        <body style="font-family: 'Arial', sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <!-- Header -->
            <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h1 style="margin: 0; font-size: 24px;">📋 ${companionName}'s Briefing</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">${briefing.timespan.label}</p>
            </div>

            <!-- Overall Status -->
            <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid ${color}; margin-bottom: 20px; border-radius: 4px;">
              <h3 style="margin: 0 0 10px 0;">Overall Status</h3>
              <p style="margin: 0; font-size: 16px;"><strong>${briefing.briefContent.overallMood}</strong></p>
              <p style="margin: 5px 0 0 0; color: #666;">${briefing.briefContent.keyTheme}</p>
            </div>

            <!-- Recommended Action -->
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
              <h3 style="margin: 0 0 10px 0; color: #2e7d32;">✓ Recommended Action</h3>
              <p style="margin: 0;">${briefing.briefContent.recommendedAction}</p>
            </div>

            <!-- Emotional Trends (if included) -->
            ${briefing.briefContent.emotionalTrends ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0;">Emotional Trends</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="background-color: #f5f5f5;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Emotion</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Frequency</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Direction</th>
                  </tr>
                  ${briefing.briefContent.emotionalTrends.map(trend => `
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 10px;">${trend.emotion}</td>
                      <td style="padding: 10px;">${trend.frequency}</td>
                      <td style="padding: 10px;">${trend.direction}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : ''}

            <!-- Patterns (if included) -->
            ${briefing.briefContent.patterns && briefing.briefContent.patterns.length > 0 ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0;">Notable Patterns</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${briefing.briefContent.patterns.map(pattern => `
                    <li style="margin-bottom: 8px;">
                      <strong>${pattern.pattern}</strong> (${pattern.frequency} times)
                      <br><small style="color: #666;">Last: ${new Date(pattern.lastOccurred).toLocaleDateString()}</small>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Flagged Incidents -->
            ${briefing.flaggedIncidents && briefing.flaggedIncidents.length > 0 ? `
              <div style="background-color: #fff3e0; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                <h3 style="margin: 0 0 15px 0; color: #e65100;">⚠️ Flagged Incidents (${briefing.flaggedIncidents.length})</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${briefing.flaggedIncidents.map(incident => `
                    <li style="margin-bottom: 8px;">
                      <strong>${incident.category}</strong> - ${incident.severity.toUpperCase()}
                      <br><small style="color: #666;">${new Date(incident.date).toLocaleDateString()}</small>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Risk Factors (if included) -->
            ${briefing.briefContent.riskFactors && briefing.briefContent.riskFactors.length > 0 ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0;">Risk Factors</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${briefing.briefContent.riskFactors.map(rf => `
                    <li style="margin-bottom: 8px;">
                      <strong>${rf.factor}</strong> (${rf.severity})
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Confidence Score -->
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; text-align: center;">
              <p style="margin: 0; color: #666;">Assessment Confidence</p>
              <div style="margin-top: 10px;">
                <div style="width: 100%; height: 20px; background-color: #e0e0e0; border-radius: 10px; overflow: hidden;">
                  <div style="width: ${briefing.briefContent.confidenceScore * 100}%; height: 100%; background-color: ${color};"></div>
                </div>
                <p style="margin: 5px 0 0 0; font-weight: bold;">${(briefing.briefContent.confidenceScore * 100).toFixed(0)}%</p>
              </div>
            </div>

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
              <p style="margin: 0;">This briefing was automatically generated by the Therapy Companion system.</p>
              <p style="margin: 5px 0 0 0;">Generated: ${new Date().toLocaleString()}</p>
            </div>

          </div>
        </body>
      </html>
    `;
  }

  /**
   * Helper: Calculate date range
   */
  calculateDateRange(timespan) {
    const end = new Date();
    const start = new Date();

    switch (timespan) {
      case 'last_24h':
        start.setDate(start.getDate() - 1);
        break;
      case 'last_7d':
        start.setDate(start.getDate() - 7);
        break;
      case 'last_30d':
        start.setDate(start.getDate() - 30);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }

    return { start, end };
  }

  /**
   * Helper: Calculate trend
   */
  calculateTrend(incidents) {
    if (incidents.length < 2) return 'stable';

    const half = Math.floor(incidents.length / 2);
    const older = incidents.slice(half);
    const newer = incidents.slice(0, half);

    const severityMap = { critical: 4, high: 3, medium: 2, low: 1 };
    const olderSeverity = older.reduce((sum, i) => sum + (severityMap[i.severity] || 0), 0) / older.length;
    const newerSeverity = newer.reduce((sum, i) => sum + (severityMap[i.severity] || 0), 0) / newer.length;

    if (newerSeverity > olderSeverity) return 'increasing';
    if (newerSeverity < olderSeverity) return 'decreasing';
    return 'stable';
  }

  /**
   * Stop scheduler
   */
  stopScheduler() {
    this.scheduledJobs.forEach((job) => {
      job.stop();
    });
    console.log('Briefing scheduler stopped');
  }
}

module.exports = AutomatedBriefingScheduler;