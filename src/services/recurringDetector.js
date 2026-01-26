import { differenceInDays, addDays, subMonths, subDays, startOfQuarter, subQuarters, subYears } from 'date-fns';

/**
 * Recurring cost detection service
 */
export class RecurringDetector {
  constructor() {
    this.minOccurrences = 3;
    this.intervalTolerance = {
      weekly: { target: 7, tolerance: 3 },
      monthly: { target: 30, tolerance: 10 }, // Increased from 5 to 10 days
      quarterly: { target: 90, tolerance: 20 }, // Increased from 10 to 20 days
      yearly: { target: 365, tolerance: 30 } // Increased from 15 to 30 days
    };
    this.amountVarianceThreshold = 0.35; // 35% variance allowed (increased from 20%)
    this.filterMode = 'recent'; // 'recent' or 'all'
  }

  /**
   * Set filter mode
   * @param {string} mode - 'recent' or 'all'
   */
  setFilterMode(mode) {
    this.filterMode = mode;
  }

  /**
   * Detect recurring transactions
   * @param {Array<Transaction>} transactions - All transactions
   * @returns {Array<Object>} - Detected recurring patterns
   */
  detect(transactions) {
    // Group transactions by normalized merchant
    const merchantGroups = this.groupByMerchant(transactions);

    console.log(`[RecurringDetector] Analyzing ${Object.keys(merchantGroups).length} unique merchants`);

    // Log merchants with many transactions
    const highOccurrence = Object.entries(merchantGroups)
      .filter(([_, txs]) => txs.filter(t => t.isExpense()).length >= 5)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    console.log('[RecurringDetector] Top merchants by transaction count:');
    highOccurrence.forEach(([merchant, txs]) => {
      const expenses = txs.filter(t => t.isExpense());
      console.log(`  ${merchant}: ${expenses.length} expenses`);
    });

    const recurring = [];
    const now = new Date();

    // Analyze each merchant group
    for (const [merchant, merchantTransactions] of Object.entries(merchantGroups)) {
      if (merchantTransactions.length < this.minOccurrences) {
        continue;
      }

      // Only check expenses (negative amounts)
      const expenses = merchantTransactions.filter(t => t.isExpense());
      if (expenses.length < this.minOccurrences) {
        continue;
      }

      const pattern = this.analyzePattern(merchant, expenses);
      if (pattern) {
        // Filter by time period if in 'recent' mode
        if (this.filterMode === 'recent') {
          if (this.isRecentlyPaid(pattern, now)) {
            recurring.push(pattern);
          }
        } else {
          recurring.push(pattern);
        }
      }
    }

    console.log(`[RecurringDetector] Detected ${recurring.length} recurring patterns`);

    // Sort by monthly cost (highest first)
    recurring.sort((a, b) => b.monthlyCost - a.monthlyCost);

    return recurring;
  }

  /**
   * Check if a recurring pattern was paid in the relevant time period
   * @param {Object} pattern - Recurring pattern
   * @param {Date} now - Current date
   * @returns {boolean} - True if recently paid
   */
  isRecentlyPaid(pattern, now) {
    const lastDate = pattern.lastDate;

    switch (pattern.frequency) {
      case 'weekly':
        // Paid in last 2 weeks
        return differenceInDays(now, lastDate) <= 14;

      case 'monthly':
        // Paid in last month
        const oneMonthAgo = subMonths(now, 1);
        return lastDate >= oneMonthAgo;

      case 'quarterly':
        // Paid in last quarter
        const lastQuarterStart = startOfQuarter(subQuarters(now, 1));
        return lastDate >= lastQuarterStart;

      case 'yearly':
        // Paid in last year
        const oneYearAgo = subYears(now, 1);
        return lastDate >= oneYearAgo;

      default:
        return true;
    }
  }

  /**
   * Group transactions by normalized merchant name
   * @param {Array<Transaction>} transactions - Transactions
   * @returns {Object} - Grouped transactions
   */
  groupByMerchant(transactions) {
    const groups = {};

    transactions.forEach(transaction => {
      const merchant = transaction.normalizedMerchant || transaction.payee;
      if (!merchant) return;

      if (!groups[merchant]) {
        groups[merchant] = [];
      }
      groups[merchant].push(transaction);
    });

    return groups;
  }

  /**
   * Analyze transaction pattern for a merchant
   * @param {string} merchant - Merchant name
   * @param {Array<Transaction>} transactions - Merchant transactions
   * @returns {Object|null} - Pattern object or null
   */
  analyzePattern(merchant, transactions) {
    const debug = merchant.toLowerCase().includes('miete') ||
                  merchant.toLowerCase().includes('rent') ||
                  transactions.length >= 10; // Debug high-occurrence merchants

    if (debug) {
      console.log(`[RecurringDetector] Analyzing: ${merchant} (${transactions.length} transactions)`);
    }

    if (transactions.length < this.minOccurrences) {
      if (debug) console.log(`  ❌ Too few occurrences: ${transactions.length} < ${this.minOccurrences}`);
      return null;
    }

    // Sort by date
    const sorted = transactions.sort((a, b) => a.bookingDate - b.bookingDate);

    // Calculate intervals between consecutive transactions
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      const daysBetween = differenceInDays(sorted[i].bookingDate, sorted[i - 1].bookingDate);
      intervals.push(daysBetween);
    }

    if (intervals.length === 0) {
      if (debug) console.log(`  ❌ No intervals calculated`);
      return null;
    }

    // Filter out same-day transactions (0 intervals) - likely corrections/split payments
    const validIntervals = intervals.filter(interval => interval > 0);

    if (validIntervals.length === 0) {
      if (debug) console.log(`  ❌ No valid intervals (all same-day transactions)`);
      return null;
    }

    // Calculate average interval using only valid intervals
    const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;

    if (debug) {
      console.log(`  All intervals: ${intervals.join(', ')}`);
      console.log(`  Valid intervals (excluding 0): ${validIntervals.join(', ')}`);
      console.log(`  Average interval: ${avgInterval.toFixed(1)} days`);
    }

    // Determine frequency type using valid intervals
    const frequency = this.determineFrequency(avgInterval, validIntervals);
    if (!frequency) {
      if (debug) console.log(`  ❌ No frequency match for avg interval ${avgInterval.toFixed(1)}`);
      return null;
    }

    if (debug) {
      console.log(`  ✓ Frequency: ${frequency.type}`);
    }

    // Get amounts for logging and calculations
    const amounts = sorted.map(t => Math.abs(t.amount));

    if (debug) {
      console.log(`  Amounts: ${amounts.map(a => a.toFixed(2)).join(', ')}`);
      console.log(`  ✅ Pattern detected!`);
    }

    // Use most recent amount (not average across gaps)
    const mostRecentAmount = Math.abs(sorted[sorted.length - 1].amount);

    // Calculate confidence score using valid intervals only
    const confidence = this.calculateConfidence(validIntervals, amounts, frequency);

    // Calculate monthly cost using most recent amount
    const monthlyCost = this.calculateMonthlyCost(mostRecentAmount, frequency.type);

    // Predict next occurrence
    const lastDate = sorted[sorted.length - 1].bookingDate;
    const nextDate = addDays(lastDate, frequency.avgInterval);

    return {
      merchant,
      frequency: frequency.type,
      avgInterval: frequency.avgInterval,
      occurrences: sorted.length,
      mostRecentAmount, // Use most recent amount
      monthlyCost,
      confidence,
      lastDate,
      nextDate,
      transactions: sorted,
      category: sorted[0].category
    };
  }

  /**
   * Determine frequency type from intervals
   * @param {number} avgInterval - Average interval in days
   * @param {Array<number>} intervals - All intervals
   * @returns {Object|null} - Frequency info or null
   */
  determineFrequency(avgInterval, intervals) {
    for (const [type, config] of Object.entries(this.intervalTolerance)) {
      const diff = Math.abs(avgInterval - config.target);
      if (diff <= config.tolerance) {
        // Check if most intervals are within tolerance
        const withinTolerance = intervals.filter(
          interval => Math.abs(interval - config.target) <= config.tolerance
        ).length;

        if (withinTolerance / intervals.length >= 0.6) { // 60% must be consistent (relaxed from 70%)
          return {
            type,
            avgInterval: Math.round(avgInterval),
            target: config.target
          };
        }
      }
    }

    return null;
  }

  /**
   * Calculate variance of amounts
   * @param {Array<number>} amounts - Amounts
   * @param {number} avgAmount - Average amount
   * @returns {number} - Variance ratio
   */
  calculateVariance(amounts, avgAmount) {
    if (avgAmount === 0) return 1;

    const squaredDiffs = amounts.map(amt => Math.pow(amt - avgAmount, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / avgAmount; // Coefficient of variation
  }

  /**
   * Calculate confidence score (0-1)
   * @param {Array<number>} intervals - Intervals
   * @param {Array<number>} amounts - Amounts
   * @param {Object} frequency - Frequency info
   * @returns {number} - Confidence score
   */
  calculateConfidence(intervals, amounts, frequency) {
    let score = 0;

    // More occurrences = higher confidence
    const occurrenceScore = Math.min(intervals.length / 10, 1) * 0.3;
    score += occurrenceScore;

    // Consistent intervals = higher confidence
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = this.calculateVariance(intervals, avgInterval);
    const intervalScore = Math.max(0, 1 - intervalVariance) * 0.4;
    score += intervalScore;

    // Consistent amounts = higher confidence
    const avgAmount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const amountVariance = this.calculateVariance(amounts, avgAmount);
    const amountScore = Math.max(0, 1 - amountVariance) * 0.3;
    score += amountScore;

    return Math.min(score, 1);
  }

  /**
   * Calculate estimated monthly cost
   * @param {number} avgAmount - Average amount
   * @param {string} frequencyType - Frequency type
   * @returns {number} - Monthly cost
   */
  calculateMonthlyCost(avgAmount, frequencyType) {
    const multipliers = {
      weekly: 4.33, // Average weeks per month
      monthly: 1,
      quarterly: 1 / 3,
      yearly: 1 / 12
    };

    return avgAmount * (multipliers[frequencyType] || 1);
  }

  /**
   * Get recurring costs summary
   * @param {Array<Object>} recurring - Recurring patterns
   * @returns {Object} - Summary
   */
  getSummary(recurring) {
    const totalMonthlyCost = recurring.reduce((sum, r) => sum + r.monthlyCost, 0);

    const byFrequency = {};
    recurring.forEach(r => {
      if (!byFrequency[r.frequency]) {
        byFrequency[r.frequency] = {
          count: 0,
          totalCost: 0
        };
      }
      byFrequency[r.frequency].count++;
      byFrequency[r.frequency].totalCost += r.monthlyCost;
    });

    return {
      totalRecurring: recurring.length,
      totalMonthlyCost,
      byFrequency,
      topRecurring: recurring.slice(0, 5)
    };
  }
}
