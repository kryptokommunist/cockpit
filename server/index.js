import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// Load API configuration from environment variables or defaults
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'http://host.docker.internal:9988/anthropic/';
const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || 'sk-aB1cD2eF3gH4jK5lM6nP7qR8sT9uV0wX1yZ2bC3nM4pK5sL6';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'anthropic--claude-4.5-sonnet';

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get API configuration
app.get('/api/config', (req, res) => {
  res.json({
    model: ANTHROPIC_MODEL,
    available: true
  });
});

// Test API connection
app.get('/api/test', async (req, res) => {
  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_AUTH_TOKEN,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'test'
        }]
      })
    });

    if (response.ok) {
      res.json({ success: true, status: response.status });
    } else {
      const text = await response.text();
      res.status(response.status).json({
        success: false,
        status: response.status,
        error: text
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Proxy endpoint for Claude API with tool support and streaming thinking
app.post('/api/claude', async (req, res) => {
  try {
    const { prompt, maxTokens = 1024, transactions = [], tools = [], streaming = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`[Claude API] Request: ${prompt.substring(0, 100)}...`);
    console.log(`[Claude API] Has tools: ${tools.length > 0}, Has transactions: ${transactions.length > 0}, Streaming: ${streaming}`);

    // Build Claude request with tools if provided
    const requestBody = {
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: prompt
      }]
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    // Set up streaming if requested
    if (streaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    let finalText = '';
    let conversationMessages = [{ role: 'user', content: prompt }];

    // Loop to handle tool calls (increased to 10 for multi-step thinking)
    for (let iteration = 0; iteration < 10; iteration++) {
      console.log(`[Claude API] Iteration ${iteration + 1}/10`);
      const response = await fetch(`${ANTHROPIC_BASE_URL}v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_AUTH_TOKEN,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          messages: conversationMessages,
          tools: tools.length > 0 ? tools : undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Claude API] Error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({
          error: `API request failed: ${response.status}`,
          details: errorText
        });
      }

      const data = await response.json();

      if (!data.content || !Array.isArray(data.content)) {
        console.error('[Claude API] Unexpected response format:', JSON.stringify(data).substring(0, 500));
        return res.status(500).json({ error: 'Unexpected API response format', details: data });
      }

      console.log(`[Claude API] Response stop_reason: ${data.stop_reason}, content blocks: ${data.content.length}`);

      // Check if Claude wants to use a tool
      const toolUseBlocks = data.content.filter(block => block.type === 'tool_use');

      if (toolUseBlocks.length > 0) {
        console.log(`[Claude API] ${toolUseBlocks.length} tool(s) called: ${toolUseBlocks.map(t => t.name).join(', ')}`);

        // Execute all tools
        const toolResults = [];
        for (const toolUseBlock of toolUseBlocks) {
          try {
            const toolResult = await executeToolOnTransactions(toolUseBlock.name, toolUseBlock.input, transactions);

            // Send thinking update with result if streaming
            if (streaming) {
              res.write(`data: ${JSON.stringify({
                type: 'thinking',
                tool: toolUseBlock.name,
                input: toolUseBlock.input,
                result: toolResult
              })}\n\n`);
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(toolResult)
            });
          } catch (toolError) {
            console.error(`[Claude API] Tool execution error for ${toolUseBlock.name}:`, toolError);

            if (streaming) {
              res.write(`data: ${JSON.stringify({
                type: 'thinking',
                tool: toolUseBlock.name,
                input: toolUseBlock.input,
                error: toolError.message
              })}\n\n`);
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify({ error: toolError.message }),
              is_error: true
            });
          }
        }

        // Add assistant's response and tool results to conversation
        conversationMessages.push({
          role: 'assistant',
          content: data.content
        });
        conversationMessages.push({
          role: 'user',
          content: toolResults
        });

        // Continue the loop to get Claude's final answer
        continue;
      }

      // No tool use, get the text response
      const textBlock = data.content.find(block => block.type === 'text');
      if (textBlock) {
        finalText = textBlock.text;
      } else {
        console.error('[Claude API] No text block found in response');
        return res.status(500).json({ error: 'No text response from Claude' });
      }

      console.log(`[Claude API] Success: ${finalText.substring(0, 100)}...`);

      if (streaming) {
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          text: finalText,
          usage: data.usage
        })}\n\n`);
        return res.end();
      } else {
        return res.json({
          text: finalText,
          usage: data.usage
        });
      }
    }

    console.error('[Claude API] Max tool iterations exceeded');
    if (streaming) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Max tool iterations exceeded'
      })}\n\n`);
      return res.end();
    } else {
      return res.status(500).json({ error: 'Max tool iterations exceeded' });
    }

  } catch (error) {
    console.error('[Claude API] Exception:', error);
    console.error('[Claude API] Stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Execute tool on transaction data
async function executeToolOnTransactions(toolName, input, transactions) {
  console.log(`[Tool] Executing ${toolName} with input:`, input);

  switch (toolName) {
    case 'get_budget_for_month': {
      const { year, month } = input;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const filtered = transactions.filter(t => {
        const date = new Date(t.bookingDate);
        return date >= startDate && date <= endDate;
      });

      const income = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expenses = Math.abs(filtered.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));

      const categoryBreakdown = {};
      filtered.filter(t => t.amount < 0).forEach(t => {
        const cat = t.category || 'OTHER';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(t.amount);
      });

      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        income: Number(income.toFixed(2)),
        expenses: Number(expenses.toFixed(2)),
        balance: Number((income - expenses).toFixed(2)),
        savingsRate: income > 0 ? Number(((income - expenses) / income * 100).toFixed(1)) : 0,
        transactionCount: filtered.length,
        categoryBreakdown: Object.entries(categoryBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => ({
            category: cat,
            amount: Number(amt.toFixed(2)),
            percentage: expenses > 0 ? Number((amt / expenses * 100).toFixed(1)) : 0
          }))
      };
    }

    case 'get_spending_by_category': {
      const { startDate, endDate } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      const filtered = transactions.filter(t => {
        const date = new Date(t.bookingDate);
        return date >= start && date <= end && t.amount < 0;
      });

      const categoryData = {};
      filtered.forEach(t => {
        const cat = t.category || 'OTHER';
        if (!categoryData[cat]) {
          categoryData[cat] = { total: 0, count: 0, transactions: [] };
        }
        categoryData[cat].total += Math.abs(t.amount);
        categoryData[cat].count++;
        categoryData[cat].transactions.push({
          date: t.bookingDate,
          merchant: t.normalizedMerchant || t.payee,
          amount: Math.abs(t.amount)
        });
      });

      return Object.entries(categoryData)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cat, data]) => ({
          category: cat,
          total: Number(data.total.toFixed(2)),
          count: data.count,
          avgPerTransaction: Number((data.total / data.count).toFixed(2)),
          topTransactions: data.transactions.sort((a, b) => b.amount - a.amount).slice(0, 5)
        }));
    }

    case 'compare_periods': {
      const { period1Start, period1End, period2Start, period2End } = input;

      const p1Trans = transactions.filter(t => {
        const d = new Date(t.bookingDate);
        return d >= new Date(period1Start) && d <= new Date(period1End);
      });

      const p2Trans = transactions.filter(t => {
        const d = new Date(t.bookingDate);
        return d >= new Date(period2Start) && d <= new Date(period2End);
      });

      const p1Income = p1Trans.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const p1Expenses = Math.abs(p1Trans.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
      const p2Income = p2Trans.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const p2Expenses = Math.abs(p2Trans.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));

      return {
        period1: {
          start: period1Start,
          end: period1End,
          income: Number(p1Income.toFixed(2)),
          expenses: Number(p1Expenses.toFixed(2)),
          balance: Number((p1Income - p1Expenses).toFixed(2))
        },
        period2: {
          start: period2Start,
          end: period2End,
          income: Number(p2Income.toFixed(2)),
          expenses: Number(p2Expenses.toFixed(2)),
          balance: Number((p2Income - p2Expenses).toFixed(2))
        },
        changes: {
          incomeDiff: Number((p2Income - p1Income).toFixed(2)),
          expensesDiff: Number((p2Expenses - p1Expenses).toFixed(2)),
          balanceDiff: Number(((p2Income - p2Expenses) - (p1Income - p1Expenses)).toFixed(2))
        }
      };
    }

    case 'get_transactions_by_category': {
      const { category, startDate, endDate, limit = 50 } = input;

      let filtered = transactions.filter(t => {
        const matchesCategory = t.category === category;
        if (!matchesCategory) return false;

        if (startDate && endDate) {
          const date = new Date(t.bookingDate);
          return date >= new Date(startDate) && date <= new Date(endDate);
        }
        return true;
      });

      // Sort by date descending (most recent first)
      filtered.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

      // Limit results
      filtered = filtered.slice(0, limit);

      return filtered.map(t => ({
        date: t.bookingDate,
        merchant: t.normalizedMerchant || t.payee,
        purpose: t.purpose,
        amount: Math.abs(t.amount),
        category: t.category
      }));
    }

    case 'get_transactions_for_month': {
      const { year, month, limit = 100 } = input;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      let filtered = transactions.filter(t => {
        const date = new Date(t.bookingDate);
        return date >= startDate && date <= endDate;
      });

      // Sort by date descending
      filtered.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

      // Limit results
      filtered = filtered.slice(0, limit);

      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        transactionCount: filtered.length,
        transactions: filtered.map(t => ({
          date: t.bookingDate,
          merchant: t.normalizedMerchant || t.payee,
          purpose: t.purpose,
          amount: t.amount,
          category: t.category
        }))
      };
    }

    case 'search_transactions': {
      const { query, startDate, endDate, limit = 20 } = input;
      const searchLower = query.toLowerCase();

      let filtered = transactions.filter(t => {
        const matchesQuery =
          (t.payee && t.payee.toLowerCase().includes(searchLower)) ||
          (t.normalizedMerchant && t.normalizedMerchant.toLowerCase().includes(searchLower)) ||
          (t.purpose && t.purpose.toLowerCase().includes(searchLower));

        if (!matchesQuery) return false;

        if (startDate && endDate) {
          const date = new Date(t.bookingDate);
          return date >= new Date(startDate) && date <= new Date(endDate);
        }
        return true;
      });

      // Sort by date descending
      filtered.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

      // Limit results
      filtered = filtered.slice(0, limit);

      return {
        query,
        matchCount: filtered.length,
        transactions: filtered.map(t => ({
          date: t.bookingDate,
          merchant: t.normalizedMerchant || t.payee,
          purpose: t.purpose,
          amount: t.amount,
          category: t.category
        }))
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Batch categorization endpoint with progress
app.post('/api/categorize-batch', async (req, res) => {
  try {
    const { transactions, existingCategories = [] } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions array is required' });
    }

    console.log(`[Batch Categorize] Processing ${transactions.length} transactions`);

    // Set up SSE headers for streaming progress
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const results = {};
    const newCategories = new Set();
    const batchSize = 10;
    const totalBatches = Math.ceil(transactions.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const i = batchIndex * batchSize;
      const batch = transactions.slice(i, i + batchSize);

      // Send progress update
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        batch: batchIndex + 1,
        totalBatches,
        processed: i,
        total: transactions.length
      })}\n\n`);

      const promises = batch.map(async (transaction) => {
        try {
          const categoryList = [...existingCategories, ...Array.from(newCategories)].join(', ');

          const prompt = `You are a financial transaction categorizer. Given the following transaction details, determine the most appropriate category.

Transaction Details:
- Merchant/Payee: ${transaction.payee}
- Purpose/Description: ${transaction.purpose}
- Amount: ${transaction.amount} EUR

Existing Categories: ${categoryList || 'GROCERIES, TRANSPORT, FOOD_DELIVERY, SUBSCRIPTIONS, UTILITIES, INSURANCE, RENT, CASH, INCOME, OTHER'}

Choose from existing categories if possible. If none fit well, you may suggest a NEW category name in UPPERCASE (e.g., ENTERTAINMENT, HEALTHCARE, EDUCATION).

CRITICAL: Respond with ONLY the category name in UPPERCASE. Do not include any notes, explanations, or parenthetical text. Just the category name, nothing more.

Examples of CORRECT responses:
- ENTERTAINMENT
- GROCERIES
- HEALTHCARE

Examples of INCORRECT responses (DO NOT DO THIS):
- ENTERTAINMENT (this is for leisure activities)
- GROCERIES - for food shopping
- HEALTHCARE (NOTE: medical expenses)

Your response:`;

          const response = await fetch(`${ANTHROPIC_BASE_URL}v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_AUTH_TOKEN,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: ANTHROPIC_MODEL,
              max_tokens: 50,
              messages: [{
                role: 'user',
                content: prompt
              }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            let category = data.content[0].text.trim().toUpperCase();

            // Clean up the category - extract only the category name
            // Remove anything after ( or - or :
            category = category.split('(')[0].split('-')[0].split(':')[0].trim();

            // Remove common prefixes/suffixes
            category = category.replace(/^(CATEGORY:|RESPONSE:)/i, '').trim();

            // Ensure it's a valid category name (only letters, numbers, underscores)
            category = category.replace(/[^A-Z0-9_]/g, '_');

            // Truncate if too long
            if (category.length > 50) {
              category = category.substring(0, 50);
            }

            // Track new categories
            if (!existingCategories.includes(category)) {
              newCategories.add(category);
            }

            results[transaction.id] = category;
          } else {
            results[transaction.id] = 'OTHER';
          }
        } catch (error) {
          console.error(`Error categorizing transaction ${transaction.id}:`, error);
          results[transaction.id] = 'OTHER';
        }
      });

      await Promise.all(promises);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[Batch Categorize] Completed: ${Object.keys(results).length} results`);
    console.log(`[Batch Categorize] New categories discovered: ${Array.from(newCategories).join(', ')}`);

    // Send final result
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      results,
      newCategories: Array.from(newCategories)
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('[Batch Categorize] Exception:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`API Base URL: ${ANTHROPIC_BASE_URL}`);
  console.log(`Model: ${ANTHROPIC_MODEL}`);
});
