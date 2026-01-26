import { differenceInMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Budget calculator service
 */
export class BudgetCalculator {
  constructor() {
    this.periods = {
      '3months': 3,
      '6months': 6,
      '12months': 12,
      'all': null,
      'custom': null
    };
  }

  /**
   * Calculate budget for a given time period
   * @param {Array<Transaction>} transactions - All transactions
   * @param {string} period - Period key ('3months', '6months', etc.)
   * @param {Object} customRange - Custom date range {start, end}
   * @returns {Object} - Budget calculation
   */
  calculate(transactions, period = 'all', customRange = null) {
    let filteredTransactions = transactions;

    // Filter by period
    if (period !== 'all') {
      const dateRange = this.getDateRange(transactions, period, customRange);
      filteredTransactions = transactions.filter(t =>
        t.bookingDate >= dateRange.start && t.bookingDate <= dateRange.end
      );
    }

    if (filteredTransactions.length === 0) {
      return this.getEmptyBudget();
    }

    // Calculate date range
    const dates = filteredTransactions.map(t => t.bookingDate);
    const startDate = new Date(Math.min(...dates));
    const endDate = new Date(Math.max(...dates));
    const monthsInPeriod = Math.max(1, differenceInMonths(endDate, startDate) + 1);

    // Calculate totals
    const income = filteredTransactions
      .filter(t => t.isIncome())
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = Math.abs(filteredTransactions
      .filter(t => t.isExpense())
      .reduce((sum, t) => sum + t.amount, 0));

    const balance = income - expenses;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;

    // Calculate by category
    const categoryBreakdown = this.calculateCategoryBreakdown(filteredTransactions);

    // Calculate monthly averages
    const avgMonthlyIncome = income / monthsInPeriod;
    const avgMonthlyExpenses = expenses / monthsInPeriod;
    const avgMonthlyBalance = balance / monthsInPeriod;

    return {
      period,
      startDate,
      endDate,
      monthsInPeriod,
      totalIncome: income,
      totalExpenses: expenses,
      balance,
      savingsRate,
      avgMonthlyIncome,
      avgMonthlyExpenses,
      avgMonthlyBalance,
      categoryBreakdown,
      transactionCount: filteredTransactions.length
    };
  }

  /**
   * Get date range for a period
   * @param {Array<Transaction>} transactions - All transactions
   * @param {string} period - Period key
   * @param {Object} customRange - Custom range
   * @returns {Object} - {start, end}
   */
  getDateRange(transactions, period, customRange) {
    if (period === 'custom' && customRange) {
      return {
        start: customRange.start,
        end: customRange.end
      };
    }

    const now = new Date();
    const months = this.periods[period];

    if (months) {
      return {
        start: startOfMonth(subMonths(now, months)),
        end: endOfMonth(now)
      };
    }

    // Default to all transactions
    const dates = transactions.map(t => t.bookingDate);
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates))
    };
  }

  /**
   * Calculate category breakdown
   * @param {Array<Transaction>} transactions - Transactions
   * @returns {Array<Object>} - Category breakdown
   */
  calculateCategoryBreakdown(transactions) {
    const categoryTotals = {};

    // Group by category
    transactions.forEach(t => {
      const category = t.category;
      if (!categoryTotals[category]) {
        categoryTotals[category] = {
          category,
          income: 0,
          expenses: 0,
          count: 0
        };
      }

      if (t.isIncome()) {
        categoryTotals[category].income += t.amount;
      } else {
        categoryTotals[category].expenses += Math.abs(t.amount);
      }
      categoryTotals[category].count++;
    });

    // Convert to array and sort by expenses (descending)
    return Object.values(categoryTotals)
      .sort((a, b) => b.expenses - a.expenses);
  }

  /**
   * Get empty budget object
   * @returns {Object} - Empty budget
   */
  getEmptyBudget() {
    return {
      period: 'all',
      startDate: new Date(),
      endDate: new Date(),
      monthsInPeriod: 0,
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      savingsRate: 0,
      avgMonthlyIncome: 0,
      avgMonthlyExpenses: 0,
      avgMonthlyBalance: 0,
      categoryBreakdown: [],
      transactionCount: 0
    };
  }

  /**
   * Export budget as JSON
   * @param {Object} budget - Budget object
   * @returns {string} - JSON string
   */
  exportJSON(budget) {
    return JSON.stringify(budget, null, 2);
  }

  /**
   * Compare two periods
   * @param {Object} budget1 - First budget
   * @param {Object} budget2 - Second budget
   * @returns {Object} - Comparison
   */
  compare(budget1, budget2) {
    return {
      incomeDiff: budget2.totalIncome - budget1.totalIncome,
      expensesDiff: budget2.totalExpenses - budget1.totalExpenses,
      balanceDiff: budget2.balance - budget1.balance,
      savingsRateDiff: budget2.savingsRate - budget1.savingsRate
    };
  }
}
