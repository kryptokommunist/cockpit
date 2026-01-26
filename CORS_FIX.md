# Quick CORS Fix

## The Problem

When you click "Test Connection" in Settings, it fails because:

1. Your browser is at `http://localhost:3000`
2. The AI API is at `http://127.0.0.1:9988`
3. Browsers block requests between different origins (CORS security)
4. Your API proxy doesn't send CORS headers to allow this

## The Solution

Your API proxy at port 9988 needs to send these headers:

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-api-key, anthropic-version
```

## How to Fix

### If you control the API proxy code:

Add CORS headers to responses. Example for Python Flask:

```python
from flask_cors import CORS
CORS(app, origins=["http://localhost:3000"])
```

### For testing only:

Install a browser CORS extension:
- Chrome: "CORS Unblock"
- Firefox: "CORS Everywhere"

⚠️ Only for testing! Don't use in production.

## Verify It Works

After fixing CORS, test in the app:
1. Open http://localhost:3000
2. Click ⚙️ Settings
3. Click "Test Connection"
4. Should see: "✅ Connection successful!"

## The App Still Works Without AI

All core features work without AI:
- CSV parsing ✅
- Categorization ✅
- Charts ✅
- Budget calculator ✅
- Filters ✅

AI features are optional enhancements.

## Need More Help?

See [AI_SETUP.md](./AI_SETUP.md) for detailed troubleshooting.
