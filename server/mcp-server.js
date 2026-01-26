import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Server for Bank Transaction Analysis
 * Provides tools for Claude to query and analyze financial data
 */

// In-memory storage for transaction data
let transactionsData = [];
let budgetCalculatorFunc = null;
let recurringDetectorFunc = null;

/**
 * Initialize the data that the MCP server will use
 */
export function initializeMCPData(transactions, budgetCalc, recurringDetect) {
  transactionsData = transactions;
  budgetCalculatorFunc = budgetCalc;
  recurringDetectorFunc = recurringDetect;
}

/**
 * Filter transactions by date range
 */
function filterTransactionsByDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return transactionsData.filter(t => {
    const date = new Date(t.bookingDate);
    return date >= start && date <= end;
  });
}

/**
 * Get budget for a specific month
 */
function getBudgetForMonth(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month

  const transactions = filterTransactionsByDateRange(startDate, endDate);

  const income = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = Math.abs(transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0));

  const categoryBreakdown = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const category = t.category || 'OTHER';
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + Math.abs(t.amount);
  });

  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    income: Number(income.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    balance: Number((income - expenses).toFixed(2)),
    savingsRate: income > 0 ? Number(((income - expenses) / income * 100).toFixed(1)) : 0,
    transactionCount: transactions.length,
    categoryBreakdown: Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [cat, amt]) => {
        obj[cat] = {
          amount: Number(amt.toFixed(2)),
          percentage: expenses > 0 ? Number((amt / expenses * 100).toFixed(1)) : 0
        };
        return obj;
      }, {})
  };
}

/**
 * Get spending by category for a period
 */
function getSpendingByCategory(startDate, endDate) {
  const transactions = filterTransactionsByDateRange(startDate, endDate);

  const categoryTotals = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const category = t.category || 'OTHER';
    if (!categoryTotals[category]) {
      categoryTotals[category] = {
        total: 0,
        count: 0,
        transactions: []
      };
    }
    categoryTotals[category].total += Math.abs(t.amount);
    categoryTotals[category].count++;
    categoryTotals[category].transactions.push({
      date: t.bookingDate.toISOString().split('T')[0],
      merchant: t.normalizedMerchant || t.payee,
      amount: Math.abs(t.amount)
    });
  });

  return Object.entries(categoryTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([category, data]) => ({
      category,
      total: Number(data.total.toFixed(2)),
      count: data.count,
      avgPerTransaction: Number((data.total / data.count).toFixed(2)),
      topTransactions: data.transactions.sort((a, b) => b.amount - a.amount).slice(0, 5)
    }));
}

/**
 * Get recurring costs
 */
function getRecurringCosts(startDate, endDate) {
  const transactions = filterTransactionsByDateRange(startDate, endDate);

  // Simple recurring detection based on merchant frequency
  const merchantFrequency = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const merchant = t.normalizedMerchant || t.payee;
    if (!merchantFrequency[merchant]) {
      merchantFrequency[merchant] = {
        count: 0,
        total: 0,
        amounts: [],
        dates: []
      };
    }
    merchantFrequency[merchant].count++;
    merchantFrequency[merchant].total += Math.abs(t.amount);
    merchantFrequency[merchant].amounts.push(Math.abs(t.amount));
    merchantFrequency[merchant].dates.push(t.bookingDate);
  });

  return Object.entries(merchantFrequency)
    .filter(([_, data]) => data.count >= 2)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([merchant, data]) => ({
      merchant,
      occurrences: data.count,
      totalAmount: Number(data.total.toFixed(2)),
      avgAmount: Number((data.total / data.count).toFixed(2)),
      category: transactionsData.find(t =>
        (t.normalizedMerchant || t.payee) === merchant
      )?.category || 'OTHER'
    }));
}

/**
 * Compare budgets between two periods
 */
function compareBudgets(period1Start, period1End, period2Start, period2End) {
  const p1Trans = filterTransactionsByDateRange(period1Start, period1End);
  const p2Trans = filterTransactionsByDateRange(period2Start, period2End);

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
      balanceDiff: Number(((p2Income - p2Expenses) - (p1Income - p1Expenses)).toFixed(2)),
      incomeChangePercent: p1Income > 0 ? Number(((p2Income - p1Income) / p1Income * 100).toFixed(1)) : 0,
      expensesChangePercent: p1Expenses > 0 ? Number(((p2Expenses - p1Expenses) / p1Expenses * 100).toFixed(1)) : 0
    }
  };
}

/**
 * Create MCP server
 */
export function createMCPServer() {
  const server = new Server(
    {
      name: 'bank-transaction-analyzer',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_budget_for_month',
          description: 'Get budget data for a specific month including income, expenses, balance, savings rate, and category breakdown',
          inputSchema: {
            type: 'object',
            properties: {
              year: {
                type: 'number',
                description: 'Year (e.g., 2026)',
              },
              month: {
                type: 'number',
                description: 'Month number (1-12)',
              },
            },
            required: ['year', 'month'],
          },
        },
        {
          name: 'get_spending_by_category',
          description: 'Get detailed spending breakdown by category for a date range, including top transactions',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
        {
          name: 'get_recurring_costs',
          description: 'Get recurring costs (subscriptions, regular payments) for a date range',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
        {
          name: 'compare_budgets',
          description: 'Compare budget data between two time periods to identify changes in income, expenses, and balance',
          inputSchema: {
            type: 'object',
            properties: {
              period1Start: {
                type: 'string',
                description: 'Period 1 start date in YYYY-MM-DD format',
              },
              period1End: {
                type: 'string',
                description: 'Period 1 end date in YYYY-MM-DD format',
              },
              period2Start: {
                type: 'string',
                description: 'Period 2 start date in YYYY-MM-DD format',
              },
              period2End: {
                type: 'string',
                description: 'Period 2 end date in YYYY-MM-DD format',
              },
            },
            required: ['period1Start', 'period1End', 'period2Start', 'period2End'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_budget_for_month': {
          const result = getBudgetForMonth(args.year, args.month);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_spending_by_category': {
          const result = getSpendingByCategory(args.startDate, args.endDate);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_recurring_costs': {
          const result = getRecurringCosts(args.startDate, args.endDate);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'compare_budgets': {
          const result = compareBudgets(
            args.period1Start,
            args.period1End,
            args.period2Start,
            args.period2End
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Start the MCP server
 */
export async function startMCPServer() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bank Transaction Analyzer MCP Server running on stdio');
}
