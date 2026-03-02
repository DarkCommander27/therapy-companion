# CareBridge Companion

A supportive AI check-in companion designed to help youth in residential care engage with care teams through empathetic, safe conversations. CareBridge Companion generates safety briefings and alerts that help staff respond quickly and consistently to youth needs.

**Status:** ✅ **Production Ready** | Full application security hardening complete (80/80 tests passing)

---

## What CareBridge Companion Is

- **A supportive check-in tool**: Youth can talk to the companion anytime, expressing thoughts, feelings, and concerns
- **A team briefing system**: Generates daily/weekly summaries of youth check-ins to help care teams stay informed
- **A safety alert system**: Detects and flags potential safety concerns (self-harm language, abuse indicators, crisis signals) for immediate staff response
- **Privacy-first**: Designed for local deployment with local inference models to keep data facility-controlled
- **LGBTQ+ affirming**: Supports inclusive, non-judgmental conversations with youth of all identities
- **Secure by default**: Multi-layer security with XSS prevention, input sanitization, password hashing, and data encryption

---

## Clear Boundaries: What It Is NOT

- ❌ **Not therapy or diagnosis**: Provides supportive conversation, not clinical assessment
- ❌ **Not a crisis hotline**: Alerts require human staff follow-up per facility protocols
- ❌ **Not staff-to-youth messaging**: Staff cannot send messages; youth communicate only with the companion
- ❌ **Not a replacement for clinical care**: Complements but does not replace therapists, counselors, or care plans

---

## Quick Start

### Prerequisites
- **Node.js 16+** (18+ recommended) — [Download](https://nodejs.org)
- **npm 8+** — Usually included with Node.js
- **MongoDB 5+** (local or remote) — [Download MongoDB](https://www.mongodb.com)
- **Optional**: Local inference models for privacy-first AI

### Installation

```bash
# Clone the repository
git clone https://github.com/DarkCommander27/CareBridge-Companion.git
cd CareBridge-Companion

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and other settings
```

### Run the Application

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The application will be available at **http://localhost:3000**

### Verify Installation

```bash
# Check server health
curl http://localhost:3000/health

# View logs
tail -f logs/*.log
```

---

## Key Features

### For Youth
- 🤖 **24/7 supportive check-ins** with a caring companion
- 🔐 **Secure conversations** with PIN or password authentication
- 🎨 **Customizable avatars and themes** for personalization
- 📱 **Multi-device support** with cross-device history sync
- ✅ **LGBTQ+ affirming environment** with inclusive language

### For Direct Care Staff
- 📊 **Dashboard** with statistics and quick overview
- 🔍 **Advanced conversation search** with filters for mood, topics, concerns
- ⚠️ **Real-time safety alerts** for concerning messages with severity levels
- 📝 **Staff notes** to document observations and follow-ups
- 📋 **Follow-up tracking** to ensure timely interventions
- ✅ **Acknowledge & close** conversations after addressing concerns

### For Facility Leadership
- 🛡️ **Comprehensive safety monitoring** with incident tracking
- 📊 **Statistics dashboard** with youth metrics and trends
- 🔐 **Audit logs** showing all system access and actions
- ⚙️ **Configurable alert thresholds** by severity level
- ⏰ **Facility-controlled availability scheduling** (lights out, meal times, therapy hours)
- 🔑 **Role-based access control** (admin, manager, staff, viewer)
- 📋 **LGBTQ+ affirming documentation** support
- 🗂️ **West Virginia compliance** baseline requirements

---

## Security Features

CareBridge Companion includes comprehensive security hardening:

| Feature | Implementation | Tests |
|---------|---|---|
| **XSS Prevention** | Input sanitization with whitelist | ✅ 12 tests |
| **NoSQL Injection** | Query operator sanitization | ✅ 5 tests |
| **Password Security** | bcryptjs with 10-round salting | ✅ 6 tests |
| **Data Encryption** | AES-256 for sensitive fields | ✅ 5 tests |
| **HTTP Security Headers** | HSTS, CSP, X-Frame-Options | ✅ 8 tests |
| **PII Masking** | Email, phone, credit card masking | ✅ 5 tests |
| **Rate Limiting** | Configurable request limits | ✅ 3 tests |
| **CORS Protection** | Origin whitelisting | ✅ 2 tests |
| **Error Handling** | Sensitive data protection in errors | ✅ 8 tests |
| **Integration Tests** | End-to-end security workflows | ✅ 27 tests |

**All 80 security tests passing** ✅

---

## Architecture

### Tech Stack
```
Frontend:
  - HTML5 / CSS3 / Vanilla JavaScript
  - Multi-page interface (chat, dashboard, staff login)
  - Responsive design for desktop and tablet

Backend:
  - Express.js 4.x (web framework)
  - Node.js 16+ (runtime)
  - MongoDB 5+ (database)
  - JWT (authentication)
  
Optional AI:
  - Ollama / LM Studio (local model serving)
  - Llama 3.1 / Similar models
  - See LLAMA_INTEGRATION_PLAN.md for details
```

### Core Services
```
Chat Service         → Real-time conversation handling
Safety Monitor       → Detects concerning messages and flags
Briefing Generator   → Automated daily/weekly summaries
Health Checker       → System status and metrics
Availability Check   → Enforces facility schedules
Rate Limiter        → Prevents abuse
```

### Middleware Stack
```
Security Headers    → HSTS, CSP, X-Frame-Options
CORS Protection     → Origin whitelisting
Input Sanitization  → XSS & NoSQL injection prevention
Rate Limiting       → Request throttling
Error Handling      → Centralized error handler
Request Logging     → Audit trail
```

---

## Project Structure

```
CareBridge-Companion/
├── client/                        # Frontend files
│   ├── index.html                 # Main chat interface
│   ├── chat.js                    # Chat logic
│   ├── staff-login.html           # Staff login page
│   ├── dashboard.html             # Staff dashboard
│   ├── dashboard.js               # Dashboard logic
│   ├── styles.css                 # Base styles
│   └── themes.js                  # Theme management
│
├── server/                        # Backend application
│   ├── app.js                     # Express app setup
│   ├── middleware/                # Express middleware
│   │   ├── errorHandler.js        # Error handling
│   │   ├── sanitization.js        # XSS & injection prevention
│   │   ├── securityHeaders.js     # HTTP security headers
│   │   ├── rateLimiter.js         # Rate limiting
│   │   ├── availabilityCheck.js   # Facility schedule enforcement
│   │   └── validation.js          # Input validation
│   ├── routes/                    # API endpoints
│   │   ├── chatRoutes.js          # Chat endpoints
│   │   ├── userRoutes.js          # User auth & settings
│   │   ├── staffRoutes.js         # Staff auth & management
│   │   └── conversationRoutes.js  # Dashboard data access
│   ├── models/                    # Database models
│   ├── services/                  # Business logic
│   ├── utils/                     # Utilities & helpers
│   └── schemas/                   # Input validation schemas
│
├── tests/                         # Test suites
│   ├── phase4Security.test.js     # Security tests (53 tests)
│   └── phase5Integration.test.js  # Integration tests (27 tests)
│
├── docs/                          # Comprehensive documentation
│   ├── ARCHITECTURE.md
│   ├── DATA_RETENTION.md
│   ├── SECURITY_IMPLEMENTATION.md
│   ├── LGBTQ_AFFIRMING_POLICY.md
│   └── ...
│
├── .env.example                   # Environment template
├── DEVELOPMENT.md                 # Development guide
├── LLAMA_INTEGRATION_PLAN.md      # AI model integration
├── package.json                   # Dependencies
└── README.md                      # This file
```

---

## API Endpoints

### Authentication
```
POST   /api/users/login           - Youth login (PIN/password)
POST   /api/staff/login           - Staff login (email/username)
POST   /api/staff/register        - Staff registration
GET    /api/staff/profile         - Get staff profile (auth required)
```

### Chat
```
POST   /api/chat                  - Send message to companion
GET    /api/chat/:sessionId       - Get conversation history
POST   /api/chat/start            - Create new chat session
POST   /api/chat/:sessionId/end   - End session
```

### Conversations (Staff Dashboard)
```
GET    /api/conversations         - List all conversations (paginated)
GET    /api/conversations/:sessionId - Get full conversation details
POST   /api/conversations/search  - Advanced search
POST   /api/conversations/:sessionId/acknowledge - Mark as reviewed
POST   /api/conversations/:sessionId/add-note - Add staff notes
GET    /api/conversations/stats/overview - Dashboard statistics
```

### System
```
GET    /health                    - Health check and metrics
GET    /health/detailed           - Detailed system health (if enabled)
GET    /metrics                   - Performance metrics (if enabled)
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

**Essential settings:**
```env
# Server
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/carebridge-companion

# Security
JWT_SECRET=your-secret-key-change-in-production
CORS_ORIGIN=http://localhost:3000

# AI Features (optional)
LLAMA_ENABLED=false
LLAMA_API_URL=http://localhost:11434

# Health Check
ENABLE_HEALTH_CHECK=true
```

See `.env.example` for all available options.

---

## Testing

Run the complete test suite:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/phase4Security.test.js
npm test -- tests/phase5Integration.test.js

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test Results:**
```
Test Suites: 2 passed
Tests:       80 passed, 0 failed
  ✅ Phase 4: 53 security tests (sanitization, encryption, headers, etc.)
  ✅ Phase 5: 27 integration tests (end-to-end workflows)
Time:        ~11 seconds
```

---

## Development

### Local Setup

For detailed development instructions, see [DEVELOPMENT.md](DEVELOPMENT.md):

- Environment configuration
- Database initialization
- Running in development mode
- Debugging and troubleshooting
- Contributing guidelines

### Local AI Integration

To integrate a local AI model:

1. Install Ollama: https://ollama.ai
2. Pull a model:
   ```bash
   ollama pull llama2
   ```
3. Start Ollama:
   ```bash
   ollama serve
   ```
4. Enable in `.env`:
   ```env
   LLAMA_ENABLED=true
   LLAMA_API_URL=http://localhost:11434
   ```
5. Restart the server

See [LLAMA_INTEGRATION_PLAN.md](LLAMA_INTEGRATION_PLAN.md) for details.

---

## Deployment

### Production Checklist

Before deploying to production:

- [ ] MongoDB instance running (on secure network)
- [ ] Environment variables configured (strong JWT secret)
- [ ] HTTPS/TLS enabled
- [ ] CORS origins configured for your domain
- [ ] Rate limits configured for your load
- [ ] Backup strategy in place
- [ ] Monitoring/alerting setup
- [ ] Staff training completed
- [ ] Safety protocols documented
- [ ] Security audit completed

### Cloud Deployment

The application can be deployed to:
- **AWS**: EC2 + RDS (MongoDB)
- **Azure**: App Service + Cosmos DB
- **Heroku**: Using Procfile (included)
- **DigitalOcean**: Droplets + Managed Database
- **On-premises**: Local server with backup

---

## Security & Compliance

### Privacy & Data Protection
- ✅ Encrypted data storage (AES-256)
- ✅ Secure password hashing (bcrypt)
- ✅ PII masking in logs
- ✅ Data retention policies with automatic deletion
- ✅ LGBTQ+ identity protection

### Compliance
- ✅ HIPAA considerations (encryption, PII masking)
- ✅ GDPR considerations (data protection, transparency)
- ✅ West Virginia child welfare standards
- ✅ SOC 2 ready (audit logs, access control)
- ✅ OWASP Top 10 protections

### Safeguarding
- ✅ Role-based access control
- ✅ Complete audit trails
- ✅ Mandatory reporting support
- ✅ Youth identity protection
- ✅ Staff accountability logging

---

## Documentation

### Implementation Teams
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design and data flow
- [SECURITY_IMPLEMENTATION.md](docs/SECURITY_IMPLEMENTATION.md) — Security features and testing
- [DATA_RETENTION.md](docs/DATA_RETENTION.md) — Privacy and data retention policies

### Care Staff
- [Direct Care One-Pager](docs/CareBridge-Companion-One-Pager-Direct-Care-Staff.md) — How to use and respond to alerts
- [LGBTQ+ Affirming Policy](docs/LGBTQ_AFFIRMING_POLICY.md) — Inclusive language and practices

### Facility Leadership
- [Leadership One-Pager](docs/CareBridge-Companion-One-Pager-Facility-Leadership.md) — Overview and implementation
- [Safeguarding & Monitoring](docs/SAFEGUARDING_MONITORING.md) — Access control and audit procedures
- [WV Alert Response SOP](docs/WV_ALERT_RESPONSE_SOP.md) — West Virginia alert protocols
- [WV Baseline Policy](docs/WV_BASELINE_POLICY_PROFILE.md) — Regulatory compliance

---

## Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill the process using port 3000
kill -9 <PID>

# Try starting again
npm start
```

### Database connection errors
```bash
# Verify MongoDB is running
ps aux | grep mongod

# Check connection string in .env
# Verify database is accessible
mongo <MONGODB_URI>
```

### Tests failing
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests with detailed output
npm test -- --verbose

# Run specific test for debugging
npm test -- tests/phase5Integration.test.js --verbose
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for more troubleshooting.

---

## Contributing

We welcome contributions that strengthen privacy, safety, and youth-centered care.

### Before Contributing
1. Read [ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. Review [LGBTQ_AFFIRMING_POLICY.md](docs/LGBTQ_AFFIRMING_POLICY.md)
3. Ensure code respects youth safety and dignity
4. Run full test suite: `npm test`

### Contribution Process
1. Fork the repository
2. Create a feature branch
3. Make changes with clear commit messages
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Submit pull request with description

---

## License

MIT License — See [LICENSE](LICENSE) for details

---

## Support & Questions

For questions about:
- **Implementation**: See [docs/](docs/) folder
- **Development**: See [DEVELOPMENT.md](DEVELOPMENT.md)
- **AI Integration**: See [LLAMA_INTEGRATION_PLAN.md](LLAMA_INTEGRATION_PLAN.md)
- **Safety & Policy**: Contact your facility's safeguarding lead

---

**Last Updated:** March 2026

**Status:** Production Ready ✅ | All 80 security tests passing ✅ | Client-Server integration complete ✅
