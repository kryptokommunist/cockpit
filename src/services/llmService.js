/**
 * LLM Service for AI-powered categorization and financial Q&A
 * Uses Anthropic Claude API
 */
export class LLMService {
  constructor() {
    // Use backend API instead of calling Claude directly
    // This avoids CORS issues entirely
    this.backendUrl = 'http://localhost:3001/api';
    this.enabled = true; // Can be toggled by user
  }

  /**
   * Call Claude API
   * @param {string} prompt - The prompt to send
   * @param {number} maxTokens - Maximum tokens to generate
   * @returns {Promise<string>} - AI response
   */
  async callClaude(prompt, maxTokens = 1024) {
    if (!this.enabled) {
      throw new Error('LLM service is disabled');
    }

    try {
      const response = await fetch(`${this.backendUrl}/claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          maxTokens
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Error calling Claude API:', error);

      // Provide helpful error messages
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error('Backend server not reachable. Make sure the backend is running on port 3001.');
      }

      throw error;
    }
  }

  /**
   * Use AI to categorize a transaction
   * @param {Transaction} transaction - Transaction to categorize
   * @returns {Promise<string>} - Category name
   */
  async categorizeTransaction(transaction) {
    const prompt = `You are a financial transaction categorizer. Given the following transaction details, determine the most appropriate category.

Transaction Details:
- Merchant/Payee: ${transaction.payee}
- Purpose/Description: ${transaction.purpose}
- Amount: ${transaction.amount} EUR
- Date: ${transaction.bookingDate.toISOString().split('T')[0]}

Available Categories:
- GROCERIES (supermarkets, food stores)
- TRANSPORT (taxis, public transport, rideshare)
- FOOD_DELIVERY (meal delivery, food services)
- SUBSCRIPTIONS (streaming, software, recurring services)
- UTILITIES (electricity, internet, phone)
- INSURANCE (health, car, life insurance)
- RENT (housing rent, apartment)
- CASH (ATM withdrawals, cash)
- INCOME (salary, payments received)
- OTHER (miscellaneous)

Respond with ONLY the category name in UPPERCASE, nothing else.`;

    try {
      const category = await this.callClaude(prompt, 50);
      return category.trim().toUpperCase();
    } catch (error) {
      console.error('Error with AI categorization:', error);
      return 'OTHER';
    }
  }

  /**
   * Batch categorize multiple transactions with SSE progress
   * @param {Array<Transaction>} transactions - Transactions to categorize
   * @param {Array<string>} existingCategories - Existing category names
   * @param {function} onProgress - Progress callback (current, total, batch, totalBatches)
   * @returns {Promise<Object>} - Object with results Map and newCategories array
   */
  async batchCategorize(transactions, existingCategories = [], onProgress = null) {
    try {
      console.log('[LLMService] batchCategorize called with', transactions.length, 'transactions');

      // Send all transactions to backend for batch processing
      const transactionsData = transactions.map(t => ({
        id: t.id,
        payee: t.payee,
        purpose: t.purpose,
        amount: t.amount
      }));

      console.log('[LLMService] Prepared transaction data:', transactionsData.length, 'items');
      console.log('[LLMService] Existing categories:', existingCategories);

      let requestBody;
      try {
        requestBody = JSON.stringify({
          transactions: transactionsData,
          existingCategories
        });
        console.log('[LLMService] Request body size:', requestBody.length, 'chars');
      } catch (jsonError) {
        console.error('[LLMService] JSON stringify error:', jsonError);
        throw new Error(`Failed to serialize transactions: ${jsonError.message}`);
      }

      console.log('[LLMService] Sending batch request to backend...');
      console.log('[LLMService] URL:', `${this.backendUrl}/categorize-batch`);

      let response;
      try {
        response = await fetch(`${this.backendUrl}/categorize-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        });
      } catch (fetchError) {
        console.error('[LLMService] Fetch error:', fetchError);
        throw new Error(`Backend server not reachable at ${this.backendUrl}. Make sure the backend is running on port 3001. Error: ${fetchError.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[LLMService] Backend error:', response.status, errorText);
        throw new Error(`Batch categorization failed: ${response.status} - ${errorText}`);
      }

      // Handle SSE stream
      console.log('[LLMService] Starting to read SSE stream...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let results = null;
      let newCategories = [];

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('[LLMService] Stream reading complete');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.type === 'progress') {
                  console.log(`[LLMService] Progress: Batch ${data.batch}/${data.totalBatches}, ${data.processed}/${data.total} transactions`);
                  if (onProgress) {
                    onProgress(data.processed, data.total, data.batch, data.totalBatches);
                  }
                } else if (data.type === 'complete') {
                  console.log('[LLMService] Batch categorization complete');
                  results = data.results;
                  newCategories = data.newCategories || [];
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error('[LLMService] Error parsing SSE data:', parseError, 'Line:', line);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('[LLMService] Error reading stream:', streamError);
        throw new Error(`Failed to read response stream: ${streamError.message}`);
      }

      if (!results) {
        throw new Error('No results received from server');
      }

      console.log('[LLMService] Got batch response:', Object.keys(results).length, 'results');
      console.log('[LLMService] New categories discovered:', newCategories);

      const resultsMap = new Map(Object.entries(results));

      // Report final progress
      if (onProgress) {
        const totalBatches = Math.ceil(transactions.length / 10);
        onProgress(transactions.length, transactions.length, totalBatches, totalBatches);
      }

      return {
        results: resultsMap,
        newCategories
      };
    } catch (error) {
      console.error('[LLMService] Error with batch categorization:', error);
      throw error;
    }
  }

  /**
   * Answer a financial question about user's transactions
   * @param {string} question - User's question
   * @param {Array<Transaction>} transactions - User's transactions
   * @param {Object} budgetData - Budget calculation data
   * @param {Array<Object>} recurringCosts - Recurring costs data
   * @returns {Promise<string>} - AI response
   */
  async answerFinancialQuestion(question, transactions, budgetData = null, recurringCosts = [], onThinking = null, onTextChunk = null, conversationHistory = []) {
    console.log('[LLMService] answerFinancialQuestion called with:', {
      question,
      transactionCount: transactions.length,
      hasBudget: !!budgetData,
      recurringCount: recurringCosts.length,
      hasThinkingCallback: !!onThinking,
      historyLength: conversationHistory.length
    });

    // Prepare transaction data for tools (include dates and categories)
    const transactionsData = transactions.map(t => ({
      bookingDate: t.bookingDate.toISOString().split('T')[0],
      amount: t.amount,
      category: t.category,
      payee: t.payee,
      normalizedMerchant: t.normalizedMerchant,
      purpose: t.purpose
    }));

    // Get date range from transactions
    const dates = transactions.map(t => t.bookingDate);
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    // Check if we're in projection mode
    const isProjectionMode = budgetData && budgetData.projections;

    // Define tools for Claude to use
    let tools = [];

    if (isProjectionMode) {
      // Future projection tools
      tools = [
        {
          name: 'get_future_projections_for_month',
          description: 'Get projected future income, expenses, balance, and category breakdown for a specific future month based on user-defined projections. Use this to answer questions about future months.',
          input_schema: {
            type: 'object',
            properties: {
              year: {
                type: 'number',
                description: 'Year (e.g., 2026)'
              },
              month: {
                type: 'number',
                description: 'Month number (1-12, where 1 is January)'
              }
            },
            required: ['year', 'month']
          }
        },
        {
          name: 'get_recurring_projections',
          description: 'Get all recurring income and expense projections (subscriptions, salary, regular bills) with their frequencies and monthly costs. Use this to understand ongoing financial commitments.',
          input_schema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_onetime_projections',
          description: 'Get all one-time future income and expense projections (planned purchases, bonus payments, etc.). Use this to see upcoming one-time financial events.',
          input_schema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ];
    } else {
      // Historical transaction tools
      tools = [
        {
          name: 'get_budget_for_month',
          description: 'Get detailed budget data for a specific month including income, expenses, balance, savings rate, and category-by-category breakdown. Use this when the user asks about a specific month.',
          input_schema: {
            type: 'object',
            properties: {
              year: {
                type: 'number',
                description: 'Year (e.g., 2026)'
              },
              month: {
                type: 'number',
                description: 'Month number (1-12, where 1 is January)'
              }
            },
            required: ['year', 'month']
          }
        },
      {
        name: 'get_spending_by_category',
        description: 'Get detailed spending breakdown by category for any date range, including transaction counts, averages, and top transactions per category. Use this to analyze spending patterns.',
        input_schema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format'
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format'
            }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'compare_periods',
        description: 'Compare budget and spending between two time periods to identify changes and trends. Use this when the user wants to compare different months or periods.',
        input_schema: {
          type: 'object',
          properties: {
            period1Start: {
              type: 'string',
              description: 'Period 1 start date in YYYY-MM-DD format'
            },
            period1End: {
              type: 'string',
              description: 'Period 1 end date in YYYY-MM-DD format'
            },
            period2Start: {
              type: 'string',
              description: 'Period 2 start date in YYYY-MM-DD format'
            },
            period2End: {
              type: 'string',
              description: 'Period 2 end date in YYYY-MM-DD format'
            }
          },
          required: ['period1Start', 'period1End', 'period2Start', 'period2End']
        }
      },
      {
        name: 'get_transactions_by_category',
        description: 'Retrieve the actual transaction list for a specific category. Use this when you need to see exact transactions, not just summaries. Returns individual transactions with dates, merchants, and amounts.',
        input_schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category name (e.g., GROCERIES, RENT, TRANSPORT)'
            },
            startDate: {
              type: 'string',
              description: 'Optional start date in YYYY-MM-DD format'
            },
            endDate: {
              type: 'string',
              description: 'Optional end date in YYYY-MM-DD format'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of transactions to return (default 50)'
            }
          },
          required: ['category']
        }
      },
      {
        name: 'get_transactions_for_month',
        description: 'Retrieve all transactions for a specific month. Use this to see the complete transaction list for detailed analysis.',
        input_schema: {
          type: 'object',
          properties: {
            year: {
              type: 'number',
              description: 'Year (e.g., 2026)'
            },
            month: {
              type: 'number',
              description: 'Month number (1-12)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of transactions to return (default 100)'
            }
          },
          required: ['year', 'month']
        }
      },
      {
        name: 'search_transactions',
        description: 'Search for transactions by merchant name or description. Use this to find specific spending patterns or analyze particular merchants.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term (merchant name, description, etc.)'
            },
            startDate: {
              type: 'string',
              description: 'Optional start date in YYYY-MM-DD format'
            },
            endDate: {
              type: 'string',
              description: 'Optional end date in YYYY-MM-DD format'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of transactions to return (default 20)'
            }
          },
          required: ['query']
        }
      }
    ];
    }

    // Build conversation history context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\n## Previous Conversation\n\n';
      conversationHistory.forEach((entry, index) => {
        conversationContext += `**Q${index + 1}:** ${entry.question}\n`;
        const summary = this.summarizeResponse(entry.response);
        conversationContext += `**A${index + 1}:** ${summary}\n\n`;
      });
      conversationContext += '---\n\n';
    }

    let prompt;

    if (isProjectionMode) {
      // Projection mode prompt
      prompt = `You are a personal finance advisor helping with future financial planning. The user has defined future projections including recurring income/expenses and one-time transactions.
${conversationContext}
**Current Question:** ${question}

You have access to tools to analyze projected financial data:

**Projection Tools:**
- get_future_projections_for_month: Get projected income, expenses, balance for a specific future month
- get_recurring_projections: Get all recurring items (salary, subscriptions, bills) with frequencies
- get_onetime_projections: Get all one-time planned transactions

**How to approach questions:**
1. Use get_future_projections_for_month to see overall budget projections for specific months
2. Use get_recurring_projections to understand ongoing financial commitments
3. Use get_onetime_projections to see planned one-time expenses/income
4. Provide specific, actionable advice based on the projected data

Examples:
- "What will my balance be next month?" → Get future projections for next month
- "What are my recurring costs?" → Get recurring projections
- "Can I afford a €1000 purchase?" → Check projected balance and recurring costs

Context:
${recurringCosts.length > 0 ? `- You have ${recurringCosts.length} defined recurring items` : ''}

Today's date is ${new Date().toISOString().split('T')[0]}.

IMPORTANT: Base your analysis on user-defined projections, not historical data.`;
    } else {
      // Historical transaction mode prompt
      prompt = `You are a personal finance advisor. The user has financial transaction data from ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}.
${conversationContext}
**Current Question:** ${question}

You have access to powerful tools to analyze financial data. Think step-by-step about what data you need:

**Summary Tools** (for high-level analysis):
- get_budget_for_month: Complete budget for a specific month with category breakdown
- get_spending_by_category: Spending analysis by category for any date range
- compare_periods: Compare two time periods side-by-side

**Detailed Tools** (for transaction-level analysis):
- get_transactions_by_category: See actual transactions for a category (e.g., all GROCERIES purchases)
- get_transactions_for_month: See all transactions in a month
- search_transactions: Find specific merchants or transaction patterns

**How to approach questions:**
1. First, gather summary data (budget, spending breakdown)
2. If you need more details, use transaction-level tools to see exact purchases
3. Look for patterns, unusual spending, or opportunities for savings
4. Provide specific, actionable advice with examples

Examples:
- "What should I spend less on?" → Get spending breakdown, then examine transactions in high-spend categories
- "Show my grocery spending" → Get transactions_by_category for GROCERIES
- "What did I spend on in January?" → Get transactions_for_month, then analyze patterns

Context:
${recurringCosts.length > 0 ? `- You have ${recurringCosts.length} recurring costs/subscriptions` : ''}
${budgetData ? `- Overall average monthly expenses: ${budgetData.avgMonthlyExpenses?.toFixed(2) || 'N/A'} EUR` : ''}

Today's date is ${new Date().toISOString().split('T')[0]}.

IMPORTANT: Use multiple tool calls if needed to gather complete information before answering. Don't hesitate to drill down into transaction details.`;
    }

    try {
      console.log('[LLMService] Sending question with tools to Claude (streaming)');

      // Check if we're dealing with projections (passed as budgetData)
      const isProjectionMode = budgetData && budgetData.projections;
      const projectionData = isProjectionMode ? budgetData : null;

      console.log('[LLMService] isProjectionMode:', isProjectionMode);
      console.log('[LLMService] budgetData:', budgetData ? {
        hasProjections: !!budgetData.projections,
        projectionsLength: budgetData.projections?.length,
        hasRecurringItems: !!budgetData.recurringItems,
        recurringItemsLength: budgetData.recurringItems?.length,
        hasOneTimeItems: !!budgetData.oneTimeItems,
        oneTimeItemsLength: budgetData.oneTimeItems?.length
      } : 'null');

      const requestBody = {
        prompt,
        maxTokens: 2048,
        transactions: transactionsData,
        projections: projectionData,
        tools,
        streaming: !!onThinking
      };

      console.log('[LLMService] Request body summary:', {
        hasPrompt: !!requestBody.prompt,
        transactionsCount: requestBody.transactions?.length || 0,
        hasProjections: !!requestBody.projections,
        projectionsCount: requestBody.projections?.projections?.length || 0,
        toolsCount: requestBody.tools?.length || 0,
        toolNames: requestBody.tools?.map(t => t.name) || [],
        streaming: requestBody.streaming
      });

      const response = await fetch(`${this.backendUrl}/claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      // If streaming, read SSE events
      if (onThinking || onTextChunk) {
        console.log('[LLMService] Reading thinking stream...');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.type === 'thinking' && onThinking) {
                  console.log(`[LLMService] Thinking: ${data.tool}`);
                  onThinking(data.tool, data.input, data.result);
                } else if (data.type === 'text' && onTextChunk) {
                  // Stream text chunk
                  onTextChunk(data.chunk);
                  finalText += data.chunk;
                } else if (data.type === 'complete') {
                  // If no streaming chunks, use the complete text
                  if (!finalText) {
                    finalText = data.text;
                    // Send as single chunk if callback exists
                    if (onTextChunk && finalText) {
                      onTextChunk(finalText);
                    }
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error('[LLMService] Error parsing SSE:', parseError);
              }
            }
          }
        }

        console.log('[LLMService] Got final response from Claude');
        return finalText;
      } else {
        // Non-streaming
        const data = await response.json();
        console.log('[LLMService] Got response from Claude with tools');
        return data.text;
      }
    } catch (error) {
      console.error('[LLMService] Error answering financial question:', error);
      throw error;
    }
  }

  /**
   * Get spending insights and recommendations
   * @param {Array<Transaction>} transactions - User's transactions
   * @param {Array<Object>} recurringCosts - Recurring costs
   * @returns {Promise<string>} - AI insights
   */
  async getSpendingInsights(transactions, recurringCosts = []) {
    const prompt = `You are a personal finance advisor. Analyze the following financial data and provide key insights and recommendations.

${await this.buildFinancialSummary(transactions, recurringCosts)}

Please provide:
1. Key observations about spending patterns
2. Areas where spending is high or concerning
3. Opportunities for savings
4. Specific actionable recommendations

Keep your response structured and concise (under 500 words).`;

    try {
      const insights = await this.callClaude(prompt, 2048);
      return insights;
    } catch (error) {
      console.error('Error getting spending insights:', error);
      throw error;
    }
  }

  /**
   * Summarize a response for conversation history
   * @param {string} response - Full response text
   * @returns {string} - Summarized response
   */
  summarizeResponse(response) {
    // Remove markdown formatting for summary
    let text = response
      .replace(/[#*`]/g, '')  // Remove markdown symbols
      .replace(/\n+/g, ' ')    // Collapse newlines
      .trim();

    // If response is short, return as-is
    if (text.length <= 200) {
      return text;
    }

    // Extract key points (first sentence + any bullet points)
    const sentences = text.split(/[.!?]\s+/);
    let summary = sentences[0] + '.';

    // Look for key financial numbers
    const numbers = text.match(/€[\d,]+\.?\d*/g);
    if (numbers && numbers.length > 0) {
      summary += ` Key amounts: ${numbers.slice(0, 3).join(', ')}.`;
    }

    // Look for recommendations
    const recommendations = text.match(/(recommend|suggest|should|consider)[^.!?]*[.!?]/gi);
    if (recommendations && recommendations.length > 0) {
      summary += ` ${recommendations[0]}`;
    }

    // Ensure summary isn't too long
    if (summary.length > 250) {
      summary = summary.substring(0, 247) + '...';
    }

    return summary;
  }

  /**
   * Build financial summary for prompts
   * @private
   */
  async buildFinancialSummary(transactions, recurringCosts) {
    const totalIncome = transactions
      .filter(t => t.isIncome())
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = Math.abs(transactions
      .filter(t => t.isExpense())
      .reduce((sum, t) => sum + t.amount, 0));

    const categoryTotals = {};
    transactions.filter(t => t.isExpense()).forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });

    return `
Financial Data:
- Period: ${transactions.length > 0 ? `${transactions[0].bookingDate.toISOString().split('T')[0]} to ${transactions[transactions.length - 1].bookingDate.toISOString().split('T')[0]}` : 'N/A'}
- Total Income: ${totalIncome.toFixed(2)} EUR
- Total Expenses: ${totalExpenses.toFixed(2)} EUR
- Net Savings: ${(totalIncome - totalExpenses).toFixed(2)} EUR

Category Breakdown:
${Object.entries(categoryTotals)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, amt]) => `- ${cat}: ${amt.toFixed(2)} EUR`)
  .join('\n')}

Recurring Costs (${recurringCosts.length}):
${recurringCosts.slice(0, 10).map(r =>
  `- ${r.merchant}: ${r.avgAmount.toFixed(2)} EUR ${r.frequency}`
).join('\n')}
`;
  }

  /**
   * Enable/disable LLM service
   * @param {boolean} enabled - Whether to enable
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Check if service is available
   * @returns {Promise<boolean>} - Whether service is available
   */
  async checkAvailability() {
    try {
      console.log('[LLMService] Checking backend at:', `${this.backendUrl}/test`);
      const response = await fetch(`${this.backendUrl}/test`);
      console.log('[LLMService] Response status:', response.status);
      const data = await response.json();
      console.log('[LLMService] Response data:', data);
      return data.success === true;
    } catch (error) {
      console.error('[LLMService] Backend availability check failed:', error);
      return false;
    }
  }
}
