# AI Features Setup Guide

## Issue: CORS (Cross-Origin Resource Sharing)

The AI features make API calls from your browser (at `http://localhost:3000`) to the Claude API proxy (at `http://127.0.0.1:9988`). Browsers block such requests by default due to CORS security policy.

## Problem

Your API proxy server at `http://127.0.0.1:9988` is not configured to send CORS headers, which prevents the browser from making requests to it.

## Solution Options

### Option 1: Configure CORS on the API Proxy (Recommended)

Your API proxy needs to send these HTTP headers:

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-api-key, anthropic-version
```

**If using a Python proxy (Flask/FastAPI):**

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])
```

**If using nginx:**

```nginx
location /anthropic/ {
    add_header Access-Control-Allow-Origin "http://localhost:3000" always;
    add_header Access-Control-Allow-Methods "POST, GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, x-api-key, anthropic-version" always;

    if ($request_method = OPTIONS) {
        return 204;
    }

    proxy_pass http://upstream-api;
}
```

### Option 2: Use a Browser Extension (Quick Test)

For testing purposes, you can use a browser extension like:
- **Chrome/Edge**: "CORS Unblock" or "Allow CORS"
- **Firefox**: "CORS Everywhere"

⚠️ **Warning**: Only use for development/testing. Disabling CORS removes browser security protections.

### Option 3: Run API Calls Server-Side (More Complex)

Instead of calling the API from the browser, create a backend service that:
1. Receives requests from the browser
2. Calls the Claude API from the server
3. Returns results to the browser

This avoids CORS entirely since the browser only talks to your backend.

## Testing the API

Once CORS is configured, test the connection:

1. Open the app: http://localhost:3000
2. Click **⚙️ Settings** button
3. Verify settings:
   - **Base URL**: `http://127.0.0.1:9988/anthropic/`
   - **API Token**: Your token from `~/.claude/settings.json`
   - **Model**: `anthropic--claude-4.5-sonnet`
4. Click **Test Connection**
5. Should see: "✅ Connection successful!"

## Current API Configuration

From your `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:9988/anthropic/",
    "ANTHROPIC_AUTH_TOKEN": "sk-aB1cD2eF3gH4jK5lM6nP7qR8sT9uV0wX1yZ2bC3nM4pK5sL6",
    "ANTHROPIC_MODEL": "anthropic--claude-4.5-sonnet"
  }
}
```

## Verifying the API Works

Test from command line (this bypasses CORS):

```bash
curl -X POST http://127.0.0.1:9988/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-aB1cD2eF3gH4jK5lM6nP7qR8sT9uV0wX1yZ2bC3nM4pK5sL6" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "anthropic--claude-4.5-sonnet",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

If this works (returns JSON), the API is functional - CORS is the only issue.

## AI Features Available

Once CORS is configured, you can use:

1. **AI Categorization**
   - Automatically categorize uncategorized transactions
   - Click "Use AI to Categorize Transactions" button
   - Progress bar shows batch processing

2. **Financial Q&A**
   - Ask questions about your finances
   - Examples:
     - "How can I save more money?"
     - "What are my biggest expenses?"
     - "Analyze my spending by category"
   - Get personalized insights based on your data

3. **Quick Actions**
   - Pre-defined questions for common insights
   - One-click analysis
   - Spending recommendations

## Without AI Features

The app works perfectly fine without AI features. You can still:

- ✅ Upload and parse German bank CSV
- ✅ Automatically categorize with rule-based system
- ✅ Manually override categories
- ✅ View interactive charts
- ✅ Detect recurring costs
- ✅ Calculate budgets
- ✅ Filter and search transactions
- ✅ Export data

The AI features are optional enhancements.

## Troubleshooting

### Error: "Failed to fetch"
**Cause**: CORS is blocking the request
**Fix**: Configure CORS on the API proxy (see Option 1 above)

### Error: "API request failed: 401"
**Cause**: Invalid or missing API token
**Fix**: Check the token in Settings matches `~/.claude/settings.json`

### Error: "API request failed: 404"
**Cause**: Wrong base URL
**Fix**: Ensure Base URL ends with `/anthropic/` (with trailing slash)

### Error: "Network request failed"
**Cause**: API proxy is not running
**Fix**: Start your API proxy server on port 9988

## Need Help?

Check that:
1. ✅ API proxy is running on port 9988
2. ✅ API responds to curl (test command above)
3. ✅ CORS headers are configured on the proxy
4. ✅ Settings in the app match your configuration
5. ✅ Browser console (F12) shows any specific errors
