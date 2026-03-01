# CareBridge Companion

A supportive AI check-in companion designed to help youth in residential care engage with care teams through empathetic, safe conversations. CareBridge Companion generates safety briefings and alerts that help staff respond quickly and consistently to youth needs.

---

## What CareBridge Companion Is

- **A supportive check-in tool**: Youth can talk to the companion anytime, expressing thoughts, feelings, and concerns
- **A team briefing system**: Generates daily/weekly summaries of youth check-ins to help care teams stay informed
- **A safety alert system**: Detects and flags potential safety concerns (e.g., self-harm language, abuse indicators, crisis signals) for immediate staff response
- **Privacy-first**: Designed for local deployment with local inference models to keep data facility-controlled
- **LGBTQ+ affirming**: Supports inclusive, non-judgmental conversations with youth of all identities

---

## Clear Boundaries: What It Is NOT

- ❌ **Not therapy or diagnosis**: The companion provides supportive conversation, not clinical assessment
- ❌ **Not a crisis hotline**: Alerts require human staff follow-up per facility protocols
- ❌ **Not staff-to-youth messaging**: Staff cannot send messages through the system; youth communicate only with the companion
- ❌ **Not a replacement for clinical care**: Complements but does not replace therapists, counselors, or care plans

---

## Key Features

### For Youth
- 24/7 supportive check-ins with a caring companion
- Safe space to express emotions and concerns between sessions
- Non-judgmental, affirming conversations

### For Direct Care Staff
- **Briefings**: Short summaries of recent youth activity, mood trends, and themes
- **Alerts**: Real-time notifications when messages suggest safety concerns
- **Suggested follow-ups**: Care plans based on youth communication patterns

### For Facility Leadership
- Comprehensive safety monitoring and incident tracking
- LGBTQ+ affirming care documentation
- Audit logs and safeguarding oversight
- Configurable alert thresholds and response protocols
- **Facility-controlled availability scheduling** (disable during lights out, enable at specific meal/activity times)
- West Virginia baseline compliance support

---

## Architecture Overview

### Tech Stack
- **Frontend**: React-based chat interface
- **Backend**: Express.js with Node.js
- **NLU**: Intent recognition + emotion detection
- **Models**: Local inference preferred (privacy-first approach)
- **Deployment**: Local-first, facility-controlled infrastructure

### Core Modules
1. **Companion Chat Service**: Real-time conversation engine
2. **NLU Pipeline**: Intent recognition and emotion analysis
3. **Safety Monitoring**: Incident detection and logging
4. **Briefing Generator**: Automated daily/weekly summaries
5. **Safeguarding System**: Access control, audit logs, monitoring dashboards
6. **Automated Scheduler**: Cron-based briefing generation
7. **Availability Scheduler**: Facility-controlled companion access windows (lights out, meal times, etc.)

### Middleware & Infrastructure
- **Rate Limiting**: Prevents abuse with configurable request limits
- **Availability Check**: Enforces facility schedules before allowing chat access
- **Error Handling**: Centralized error handling with consistent responses
- **Request Logging**: Tracks requests and audit events
- **Health Check**: System status monitoring endpoint

### Security & Compliance
- **JWT Authentication**: Secure user authentication
- **Role-Based Access Control**: Least privilege access enforcement
- **Audit Logging**: Complete activity tracking
- **Data Encryption**: Sensitive data protection
- **Rate Limiting**: DDoS and abuse prevention

---

## Facility-Controlled Availability Scheduling

Facilities can configure when the companion is available to youth, aligning with facility schedules and routines:

### Features
- **Customizable Time Windows**: Define when companion is available (e.g., "Breakfast: 07:00-08:30", "Activities: 08:30-12:00", "Evening Recreation: 17:00-21:00")
- **Disabled Periods**: Schedule lights out and other times when chat should be unavailable (e.g., "Lights Out: 21:00-07:00")
- **Day-of-Week Control**: Different schedules for weekdays vs. weekends if needed
- **Real-time Access Check**: System automatically checks availability before allowing chat access
- **User Feedback**: Youth see when companion is next available if they try to chat during disabled times

### Common Facility Schedules
```
Morning Routine
├─ Breakfast: 07:00-08:30
├─ Chores/Prep: 08:30-09:00
└─ Companion Available: ✓

Daytime Activities
├─ School/Programs: 09:00-12:00
├─ Lunch: 12:00-13:00
└─ Companion Available: ✓

Afternoon Sessions
├─ Therapy/Counseling: 13:00-16:00
├─ Recreation: 16:00-17:00
└─ Companion Available: ✓

Evening Routine
├─ Dinner: 17:00-18:00
├─ Recreation: 18:00-21:00
├─ Bedtime Routine: 21:00-22:00
└─ Companion Available: ✓ until 21:00

Nighttime (Lights Out)
├─ 21:00-07:00 (next day)
└─ Companion Available: ✗
```

### Configuration Example
```javascript
const schedule = {
  enabled: true,
  timeWindows: [
    {
      name: 'Morning - Breakfast',
      startTime: '07:00',
      endTime: '08:30',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // All days
    },
    {
      name: 'Daytime - Activities',
      startTime: '08:30',
      endTime: '12:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
    },
    // ... more time windows
  ],
  disabledWindows: [
    {
      name: 'Lights Out',
      startTime: '21:00',
      endTime: '07:00', // Spans midnight
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
    }
  ]
};
```

### Implementation
The `CompanionAvailabilityScheduler` service provides:

```javascript
// Check if companion is available now
const { isAvailable, reason } = CompanionAvailabilityScheduler
  .isCompanionAvailable(companionProfile);

// Get next available time
const { nextAvailableTime, untilAvailable } = CompanionAvailabilityScheduler
  .getNextAvailableTime(companionProfile);

// Update facility's schedule
await CompanionAvailabilityScheduler
  .updateAvailabilitySchedule(companionId, newSchedule);
```

---

## Quick Start

### Prerequisites
- Node.js 16+ (18+ recommended)
- npm or yarn package manager
- MongoDB 5+ (local or connection string)
- Optional: Local inference models for privacy-first deployment

### Installation

```bash
# Clone the repository
git clone https://github.com/DarkCommander27/CareBridge-Companion.git
cd CareBridge-Companion

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (database URI, alert recipients, etc.)
# See .env.example for all available options
```

### Start the Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### Health Check

Verify the system is healthy:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-01T12:00:00.000Z",
  "uptime": 123,
  "checks": {
    "database": { "healthy": true },
    "nlu": { "healthy": true },
    "email": { "healthy": true },
    "scheduler": { "healthy": true }
  }
}
```

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
npm start
```

---

## Development

For detailed setup instructions and development workflow:

See [DEVELOPMENT.md](DEVELOPMENT.md) for:
- Local environment setup
- Database initialization
- Testing and debugging
- Contributing guidelines
- Troubleshooting

### Implementation Details

See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for:
- Complete list of improvements
- Verification status
- Integration details
- Next steps

---

## Configuration

### Environment Variables

All configuration is managed through environment variables. Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

**Key Configuration:**

```env
# Server
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://host:port/carebridge-companion

# Alert Recipients (semicolon-separated)
SAFETY_ALERT_RECIPIENTS=clinician@facility.org;supervisor@facility.org
SAFEGUARDING_ALERT_RECIPIENTS=safeguarding@facility.org

# Rate Limiting
COMPANION_CHAT_RATE_LIMIT_MAX=50  # Max messages per 15 minutes

# Data Retention (days)
CONVERSATION_RETENTION_DAYS=90
BRIEFING_RETENTION_DAYS=365
INCIDENT_LOG_RETENTION_DAYS=730

# Features
ENABLE_TRANSCRIPT_EXPORT=false
ENABLE_BREAK_GLASS_ACCESS=false
ENABLE_HEALTH_CHECK=true
```

See [.env.example](.env.example) for all available options.

### Health Check Endpoint

Monitor system status:

```bash
curl http://localhost:3000/health
```

Returns status of:
- Database connectivity
- NLU models availability
- Email service configuration
- Scheduler service status

### Rate Limiting

Built-in rate limiting prevents abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Global | 100 requests | 15 minutes |
| Companion chat | 50 messages | 15 minutes |
| Auth endpoints | 5 attempts | 15 minutes |

Configurable via environment variables.

---

## API Endpoints

### Health & Status
- `GET /health` — System health check and metrics

### Authentication
- `POST /api/auth/login` — User login
- `POST /api/auth/logout` — User logout
- `POST /api/auth/refresh` — Refresh authentication token

### Chat
- `POST /api/chat` — Send message to companion (rate-limited, availability-checked)
- `GET /api/chat/history/:userId` — Get conversation history
- `GET /api/chat/availability/:userId` — Check if companion is available for user

### Briefings
- `GET /api/briefings/:companionId` — Get recent briefings
- `GET /api/briefings/:companionId/daily` — Get latest daily briefing
- `GET /api/briefings/:companionId/weekly` — Get latest weekly briefing

### Availability Management
- `GET /api/availability/:companionId` — Get companion availability schedule
- `PUT /api/availability/:companionId` — Update availability schedule (admin only)

### Administrative
- `GET /api/admin/incidents` — View incident logs (safeguarding role)
- `GET /api/admin/audit-logs` — View audit logs (admin only)
- `POST /api/admin/alerts/test` — Send test alert (admin only)

---

## Documentation

### For Implementation Teams
- [Architecture Overview](docs/ARCHITECTURE.md) — System design, modules, and data flow
- [Data Retention Policy](docs/DATA_RETENTION.md) — Privacy, retention schedules, and compliance

### For Direct Care Staff
- [Direct Care Staff One-Pager](docs/CareBridge-Companion-One-Pager-Direct-Care-Staff.md) — What alerts mean, how to respond, what NOT to do

### For Facility Leadership
- [Facility Leadership One-Pager](docs/CareBridge-Companion-One-Pager-Facility-Leadership.md) — Overview, compliance, implementation strategy
- [LGBTQ+ Affirming Policy](docs/LGBTQ_AFFIRMING_POLICY.md) — Care standards and safeguards
- [Safeguarding & Monitoring](docs/SAFEGUARDING_MONITORING.md) — Access control, audit procedures, incident tracking
- [WV Alert Response SOP](docs/WV_ALERT_RESPONSE_SOP.md) — West Virginia-specific alert protocols
- [WV Baseline Policy Profile](docs/WV_BASELINE_POLICY_PROFILE.md) — Compliance with WV regulatory requirements

---

## Project Structure

```
CareBridge-Companion/
├── docs/                          # Comprehensive documentation
│   ├── ARCHITECTURE.md
│   ├── DATA_RETENTION.md
│   ├── LGBTQ_AFFIRMING_POLICY.md
│   ├── SAFEGUARDING_MONITORING.md
│   ├── WV_ALERT_RESPONSE_SOP.md
│   └── WV_BASELINE_POLICY_PROFILE.md
├── server/                        # Backend application
│   ├── middleware/                # Express middleware
│   │   ├── errorHandler.js        # Centralized error handling
│   │   ├── availabilityCheck.js   # Enforce facility schedules
│   │   └── rateLimiter.js         # Request rate limiting
│   ├── services/                  # Core business logic
│   │   ├── automatedBriefingScheduler.js
│   │   ├── companionAvailabilityScheduler.js
│   │   ├── companionBriefingService.js
│   │   ├── nluPipeline.js
│   │   ├── safetyMonitoring.js
│   │   └── healthCheckService.js
│   ├── utils/                     # Utilities
│   │   └── logger.js              # Logging utility
│   └── app.js                     # Express app setup
├── .env.example                   # Environment template (copy to .env)
├── DEVELOPMENT.md                 # Development setup guide
├── README.md                      # This file
└── LICENSE                        # MIT License
```

---

## Alert Response Workflow

When CareBridge Companion detects a safety concern:

1. **Alert generated** → System identifies potential risk (self-harm, abuse, crisis indicators)
2. **Notification sent** → Care team receives alert with risk level and context
3. **Staff acknowledge** → On-call staff confirm receipt
4. **In-person check** → Staff conduct safety assessment per facility protocol
5. **Documentation** → Actions and observations logged in incident records
6. **Follow-up** → Continued monitoring based on facility care plan

**Critical**: Facility safety protocols always take precedence. Staff must follow their facility's escalation procedures, not rely solely on system alerts.

---

## Safety & Compliance

- **Privacy-first design**: Data stays local to the facility whenever possible
- **Encrypted storage**: All youth conversations stored securely
- **Audit trails**: All system access and actions logged
- **Mandatory reporting**: System supports facility mandatory reporting requirements
- **LGBTQ+ safety**: Affirming language and identity protection built-in
- **West Virginia compliance**: Meets WV child welfare and residential facility standards

---

## Contributing

This project is developed with privacy, safety, and youth-centered care as core values. 

To contribute:
1. Review the [Architecture Overview](docs/ARCHITECTURE.md)
2. Follow facility safeguarding and privacy guidelines
3. Ensure all code changes respect youth safety and dignity
4. Consult [LGBTQ+ Affirming Policy](docs/LGBTQ_AFFIRMING_POLICY.md) for inclusive language and practices

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Questions or Feedback?

For questions about implementation, policy, or safeguarding, consult the relevant documentation in the [docs/](docs/) folder or contact your facility's program director or safeguarding lead.

---

**Last updated**: March 2026
