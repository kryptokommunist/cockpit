# AI Chat - Thinking Mode Implementation

## Overview

The AI Financial Assistant now includes a **Thinking Mode** that allows Claude to perform multi-step reasoning and data gathering before providing answers. This enables more thorough analysis and detailed responses based on actual transaction data.

## What is Thinking Mode?

Thinking Mode is a feature where Claude:
1. **Analyzes** the user's question
2. **Plans** which data to gather
3. **Executes** multiple tool calls to collect information
4. **Synthesizes** all the data into a comprehensive answer

The UI shows each thinking step in real-time, so users can see what data Claude is gathering.

## New Capabilities

### Transaction-Level Tools

In addition to summary tools, Claude can now access transaction-level data:

#### 1. `get_transactions_by_category`
Retrieve actual transactions for a specific category.

**Example:** "Show me all my GROCERIES purchases in January"
- Returns individual transactions with dates, merchants, and amounts
- Can filter by date range
- Limits to 50 transactions by default

**Use case:** When you want to see exactly what you bought, not just totals

#### 2. `get_transactions_for_month`
Get all transactions for a specific month.

**Example:** "What did I spend on in January 2026?"
- Returns complete transaction list for the month
- Sorted by date (most recent first)
- Limits to 100 transactions by default

**Use case:** Reviewing all activity in a specific month

#### 3. `search_transactions`
Find transactions by merchant name or description.

**Example:** "How much did I spend at Amazon?"
- Searches through merchant names and descriptions
- Can filter by date range
- Returns up to 20 matching transactions

**Use case:** Tracking spending at specific merchants

## How Thinking Mode Works

### Architecture

```
User Question
    ↓
Frontend (FinancialQA)
    ↓
Backend (SSE Stream)
    ↓
Claude API (Tool Use)
    ├─ Tool 1: get_budget_for_month
    │  └─ Result: Budget data
    ├─ Tool 2: get_transactions_by_category
    │  └─ Result: Transaction list
    ├─ Tool 3: get_spending_by_category
    │  └─ Result: Category breakdown
    └─ Final Response
    ↓
UI: Show thinking steps + answer
```

### Multi-Step Reasoning Example

**User Question:** "What should I spend less on in January 2026?"

**Claude's Thinking Process:**

1. **Step 1:** Use `get_budget_for_month(2026, 1)` to see overall budget
   - Discovers: €3,000 income, €2,200 expenses
   - Identifies high categories: GROCERIES (€450), TRANSPORT (€300)

2. **Step 2:** Use `get_transactions_by_category("GROCERIES")` for January
   - Sees: 15 transactions, mostly at REWE and EDEKA
   - Notices: Several small purchases (€20-30 each)

3. **Step 3:** Use `get_transactions_by_category("TRANSPORT")` for January
   - Sees: 20 BOLT rides averaging €15 each
   - Pattern: Mostly late-night rides

4. **Final Answer:** Provides specific recommendations based on transaction patterns:
   - Consolidate grocery shopping into weekly trips
   - Use public transport for non-urgent trips
   - Specific savings potential: €150-200/month

## UI Features

### Thinking Indicator

When Claude is gathering data, a purple gradient box appears showing:

```
🤔 Analyzing your data...
  ✓ 📊 Getting budget data
  ✓ 💰 Analyzing spending by category
  ✓ 🔍 Examining individual transactions
```

Each step appears as Claude executes tools, providing transparency into the analysis process.

### Tool Icons

- 📊 **Getting budget data** - `get_budget_for_month`
- 💰 **Analyzing spending by category** - `get_spending_by_category`
- 📈 **Comparing time periods** - `compare_periods`
- 🔍 **Examining individual transactions** - `get_transactions_by_category`
- 📝 **Retrieving transaction list** - `get_transactions_for_month`
- 🔎 **Searching transactions** - `search_transactions`

## Example Questions

### Budget Analysis
**Q:** "What is my budget for January 2026? How can I balance it?"

**Thinking:**
1. Get budget for January 2026
2. Get spending breakdown by category
3. Examine high-spend categories in detail

**Answer:** Detailed breakdown with specific recommendations

### Spending Reduction
**Q:** "What should I spend less on?"

**Thinking:**
1. Get spending by category for recent period
2. Get transactions for top 3 categories
3. Identify patterns and opportunities

**Answer:** Specific merchants, frequencies, and savings potential

### Transaction Deep Dive
**Q:** "Show me all my restaurant spending last month"

**Thinking:**
1. Search transactions for "restaurant" keywords
2. Get transactions by FOOD_DELIVERY category
3. Calculate totals and patterns

**Answer:** Complete list with dates, merchants, and analysis

### Merchant Analysis
**Q:** "How much am I spending on BOLT rides?"

**Thinking:**
1. Search transactions for "BOLT"
2. Calculate total and average per ride
3. Identify patterns (time of day, frequency)

**Answer:** Detailed BOLT spending analysis with recommendations

## Technical Implementation

### Backend Changes

1. **New Tools Added** (`server/index.js`):
   ```javascript
   - get_transactions_by_category(category, startDate, endDate, limit)
   - get_transactions_for_month(year, month, limit)
   - search_transactions(query, startDate, endDate, limit)
   ```

2. **Streaming Support**:
   - SSE (Server-Sent Events) for real-time thinking updates
   - Sends `thinking` events when tools are called
   - Sends `complete` event with final answer

3. **Increased Iterations**:
   - Tool loop limit increased from 5 to 10
   - Allows for deeper multi-step reasoning

### Frontend Changes

1. **Thinking Callback** (`src/ui/financialQA.js`):
   ```javascript
   addThinkingIndicator()
   updateThinkingIndicator(thinkingId, toolName)
   ```

2. **SSE Reader** (`src/services/llmService.js`):
   ```javascript
   - Reads thinking events from stream
   - Calls onThinking callback for each tool use
   - Returns final text when complete
   ```

3. **Enhanced Prompt**:
   - Encourages multi-step reasoning
   - Lists both summary and detailed tools
   - Provides examples of when to use each tool

## Performance

- **Latency:** Each tool call adds ~1-2 seconds
- **Typical flow:** 2-4 tool calls = 5-10 seconds total
- **Max iterations:** 10 (safety limit)
- **Transaction limits:**
  - get_transactions_by_category: 50 transactions
  - get_transactions_for_month: 100 transactions
  - search_transactions: 20 transactions

## Privacy & Security

- All data processing happens on your backend
- Transaction data never leaves your infrastructure
- Tools filter and limit data before sending to Claude
- No PII (personally identifiable information) exposed unnecessarily

## Future Enhancements

Potential additional tools:
- `analyze_merchant_pattern`: Deep dive into specific merchant spending
- `predict_next_month`: Forecast based on historical patterns
- `find_anomalies`: Identify unusual transactions
- `optimize_categories`: Suggest category reassignments
- `calculate_run_rate`: Project annual spending from current rate
- `compare_to_average`: Compare to historical averages

## Best Practices

### For Users

1. **Ask specific questions**: "Show me my grocery spending" is better than "Tell me about spending"
2. **Specify time periods**: "in January 2026" helps Claude focus
3. **Request details**: "Show me the transactions" triggers deeper analysis
4. **Be patient**: Multi-step thinking takes a few extra seconds

### For Developers

1. **Tool limits**: Always limit transaction results to prevent overwhelming Claude
2. **Date filtering**: Pre-filter data to relevant time periods
3. **Error handling**: Tools should gracefully handle missing data
4. **Logging**: Log each tool execution for debugging
5. **Caching**: Consider caching tool results for repeated queries

## Troubleshooting

### Thinking indicator doesn't show
- Check browser console for SSE errors
- Verify backend is running on port 3001
- Ensure `streaming: true` is being sent

### Tools timing out
- Check Claude API connection
- Verify transaction data format
- Check backend logs for errors

### Incomplete answers
- Increase maxTokens if needed
- Check if iteration limit (10) was reached
- Verify all tools executed successfully

## Comparison: Before vs After

### Before (Summary Only)
**Q:** "What should I spend less on?"
**A:** "Based on your overall spending, groceries seem high at €450/month."

### After (With Thinking)
**Q:** "What should I spend less on?"

**Thinking:**
1. Get budget → See €450 on groceries
2. Get GROCERIES transactions → See 15 trips to REWE
3. Analyze pattern → Multiple small trips per week

**A:** "Your grocery spending is €450/month across 15 trips. You're averaging 3-4 trips per week with purchases of €20-35 each. By consolidating to 1-2 weekly shopping trips, you could reduce impulse purchases and save approximately €80-100/month (18-22%)."

The difference: **Specific, actionable, data-driven recommendations** based on actual transaction patterns.
