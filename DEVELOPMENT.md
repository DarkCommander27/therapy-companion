# CareBridge Companion — Development Setup Guide

This guide will help you set up a local development environment and start contributing to CareBridge Companion.

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 16+** (LTS recommended) — [Download](https://nodejs.org)
- **npm 8+** or **yarn** — Usually comes with Node.js
- **MongoDB 5+** — [Download](https://www.mongodb.com/try/download/community)
- **Git** — [Download](https://git-scm.com)

Verify your versions:
```bash
node --version
npm --version
mongod --version
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/DarkCommander27/CareBridge-Companion.git
cd CareBridge-Companion
```

---

## 2. Install Dependencies

```bash
npm install
```

This installs all required packages listed in `package.json`, including:
- Express (web framework)
- MongoDB drivers
- Testing frameworks
- Development tools

---

## 3. Environment Configuration

Copy the example environment file and update it with your local settings:

```bash
cp .env.example .env
```

Then edit `.env` with your local configuration:

### Critical Settings for Local Development

```env
# Development environment
NODE_ENV=development
PORT=3000

# MongoDB local connection
MONGODB_URI=mongodb://localhost:27017/carebridge-companion

# Dummy credentials (safe for dev)
JWT_SECRET=dev-only-secret-key
JWT_EXPIRATION=7d

# Email (can use mock)
MOCK_EMAIL=true
EMAIL_SERVICE=gmail

# Logging
LOG_LEVEL=debug
NODE_DEBUG=carebridge-companion:*

# Use local NLU models (recommended for dev)
USE_LOCAL_INFERENCE=true
NLU_MODELS_PATH=./models

# Feature flags
ENABLE_HEALTH_CHECK=true
```

---

## 4. Start MongoDB

**Option A: Using MongoDB locally**

```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Linux
sudo systemctl start mongod

# On Windows
net start MongoDB

# Or run in foreground
mongod
```

**Option B: Using Docker**

```bash
docker run -d -p 27017:27017 --name carebridge-mongo mongo:latest
```

Verify MongoDB is running:
```bash
mongo --version
```

---

## 5. Create Local Database (Optional)

```bash
mongo
# In mongo shell:
> use carebridge-companion
> db.createCollection("companions")
> exit
```

---

## 6. Start Development Server

```bash
npm run dev
```

Expected output:
```
[timestamp] [INFO] Server listening on port 3000
[timestamp] [INFO] Connected to MongoDB
[timestamp] [INFO] Initializing automated briefing scheduler...
```

The server is now running at `http://localhost:3000`

---

## 7. Verify Health Check

Test that the system is healthy:

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
    "database": { "healthy": true, ... },
    "nlu": { "healthy": true, ... },
    "email": { "healthy": true, ... },
    "scheduler": { "healthy": true, ... }
  }
}
```

---

## 8. Project Structure

```
CareBridge-Companion/
├── server/
│   ├── middleware/                    # Express middleware
│   │   ├── errorHandler.js
│   │   ├── availabilityCheck.js
│   │   └── rateLimiter.js
│   ├── services/                      # Business logic
│   │   ├── automatedBriefingScheduler.js
│   │   ├── companionAvailabilityScheduler.js
│   │   ├── companionBriefingService.js
│   │   ├── healthCheckService.js
│   │   ├── nluPipeline.js
│   │   └── safetyMonitoring.js
│   ├── models/                        # MongoDB models
│   │   ├── CompanionProfile.js
│   │   ├── Conversation.js
│   │   ├── IncidentLog.js
│   │   └── User.js
│   ├── routes/                        # API endpoints
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── briefings.js
│   │   └── health.js
│   ├── utils/                         # Utilities
│   │   └── logger.js
│   └── app.js                         # Express app setup
├── docs/                              # Project documentation
├── .env.example                       # Environment template
├── package.json
└── README.md
```

---

## 9. Common Development Tasks

### Run Tests

```bash
npm test
```

### Run Linter

```bash
npm run lint
```

### Watch Mode (Auto-reload on file changes)

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### View Logs

```bash
# Watch all logs
tail -f logs/combined.log

# View only errors
tail -f logs/error.log

# View audit logs
tail -f logs/audit.log
```

---

## 10. Testing the Chat Endpoint

Create a test file `test-chat.js`:

```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  }
};

const data = JSON.stringify({
  userId: 'test-user-1',
  message: 'I\'ve been feeling really anxious lately'
});

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('Response:', JSON.parse(responseData));
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(data);
req.end();
```

Run it:
```bash
node test-chat.js
```

---

## 11. Debugging

### Using VS Code Debugger

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "CareBridge Dev",
      "program": "${workspaceFolder}/server/app.js",
      "restart": true,
      "runtimeArgs": ["--nolazy"],
      "port": 9229,
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

Then: Press `F5` to start debugging.

### Using Node Inspector

```bash
node --inspect server/app.js
```

Then visit `chrome://inspect` in Chrome DevTools.

---

## 12. Database Management

### Access MongoDB Shell

```bash
mongo
```

### Create a Test Companion Profile

```javascript
use carebridge-companion
db.companionprofiles.insertOne({
  companionName: "Test Companion",
  userId: "test-user-1",
  type: "youth",
  createdAt: new Date(),
  availabilitySchedule: {
    enabled: true,
    timeWindows: [
      {
        name: "Available",
        startTime: "00:00",
        endTime: "23:59",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
      }
    ]
  }
})
```

---

## 13. Contributing Guidelines

Before submitting a pull request:

1. **Create a feature branch**: `git checkout -b feature/your-feature-name`
2. **Run tests**: `npm test`
3. **Run linter**: `npm run lint`
4. **Review your changes**: Check README/docs updates if needed
5. **Commit with clear messages**: `git commit -m "Add [feature]: description"`
6. **Push to Github**: `git push origin feature/your-feature-name`
7. **Create pull request** on GitHub

---

## 14. Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### MongoDB Connection Refused
```bash
# Make sure MongoDB is running
mongod

# Or check MongoDB logs
tail -f /usr/local/var/log/mongodb/mongo.log
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Loading
- Verify `.env` exists in project root
- Restart dev server: `npm run dev`
- Check `.env` file is not in `.gitignore`

---

## 15. Additional Resources

- [Express.js Documentation](https://expressjs.com)
- [MongoDB Documentation](https://docs.mongodb.com)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides)
- [Project Architecture](docs/ARCHITECTURE.md)
- [Safety & Compliance](docs/SAFEGUARDING_MONITORING.md)

---

**Need Help?**

- Check existing issues on [GitHub Issues](https://github.com/DarkCommander27/CareBridge-Companion/issues)
- Review documentation in `/docs`
- Review error logs in `/logs`

Happy coding! 🚀
