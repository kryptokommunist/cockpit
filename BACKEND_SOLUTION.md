# Backend Solution for CORS Issue

## ✅ Problem Solved!

The CORS issue has been completely eliminated by adding a backend proxy server.

## Architecture

```
Browser (localhost:3000)
    ↓ (no CORS issue - same origin policy satisfied)
Backend Server (localhost:3001)
    ↓ (server-to-server - no CORS)
Claude API (127.0.0.1:9988)
```

## What Was Built

### Backend Server (`server/index.js`)
- Express.js server running on port 3001
- CORS enabled for frontend at `localhost:3000`
- Proxy endpoints for Claude API calls
- No client-side API configuration needed

### Key Endpoints

1. **`GET /health`** - Health check
   ```bash
   curl http://localhost:3001/health
   # {"status":"ok","timestamp":"2026-01-25T19:39:22.342Z"}
   ```

2. **`GET /api/test`** - Test Claude API connection
   ```bash
   curl http://localhost:3001/api/test
   # {"success":true,"status":200}
   ```

3. **`POST /api/claude`** - Send prompts to Claude
   ```bash
   curl -X POST http://localhost:3001/api/claude \
     -H "Content-Type: application/json" \
     -d '{"prompt":"Hello","maxTokens":100}'
   ```

4. **`POST /api/categorize-batch`** - Batch categorize transactions
   ```bash
   curl -X POST http://localhost:3001/api/categorize-batch \
     -H "Content-Type: application/json" \
     -d '{"transactions":[...]}'
   ```

### Frontend Changes

The `LLMService` now calls the backend instead of Claude API directly:
- **Before**: Browser → Claude API (blocked by CORS)
- **After**: Browser → Backend → Claude API (no CORS)

### Docker Setup

Two containers running:
1. **webapp** (port 3000) - Vite frontend
2. **backend** (port 3001) - Express proxy server

Both containers can access `host.docker.internal:9988` for the Claude API.

## How to Use

### Start the Application

```bash
docker-compose up -d
```

Both services start automatically:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Configuration

Backend configuration is set via environment variables in `docker-compose.yml`:

```yaml
environment:
  - ANTHROPIC_BASE_URL=http://host.docker.internal:9988/anthropic/
  - ANTHROPIC_AUTH_TOKEN=sk-aB1cD2eF3gH4jK5lM6nP7qR8sT9uV0wX1yZ2bC3nM4pK5sL6
  - ANTHROPIC_MODEL=anthropic--claude-4.5-sonnet
```

No manual configuration needed in the frontend!

### Test AI Features

1. **Open app**: http://localhost:3000
2. **Upload CSV**: Drag and drop your German bank CSV
3. **Use AI Q&A**: Scroll to "AI Financial Assistant" section
   - Ask questions about your finances
   - Get AI-powered insights
4. **AI Categorization**: Click "Use AI to Categorize Transactions"
   - Batch processes uncategorized transactions
   - Progress bar shows completion

## Benefits

✅ **No CORS issues** - Backend handles all API calls
✅ **No manual configuration** - Settings in docker-compose.yml
✅ **Secure** - API key never exposed to browser
✅ **Scalable** - Can add rate limiting, caching, etc.
✅ **Better error handling** - Server-side logging
✅ **Batch processing** - Efficient categorization

## Troubleshooting

### Backend not responding
```bash
# Check if backend is running
docker-compose ps

# Should show:
# cockpit-backend-1   Up   0.0.0.0:3001->3001/tcp

# View backend logs
docker-compose logs backend
```

### API test fails
```bash
# Test backend health
curl http://localhost:3001/health

# Test API connection
curl http://localhost:3001/api/test

# If fails, check if Claude API proxy is running on port 9988
curl http://127.0.0.1:9988/anthropic/v1/messages
```

### Frontend can't reach backend
```bash
# Check if port 3001 is accessible
curl http://localhost:3001/health

# Check browser console (F12) for network errors
# Should see requests to http://localhost:3001/api/*
```

## Files Modified

1. `server/index.js` - New Express backend server
2. `src/services/llmService.js` - Updated to use backend
3. `package.json` - Added Express, CORS, node-fetch
4. `docker-compose.yml` - Added backend service
5. `Dockerfile.backend` - Backend container config
6. `index.html` - Removed settings UI (not needed)
7. `src/main.js` - Removed settings panel code

## Comparison

### Before (Direct API Call)
❌ CORS errors
❌ API key exposed in browser
❌ Manual configuration required
❌ Browser security restrictions

### After (Backend Proxy)
✅ No CORS issues
✅ API key secure on server
✅ Zero configuration for users
✅ Full access to API features

## Status

🟢 **FULLY OPERATIONAL**

- Frontend: Running on port 3000
- Backend: Running on port 3001
- API Connection: Verified working
- AI Features: Ready to use

The application is now ready to use all AI features without any CORS issues!
