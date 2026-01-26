# AI Financial Chat - Features & Implementation

## Overview

The Bank Transaction Analyzer includes an AI-powered chat interface that can answer detailed questions about your finances. The AI has access to tools that allow it to query and analyze your transaction data dynamically.

## Key Features

### 1. **Month-Specific Budget Analysis**
Ask questions like:
- "What is my budget for January 2026?"
- "Show me my budget for last month"
- "What was my income and expenses in December?"

The AI will use the `get_budget_for_month` tool to retrieve:
- Total income for the month
- Total expenses for the month
- Net balance (income - expenses)
- Savings rate percentage
- Complete category-by-category breakdown with percentages
- Total number of transactions

### 2. **Category Spending Analysis**
Ask questions like:
- "What should I spend less on?"
- "What are my biggest expense categories?"
- "Analyze my spending for the last 3 months"

The AI will use the `get_spending_by_category` tool to analyze:
- Spending amount per category
- Number of transactions per category
- Average transaction amount per category
- Top 5 transactions in each category
- Percentage of total spending per category

### 3. **Period Comparison**
Ask questions like:
- "Compare this month to last month"
- "How does January 2026 compare to December 2025?"
- "What changed in my spending this month?"

The AI will use the `compare_periods` tool to show:
- Income, expenses, and balance for both periods
- Absolute differences (e.g., +€200 expenses)
- Percentage changes
- Identification of trends

### 4. **Personalized Recommendations**
The AI can provide:
- Actionable advice on reducing spending
- Identification of unusual expenses
- Suggestions for balancing your budget
- Tips for increasing your savings rate

## How It Works

### Architecture

```
User Question
    ↓
Frontend (financialQA.js)
    ↓
Backend API (/api/claude)
    ↓
Claude API (with tools)
    ↓
Tool Execution (executeToolOnTransactions)
    ↓
Response with Data
    ↓
User sees answer
```

### Tool System

The backend provides Claude with three tools:

#### 1. `get_budget_for_month`
**Input:**
- `year` (number): e.g., 2026
- `month` (number): 1-12 (1 = January)

**Output:**
```json
{
  "period": "2026-01",
  "income": 3000.00,
  "expenses": 2200.50,
  "balance": 799.50,
  "savingsRate": 26.7,
  "transactionCount": 45,
  "categoryBreakdown": [
    {
      "category": "RENT",
      "amount": 800.00,
      "percentage": 36.4
    },
    {
      "category": "GROCERIES",
      "amount": 450.00,
      "percentage": 20.5
    }
    // ... more categories
  ]
}
```

#### 2. `get_spending_by_category`
**Input:**
- `startDate` (string): "YYYY-MM-DD"
- `endDate` (string): "YYYY-MM-DD"

**Output:**
```json
[
  {
    "category": "GROCERIES",
    "total": 450.00,
    "count": 12,
    "avgPerTransaction": 37.50,
    "topTransactions": [
      {
        "date": "2026-01-15",
        "merchant": "REWE",
        "amount": 85.50
      }
      // ... top 5
    ]
  }
  // ... more categories
]
```

#### 3. `compare_periods`
**Input:**
- `period1Start` (string): "YYYY-MM-DD"
- `period1End` (string): "YYYY-MM-DD"
- `period2Start` (string): "YYYY-MM-DD"
- `period2End` (string): "YYYY-MM-DD"

**Output:**
```json
{
  "period1": {
    "start": "2025-12-01",
    "end": "2025-12-31",
    "income": 3000.00,
    "expenses": 2500.00,
    "balance": 500.00
  },
  "period2": {
    "start": "2026-01-01",
    "end": "2026-01-31",
    "income": 3000.00,
    "expenses": 2200.50,
    "balance": 799.50
  },
  "changes": {
    "incomeDiff": 0.00,
    "expensesDiff": -299.50,
    "balanceDiff": 299.50
  }
}
```

### Tool Execution Flow

1. **User asks a question** (e.g., "What is my budget for January 2026?")
2. **Frontend sends to backend:**
   - The user's question as a prompt
   - All transaction data (dates, amounts, categories, merchants)
   - Tool definitions (what tools are available)
3. **Backend calls Claude API** with tools enabled
4. **Claude decides to use a tool:**
   - Analyzes the question
   - Determines which tool to use
   - Extracts parameters (e.g., year=2026, month=1)
   - Returns a tool_use block
5. **Backend executes the tool:**
   - Runs `executeToolOnTransactions()` function
   - Filters transactions by date range
   - Calculates budget data
   - Returns structured JSON result
6. **Backend sends tool result back to Claude:**
   - Continues the conversation
   - Includes tool result in context
7. **Claude generates final answer:**
   - Uses the tool data to answer accurately
   - Provides specific numbers and insights
   - Gives actionable recommendations
8. **User sees the answer** in the chat interface

## Implementation Details

### Frontend (`src/services/llmService.js`)

```javascript
async answerFinancialQuestion(question, transactions, budgetData, recurringCosts) {
  // Prepare transaction data for tools
  const transactionsData = transactions.map(t => ({
    bookingDate: t.bookingDate.toISOString().split('T')[0],
    amount: t.amount,
    category: t.category,
    payee: t.payee,
    normalizedMerchant: t.normalizedMerchant,
    purpose: t.purpose
  }));

  // Define tools
  const tools = [/* tool definitions */];

  // Send to backend
  const response = await fetch(`${this.backendUrl}/claude`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: enhancedPrompt,
      maxTokens: 2048,
      transactions: transactionsData,
      tools
    })
  });
}
```

### Backend (`server/index.js`)

```javascript
app.post('/api/claude', async (req, res) => {
  const { prompt, maxTokens, transactions, tools } = req.body;

  // Loop to handle tool calls (up to 5 iterations)
  for (let iteration = 0; iteration < 5; iteration++) {
    // Call Claude API
    const response = await fetch(`${ANTHROPIC_BASE_URL}v1/messages`, {
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        messages: conversationMessages,
        tools: tools
      })
    });

    // Check if Claude wants to use a tool
    const toolUseBlock = data.content.find(block => block.type === 'tool_use');

    if (toolUseBlock) {
      // Execute the tool
      const toolResult = await executeToolOnTransactions(
        toolUseBlock.name,
        toolUseBlock.input,
        transactions
      );

      // Continue conversation with tool result
      conversationMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult)
        }]
      });

      continue; // Get Claude's final answer
    }

    // No tool use - return final answer
    return res.json({ text: textBlock.text });
  }
});
```

### Tool Execution (`server/index.js`)

```javascript
async function executeToolOnTransactions(toolName, input, transactions) {
  switch (toolName) {
    case 'get_budget_for_month': {
      const { year, month } = input;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const filtered = transactions.filter(t => {
        const date = new Date(t.bookingDate);
        return date >= startDate && date <= endDate;
      });

      // Calculate income, expenses, category breakdown
      // Return structured data
    }
    // ... other tools
  }
}
```

## Example Interactions

### Example 1: Month-Specific Budget

**User:** "What is my budget for January 2026? How can I balance it?"

**Claude's Process:**
1. Recognizes this is a month-specific question
2. Calls `get_budget_for_month(2026, 1)`
3. Receives detailed budget data
4. Analyzes the data
5. Provides answer with specific numbers and recommendations

**Response:**
> "Based on your January 2026 data:
>
> Your budget for January 2026 shows:
> - Income: €3,000.00
> - Expenses: €2,200.50
> - Balance: €799.50 (26.7% savings rate)
>
> Your biggest expense categories are:
> 1. RENT: €800.00 (36.4%)
> 2. GROCERIES: €450.00 (20.5%)
> 3. TRANSPORT: €300.00 (13.6%)
>
> To better balance your budget:
> - Your grocery spending is slightly high at €450. Consider meal planning and buying in bulk to reduce this by 10-15%
> - Transport costs could potentially be reduced by using public transportation more often
> - Your savings rate of 26.7% is good, but you could aim for 30% by reducing discretionary spending"

### Example 2: Spending Reduction

**User:** "What should I spend less on?"

**Claude's Process:**
1. Calls `get_spending_by_category` for recent period
2. Analyzes all categories
3. Identifies high-spending categories
4. Provides specific recommendations

**Response:**
> "Based on your recent spending, here are categories you should consider reducing:
>
> 1. FOOD_DELIVERY (€350/month, 24 transactions)
>    - Average €14.58 per order
>    - Recommendation: Reduce by cooking more at home. Could save €200-250/month
>
> 2. SUBSCRIPTIONS (€89/month)
>    - Spotify, Netflix, Amazon Prime, Apple
>    - Recommendation: Review which subscriptions you actually use. Cancel unused ones.
>
> 3. TRANSPORT (€300/month)
>    - Mostly BOLT/Uber rides
>    - Recommendation: Use public transport more, could save €150/month"

## Benefits of Tool-Based Approach

1. **Accurate Data**: Claude gets exact numbers from your transaction database, not summaries
2. **Date-Specific Queries**: Can answer questions about any specific month or period
3. **Detailed Analysis**: Access to transaction-level details for deep insights
4. **Dynamic Queries**: Can compare different periods, analyze trends, etc.
5. **Scalable**: Easy to add new tools (e.g., "predict_next_month", "find_unusual_spending")

## Future Enhancements

Potential additional tools:
- `predict_next_month`: Forecast next month's expenses based on history
- `find_unusual_spending`: Identify anomalous transactions
- `get_merchant_analysis`: Deep dive into specific merchants
- `calculate_savings_potential`: Estimate how much could be saved
- `get_recurring_subscriptions`: List all subscriptions with renewal dates

## Technical Notes

- Tools are executed server-side for security and performance
- Transaction data is sent with each request (privacy: client-side only)
- Tool execution is iterative (Claude can call multiple tools)
- Maximum 5 tool iterations to prevent infinite loops
- All monetary values rounded to 2 decimal places
- Dates handled in ISO format (YYYY-MM-DD)
