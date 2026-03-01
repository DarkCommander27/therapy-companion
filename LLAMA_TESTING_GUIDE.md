# Llama 3.1 Streaming Chat Integration - Testing Guide

## Overview

This guide walks you through testing the fully integrated Llama 3.1 model with:
- ✅ Streaming responses (real-time text chunks)
- ✅ Full conversation history (persistent storage)
- ✅ Mood detection (automatic mood analysis)
- ✅ Safety flag detection (critical alerts)
- ✅ Staff briefings (auto-generated summaries)

**Test Timeline:** ~30 minutes  
**Prerequisites:** Llama running, MongoDB running, Node dependencies installed

---

## 1. Pre-Test Checklist

### Verify Ollama is Running

```bash
# Check if Ollama is accessible
curl http://localhost:11434/api/tags

# Expected response:
# {
#   "models": [
#     {
#       "name": "llama2:7b",
#       "modified_time": "...",
#       "size": ...
#     }
#   ]
# }
```

If this fails, start Ollama:
```bash
ollama serve
```

### Verify MongoDB is Running

```bash
# Test connection
mongoose connection status
# Or: mongosh

# Should show database connected
```

### Verify Node Server is Running

```bash
# Start development server
npm run dev

# Or: node server/app.js

# Watch for:
# ✓ Connected to MongoDB
# ✓ Rate limiting middleware app
# ✓ Availability check middleware applied
# ✓ Chat routes enabled - streaming and full history storage active
```

---

## 2. Test 1: Health Check Endpoint

### Verify Llama Model Health

```bash
# Check if Llama model is healthy
curl http://localhost:3000/api/chat/health

# Expected response (200 OK):
{
  "healthy": true,
  "model": "llama2:7b",
  "temperature": 0.7,
  "maxTokens": 500,
  "lastHealthCheck": "2026-03-01T14:30:00Z",
  "lastResponseTimeMs": 1250
}

# If unhealthy (503):
{
  "healthy": false,
  "message": "Model unavailable - check Ollama"
}
```

**How to debug if unhealthy:**
1. Verify Ollama is running: `ollama serve`
2. Check LLAMA_API_URL in `.env` (should be `http://localhost:11434`)
3. Check LLAMA_MODEL name matches: `ollama list`
4. Check network connectivity: `curl http://localhost:11434/api/tags`

---

## 3. Test 2: Create Chat Session

### Start a New Conversation

```bash
curl -X POST http://localhost:3000/api/chat/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "youth-001",
    "companionId": "carebridge-companion-01"
  }'

# Expected response (201 Created):
{
  "success": true,
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "userId": "youth-001",
  "companionId": "carebridge-companion-01",
  "startTime": "2026-03-01T14:30:00Z"
}

# Save the sessionId - you'll need it for next tests!
```

**Note:** Each `POST /api/chat/start` creates a new session. Use the returned `sessionId` for all subsequent messages in that session.

---

## 4. Test 3: Send Chat Message (Non-Streaming)

### Send a Simple Message

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I've been feeling really sad lately",
    "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "userId": "youth-001"
  }'

# Expected response (200 OK):
{
  "success": true,
  "response": "I hear you. Sadness can feel really overwhelming, and it's valid to feel this way...",
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "metadata": {
    "userMessageId": 0,
    "processingTimeMs": 2450,
    "tokensUsed": 87,
    "mood": "sad",
    "moodScore": 0.85,
    "safetyFlags": null,
    "timestamp": "2026-03-01T14:30:15Z"
  }
}
```

**What to verify:**
- ✅ Response is empathetic and helpful
- ✅ Mood correctly detected as "sad"
- ✅ No safety flags (not a crisis)
- ✅ Response time is reasonable (< 5 seconds)

---

## 5. Test 4: Send Chat Message with Safety Concern (Critical Test)

### Test Safety Flag Detection

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to hurt myself. I can't take the pain anymore.",
    "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "userId": "youth-001"
  }'

# Expected response (200 OK with warning):
{
  "success": true,
  "response": "I hear you, and I'm so glad you're telling me this. This is really important - your pain matters...",
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "metadata": {
    "mood": "desperate",
    "moodScore": 0.95,
    "safetyFlags": {
      "detected": true,
      "flags": ["self-harm-mention", "extreme-distress"],
      "severity": "critical",
      "requiresImmedateAction": true
    },
    "timestamp": "2026-03-01T14:30:30Z"
  }
}

# Check logs - should show:
# ⚠️ SAFETY FLAG - Severity: critical, Flags: self-harm-mention, extreme-distress
# 🚨 CRITICAL SAFETY ALERT - UserID: youth-001, SessionID: ...
```

**Server-side logging:**
```
⚠️ SAFETY FLAG - SessionID: f47ac10b..., Severity: critical, Flags: self-harm-mention, extreme-distress
🚨 CRITICAL SAFETY ALERT - UserID: youth-001, SessionID: f47ac10b...
✓ User message saved - SessionID: f47ac10b...
```

**What this demonstrates:**
- ✅ Safety flag detection works for self-harm mentions
- ✅ Severity correctly elevated to "critical"
- ✅ Companion still provides compassionate response
- ✅ Server logs alert for staff attention
- ✅ Message still saved to database

---

## 6. Test 5: Streaming Response

### Test Real-time Streaming (Optional - requires streaming client)

```bash
# Using curl with streaming
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "message": "What helps you feel better when you're sad?",
    "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "userId": "youth-001",
    "stream": true
  }'

# Expected response (streaming):
data: {"chunk":"I","isDone":false,"tokenCount":1}
data: {"chunk":" think","isDone":false,"tokenCount":2}
data: {"chunk":" different","isDone":false,"tokenCount":3}
data: {"chunk":" things","isDone":false,"tokenCount":4}
...
data: {"done":true,"sessionId":"...","processingTimeMs":2800,"safetyFlags":null}
```

**Client-side implementation (JavaScript):**
```javascript
const response = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
  },
  body: JSON.stringify({
    message: "What helps you feel better?",
    sessionId: "...",
    userId: "youth-001"
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullText = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  lines.forEach(line => {
    if (line.startsWith('data: ')) {
      const json = JSON.parse(line.substring(6));
      fullText += json.chunk;
      
      // Update UI in real-time
      console.log(fullText);
      
      if (json.done) {
        console.log('Stream complete!');
      }
    }
  });
}
```

---

## 7. Test 6: Retrieve Conversation History

### Get Full Conversation Details

```bash
curl http://localhost:3000/api/chat/f47ac10b-58cc-4372-a567-0e02b2c3d479

# Expected response:
{
  "success": true,
  "session": {
    "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "userId": "youth-001",
    "startTime": "2026-03-01T14:30:00Z",
    "endTime": null,
    "duration": 5
  },
  "messages": [
    {
      "role": "user",
      "content": "Hi, I've been feeling really sad lately",
      "timestamp": "2026-03-01T14:30:15Z",
      "analysis": {
        "mood": "sad",
        "moodScore": 0.85,
        "sentiment": "negative"
      },
      "safetyFlags": {
        "detected": false,
        "flags": [],
        "severity": "low"
      }
    },
    {
      "role": "assistant",
      "content": "I hear you. Sadness can feel really overwhelming...",
      "timestamp": "2026-03-01T14:30:20Z"
    },
    {
      "role": "user",
      "content": "I want to hurt myself. I can't take the pain anymore.",
      "timestamp": "2026-03-01T14:30:30Z",
      "analysis": {
        "mood": "desperate",
        "moodScore": 0.95
      },
      "safetyFlags": {
        "detected": true,
        "flags": ["self-harm-mention", "extreme-distress"],
        "severity": "critical",
        "requiresImmedateAction": true
      }
    }
  ],
  "analysis": {
    "overallMood": "desperate",
    "moodTrend": "declining",
    "primaryConcerns": ["emotional-distress", "self-harm-risk"],
    "hasHarmIndicators": true,
    "requiresStaffFollowUp": true
  },
  "summary": {
    "brief": "Youth expressed sad mood (declining). Concerns: emotional-distress, self-harm-risk. ⚠️ REQUIRES STAFF FOLLOW-UP",
    "staffNotes": "Check in with youth today about emotional distress and self-harm concerns..."
  }
}
```

**What this demonstrates:**
- ✅ Full message history stored in database
- ✅ Each message has mood analysis
- ✅ Safety flags are preserved
- ✅ Conversation trend detected (declining mood)
- ✅ Auto-generated summary for staff

---

## 8. Test 7: Staff Follow-Up Endpoint

### Retrieve Conversations Needing Review

```bash
curl http://localhost:3000/api/chat/staff/followup

# Expected response:
{
  "success": true,
  "pending": [
    {
      "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "userId": "youth-001",
      "duration": 5,
      "summary": "Check in with youth today about emotional distress and self-harm concerns...",
      "flagCount": 2,
      "unacknowledgedCount": 2
    }
  ],
  "count": 1
}
```

**What this demonstrates:**
- ✅ Staff can see all flagged conversations
- ✅ Unacknowledged flags are visible
- ✅ Summary helps staff prioritize
- ✅ Easy handoff to next shift

---

## 9. Test 8: User Conversation History

### Get User's Past Conversations

```bash
curl http://localhost:3000/api/chat/user/youth-001?limit=5

# Expected response:
{
  "success": true,
  "userId": "youth-001",
  "conversations": [
    {
      "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "startTime": "2026-03-01T14:30:00Z",
      "duration": 5,
      "messageCount": 3,
      "mood": "desperate",
      "summary": "Youth expressed sad mood (declining)..."
    },
    {
      "sessionId": "a1b2c3d4-e5f6-...",
      "startTime": "2026-03-01T10:15:00Z",
      "duration": 12,
      "messageCount": 8,
      "mood": "anxious",
      "summary": "Youth expressed anxious mood about upcoming event..."
    }
  ],
  "count": 2
}
```

**What this demonstrates:**
- ✅ Can see youth's conversation history
- ✅ Trends visible (mood progression)
- ✅ Supports longitudinal analysis
- ✅ Helps therapists prepare for sessions

---

## 10. Test 9: End Session

### Properly Close a Conversation

```bash
curl -X POST http://localhost:3000/api/chat/f47ac10b-58cc-4372-a567-0e02b2c3d479/end

# Expected response:
{
  "success": true,
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "duration": 12,
  "messageCount": 5,
  "hasFlags": true
}
```

**What happens when session ends:**
- ✅ Final session duration calculated
- ✅ Conversation analysis updated
- ✅ Summary regenerated
- ✅ Ready for staff briefing

---

## 11. Test 10: Acknowledge Staff Review

### Mark Review as Complete

```bash
curl -X POST http://localhost:3000/api/chat/f47ac10b-58cc-4372-a567-0e02b2c3d479/acknowledge \
  -H "Content-Type: application/json" \
  -d '{
    "staffMemberId": "staff-maria-98"
  }'

# Expected response:
{
  "success": true,
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "acknowledgedBy": "staff-maria-98",
  "acknowledgedAt": "2026-03-01T15:00:00Z"
}
```

**What this demonstrates:**
- ✅ Staff can acknowledge they reviewed conversation
- ✅ Audit trail of who reviewed and when
- ✅ Prevents duplicate work across shifts

---

## 12. Quick Test Script (Automated)

Save this as `test-chat.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== CareBridge Chat Testing ==="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
curl -s $BASE_URL/api/chat/health | jq .
echo ""

# Test 2: Create Session
echo "Test 2: Create Session"
SESSION=$(curl -s -X POST $BASE_URL/api/chat/start \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-1"}' | jq -r '.sessionId')
echo "Created session: $SESSION"
echo ""

# Test 3: Send Message
echo "Test 3: Send Message"
curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Hi, how are you?\",\"sessionId\":\"$SESSION\",\"userId\":\"test-user-1\"}" | jq .
echo ""

# Test 4: Send Critical Message
echo "Test 4: Safety Flag Test"
curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"I want to hurt myself\",\"sessionId\":\"$SESSION\",\"userId\":\"test-user-1\"}" | jq '.metadata.safetyFlags'
echo ""

# Test 5: Get History
echo "Test 5: Get Conversation History"
curl -s $BASE_URL/api/chat/$SESSION | jq '.messages | length'
echo "messages in conversation"
echo ""

echo "=== Tests Complete ==="
```

Run it:
```bash
chmod +x test-chat.sh
./test-chat.sh
```

---

## 13. Performance Benchmarks

After running tests, you should see:

| Metric | Target | Actual |
|--------|--------|--------|
| Health check response time | < 100ms | ___ |
| New session creation | < 500ms | ___ |
| First message response | 2-5s | ___ |
| Subsequent messages | 1.5-3s | ___ |
| Total tokens generated | 50-500 | ___ |
| Safety flag detection | Instant | ___ |

---

## 14. Debugging

### Enable Debug Logging

```javascript
// In .env
LOG_LEVEL=debug

// Then search logs for:
// [DEBUG] ...full prompts sent
// [DEBUG] ...model response received
// [DEBUG] ...safety analysis
```

### Check Database

```bash
# Connect to MongoDB
mongosh carebridge-companion

# View conversations
db.conversations.find().pretty()

# View a specific conversation
db.conversations.findOne({ sessionId: "..." }).pretty()

# Count messages
db.conversations.aggregate([{$group: {_id: null, totalMessages: {$sum: {$size: "$messages"}}}}])
```

### Check Ollama Logs

```bash
# Ollama logs (macOS):
tail -f ~/.ollama/logs/server.log

# Linux:
journalctl -u ollama -f

# Watch for:
# - Model loading times
# - Input/output tokens
# - Generation speed
```

---

## 15. Troubleshooting

### Q: Responses are slow (> 10 seconds)

**Check:** 
- Is Ollama running? `curl http://localhost:11434/api/tags`
- What's your system memory? (7B model needs ~6GB)
- Is the model loaded? (First request is slowest)

**Solution:**
- Increase system resources
- Use smaller model if needed
- Disable streaming to reduce overhead

### Q: "Model unavailable" error

**Check:**
- Is Ollama running? `ollama serve`
- Is LLAMA_API_URL correct in `.env`?
- Can you reach it? `curl http://localhost:11434/api/tags`

**Solution:**
- Verify Ollama is accessible
- Check firewall settings
- Verify model is installed: `ollama list`

### Q: Safety flags not detected

**Check:**
- Are the keywords in the detection list?
- Is the message flagged in logs?
- Check `llamaService.detectSafetyFlags()` implementation

**Solution:**
- Add more keywords to detection patterns
- Use Llama to classify safety concerns instead
- Review false negatives

### Q: Streaming not working

**Check:**
- Is LLAMA_STREAM=true in `.env`?
- Is client expecting `text/event-stream`?
- Check browser console for errors

**Solution:**
- Verify streaming enabled
- Check EventSource/fetch configuration
- Test with non-streaming first

---

## Next Steps After Testing

Once all tests pass:

1. ✅ Connect to frontend (React/Vue app)
2. ✅ Test with real users (start with staff)
3. ✅ Monitor safety flag accuracy
4. ✅ Collect feedback and iterate
5. ✅ Deploy to production

---

**Test Status:**  
- [ ] Health check working
- [ ] Session creation working
- [ ] Basic messages working
- [ ] Safety flags working
- [ ] Streaming working
- [ ] History retrieval working
- [ ] Staff endpoints working
- [ ] Closure/acknowledgment working

✅ **All tests passed?** You're ready for production! 🚀
