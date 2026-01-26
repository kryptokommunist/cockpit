# Debugging the Fetch Failure

The AI features are failing with "TypeError: Load failed" despite the backend working correctly.

## What Works
- ✅ curl to backend endpoints
- ✅ test-ai.html (http://localhost:3000/test-ai.html) can call backend

## What Fails
- ❌ Main app AI chat gets stuck at "Thinking..."
- ❌ Batch categorization shows "0/0" and fails with "TypeError: Load failed"

## Hypothesis
The issue might be related to:
1. Mixed content (HTTP/HTTPS mismatch)
2. Request payload size
3. Different fetch context
4. CORS preflight for specific requests

## Next Debugging Steps

### Step 1: Test the batch endpoint from test-ai.html
1. Open http://localhost:3000/test-ai.html
2. Click "Test Batch Categorize"
3. Check if it succeeds or fails

### Step 2: Test from main app's browser console
1. Open http://localhost:3000
2. Upload a CSV file
3. Open browser console (F12)
4. Run this command:

```javascript
fetch('http://localhost:3001/api/test')
  .then(r => r.json())
  .then(d => console.log('Direct fetch SUCCESS:', d))
  .catch(e => console.error('Direct fetch FAILED:', e));
```

5. If that works, try the Claude endpoint:

```javascript
fetch('http://localhost:3001/api/claude', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({prompt: 'test', maxTokens: 10})
})
  .then(r => r.json())
  .then(d => console.log('Claude SUCCESS:', d))
  .catch(e => console.error('Claude FAILED:', e));
```

6. If that works, try a mini batch:

```javascript
fetch('http://localhost:3001/api/categorize-batch', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    transactions: [{id: 't1', payee: 'REWE', purpose: 'food', amount: -10}]
  })
})
  .then(r => r.json())
  .then(d => console.log('Batch SUCCESS:', d))
  .catch(e => console.error('Batch FAILED:', e));
```

### Step 3: Check Network Tab
1. Open browser DevTools (F12)
2. Go to "Network" tab
3. Try using AI chat or categorization
4. Look for the failed request
5. Check:
   - Request Headers
   - Response (if any)
   - Timing information
   - Any error messages

### Step 4: Check for Mixed Content
1. In browser console, check:
```javascript
console.log('Page protocol:', window.location.protocol);
console.log('Page origin:', window.location.origin);
```

If it shows `https:` instead of `http:`, that's the problem!

### Step 5: Check Request Payload Size
If batch categorization is sending too many transactions, the request might be too large.

Try limiting the batch size in `src/services/llmService.js`:

```javascript
async batchCategorize(transactions, onProgress = null) {
  // Limit to first 10 transactions for testing
  const limitedTransactions = transactions.slice(0, 10);
  console.log('[LLMService] Limited to', limitedTransactions.length, 'transactions for testing');

  const transactionsData = limitedTransactions.map(t => ({
    id: t.id,
    payee: t.payee,
    purpose: t.purpose,
    amount: t.amount
  }));
  // ... rest of code
}
```

## Common Solutions

### If it's a CORS preflight issue:
Check backend logs for OPTIONS requests being rejected.

### If it's a timeout:
Add timeout handling:
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

const response = await fetch(url, {
  ...options,
  signal: controller.signal
});
clearTimeout(timeoutId);
```

### If it's mixed content:
Ensure both frontend and backend use the same protocol (HTTP).

### If it's payload size:
Batch process in smaller chunks.
