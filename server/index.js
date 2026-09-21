import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { DKBService } from './dkbService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3005;
const IS_CF = !!process.env.VCAP_SERVICES;

// Parse CF VCAP_SERVICES for AI Core and GenAI proxy credentials
function parseVcapServices() {
  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) return { aicore: null };
  try {
    const services = JSON.parse(vcap);
    let aicore = null;
    for (const key of Object.keys(services)) {
      if (key.toLowerCase().includes('aicore')) {
        const creds = services[key][0]?.credentials || {};
        const uaa = creds.uaa || {};
        const urls = creds.serviceurls || {};
        aicore = {
          clientId: uaa.clientid || creds.clientid,
          clientSecret: uaa.clientsecret || creds.clientsecret,
          authUrl: uaa.url || creds.url,
          apiUrl: urls.AI_API_URL || creds.AI_API_URL,
        };
      }
    }
    return { aicore };
  } catch {
    return { aicore: null };
  }
}

const { aicore: _cfAicore } = parseVcapServices();

// Simple token cache for AI Core OAuth
const _aicoreTokenCache = { token: null, expiresAt: 0 };

async function getAicoreToken() {
  const now = Date.now() / 1000;
  if (_aicoreTokenCache.token && now < _aicoreTokenCache.expiresAt - 30) {
    return _aicoreTokenCache.token;
  }
  const resp = await fetch(`${_cfAicore.authUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: _cfAicore.clientId,
      client_secret: _cfAicore.clientSecret,
    }),
  });
  if (!resp.ok) throw new Error(`AI Core auth failed: ${resp.status}`);
  const data = await resp.json();
  _aicoreTokenCache.token = data.access_token;
  _aicoreTokenCache.expiresAt = now + (data.expires_in || 3600);
  return _aicoreTokenCache.token;
}

function useAicore() {
  return !!(
    _cfAicore?.clientId &&
    _cfAicore?.clientSecret &&
    _cfAicore?.authUrl &&
    _cfAicore?.apiUrl
  );
}

// Build the URL + headers + body for a Claude/AI Core messages request
async function buildLlmRequest(requestBody) {
  const AICORE_DEPLOYMENT_ID = process.env.AICORE_DEPLOYMENT_ID || 'd34c832f51430c83';
  const AICORE_RESOURCE_GROUP = process.env.AICORE_RESOURCE_GROUP || 'default';
  const GENAI_PROXY_URL = process.env.GENAI_PROXY_URL || 'http://host.docker.internal:9988/anthropic/v1/messages';
  const GENAI_API_KEY = process.env.GENAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
  const GENAI_MODEL = process.env.GENAI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

  if (useAicore()) {
    const token = await getAicoreToken();
    const url = `${_cfAicore.apiUrl}/v2/inference/deployments/${AICORE_DEPLOYMENT_ID}/v1/messages`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'AI-Resource-Group': AICORE_RESOURCE_GROUP,
      'anthropic-version': '2023-06-01',
    };
    return { url, headers, body: { ...requestBody, model: GENAI_MODEL } };
  }

  // GenAI proxy / local proxy fallback
  const url = GENAI_PROXY_URL;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': GENAI_API_KEY,
    'anthropic-version': '2023-06-01',
  };
  return { url, headers, body: { ...requestBody, model: GENAI_MODEL } };
}

// Resolve the model name to report to callers
function resolvedModel() {
  return process.env.GENAI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
}

// Legacy env vars kept for local dev / Docker
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'http://host.docker.internal:9988/anthropic/';
const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';
const ANTHROPIC_MODEL = resolvedModel();

// Access token guard for the frontend (CF deployments only)
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

// Initialize DKB service
const dkbService = new DKBService();

// Enable CORS for frontend
app.use(cors({
  origin: IS_CF ? true : 'http://localhost:3004',
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Serve built frontend on CF (dist/ is built before cf push)
if (IS_CF) {
  const distDir = path.join(__dirname, '..', 'dist');

  // Token check middleware for all non-API, non-health, non-asset routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    if (req.path.startsWith('/assets/') || req.path.endsWith('.svg') || req.path.endsWith('.ico')) return next();
    if (ACCESS_TOKEN && req.query.token !== ACCESS_TOKEN) {
      return res.status(401).send('Unauthorized: missing or invalid ?token=');
    }
    next();
  });

  app.use(express.static(distDir));

  // SPA fallback — pass token through
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get API configuration
app.get('/api/config', (req, res) => {
  res.json({
    model: resolvedModel(),
    available: true,
    backend: useAicore() ? 'aicore' : 'genai-proxy',
  });
});

// Test API connection
app.get('/api/test', async (req, res) => {
  try {
    const { url, headers, body } = await buildLlmRequest({
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }],
    });
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (response.ok) {
      res.json({ success: true, status: response.status });
    } else {
      const text = await response.text();
      res.status(response.status).json({ success: false, status: response.status, error: text });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy endpoint for Claude API with tool support and streaming thinking
app.post('/api/claude', async (req, res) => {
  try {
    const { prompt, maxTokens = 1024, transactions = [], projections = null, tools = [], streaming = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`[Claude API] Request: ${prompt.substring(0, 100)}...`);
    console.log(`[Claude API] Has tools: ${tools.length > 0}, Has transactions: ${transactions.length > 0}, Has projections: ${!!projections}, Streaming: ${streaming}`);

    if (projections) {
      console.log('[Claude API] Projections structure:', {
        keys: Object.keys(projections),
        projectionsCount: projections.projections?.length || 0,
        recurringItemsCount: projections.recurringItems?.length || 0,
        oneTimeItemsCount: projections.oneTimeItems?.length || 0
      });
    }

    // Build Claude request with tools if provided (unused, kept for reference)
    void { model: resolvedModel(), max_tokens: maxTokens };

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
      const { url: llmUrl, headers: llmHeaders, body: llmBodyBase } = await buildLlmRequest({
        max_tokens: maxTokens,
        messages: conversationMessages,
        tools: tools.length > 0 ? tools : undefined,
      });
      const response = await fetch(llmUrl, {
        method: 'POST',
        headers: llmHeaders,
        body: JSON.stringify(llmBodyBase),
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
            const toolResult = await executeToolOnTransactions(toolUseBlock.name, toolUseBlock.input, transactions, projections);

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
async function executeToolOnTransactions(toolName, input, transactions, projections = null) {
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

    case 'get_future_projections_for_month': {
      console.log('[Tool] get_future_projections_for_month - input:', JSON.stringify(input));
      console.log('[Tool] projections object:', projections ? 'exists' : 'null');
      console.log('[Tool] projections keys:', projections ? Object.keys(projections) : 'N/A');
      console.log('[Tool] projections.projections:', projections?.projections ? `array with ${projections.projections.length} items` : 'missing');

      if (projections?.projections?.length > 0) {
        console.log('[Tool] First projection sample:', JSON.stringify(projections.projections[0]));
      }

      if (!projections || !projections.projections) {
        console.log('[Tool] ERROR: No projection data available');
        return { error: 'No projection data available' };
      }

      const { year, month } = input;
      // Use same logic as UI: start of month to start of next month (exclusive end)
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1); // First day of NEXT month

      console.log('[Tool] Filtering for date range:', { startDate, endDate, month, year });

      const monthProjections = projections.projections.filter(p => {
        const pDate = new Date(p.date);
        return pDate >= startDate && pDate < endDate; // Note: < not <=
      });

      console.log('[Tool] Found', monthProjections.length, 'projections for the month');

      const income = monthProjections.filter(p => p.isIncome).reduce((s, p) => s + Math.abs(p.amount), 0);
      const expenses = monthProjections.filter(p => !p.isIncome).reduce((s, p) => s + Math.abs(p.amount), 0);

      // Calculate cumulative balance (starting balance + all changes up to this month)
      const startingBalance = projections.startingBalance || 0;

      // Get all projections from start date (now) up to end of requested month
      const now = new Date();
      const allProjectionsUpToMonth = projections.projections.filter(p => {
        const pDate = new Date(p.date);
        return pDate >= now && pDate < endDate;
      });

      // Calculate cumulative balance
      let cumulativeBalance = startingBalance;
      allProjectionsUpToMonth.forEach(p => {
        if (p.isIncome) {
          cumulativeBalance += Math.abs(p.amount);
        } else {
          cumulativeBalance -= Math.abs(p.amount);
        }
      });

      const categoryBreakdown = {};
      monthProjections.filter(p => !p.isIncome).forEach(p => {
        const cat = p.category || 'OTHER';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(p.amount);
      });

      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        projectedIncome: Number(income.toFixed(2)),
        projectedExpenses: Number(expenses.toFixed(2)),
        monthlyBalance: Number((income - expenses).toFixed(2)),
        projectedBalance: Number(cumulativeBalance.toFixed(2)), // This is now cumulative
        projectedSavingsRate: income > 0 ? Number(((income - expenses) / income * 100).toFixed(1)) : 0,
        categoryBreakdown: Object.entries(categoryBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => ({
            category: cat,
            amount: Number(amt.toFixed(2)),
            percentage: expenses > 0 ? Number((amt / expenses * 100).toFixed(1)) : 0
          }))
      };
    }

    case 'get_recurring_projections': {
      if (!projections || !projections.recurringItems) {
        return { error: 'No projection data available' };
      }

      const recurringItems = projections.recurringItems;
      const expenses = recurringItems.filter(item => !item.isIncome).map(item => {
        let monthlyCost = Math.abs(item.amount);
        switch (item.frequency) {
          case 'weekly': monthlyCost = monthlyCost * 4.33; break;
          case 'quarterly': monthlyCost = monthlyCost / 3; break;
          case 'yearly': monthlyCost = monthlyCost / 12; break;
        }
        return {
          name: item.name,
          category: item.category,
          frequency: item.frequency,
          amount: Number(Math.abs(item.amount).toFixed(2)),
          monthlyCost: Number(monthlyCost.toFixed(2))
        };
      });

      const income = recurringItems.filter(item => item.isIncome).map(item => {
        let monthlyCost = Math.abs(item.amount);
        switch (item.frequency) {
          case 'weekly': monthlyCost = monthlyCost * 4.33; break;
          case 'quarterly': monthlyCost = monthlyCost / 3; break;
          case 'yearly': monthlyCost = monthlyCost / 12; break;
        }
        return {
          name: item.name,
          category: item.category,
          frequency: item.frequency,
          amount: Number(Math.abs(item.amount).toFixed(2)),
          monthlyCost: Number(monthlyCost.toFixed(2))
        };
      });

      const totalExpenses = expenses.reduce((s, e) => s + e.monthlyCost, 0);
      const totalIncome = income.reduce((s, i) => s + i.monthlyCost, 0);

      return {
        recurringExpenses: expenses,
        recurringIncome: income,
        summary: {
          totalRecurringExpenses: Number(totalExpenses.toFixed(2)),
          totalRecurringIncome: Number(totalIncome.toFixed(2)),
          netRecurring: Number((totalIncome - totalExpenses).toFixed(2))
        }
      };
    }

    case 'get_onetime_projections': {
      if (!projections || !projections.oneTimeItems) {
        return { error: 'No projection data available' };
      }

      return {
        oneTimeItems: projections.oneTimeItems.map(item => ({
          name: item.name,
          category: item.category,
          date: new Date(item.date).toISOString().split('T')[0],
          amount: Number(Math.abs(item.amount).toFixed(2)),
          isIncome: item.isIncome
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

          const { url: llmUrl2, headers: llmHeaders2, body: llmBody2 } = await buildLlmRequest({
            max_tokens: 50,
            messages: [{ role: 'user', content: prompt }],
          });
          const response = await fetch(llmUrl2, {
            method: 'POST',
            headers: llmHeaders2,
            body: JSON.stringify(llmBody2),
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

// ============================================================================
// DKB Bank Integration Endpoints
// ============================================================================

// Fetch all data (accounts + transactions) in a single login
app.post('/api/dkb/fetch-all', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log(`[DKB API] Fetching all data for user: ${username}`);

    // Fetch all data in one login session (1095 days = ~3 years of history)
    const result = await dkbService.fetchAllInOneSession(username, password, 1095);

    res.json({
      success: true,
      accounts: result.accounts,
      transactions: result.transactions
    });
  } catch (error) {
    console.error('[DKB API] Error fetching all data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Step 1: Authenticate and get available accounts
app.post('/api/dkb/auth', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log(`[DKB API] Authenticating user: ${username}`);

    const result = await dkbService.createConsentAndGetAccounts({ username, password });

    res.json({
      success: true,
      session: result.session,
      accounts: result.accounts,
      username: result.username,
      password: result.password
    });
  } catch (error) {
    console.error('[DKB API] Error authenticating:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Step 2: Add selected account
app.post('/api/dkb/accounts', async (req, res) => {
  try {
    const { session, selectedAccount, username, password } = req.body;

    if (!session || !selectedAccount) {
      return res.status(400).json({ error: 'Session and selected account are required' });
    }

    console.log(`[DKB API] Adding account: ${selectedAccount.iban}`);

    const result = await dkbService.addAccountWithSelection({
      session,
      selectedAccount,
      username,
      password
    });

    res.json({
      success: true,
      account: result
    });
  } catch (error) {
    console.error('[DKB API] Error adding account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List DKB accounts
app.get('/api/dkb/accounts', (req, res) => {
  try {
    const accounts = dkbService.listAccounts();
    res.json({
      success: true,
      accounts
    });
  } catch (error) {
    console.error('[DKB API] Error listing accounts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get account status
app.get('/api/dkb/accounts/:accountId/status', (req, res) => {
  try {
    const { accountId } = req.params;
    const status = dkbService.getAccountStatus(accountId);

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('[DKB API] Error getting account status:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Fetch transactions from DKB
app.post('/api/dkb/accounts/:accountId/transactions', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate } = req.body;

    console.log(`[DKB API] Fetching transactions for account: ${accountId}`);

    const transactions = await dkbService.fetchTransactions(accountId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('[DKB API] Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove DKB account
app.delete('/api/dkb/accounts/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;

    console.log(`[DKB API] Removing account: ${accountId}`);
    dkbService.removeAccount(accountId);

    res.json({
      success: true,
      message: 'Account removed successfully'
    });
  } catch (error) {
    console.error('[DKB API] Error removing account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Parse DKB CSV (for manual upload scenario)
app.post('/api/dkb/parse-csv', async (req, res) => {
  try {
    const { csvContent } = req.body;

    if (!csvContent) {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    console.log('[DKB API] Parsing DKB CSV');

    const transactions = dkbService.parseDKBCSV(csvContent);

    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('[DKB API] Error parsing CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`LLM backend: ${useAicore() ? 'AI Core' : 'GenAI Proxy'}`);
  console.log(`Model: ${resolvedModel()}`);
  console.log(`DKB integration endpoints available`);
});
