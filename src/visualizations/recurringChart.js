import Chart from 'chart.js/auto';
import { formatCurrency } from '../utils/numberUtils.js';
import { formatDateGerman } from '../utils/dateUtils.js';

/**
 * Recurring costs chart - horizontal bar chart
 */
export class RecurringChart {
  constructor(canvas, recurringDetector) {
    this.canvas = canvas;
    this.chart = null;
    this.recurringDetector = recurringDetector;
    this.allRecurringData = [];
    this.viewType = 'expense';  // 'expense' or 'income'
    this.setupTabs();
    this.setupToggle();
  }

  /**
   * Setup the expense/income tabs
   */
  setupTabs() {
    const container = this.canvas.parentElement;

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
        this.viewType = tab.dataset.type;

        // Re-render with current data
        if (this.allRecurringData.length > 0) {
          this.update(this.allRecurringData);
        }
      });
    });
  }

  /**
   * Setup the toggle button for showing all vs recent
   */
  setupToggle() {
    const container = this.canvas.parentElement;

    // Check if toggle already exists
    if (container.querySelector('.recurring-toggle')) {
      return;
    }

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'recurring-toggle';
    toggleContainer.innerHTML = `
      <label>
        <input type="checkbox" id="recurring-show-all" />
        Show all recurring costs
      </label>
    `;

    container.insertBefore(toggleContainer, this.canvas);

    const checkbox = toggleContainer.querySelector('#recurring-show-all');
    checkbox.addEventListener('change', (e) => {
      this.recurringDetector.setFilterMode(e.target.checked ? 'all' : 'recent');
      // Trigger update - needs to be called from parent
      window.dispatchEvent(new CustomEvent('recurring-filter-changed'));
    });
  }

  /**
   * Update chart with recurring data
   * @param {Object} recurringData - Object with expenses and income arrays
   */
  update(recurringData) {
    // Handle both old format (array) and new format (object with expenses/income)
    if (Array.isArray(recurringData)) {
      this.allRecurringData = { expenses: recurringData, income: [] };
    } else {
      this.allRecurringData = recurringData;
    }

    // Get data for current view type
    const recurring = this.viewType === 'expense'
      ? this.allRecurringData.expenses || []
      : this.allRecurringData.income || [];

    if (recurring.length === 0) {
      this.destroy();
      this.showEmptyState();
      this.updateTotalSummary(0, 0);
      return;
    }

    this.hideEmptyState();

    // Calculate totals
    const totalMonthlyCost = recurring.reduce((sum, r) => sum + r.monthlyCost, 0);
    const totalCount = recurring.length;

    this.updateTotalSummary(totalMonthlyCost, totalCount);

    const data = this.prepareData(recurring);

    if (this.chart) {
      this.chart.data = data;
      this.chart.options.plugins.tooltip.callbacks = this.getTooltipCallbacks();
      this.chart.update();
    } else {
      this.create(data);
    }
  }

  /**
   * Update the total summary display
   */
  updateTotalSummary(totalMonthlyCost, count) {
    const container = this.canvas.parentElement;
    let summaryElement = container.querySelector('.recurring-summary');

    if (!summaryElement) {
      summaryElement = document.createElement('div');
      summaryElement.className = 'recurring-summary';
      container.insertBefore(summaryElement, this.canvas.nextSibling);
    }

    if (count === 0) {
      summaryElement.innerHTML = '';
      return;
    }

    const annualCost = totalMonthlyCost * 12;

    summaryElement.innerHTML = `
      <div class="recurring-summary-content">
        <div class="summary-item">
          <span class="summary-label">Total Recurring Costs:</span>
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
   * Prepare chart data from recurring patterns
   * @param {Array<Object>} recurring - Recurring patterns
   * @returns {Object} - Chart.js data object
   */
  prepareData(recurring) {
    // Take top 10 recurring costs
    const top10 = recurring.slice(0, 10);

    const showAll = this.recurringDetector?.filterMode === 'all';

    const labels = top10.map(r => {
      const merchant = r.merchant.length > 20
        ? r.merchant.substring(0, 20) + '...'
        : r.merchant;

      if (showAll) {
        // Show frequency and last payment date
        const lastDateStr = formatDateGerman(r.lastDate);
        return `${merchant} (${r.frequency}, last: ${lastDateStr})`;
      } else {
        return `${merchant} (${r.frequency})`;
      }
    });

    // Always show monthly cost (normalized)
    const values = top10.map(r => r.monthlyCost);

    // Color based on confidence
    const colors = top10.map(r => {
      if (r.confidence >= 0.8) return 'rgba(76, 175, 80, 0.7)'; // High confidence - green
      if (r.confidence >= 0.6) return 'rgba(255, 152, 0, 0.7)'; // Medium - orange
      return 'rgba(244, 67, 54, 0.7)'; // Low - red
    });

    return {
      labels,
      datasets: [{
        label: 'Monthly Cost',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.7', '1')),
        borderWidth: 2,
        recurring: top10 // Store recurring data for tooltips
      }]
    };
  }

  /**
   * Get tooltip callbacks based on filter mode
   * @returns {Object} - Tooltip callbacks
   */
  getTooltipCallbacks() {
    const showAll = this.recurringDetector?.filterMode === 'all';

    return {
      label: (context) => {
        const recurring = context.dataset.recurring?.[context.dataIndex];
        if (!recurring) {
          return formatCurrency(context.parsed.x);
        }

        const lines = [];
        lines.push(`Monthly cost: ${formatCurrency(recurring.monthlyCost)}`);
        lines.push(`Last payment: ${formatCurrency(recurring.mostRecentAmount)}`);

        if (showAll) {
          lines.push(`Last paid: ${formatDateGerman(recurring.lastDate)}`);
        }

        lines.push(`Frequency: ${recurring.frequency}`);
        lines.push(`Occurrences: ${recurring.occurrences}`);
        lines.push(`Next expected: ${formatDateGerman(recurring.nextDate)}`);

        return lines;
      }
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
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.2,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: this.getTooltipCallbacks()
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
          },
          y: {
            ticks: {
              font: {
                size: 11
              }
            }
          }
        }
      }
    });
  }

  /**
   * Show empty state message
   */
  showEmptyState() {
    const container = this.canvas.parentElement;
    let emptyState = container.querySelector('.empty-state');

    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = '<p>No recurring costs detected</p>';
      container.appendChild(emptyState);
    }

    this.canvas.style.display = 'none';
    emptyState.style.display = 'block';
  }

  /**
   * Hide empty state message
   */
  hideEmptyState() {
    const container = this.canvas.parentElement;
    const emptyState = container.querySelector('.empty-state');

    if (emptyState) {
      emptyState.style.display = 'none';
    }

    this.canvas.style.display = 'block';
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
