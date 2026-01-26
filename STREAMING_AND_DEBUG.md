# Streaming Visualization & Debug Mode

## Overview

The AI Financial Chat now includes three major enhancements:
1. **Streaming text visualization** - See responses appear in real-time
2. **Debug tab** - View all agent interactions and tool calls
3. **Markdown table support** - Render tables in responses

## Features

### 1. Streaming Text Visualization

Responses now stream character-by-character (or chunk-by-chunk) as they arrive from Claude, providing immediate feedback and a more dynamic user experience.

#### How It Works

```
User sends question
    ↓
Backend streams SSE events:
  - thinking events (tool calls)
  - text chunks (response text)
  - complete event (finished)
    ↓
Frontend displays:
  - Thinking indicator with steps
  - Streaming text with cursor
  - Final formatted response
```

#### Visual Indicators

- **Streaming cursor**: A blinking `▋` cursor appears at the end of text
- **Real-time updates**: Text appears as soon as it's available
- **Smooth experience**: No waiting for complete response

#### Example Flow

```
User: "What is my budget for January 2026?"

[Thinking indicator appears]
🤔 Analyzing your data...
  ✓ 📊 Getting budget data
  ✓ 💰 Analyzing spending by category

[Text starts streaming with cursor]
Your budget for January 2026:▋

[More text appears]
Your budget for January 2026:

**Income:** €3,000▋

[Continues until complete]
Your budget for January 2026:

**Income:** €3,000.00
**Expenses:** €2,200.50
...
```

### 2. Debug Tab

A dedicated debug view shows all agent interactions, including:
- User messages
- Tool calls with inputs and outputs
- Assistant responses
- Errors

#### Accessing Debug View

Click the **"Debug"** tab at the top of the chat interface to switch between:
- **Chat tab**: Normal conversation view
- **Debug tab**: Technical details

#### Debug Entry Types

**USER**
```
[USER] 12:34:56 PM
What is my budget for January 2026?
```

**TOOL**
```
[TOOL] get_budget_for_month 12:34:57 PM

Input:
{
  "year": 2026,
  "month": 1
}

Result:
{
  "period": "2026-01",
  "income": 3000.00,
  "expenses": 2200.50,
  "balance": 799.50,
  ...
}
```

**ASSISTANT**
```
[ASSISTANT] 12:34:58 PM
Your budget for January 2026:

**Income:** €3,000.00
**Expenses:** €2,200.50
...
```

**ERROR**
```
[ERROR] 12:35:00 PM
Backend server not reachable
```

#### Use Cases

1. **Debugging issues**: See exactly what tools were called
2. **Understanding reasoning**: Follow Claude's thought process
3. **Verifying data**: Check tool inputs and outputs
4. **Troubleshooting errors**: Identify where failures occur

### 3. Markdown Table Support

The markdown renderer now supports tables, allowing Claude to present structured data in a clear format.

#### Syntax

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

#### Rendered Output

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

#### Example Use Case

**Question:** "Show me my top 5 expense categories"

**Claude's Response:**

```markdown
Here are your top 5 expense categories for January 2026:

| Category | Amount | Percentage | Avg per Transaction |
|----------|--------|------------|---------------------|
| RENT | €800.00 | 36.4% | €800.00 |
| GROCERIES | €450.00 | 20.5% | €37.50 |
| TRANSPORT | €300.00 | 13.6% | €15.00 |
| SUBSCRIPTIONS | €89.00 | 4.0% | €22.25 |
| UTILITIES | €65.00 | 3.0% | €65.00 |

**Recommendations:**
- Your GROCERIES spending is higher than average...
```

#### Supported Markdown

- **Headers**: `#`, `##`, `###`
- **Bold**: `**text**` or `__text__`
- **Italic**: `*text*` or `_text_`
- **Code blocks**: ` ```code``` `
- **Inline code**: `` `code` ``
- **Lists**: `- item` or `1. item`
- **Links**: `[text](url)`
- **Tables**: See syntax above

## Technical Implementation

### Frontend Architecture

#### Streaming Message (`financialQA.js`)

```javascript
// Create streaming message container
const streamingId = this.addStreamingMessage();

// Stream text chunks
await this.llmService.answerFinancialQuestion(
  question,
  transactions,
  budget,
  recurring,
  (toolName, toolInput, toolResult) => {
    // Handle thinking updates
    this.updateThinkingIndicator(thinkingId, toolName);
    this.addDebugEntry('tool', toolName, toolInput, toolResult);
  },
  (chunk) => {
    // Handle text streaming
    this.appendToStreamingMessage(streamingId, chunk);
  }
);

// Finalize and render markdown
this.finalizeStreamingMessage(streamingId);
```

#### Debug Entries

```javascript
addDebugEntry(type, content, input = null, result = null) {
  // Create formatted debug entry
  // Types: 'user', 'assistant', 'tool', 'error'
  // Display with badges, timestamps, collapsible sections
}
```

#### Table Rendering

```javascript
processTables(text) {
  // Detect table syntax: | col1 | col2 |
  // Parse header row
  // Skip separator row: |------|------|
  // Parse data rows
  // Generate <table> HTML
}
```

### Backend Streaming (`server/index.js`)

```javascript
// Set up SSE headers
if (streaming) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

// Send thinking events
res.write(`data: ${JSON.stringify({
  type: 'thinking',
  tool: toolUseBlock.name,
  input: toolUseBlock.input,
  result: toolResult
})}\n\n`);

// Send text chunks (future enhancement)
res.write(`data: ${JSON.stringify({
  type: 'text',
  chunk: textChunk
})}\n\n`);

// Send complete event
res.write(`data: ${JSON.stringify({
  type: 'complete',
  text: finalText
})}\n\n`);
```

### SSE Event Types

1. **thinking**: Tool execution
   ```json
   {
     "type": "thinking",
     "tool": "get_budget_for_month",
     "input": { "year": 2026, "month": 1 },
     "result": { "income": 3000, ... }
   }
   ```

2. **text**: Streaming text chunk
   ```json
   {
     "type": "text",
     "chunk": "Your budget for "
   }
   ```

3. **complete**: Final response
   ```json
   {
     "type": "complete",
     "text": "Full response text..."
   }
   ```

4. **error**: Error occurred
   ```json
   {
     "type": "error",
     "error": "Error message"
   }
   ```

## UI Components

### Tab Interface

```html
<div class="qa-tabs">
  <button class="qa-tab active" data-tab="chat">Chat</button>
  <button class="qa-tab" data-tab="debug">Debug</button>
</div>

<div class="qa-tab-content">
  <div class="qa-tab-panel active" id="qa-tab-chat">
    <!-- Chat messages -->
  </div>
  <div class="qa-tab-panel" id="qa-tab-debug">
    <!-- Debug entries -->
  </div>
</div>
```

### Streaming Message

```html
<div class="qa-message qa-message-assistant qa-message-streaming">
  <div class="qa-message-content">
    Your budget for January 2026:<span class="streaming-cursor">▋</span>
  </div>
  <div class="qa-message-time">12:34:56 PM</div>
</div>
```

### Debug Entry

```html
<div class="debug-entry debug-entry-tool">
  <div class="debug-header">
    <span class="debug-badge debug-badge-tool">TOOL</span>
    <span class="debug-tool-name">get_budget_for_month</span>
    <span class="debug-time">12:34:57 PM</span>
  </div>
  <div class="debug-section">
    <strong>Input:</strong>
    <pre><code>{ "year": 2026, "month": 1 }</code></pre>
  </div>
  <div class="debug-section">
    <strong>Result:</strong>
    <pre><code>{ "income": 3000, ... }</code></pre>
  </div>
</div>
```

## Performance Considerations

### Streaming

- **Latency**: Text appears immediately, no waiting for full response
- **Bandwidth**: SSE is lightweight (text-only, line-based)
- **Memory**: Frontend buffers and displays incrementally

### Debug View

- **Storage**: Debug entries kept in memory (cleared on refresh)
- **Rendering**: Lazy rendering for large tool results
- **Limit**: Consider truncating very large outputs (>1000 chars)

### Tables

- **Parsing**: Simple regex-based, O(n) complexity
- **Rendering**: Standard HTML table generation
- **Styling**: CSS-based, no JavaScript overhead

## Best Practices

### For Users

1. **Watch the thinking indicator**: See what tools Claude is using
2. **Check debug tab**: If something seems wrong, verify tool outputs
3. **Use tables**: Ask Claude to "show in a table" for structured data

### For Developers

1. **Limit tool results**: Truncate large datasets before sending to Claude
2. **Handle SSE errors**: Reconnect or fallback to non-streaming
3. **Sanitize markdown**: Always escape user input to prevent XSS
4. **Optimize streaming**: Send chunks of meaningful size (50-100 chars)

## Troubleshooting

### Streaming not working

**Symptom**: Text appears all at once instead of streaming

**Possible causes**:
1. Backend not sending SSE events
2. Browser buffering responses
3. Callback not registered

**Solution**: Check browser network tab for SSE stream, verify `streaming: true` in request

### Debug view empty

**Symptom**: Debug tab shows no entries

**Possible causes**:
1. Tab switched before entries added
2. JavaScript error preventing logging

**Solution**: Check browser console for errors, verify `addDebugEntry` calls

### Tables not rendering

**Symptom**: Table syntax appears as plain text

**Possible causes**:
1. Incorrect markdown syntax
2. Missing separator row
3. Table parser not running

**Solution**: Verify table has `|---|---` separator row, check `processTables` is called

### Cursor flickering

**Symptom**: Streaming cursor blinks too fast/slow

**Solution**: Adjust `@keyframes blink` animation duration in CSS

## Future Enhancements

### Planned Features

1. **Token-by-token streaming**: Stream Claude's actual output tokens
2. **Copy debug entries**: Export debug log as JSON/text
3. **Filter debug view**: Show only tool calls or errors
4. **Syntax highlighting**: Color-code JSON in debug view
5. **Collapsible debug sections**: Minimize large tool results
6. **Replay mode**: Replay conversation with timing
7. **Export chat**: Download conversation as markdown

### Advanced Table Features

1. **Column alignment**: Left/center/right align columns
2. **Sortable tables**: Click headers to sort
3. **Searchable tables**: Filter table rows
4. **Expandable rows**: Show more details on click

## Examples

### Example 1: Budget Question with Table

**User**: "Show me my spending breakdown in a table"

**Thinking**:
- ✓ 📊 Getting budget data
- ✓ 💰 Analyzing spending by category

**Response**:
```markdown
Here's your spending breakdown for January 2026:

| Category | Amount | % of Total | Avg/Transaction |
|----------|--------|------------|-----------------|
| RENT | €800.00 | 36.4% | €800.00 |
| GROCERIES | €450.00 | 20.5% | €37.50 |
| TRANSPORT | €300.00 | 13.6% | €15.00 |
| FOOD_DELIVERY | €250.00 | 11.4% | €20.83 |
| SUBSCRIPTIONS | €89.00 | 4.0% | €22.25 |

Your highest category is RENT at 36.4% of total spending.
```

### Example 2: Debug View for Tool Call

**User**: "What did I spend on groceries?"

**Debug Entries**:

```
[USER] 2:30:15 PM
What did I spend on groceries?

[TOOL] get_transactions_by_category 2:30:16 PM
Input:
{
  "category": "GROCERIES",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31"
}

Result:
[
  {
    "date": "2026-01-25",
    "merchant": "REWE",
    "amount": 45.50,
    "purpose": "Groceries"
  },
  ...
]

[ASSISTANT] 2:30:17 PM
You spent €450.00 on groceries in January 2026 across 15 transactions...
```

## Comparison: Before vs After

### Before

- ❌ Wait for complete response (5-10 seconds)
- ❌ No visibility into tool calls
- ❌ Tables display as plain text
- ❌ Can't debug issues

### After

- ✅ See response stream in real-time
- ✅ Debug tab shows all tool calls
- ✅ Tables render beautifully
- ✅ Can verify tool inputs/outputs
- ✅ Blinking cursor shows progress
- ✅ Thinking indicator shows activity

**Result**: More transparent, responsive, and debuggable AI chat experience!
