# AI Features Troubleshooting Guide

## Issue: "AI service is not available" message

This message appears when the frontend can't connect to the backend server.

## Step 1: Verify Backend is Running

```bash
# Check if both containers are running
docker-compose ps

# Should show both services UP with ports:
# cockpit-backend-1   Up   0.0.0.0:3001->3001/tcp
# cockpit-webapp-1    Up   0.0.0.0:3000->3000/tcp
```

## Step 2: Test Backend from Command Line

```bash
# Test health endpoint
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}

# Test API connection
curl http://localhost:3001/api/test
# Expected: {"success":true,"status":200}

# Test AI directly
curl -X POST http://localhost:3001/api/claude \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hi","maxTokens":10}'
# Expected: {"text":"Hi! How can...","usage":{...}}
```

If ANY of these fail, the backend isn't working properly.

## Step 3: Check Browser Console

1. Open http://localhost:3000
2. Press F12 to open Developer Tools
3. Go to "Console" tab
4. Upload a CSV file
5. Look for messages like:
   ```
   [LLMService] Checking backend at: http://localhost:3001/api/test
   [LLMService] Response status: 200
   [LLMService] Response data: {success: true, status: 200}
   [FinancialQA] AI service is ready!
   ```

### Common Console Errors

#### Error: "Failed to fetch"
**Cause**: Backend not running or not accessible
**Fix**:
```bash
docker-compose restart backend
curl http://localhost:3001/health
```

#### Error: "CORS policy"
**Cause**: CORS not configured (shouldn't happen with our setup)
**Fix**: Check backend logs:
```bash
docker-compose logs backend | grep -i cors
```

#### Error: "net::ERR_CONNECTION_REFUSED"
**Cause**: Backend container not exposing port
**Fix**:
```bash
docker-compose down
docker-compose up -d
docker-compose ps  # Verify ports are mapped
```

## Step 4: Test from Browser

Open http://localhost:3000/test-ai.html

Click each button to test:
1. **Test Health** - Should show `{"status":"ok",...}`
2. **Test API** - Should show `{"success":true,...}`
3. **Test Claude** - Should show AI response

If browser tests FAIL but curl tests SUCCEED:
- It's a browser/CORS issue
- Check browser console for specific error
- Try different browser

## Step 5: Check Backend Logs

```bash
# View all backend logs
docker-compose logs backend

# Follow backend logs in real-time
docker-compose logs -f backend

# Look for errors
docker-compose logs backend | grep -i error
```

### Expected Logs
```
Backend server running on http://0.0.0.0:3001
API Base URL: http://host.docker.internal:9988/anthropic/
Model: anthropic--claude-4.5-sonnet
```

### Common Backend Errors

#### "EADDRINUSE: address already in use"
**Fix**:
```bash
lsof -ti:3001 | xargs kill -9
docker-compose up -d backend
```

#### "Cannot find module"
**Fix**:
```bash
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d
```

## Step 6: Full Reset

If nothing works, do a complete reset:

```bash
# Stop everything
docker-compose down

# Kill any processes on ports
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Rebuild from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d

# Wait and test
sleep 5
curl http://localhost:3001/health
curl http://localhost:3001/api/test
```

## Step 7: Verify Claude API Proxy

The backend needs to reach the Claude API at port 9988:

```bash
# Test from host machine
curl http://127.0.0.1:9988/anthropic/v1/messages \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-aB1cD2eF3gH4jK5lM6nP7qR8sT9uV0wX1yZ2bC3nM4pK5sL6" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"anthropic--claude-4.5-sonnet","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'

# Should return Claude API response
```

If this fails:
- Claude API proxy isn't running on port 9988
- Check your `~/.claude/settings.json` configuration
- Start the Claude API proxy

## Step 8: Manual Test in Browser

Open browser console (F12) on http://localhost:3000 and run:

```javascript
// Test health
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(d => console.log('Health:', d))
  .catch(e => console.error('Error:', e));

// Test API
fetch('http://localhost:3001/api/test')
  .then(r => r.json())
  .then(d => console.log('API:', d))
  .catch(e => console.error('Error:', e));

// Test Claude
fetch('http://localhost:3001/api/claude', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({prompt: 'Hi', maxTokens: 10})
})
  .then(r => r.json())
  .then(d => console.log('Claude:', d))
  .catch(e => console.error('Error:', e));
```

## What Should Work

After uploading a CSV file, you should be able to:

1. **See AI Assistant Section** - Scroll down to "AI Financial Assistant"
2. **No Warning Message** - Should NOT see "AI service is not available"
3. **Ask Questions** - Type question and click Send
4. **Get Responses** - AI should respond in conversation
5. **Use Quick Actions** - Click buttons like "Get Spending Insights"
6. **AI Categorization** - Click "Use AI to Categorize Transactions"

## Still Not Working?

Check these files have correct content:

1. `src/services/llmService.js` - Line 9: `this.backendUrl = 'http://localhost:3001/api';`
2. `server/index.js` - PORT should be 3001
3. `docker-compose.yml` - Backend service should map port 3001

Post your error messages and I can help debug further!
