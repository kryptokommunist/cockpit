import Chart from 'chart.js/auto';
import { Categorizer } from '../services/categorizer.js';
import { formatCurrency } from '../utils/numberUtils.js';
import { startOfWeek, startOfMonth, startOfYear, format, subDays, subMonths, subYears } from 'date-fns';

/**
 * Category breakdown chart - doughnut chart showing expense distribution
 */
export class CategoryChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.chart = null;
    this.categorizer = new Categorizer();
    this.groupBy = 'all'; // 'all', 'year', 'month', 'week'
    this.timePeriod = 'all'; // 'all', 'last7days', 'last30days', 'last3months', 'last6months', 'lastyear'
    this.viewType = 'expense'; // 'expense' or 'income'
    this.allTransactions = [];
    this.recurringMerchants = new Set(); // Set of recurring merchant names to exclude
    this.setupTabs();
    this.setupSelectors();
  }

  /**
   * Set recurring merchants to exclude from category breakdown
   * @param {Array} recurringPatterns - Recurring expense/income patterns
   */
  setRecurringMerchants(recurringPatterns) {
    this.recurringMerchants.clear();
    if (recurringPatterns && recurringPatterns.expenses) {
      recurringPatterns.expenses.forEach(p => this.recurringMerchants.add(p.merchant));
    }
    if (recurringPatterns && recurringPatterns.income) {
      recurringPatterns.income.forEach(p => this.recurringMerchants.add(p.merchant));
    }
    console.log(`[CategoryChart] Excluding ${this.recurringMerchants.size} recurring merchants`);
  }

  /**
   * Setup the income/expense tabs
   */
  setupTabs() {
    const container = this.canvas.parentElement;

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
        this.viewType = tab.dataset.type;
        this.update(this.allTransactions);
      });
    });
  }

  /**
   * Setup the selectors (time period and group by)
   */
  setupSelectors() {
    const container = this.canvas.parentElement;

    // Check if selectors already exist
    if (container.querySelector('.category-selectors')) {
      return;
    }

    const selectorsContainer = document.createElement('div');
    selectorsContainer.className = 'category-selectors';
    selectorsContainer.innerHTML = `
      <div class="category-selector-row">
        <label>
          Time period:
          <select id="category-period-select">
            <option value="all">All Time</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last3months">Last 3 Months</option>
            <option value="last6months">Last 6 Months</option>
            <option value="lastyear">Last Year</option>
          </select>
        </label>
        <label>
          Group by:
          <select id="category-groupby-select">
            <option value="all">Total</option>
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="week">Week</option>
          </select>
        </label>
      </div>
    `;

    container.insertBefore(selectorsContainer, this.canvas);

    const periodSelect = selectorsContainer.querySelector('#category-period-select');
    periodSelect.addEventListener('change', (e) => {
      this.timePeriod = e.target.value;
      this.update(this.allTransactions);
    });

    const groupBySelect = selectorsContainer.querySelector('#category-groupby-select');
    groupBySelect.addEventListener('change', (e) => {
      this.groupBy = e.target.value;
      this.update(this.allTransactions);
    });
  }

  /**
   * Update chart with transaction data
   * @param {Array<Transaction>} transactions - Transactions
   */
  update(transactions) {
    this.allTransactions = transactions;

    if (transactions.length === 0) {
      this.destroy();
      this.updateTotalSummary(0, 0);
      return;
    }

    // Filter by time period
    const filteredTransactions = this.filterByTimePeriod(transactions);

    // Calculate totals for the current view type
    const viewTransactions = this.viewType === 'expense'
      ? filteredTransactions.filter(t => t.isExpense())
      : filteredTransactions.filter(t => t.isIncome());

    const total = viewTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const count = viewTransactions.length;

    this.updateTotalSummary(total, count);

    const data = this.prepareData(filteredTransactions);

    if (this.chart) {
      this.chart.data = data;
      this.chart.update();
    } else {
      this.create(data);
    }
  }

  /**
   * Filter transactions by selected time period
   */
  filterByTimePeriod(transactions) {
    if (this.timePeriod === 'all') {
      return transactions;
    }

    const now = new Date();
    let cutoffDate;

    switch (this.timePeriod) {
      case 'last7days':
        cutoffDate = subDays(now, 7);
        break;
      case 'last30days':
        cutoffDate = subDays(now, 30);
        break;
      case 'last3months':
        cutoffDate = subMonths(now, 3);
        break;
      case 'last6months':
        cutoffDate = subMonths(now, 6);
        break;
      case 'lastyear':
        cutoffDate = subYears(now, 1);
        break;
      default:
        return transactions;
    }

    return transactions.filter(t => t.bookingDate >= cutoffDate);
  }

  /**
   * Prepare chart data from transactions
   * @param {Array<Transaction>} transactions - Transactions
   * @returns {Object} - Chart.js data object
   */
  prepareData(transactions) {
    if (this.groupBy === 'all') {
      return this.prepareDataAllTime(transactions);
    } else {
      return this.prepareDataGrouped(transactions);
    }
  }

  /**
   * Prepare data for all time view (original)
   */
  prepareDataAllTime(transactions) {
    // Group by category based on view type
    const categoryTotals = {};

    const filteredTransactions = this.viewType === 'expense'
      ? transactions.filter(t => t.isExpense())
      : transactions.filter(t => t.isIncome());

    // Filter out recurring merchants
    const uniqueTransactions = filteredTransactions.filter(t => {
      const merchant = t.normalizedMerchant || t.payee;
      return !this.recurringMerchants.has(merchant);
    });

    uniqueTransactions.forEach(t => {
      const category = t.category;
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      categoryTotals[category] += Math.abs(t.amount);
    });

    // Sort by amount (descending)
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1]);

    const labels = sortedCategories.map(([cat]) => cat);
    const values = sortedCategories.map(([, amount]) => amount);
    const colors = labels.map(cat => this.categorizer.getCategoryColor(cat));

    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    };
  }

  /**
   * Prepare data grouped by time period
   */
  prepareDataGrouped(transactions) {
    // Group transactions by time period and category
    const periodGroups = {};

    const filteredTransactions = this.viewType === 'expense'
      ? transactions.filter(t => t.isExpense())
      : transactions.filter(t => t.isIncome());

    // Filter out recurring merchants
    const uniqueTransactions = filteredTransactions.filter(t => {
      const merchant = t.normalizedMerchant || t.payee;
      return !this.recurringMerchants.has(merchant);
    });

    uniqueTransactions.forEach(t => {
      const periodKey = this.getPeriodKey(t.bookingDate);

      if (!periodGroups[periodKey]) {
        periodGroups[periodKey] = {};
      }

      const category = t.category;
      if (!periodGroups[periodKey][category]) {
        periodGroups[periodKey][category] = 0;
      }
      periodGroups[periodKey][category] += Math.abs(t.amount);
    });

    // Calculate average per period
    const periodCount = Object.keys(periodGroups).length;
    const categoryAverages = {};

    Object.values(periodGroups).forEach(periodData => {
      Object.entries(periodData).forEach(([category, amount]) => {
        if (!categoryAverages[category]) {
          categoryAverages[category] = 0;
        }
        categoryAverages[category] += amount;
      });
    });

    // Divide by period count to get averages
    Object.keys(categoryAverages).forEach(category => {
      categoryAverages[category] /= periodCount;
    });

    // Sort by amount (descending)
    const sortedCategories = Object.entries(categoryAverages)
      .sort((a, b) => b[1] - a[1]);

    const labels = sortedCategories.map(([cat]) => `${cat} (avg/${this.groupBy})`);
    const values = sortedCategories.map(([, amount]) => amount);
    const colors = sortedCategories.map(([cat]) => this.categorizer.getCategoryColor(cat));

    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    };
  }

  /**
   * Get period key for grouping
   */
  getPeriodKey(date) {
    switch (this.groupBy) {
      case 'year':
        return format(startOfYear(date), 'yyyy');
      case 'month':
        return format(startOfMonth(date), 'yyyy-MM');
      case 'week':
        return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-ww');
      default:
        return 'all';
    }
  }

  /**
   * Create the chart
   * @param {Object} data - Chart data
   */
  create(data) {
    this.chart = new Chart(this.canvas, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              padding: 15,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const category = this.chart.data.labels[index].replace(/ \(avg\/.*\)$/, ''); // Remove avg suffix if present
            this.showTransactionsForCategory(category);
          }
        }
      }
    });
  }

  /**
   * Update the total summary display
   * @param {number} total - Total amount
   * @param {number} count - Number of transactions
   */
  updateTotalSummary(total, count) {
    const container = this.canvas.parentElement;
    let summaryElement = container.querySelector('.category-summary');

    if (!summaryElement) {
      summaryElement = document.createElement('div');
      summaryElement.className = 'category-summary';
      container.insertBefore(summaryElement, this.canvas.nextSibling);
    }

    if (count === 0) {
      summaryElement.innerHTML = '';
      return;
    }

    const viewLabel = this.viewType === 'expense' ? 'Expenses' : 'Income';
    const periodLabel = this.getPeriodLabel();

    // Calculate average per period if grouped
    let averageInfo = '';
    if (this.groupBy !== 'all') {
      const filteredTransactions = this.filterByTimePeriod(this.allTransactions);
      const viewTransactions = this.viewType === 'expense'
        ? filteredTransactions.filter(t => t.isExpense())
        : filteredTransactions.filter(t => t.isIncome());

      const periodGroups = {};
      viewTransactions.forEach(t => {
        const periodKey = this.getPeriodKey(t.bookingDate);
        if (!periodGroups[periodKey]) {
          periodGroups[periodKey] = 0;
        }
        periodGroups[periodKey] += Math.abs(t.amount);
      });

      const periodCount = Object.keys(periodGroups).length;
      const average = total / (periodCount || 1);

      averageInfo = `
        <div class="summary-item secondary">
          <span class="summary-label">Average per ${this.groupBy}:</span>
          <span class="summary-value">${formatCurrency(average)}</span>
        </div>
      `;
    }

    summaryElement.innerHTML = `
      <div class="category-summary-content">
        <div class="summary-item">
          <span class="summary-label">Total ${viewLabel} ${periodLabel}:</span>
          <span class="summary-value">${formatCurrency(total)}</span>
        </div>
        ${averageInfo}
        <div class="summary-item secondary">
          <span class="summary-label">Transactions:</span>
          <span class="summary-value">${count}</span>
        </div>
      </div>
    `;
  }

  /**
   * Get period label for display
   * @returns {string}
   */
  getPeriodLabel() {
    const labels = {
      'all': '(All Time)',
      'last7days': '(Last 7 Days)',
      'last30days': '(Last 30 Days)',
      'last3months': '(Last 3 Months)',
      'last6months': '(Last 6 Months)',
      'lastyear': '(Last Year)'
    };
    return labels[this.timePeriod] || '';
  }

  /**
   * Show recategorization modal for a transaction
   * @param {Object} transaction - Transaction to recategorize
   */
  showRecategorizeModal(transaction) {
    // Dispatch event to main app to show recategorize modal
    window.dispatchEvent(new CustomEvent('show-recategorize-modal', {
      detail: { transaction }
    }));
  }

  /**
   * Show transactions for a specific category
   * @param {string} category - Category name
   */
  showTransactionsForCategory(category) {
    const container = this.canvas.parentElement;

    // Remove existing transaction list if any
    const existingList = container.querySelector('.category-transaction-list');
    if (existingList) {
      existingList.remove();
    }

    // Filter transactions by category and view type
    const filteredByTimePeriod = this.filterByTimePeriod(this.allTransactions);
    const categoryTransactions = filteredByTimePeriod.filter(t => {
      const matchesCategory = t.category === category;
      const matchesType = this.viewType === 'expense' ? t.isExpense() : t.isIncome();
      return matchesCategory && matchesType;
    });

    if (categoryTransactions.length === 0) {
      return;
    }

    // Sort by date (newest first)
    categoryTransactions.sort((a, b) => b.bookingDate - a.bookingDate);

    // Create transaction list container
    const listContainer = document.createElement('div');
    listContainer.className = 'category-transaction-list';

    const header = document.createElement('div');
    header.className = 'category-transaction-header';
    header.innerHTML = `
      <h4>${category} Transactions (${categoryTransactions.length})</h4>
      <button class="btn-close-list">×</button>
    `;
    listContainer.appendChild(header);

    // Add close button handler
    header.querySelector('.btn-close-list').addEventListener('click', () => {
      listContainer.remove();
    });

    // Create scrollable transaction list
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'category-transaction-scroll';

    categoryTransactions.forEach(transaction => {
      const item = document.createElement('div');
      item.className = 'category-transaction-item';
      item.innerHTML = `
        <div class="transaction-date">${format(transaction.bookingDate, 'dd.MM.yyyy')}</div>
        <div class="transaction-merchant">${transaction.payee}</div>
        <div class="transaction-purpose">${transaction.purpose.substring(0, 50)}${transaction.purpose.length > 50 ? '...' : ''}</div>
        <div class="transaction-amount">${formatCurrency(Math.abs(transaction.amount))}</div>
        <button class="btn-recategorize" title="Recategorize">⚙️</button>
      `;

      // Add recategorize button handler
      const recategorizeBtn = item.querySelector('.btn-recategorize');
      recategorizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showRecategorizeModal(transaction);
      });

      scrollContainer.appendChild(item);
    });

    listContainer.appendChild(scrollContainer);
    container.appendChild(listContainer);
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
