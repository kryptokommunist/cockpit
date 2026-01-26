import Chart from 'chart.js/auto';
import { formatCurrency } from '../utils/numberUtils.js';
import { format, startOfMonth, eachMonthOfInterval, addMonths } from 'date-fns';

/**
 * Future Chart Manager - manages projected charts
 */
export class FutureChartManager {
  constructor(projectionService, categorizer) {
    this.projectionService = projectionService;
    this.categorizer = categorizer;
    this.timelineChart = null;
    this.categoryChart = null;
    this.recurringChart = null;
    this.projections = [];

    this.initializeCharts();
    this.setupEventListeners();
  }

  /**
   * Initialize future charts
   */
  initializeCharts() {
    const timelineCanvas = document.getElementById('future-timeline-chart');
    const categoryCanvas = document.getElementById('future-category-chart');
    const recurringCanvas = document.getElementById('future-recurring-chart');

    if (timelineCanvas) {
      this.createTimelineChart(timelineCanvas);
    }

    if (categoryCanvas) {
      this.createCategoryChart(categoryCanvas);
    }

    if (recurringCanvas) {
      this.createRecurringChart(recurringCanvas);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    window.addEventListener('update-future-projection', (event) => {
      const { projections, startingBalance } = event.detail;
      this.startingBalance = startingBalance || 0;
      this.updateAll(projections);
    });
  }

  /**
   * Update all charts with new projections
   */
  updateAll(projections) {
    this.projections = projections;
    this.updateTimelineChart();
    this.updateCategoryChart();
    this.updateRecurringChart();
  }

  /**
   * Create timeline chart (bars for income/expenses, line for balance)
   */
  createTimelineChart(canvas) {
    const startDate = new Date();
    const months = eachMonthOfInterval({
      start: startDate,
      end: addMonths(startDate, 11)
    });

    const labels = months.map(d => format(d, 'MMM yyyy'));

    this.timelineChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Projected Income',
            data: new Array(12).fill(0),
            backgroundColor: 'rgba(76, 175, 80, 0.7)',
            borderColor: '#4CAF50',
            borderWidth: 1,
            type: 'bar',
            order: 2
          },
          {
            label: 'Projected Expenses',
            data: new Array(12).fill(0),
            backgroundColor: 'rgba(244, 67, 54, 0.7)',
            borderColor: '#F44336',
            borderWidth: 1,
            type: 'bar',
            order: 2
          },
          {
            label: 'Cumulative Balance',
            data: new Array(12).fill(0),
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            type: 'line',
            order: 1,
            yAxisID: 'y1'
          }
        ]
      },
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
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: false
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            title: {
              display: true,
              text: 'Monthly Income/Expenses'
            },
            ticks: {
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Cumulative Balance'
            },
            ticks: {
              callback: function(value) {
                return formatCurrency(value);
              }
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }

  /**
   * Update timeline chart with projections
   */
  updateTimelineChart() {
    if (!this.timelineChart) return;

    const startDate = new Date();
    const months = eachMonthOfInterval({
      start: startDate,
      end: addMonths(startDate, 11)
    });

    // Calculate cumulative balance starting from current balance
    let cumulativeBalance = this.startingBalance || 0;
    const monthlyData = months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = addMonths(monthStart, 1);

      const monthProjections = this.projections.filter(p => {
        const pDate = new Date(p.date);
        return pDate >= monthStart && pDate < monthEnd;
      });

      const income = monthProjections
        .filter(p => p.isIncome)
        .reduce((sum, p) => sum + Math.abs(p.amount), 0);

      const expenses = monthProjections
        .filter(p => !p.isIncome)
        .reduce((sum, p) => sum + Math.abs(p.amount), 0);

      const monthlyChange = income - expenses;
      cumulativeBalance += monthlyChange;

      return {
        income,
        expenses,
        balance: cumulativeBalance // Cumulative balance
      };
    });

    this.timelineChart.data.datasets[0].data = monthlyData.map(d => d.income);
    this.timelineChart.data.datasets[1].data = monthlyData.map(d => d.expenses);
    this.timelineChart.data.datasets[2].data = monthlyData.map(d => d.balance);
    this.timelineChart.update();
  }

  /**
   * Create category chart
   */
  createCategoryChart(canvas) {
    this.categoryChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        plugins: {
          legend: {
            display: true,
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Update category chart with projections
   */
  updateCategoryChart() {
    if (!this.categoryChart) return;

    // Group projections by category (expenses only)
    const categoryTotals = {};

    this.projections
      .filter(p => !p.isIncome)
      .forEach(p => {
        const category = p.category;
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
        }
        categoryTotals[category] += Math.abs(p.amount);
      });

    // Sort by amount
    const sorted = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1]);

    const labels = sorted.map(([cat]) => cat);
    const values = sorted.map(([, amount]) => amount);
    const colors = labels.map(cat => this.categorizer.getCategoryColor(cat));

    this.categoryChart.data.labels = labels;
    this.categoryChart.data.datasets[0].data = values;
    this.categoryChart.data.datasets[0].backgroundColor = colors;
    this.categoryChart.update();
  }

  /**
   * Create recurring chart
   */
  createRecurringChart(canvas) {
    this.recurringChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Monthly Amount',
          data: [],
          backgroundColor: '#2196F3',
          borderColor: '#1976D2',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${formatCurrency(context.parsed.x)} per month`;
              }
            }
          }
        },
        scales: {
          x: {
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
   * Update recurring chart with projections
   */
  updateRecurringChart() {
    if (!this.recurringChart) return;

    const recurringItems = this.projectionService.getRecurringItems();

    // Calculate monthly cost for each recurring item
    const items = recurringItems.map(item => {
      let monthlyCost = Math.abs(item.amount);

      // Convert to monthly based on frequency
      switch (item.frequency) {
        case 'weekly':
          monthlyCost = monthlyCost * 4.33; // ~4.33 weeks per month
          break;
        case 'quarterly':
          monthlyCost = monthlyCost / 3;
          break;
        case 'yearly':
          monthlyCost = monthlyCost / 12;
          break;
      }

      return {
        name: item.name,
        monthlyCost,
        isIncome: item.isIncome
      };
    });

    // Sort by monthly cost (expenses first, then income)
    items.sort((a, b) => {
      if (a.isIncome !== b.isIncome) {
        return a.isIncome ? 1 : -1; // Expenses first
      }
      return b.monthlyCost - a.monthlyCost;
    });

    // Take top 10
    const top10 = items.slice(0, 10);

    const labels = top10.map(i => i.name);
    const values = top10.map(i => i.monthlyCost);
    const colors = top10.map(i => i.isIncome ? '#4CAF50' : '#2196F3');

    this.recurringChart.data.labels = labels;
    this.recurringChart.data.datasets[0].data = values;
    this.recurringChart.data.datasets[0].backgroundColor = colors;
    this.recurringChart.update();
  }

  /**
   * Destroy all charts
   */
  destroyAll() {
    if (this.timelineChart) {
      this.timelineChart.destroy();
      this.timelineChart = null;
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
      this.categoryChart = null;
    }
    if (this.recurringChart) {
      this.recurringChart.destroy();
      this.recurringChart = null;
    }
  }
}
