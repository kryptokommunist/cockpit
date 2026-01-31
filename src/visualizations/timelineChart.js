import Chart from 'chart.js/auto';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, min, max } from 'date-fns';
import { formatCurrency } from '../utils/numberUtils.js';

/**
 * Timeline chart - shows income, expenses, and cumulative balance over time
 */
export class TimelineChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.chart = null;
    this.accountBalance = null;
  }

  /**
   * Update chart with transaction data
   * @param {Array<Transaction>} transactions - Transactions
   * @param {number} accountBalance - Current account balance from DKB (optional)
   */
  update(transactions, accountBalance = null) {
    if (transactions.length === 0) {
      this.destroy();
      return;
    }

    this.accountBalance = accountBalance;
    const data = this.prepareData(transactions);

    if (this.chart) {
      this.chart.data = data;
      this.chart.update();
    } else {
      this.create(data);
    }
  }

  /**
   * Prepare chart data from transactions
   * @param {Array<Transaction>} transactions - Transactions
   * @returns {Object} - Chart.js data object
   */
  prepareData(transactions) {
    // Get date range
    const dates = transactions.map(t => t.bookingDate);
    const minDate = min(dates);
    const maxDate = max(dates);

    // Generate monthly intervals
    const months = eachMonthOfInterval({
      start: startOfMonth(minDate),
      end: endOfMonth(maxDate)
    });

    // First pass: calculate income and expenses for each month
    const monthlyData = months.map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const monthTransactions = transactions.filter(t =>
        t.bookingDate >= monthStart && t.bookingDate <= monthEnd
      );

      const income = monthTransactions
        .filter(t => t.isIncome())
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(monthTransactions
        .filter(t => t.isExpense())
        .reduce((sum, t) => sum + t.amount, 0));

      return {
        month: format(monthStart, 'MMM yyyy'),
        income,
        expenses,
        netChange: income - expenses,
        balance: 0  // Will be calculated in second pass
      };
    });

    // Second pass: calculate cumulative balance BACKWARDS from current balance
    // The last month's ending balance should equal the current account balance
    if (this.accountBalance !== null) {
      // Start from the end (current balance) and work backwards
      let balance = this.accountBalance;

      // Go backwards through the months
      for (let i = monthlyData.length - 1; i >= 0; i--) {
        monthlyData[i].balance = balance;
        // Subtract this month's net change to get previous month's ending balance
        balance -= monthlyData[i].netChange;
      }
    } else {
      // No account balance available - use forward calculation starting from 0
      let cumulativeBalance = 0;
      for (let i = 0; i < monthlyData.length; i++) {
        cumulativeBalance += monthlyData[i].netChange;
        monthlyData[i].balance = cumulativeBalance;
      }
    }

    return {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: 'Income',
          data: monthlyData.map(d => d.income),
          backgroundColor: 'rgba(76, 175, 80, 0.5)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: monthlyData.map(d => d.expenses),
          backgroundColor: 'rgba(244, 67, 54, 0.5)',
          borderColor: 'rgba(244, 67, 54, 1)',
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: 'Cumulative Balance',
          data: monthlyData.map(d => d.balance),
          backgroundColor: 'rgba(33, 150, 243, 0.5)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2,
          tension: 0.4,
          type: 'line'
        }
      ]
    };
  }

  /**
   * Create the chart
   * @param {Object} data - Chart data
   */
  create(data) {
    this.chart = new Chart(this.canvas, {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                label += formatCurrency(context.parsed.y);
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          }
        }
      }
    });
  }

  /**
   * Destroy the chart
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
