import Chart from 'chart.js/auto';
import { formatCurrency } from '../utils/numberUtils.js';
import { format, startOfMonth, startOfYear, endOfYear, eachMonthOfInterval, addMonths } from 'date-fns';
import { MonthRangeSelector } from '../ui/monthRangeSelector.js';

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
    const now = new Date();
    const startDate = startOfYear(now);
    const endDate = endOfYear(now);
    const months = eachMonthOfInterval({
      start: startDate,
      end: endDate
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

    const now = new Date();
    const startDate = startOfYear(now);
    const endDate = endOfYear(now);
    const months = eachMonthOfInterval({
      start: startDate,
      end: endDate
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
    this.categoryViewType = 'expense'; // 'expense' or 'income'
    this.categoryGroupBy = 'all'; // 'all', 'month'
    this.setupCategoryTabs(canvas);
    this.setupCategorySelectors(canvas);

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
   * Setup category tabs for income/expense
   */
  setupCategoryTabs(canvas) {
    const container = canvas.parentElement;

    // Check if tabs already exist
    if (container.querySelector('.category-tabs')) {
      return;
    }

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'category-tabs';
    tabsContainer.innerHTML = `
      <button class="category-tab active" data-type="expense">Unique Expenses</button>
      <button class="category-tab" data-type="income">Unique Income</button>
    `;

    container.insertBefore(tabsContainer, container.firstChild);

    // Add click handlers
    const tabs = tabsContainer.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active state
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update view type
        this.categoryViewType = tab.dataset.type;
        this.updateCategoryChart();
      });
    });
  }

  /**
   * Setup category selectors (groupby dropdown and date range)
   */
  setupCategorySelectors(canvas) {
    const container = canvas.parentElement;

    // Check if selectors already exist
    if (container.querySelector('.category-selectors')) {
      return;
    }

    const selectorsContainer = document.createElement('div');
    selectorsContainer.className = 'category-selectors';
    selectorsContainer.innerHTML = `
      <div class="category-selector-row">
        <label>
          Group by:
          <select id="future-category-groupby-select">
            <option value="all">Total</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>
      <div class="category-date-range" id="category-date-range"></div>
    `;

    container.insertBefore(selectorsContainer, canvas);

    const groupBySelect = selectorsContainer.querySelector('#future-category-groupby-select');
    groupBySelect.addEventListener('change', (e) => {
      this.categoryGroupBy = e.target.value;
      this.updateCategoryChart();
    });

    // Add month range selector for category averages
    const dateRangeContainer = selectorsContainer.querySelector('#category-date-range');
    const settings = this.projectionService.getTimePeriodSettings();

    this.categoryRangeSelector = new MonthRangeSelector(
      dateRangeContainer,
      'Category Averages Period',
      settings.categoryAverages,
      (range) => {
        console.log('[FutureChartManager] Category range selector onChange fired');
        this.projectionService.setCategoryAveragesPeriod(range);
        console.log('[FutureChartManager] Category period updated, triggering projection reload');
        // Trigger projection reload
        window.dispatchEvent(new CustomEvent('reload-projections-from-date-change'));
      }
    );
    console.log('[FutureChartManager] Category range selector initialized');
  }

  /**
   * Update category chart with projections
   */
  updateCategoryChart() {
    if (!this.categoryChart) return;

    if (this.categoryGroupBy === 'all') {
      this.updateCategoryChartTotal();
    } else {
      this.updateCategoryChartGrouped();
    }
  }

  /**
   * Update category chart - total view
   */
  updateCategoryChartTotal() {
    // Group projections by category based on view type
    const categoryTotals = {};

    this.projections
      .filter(p => this.categoryViewType === 'expense' ? !p.isIncome : p.isIncome)
      .forEach(p => {
        const category = p.category;
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
        }
        categoryTotals[category] += Math.abs(p.amount);
      });

    // Calculate total and count for summary
    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
    const count = this.projections.filter(p =>
      this.categoryViewType === 'expense' ? !p.isIncome : p.isIncome
    ).length;

    this.updateCategorySummary(total, count, 'Total');

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
   * Update category chart - grouped by month
   */
  updateCategoryChartGrouped() {
    // Group projections by month and category
    const monthGroups = {};

    this.projections
      .filter(p => this.categoryViewType === 'expense' ? !p.isIncome : p.isIncome)
      .forEach(p => {
        const monthKey = format(p.date, 'yyyy-MM');

        if (!monthGroups[monthKey]) {
          monthGroups[monthKey] = {};
        }

        const category = p.category;
        if (!monthGroups[monthKey][category]) {
          monthGroups[monthKey][category] = 0;
        }
        monthGroups[monthKey][category] += Math.abs(p.amount);
      });

    // Calculate average per month for each category
    const monthCount = Object.keys(monthGroups).length || 1;
    const categoryAverages = {};

    Object.values(monthGroups).forEach(monthData => {
      Object.entries(monthData).forEach(([category, amount]) => {
        if (!categoryAverages[category]) {
          categoryAverages[category] = 0;
        }
        categoryAverages[category] += amount;
      });
    });

    // Divide by month count to get averages
    Object.keys(categoryAverages).forEach(category => {
      categoryAverages[category] /= monthCount;
    });

    // Calculate total for summary
    const total = Object.values(categoryAverages).reduce((sum, val) => sum + val, 0);
    const count = this.projections.filter(p =>
      this.categoryViewType === 'expense' ? !p.isIncome : p.isIncome
    ).length;

    this.updateCategorySummary(total, count, 'Average per Month');

    // Sort by amount
    const sorted = Object.entries(categoryAverages)
      .sort((a, b) => b[1] - a[1]);

    const labels = sorted.map(([cat]) => `${cat} (avg/month)`);
    const values = sorted.map(([, amount]) => amount);
    const colors = sorted.map(([cat]) => this.categorizer.getCategoryColor(cat));

    this.categoryChart.data.labels = labels;
    this.categoryChart.data.datasets[0].data = values;
    this.categoryChart.data.datasets[0].backgroundColor = colors;
    this.categoryChart.update();
  }

  /**
   * Update category summary display
   */
  updateCategorySummary(total, count, totalLabel = 'Total') {
    const container = this.categoryChart.canvas.parentElement;
    let summaryElement = container.querySelector('.category-summary');

    if (!summaryElement) {
      summaryElement = document.createElement('div');
      summaryElement.className = 'category-summary';
      container.insertBefore(summaryElement, this.categoryChart.canvas.nextSibling);
    }

    if (count === 0) {
      summaryElement.innerHTML = '';
      return;
    }

    const viewLabel = this.categoryViewType === 'expense' ? 'Expenses' : 'Income';

    let summaryHTML = '';
    if (this.categoryGroupBy === 'all') {
      const monthlyTotal = total / 12;
      summaryHTML = `
        <div class="summary-item">
          <span class="summary-label">Total Projected ${viewLabel} (12 months):</span>
          <span class="summary-value">${formatCurrency(total)}</span>
        </div>
        <div class="summary-item secondary">
          <span class="summary-label">Average per month:</span>
          <span class="summary-value">${formatCurrency(monthlyTotal)}</span>
        </div>
      `;
    } else {
      summaryHTML = `
        <div class="summary-item">
          <span class="summary-label">Average ${viewLabel} per Month:</span>
          <span class="summary-value">${formatCurrency(total)}</span>
        </div>
        <div class="summary-item secondary">
          <span class="summary-label">Annual (estimated):</span>
          <span class="summary-value">${formatCurrency(total * 12)}</span>
        </div>
      `;
    }

    summaryElement.innerHTML = `
      <div class="category-summary-content">
        ${summaryHTML}
        <div class="summary-item secondary">
          <span class="summary-label">Projected Items:</span>
          <span class="summary-value">${count}</span>
        </div>
      </div>
    `;
  }

  /**
   * Create recurring chart
   */
  createRecurringChart(canvas) {
    this.recurringViewType = 'expense'; // 'expense' or 'income'
    this.setupRecurringTabs(canvas);

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
   * Setup recurring tabs for income/expense
   */
  setupRecurringTabs(canvas) {
    const container = canvas.parentElement;

    // Check if tabs already exist
    if (container.querySelector('.recurring-tabs')) {
      return;
    }

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'recurring-tabs';
    tabsContainer.innerHTML = `
      <button class="recurring-tab active" data-type="expense">Recurring Expenses</button>
      <button class="recurring-tab" data-type="income">Recurring Income</button>
    `;

    container.insertBefore(tabsContainer, container.firstChild);

    // Add click handlers
    const tabs = tabsContainer.querySelectorAll('.recurring-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active state
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update view type
        this.recurringViewType = tab.dataset.type;
        this.updateRecurringChart();
      });
    });

    // Setup recurring detection date range selector
    this.setupRecurringSelectors(canvas);
  }

  /**
   * Setup recurring selectors (date range)
   */
  setupRecurringSelectors(canvas) {
    const container = canvas.parentElement;

    // Check if selectors already exist
    if (container.querySelector('.recurring-selectors')) {
      return;
    }

    const selectorsContainer = document.createElement('div');
    selectorsContainer.className = 'recurring-selectors';
    selectorsContainer.innerHTML = `
      <div class="recurring-date-range" id="recurring-date-range"></div>
    `;

    container.insertBefore(selectorsContainer, canvas);

    // Add month range selector for recurring detection
    const dateRangeContainer = selectorsContainer.querySelector('#recurring-date-range');
    const settings = this.projectionService.getTimePeriodSettings();

    this.recurringRangeSelector = new MonthRangeSelector(
      dateRangeContainer,
      'Recurring Detection Period',
      settings.recurringDetection,
      (range) => {
        console.log('[FutureChartManager] Recurring range selector onChange fired');
        this.projectionService.setRecurringDetectionPeriod(range);
        console.log('[FutureChartManager] Recurring detection period updated, triggering projection reload');
        // Trigger projection reload
        window.dispatchEvent(new CustomEvent('reload-projections-from-date-change'));
      }
    );
    console.log('[FutureChartManager] Recurring range selector initialized');
  }

  /**
   * Update recurring chart with projections
   */
  updateRecurringChart() {
    if (!this.recurringChart) return;

    const recurringItems = this.projectionService.getRecurringItems();

    // Filter by view type
    const filteredItems = recurringItems.filter(item =>
      this.recurringViewType === 'expense' ? !item.isIncome : item.isIncome
    );

    // Calculate monthly cost for each recurring item
    const items = filteredItems.map(item => {
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
        frequency: item.frequency,
        isIncome: item.isIncome
      };
    });

    // Sort by monthly cost
    items.sort((a, b) => b.monthlyCost - a.monthlyCost);

    // Calculate totals for summary
    const totalMonthlyCost = items.reduce((sum, i) => sum + i.monthlyCost, 0);
    const totalCount = items.length;

    this.updateRecurringSummary(totalMonthlyCost, totalCount);

    // Take top 10
    const top10 = items.slice(0, 10);

    const labels = top10.map(i => `${i.name} (${i.frequency})`);
    const values = top10.map(i => i.monthlyCost);
    const colors = top10.map(i => i.isIncome ? '#4CAF50' : '#2196F3');

    this.recurringChart.data.labels = labels;
    this.recurringChart.data.datasets[0].data = values;
    this.recurringChart.data.datasets[0].backgroundColor = colors;
    this.recurringChart.update();
  }

  /**
   * Update recurring summary display
   */
  updateRecurringSummary(totalMonthlyCost, count) {
    const container = this.recurringChart.canvas.parentElement;
    let summaryElement = container.querySelector('.recurring-summary');

    if (!summaryElement) {
      summaryElement = document.createElement('div');
      summaryElement.className = 'recurring-summary';
      container.insertBefore(summaryElement, this.recurringChart.canvas.nextSibling);
    }

    if (count === 0) {
      summaryElement.innerHTML = '';
      return;
    }

    const annualCost = totalMonthlyCost * 12;
    const viewLabel = this.recurringViewType === 'expense' ? 'Expenses' : 'Income';

    summaryElement.innerHTML = `
      <div class="recurring-summary-content">
        <div class="summary-item">
          <span class="summary-label">Total Recurring ${viewLabel}:</span>
          <span class="summary-value">${formatCurrency(totalMonthlyCost)} / month</span>
        </div>
        <div class="summary-item secondary">
          <span class="summary-label">Annual:</span>
          <span class="summary-value">${formatCurrency(annualCost)} / year</span>
        </div>
        <div class="summary-item secondary">
          <span class="summary-label">Recurring Items:</span>
          <span class="summary-value">${count}</span>
        </div>
      </div>
    `;
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
