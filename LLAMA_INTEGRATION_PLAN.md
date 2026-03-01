# Llama Model Integration Plan for CareBridge Companion

## Overview
This document outlines the architecture, approach, and implementation strategy for integrating your local Llama model into the CareBridge Companion system for testing and development.

---

## 1. Current State Analysis

### What We Have
- **Express.js Backend** running on port 3000 (or configurable)
- **Local Llama Model** running on your machine (via Ollama, LM Studio, or similar)
- **Middleware Stack** (auth, rate limiting, error handling, logging)
- **Service Layer** (availability scheduler, health check, facility config)
- **No AI Integration Yet** - placeholders exist for chat endpoints

### What We're Adding
- **Local LLM Integration Service** - communicates with your Llama model
- **Chat Route Handler** - processes youth messages through the model
- **Response Processing** - extracts mood & safety flags from model output
- **Test Utilities** - simple testing without full database setup

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CareBridge Express App                        │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/chat                                                 │
│  ├─ Authentication Check (JWT)                                  │
│  ├─ Rate Limiting Check                                         │
│  ├─ Availability Check (Facility schedule)                      │
│  └─ Chat Handler                                                │
│     ├─ Validate message format                                  │
│     ├─ Build system prompt (context, safety guidelines)         │
│     ├─ Call Llama Service                                       │
│     ├─ Parse & extract mood/flags from response                │
│     ├─ Save to database (future)                               │
│     ├─ Return formatted response                                │
│     └─ Log interaction (audit trail)                            │
└─────────────────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Llama Integration Service                           │
├─────────────────────────────────────────────────────────────────┤
│  LlamaService.generateResponse(message, context)                │
│  ├─ Build complete prompt with system guidelines                │
│  ├─ Call local Llama via HTTP/Ollama API                       │
│  ├─ Stream or wait for response                                 │
│  ├─ Parse and validate output                                   │
│  └─ Return structured response {text, mood, flags}              │
└─────────────────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────┐
│             Local Llama Model (Your Machine)                    │
├─────────────────────────────────────────────────────────────────┤
│  Ollama / LM Studio / vLLM                                       │
│  Running on: http://localhost:11434 (Ollama default)            │
│  Model: llama2:7b / llama2:13b / llama3 / etc.                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Integration Points

### 3.1 Environment Configuration

**File**: `.env.example` (already exists, needs updates)

```env
# Llama Model Configuration
LLAMA_ENABLED=true
LLAMA_API_URL=http://localhost:11434
LLAMA_MODEL=llama2:7b
LLAMA_TIMEOUT=30000
LLAMA_TEMPERATURE=0.7
LLAMA_MAX_TOKENS=500
LLAMA_CONTEXT_WINDOW=2048

# For streaming responses (optional)
LLAMA_STREAM=false

# Rate limiting for model calls (prevent DOS)
LLAMA_RATE_LIMIT=10
LLAMA_RATE_LIMIT_WINDOW=60000
```

### 3.2 Service Layer

**New File**: `server/services/llamaService.js`

Responsibilities:
- Connect to local Llama API
- Build system prompts with safety guidelines
- Send messages to model
- Parse responses
- Extract mood/sentiment
- Detect safety flags (self-harm, abuse, etc.)
- Handle timeouts & errors gracefully
- Cache prompts if needed

```javascript
class LlamaService {
  // Initialize connection
  constructor()
  
  // Health check - verify model is running
  isModelAvailable()
  
  // Generate response with streaming or wait
  generateResponse(userMessage, context)
  
  // Extract structured data from response
  extractSentiment(response)
  extractSafetyFlags(response)
  
  // System prompt building
  buildSystemPrompt()
  buildCompanionPrompt()
  
  // Utility functions
  sanitizeInput(message)
  validateResponse(response)
}
```

### 3.3 Route Handler

**File**: `server/app.js` (update existing placeholder)

```javascript
// POST /api/chat
app.post('/api/chat', 
  authenticate,              // JWT verification
  checkCompanionAvailability, // Facility schedule check
  chatRateLimiter,           // Global rate limit
  asyncHandler(async (req, res) => {
    const { message, companionId, userId } = req.body;
    
    // 1. Validate input
    // 2. Get/create conversation context
    // 3. Call LlamaService.generateResponse()
    // 4. Extract mood, safety flags
    // 5. Log to audit trail
    // 6. Return response + metadata
  })
);
```

### 3.4 Health Check Integration

**Update**: `server/services/healthCheckService.js`

Add Llama model health check:
```javascript
async checkLlamaModel() {
  // Verify model is running
  // Check response time
  // Log status
}
```

---

## 4. Implementation Strategy

### Phase 1: Llama Service (Standalone)
1. Create `llamaService.js`
2. Test connection to local Llama
3. Build system prompts
4. Test basic response generation
5. Build sentiment extraction

### Phase 2: Route Integration
1. Add chat route handler
2. Integrate with middleware chain
3. Add error handling
4. Add logging

### Phase 3: Response Processing
1. Extract mood/sentiment
2. Detect safety flags
3. Format response for frontend
4. Add test data generation

### Phase 4: Testing & Validation
1. Unit tests for service
2. Integration tests for endpoint
3. Performance testing (latency)
4. Mock different response scenarios

---

## 5. Data Flow Example

### User sends message: "I've been feeling really sad lately and I don't know why"

```
1. Frontend sends:
   POST /api/chat
   {
     "message": "I've been feeling really sad lately and I don't know why",
     "companionId": "companion-001",
     "userId": "youth-123"
   }

2. Backend processes:
   ✓ JWT verified
   ✓ Availability checked (within facility hours)
   ✓ Rate limit OK
   ✓ Input validated

3. LlamaService builds prompt:
   System: "You are a compassionate AI companion for youth in foster care..."
   Context: [Previous messages, if any]
   User: "I've been feeling really sad lately and I don't know why"

4. Llama model responds:
   "I hear you. Sadness can feel really overwhelming, especially when you're 
    not sure what's causing it. That's something a lot of people experience. 
    Would it help to talk about what's been different lately?"

5. Backend processes response:
   ✓ Mood detected: NEGATIVE (confidence: 0.85)
   ✓ Safety flags: None critical detected
   ✓ Response validated & safe
   ✓ Logged to audit trail

6. Response sent to frontend:
   {
     "success": true,
     "response": "I hear you. Sadness can feel...",
     "metadata": {
       "mood": "sad",
       "moodScore": 0.85,
       "safetyFlags": [],
       "timestamp": "2026-03-01T14:30:00Z",
       "responseTime": "2450ms"
     }
   }

7. Logged for staff briefing:
   - User expressed sadness
   - No safety concerns
   - Companion provided supportive response
```

---

## 6. System Prompts

### Llama Companion Prompt

```
You are CareBridge Companion, a supportive AI chatbot designed to help 
young people in foster care, group homes, and residential programs.

Your role:
- Listen with compassion and without judgment
- Validate their feelings
- Provide supportive guidance
- Never diagnose or prescribe treatment
- Be authentic and warm, but maintain professional boundaries

Important:
- Keep responses brief (1-2 sentences max)
- Use age-appropriate language
- Acknowledge their experiences
- Ask clarifying questions
- If they mention thoughts of self-harm, safety concerns, or abuse:
  - Take it seriously
  - Suggest they talk to a staff member
  - Do NOT minimize their concerns

Safety flags to watch for:
- Talk of self-harm, suicide, or death
- Mention of abuse or exploitation
- Substance use or dangerous activities
- Extreme isolation or hopelessness
```

### Mood Detection Prompt

```
Analyze the user's message and extract:
1. Overall mood (happy, sad, angry, anxious, neutral)
2. Confidence level (0.0 to 1.0)
3. Key concerns mentioned
4. Hope/Resilience indicators

Format as JSON:
{
  "mood": "string",
  "moodScore": number,
  "concerns": [list],
  "hopeful": boolean
}
```

### Safety Detection Prompt

```
Scan this message for safety concerns:
- Self-harm or suicide mentions
- Abuse or exploitation indicators
- Substance use references
- Crisis indicators
- Trafficking signs

Flag severity: CRITICAL, HIGH, MEDIUM, LOW, NONE
```

---

## 7. Configuration Checklist

Before implementation, you'll need to verify:

- [ ] Llama model is running locally
- [ ] Ollama/LM Studio is accessible at configured URL
- [ ] Model responds to test requests
- [ ] Response times are acceptable (< 5 seconds ideal)
- [ ] `.env` file configured with LLAMA_* variables
- [ ] No firewall blocking localhost connection
- [ ] Model memory/performance is adequate

---

## 8. Error Handling & Fallbacks

### If Llama is unavailable:
```javascript
// Graceful fallback to template responses
if (!llamaService.isAvailable()) {
  return {
    response: "I'm here to listen. What's on your mind?",
    fallback: true,
    message: "Model temporarily unavailable"
  };
}
```

### Timeout handling:
```javascript
LLAMA_TIMEOUT = 30000 // 30 seconds
If exceeded → Return timeout error, log issue, alert ops
```

### Invalid responses:
```javascript
If response doesn't contain expected data:
→ Log error with full response
→ Return generic supportive message
→ Alert developer to investigate
```

---

## 9. Testing Strategy

### Unit Tests (Service Layer)
```bash
# Test Llama connection
npm test -- llamaService.test.js

# Test response parsing
npm test -- moodDetection.test.js

# Test safety flag detection
npm test -- safetyDetection.test.js
```

### Integration Tests (Routes)
```bash
# Test chat endpoint with Llama
npm test -- chatEndpoint.integration.test.js

# Test with unavailable model
npm test -- llamaFallback.test.js
```

### Manual Testing
```bash
# Use curl to test
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hi, how are you?","userId":"test-123"}'

# Test with different messages
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"I want to hurt myself","userId":"test-123"}'
```

### Performance Testing
```bash
# Load test with k6 or Artillery
# Test: 10 concurrent users, 100 requests/second
# Measure: Response time, errors, Llama latency
```

---

## 10. Files to Create/Modify

### New Files:
- `server/services/llamaService.js` (200-300 lines)
- `server/utils/promptBuilder.js` (150-200 lines)
- `server/utils/responseParser.js` (150-200 lines)
- `server/tests/llama.test.js` (100-150 lines)
- `LLAMA_TESTING_GUIDE.md` (documentation)

### Files to Modify:
- `.env.example` → Add LLAMA_* variables
- `server/app.js` → Update /api/chat route handler
- `server/services/healthCheckService.js` → Add model health check
- `package.json` → Add axios dependency (if not present)

---

## 11. Dependencies Needed

All already in package.json:
- ✅ `axios` - HTTP client for Llama API
- ✅ `dotenv` - Environment variables
- ✅ `express` - Web framework
- ✅ `express-async-errors` - Async error handling

No new npm packages required!

---

## 12. Performance Expectations

With Llama 2 7B on a typical machine:

| Metric | Expected Value |
|--------|----------------|
| Response time | 2-5 seconds |
| Throughput | 1-2 req/sec per model instance |
| Memory usage | 4-8 GB (7B model) |
| Latency p95 | < 10 seconds |
| Concurrent users | 1-5 (with streaming off) |

**Considerations:**
- First request = slower (model warm-up)
- Subsequent requests = faster (cached context)
- Longer messages = longer response time
- Higher temperature = more creative, slower
- Max tokens = affects response length & time

---

## 13. Security Considerations

### Input Validation
- Maximum message length: 2000 characters
- Sanitize to prevent injection
- Validate UTF-8 encoding

### Output Validation
- Ensure response doesn't contain sensitive data
- Check for model jailbreak attempts
- Validate response format before returning

### Rate Limiting
- Per-user: 10 requests/minute
- Per-model: 30 concurrent requests max
- Timeout: 30 seconds

### Logging
- Log all messages (for auditing)
- Log safety flags by severity
- Do NOT log auth tokens in responses
- Check HIPAA compliance for message storage

---

## 14. Monitoring & Debugging

### Health Endpoint
```
GET /health
Returns: Model status, uptime, avg response time
```

### Debug Logs
```
Set LOG_LEVEL=debug to see:
- Full prompts sent to model
- Full responses from model
- Processing time for each step
- Any non-critical errors
```

### Metrics to Track
- Uptime %
- Response time (min, max, avg, p95)
- Error rate
- Safety flag accuracy
- Model availability %

---

## 15. Next Steps

### Before Implementation:
1. **Review this plan** - Does it align with your vision?
2. **Verify setup** - Confirm Llama is running and accessible
3. **Test connection** - Can we reach the model via HTTP?
4. **Confirm prompt strategy** - Are system prompts appropriate?
5. **Define success criteria** - What does "successful integration" look like?

### Questions to Answer:
- [ ] Which Llama model are you using? (size, variant)
- [ ] What's your target response latency?
- [ ] Do you want streaming responses or wait for complete response?
- [ ] Should we cache recent conversations for context?
- [ ] Do you want safety flags to block messages or just log them?
- [ ] Should mood detection be automatic or optional?

---

## Summary

**Timeline**: 2-3 days (Llama service + route + tests)
**Complexity**: Medium (straightforward HTTP integration)
**Risk**: Low (failures are handled gracefully with fallbacks)
**Testing Effort**: 4 hours (unit + integration + manual)

Once you confirm:
1. This approach works for you
2. Your Llama model is ready
3. Configuration details are clear

We can start building! 🦙✨

---

**Last Updated**: March 2026
**Status**: Planning Phase - Awaiting Approval
