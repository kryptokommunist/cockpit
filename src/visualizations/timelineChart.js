import Chart from 'chart.js/auto';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, min, max } from 'date-fns';
import { formatCurrency } from '../utils/numberUtils.js';

/**
 * Timeline chart - shows income, expenses, and balance over time
 */
export class TimelineChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.chart = null;
  }

  /**
   * Update chart with transaction data
   * @param {Array<Transaction>} transactions - Transactions
   */
  update(transactions) {
    if (transactions.length === 0) {
      this.destroy();
      return;
    }

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

    // Aggregate data by month
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

      const balance = income - expenses;

      return {
        month: format(monthStart, 'MMM yyyy'),
        income,
        expenses,
        balance
      };
    });

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
          label: 'Balance',
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
