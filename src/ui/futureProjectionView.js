import { addMonths, format, startOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { formatCurrency } from '../utils/numberUtils.js';
import { MonthRangeSelector } from './monthRangeSelector.js';

/**
 * Future Projection View Manager
 */
export class FutureProjectionView {
  constructor(projectionService, categorizer) {
    this.projectionService = projectionService;
    this.categorizer = categorizer;
    this.transactions = [];
    this.recurringData = null;
    this.isReloading = false; // Flag to prevent infinite loops
    this.setupTabSwitching();
    this.setupAddButtons();
  }

  /**
   * Set transaction data for auto-population
   * @param {Array} transactions - Historical transactions
   * @param {Object} recurringData - Detected recurring patterns (deprecated, now detected dynamically)
   * @param {Object} recurringDetector - Recurring detector instance
   */
  setTransactionData(transactions, recurringData, recurringDetector) {
    this.transactions = transactions;
    this.recurringData = recurringData;
    this.recurringDetector = recurringDetector;

    // Calculate current balance
    this.currentBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`[FutureProjectionView] Current balance: €${this.currentBalance.toFixed(2)}`);
  }

  /**
   * Get filtered transactions based on recurring detection period
   * @returns {Array} Filtered transactions
   */
  getFilteredTransactionsForPeriod() {
    if (!this.transactions || this.transactions.length === 0) {
      return [];
    }

    const { startDate, endDate } = this.projectionService.getRecurringDetectionDateRange();

    const filtered = this.transactions.filter(t =>
      t.bookingDate >= startDate && t.bookingDate <= endDate
    );

    console.log(`[FutureProjectionView] Filtered ${filtered.length} transactions from ${format(startDate, 'MMM yyyy')} - ${format(endDate, 'MMM yyyy')}`);

    return filtered;
  }

  /**
   * Auto-populate projections from overview data
   */
  async autoPopulateFromOverview() {
    // Check if we already have projections
    if (this.projectionService.getRecurringItems().length > 0) {
      console.log('[FutureProjectionView] Already have projections, skipping auto-populate');
      return;
    }

    // Check if recurringDetector is available
    if (!this.recurringDetector) {
      console.error('[FutureProjectionView] recurringDetector not available, cannot auto-populate');
      return;
    }

    console.log('[FutureProjectionView] Auto-populating from overview data...');

    // Get filtered transactions based on recurring detection period
    const filteredTransactions = this.getFilteredTransactionsForPeriod();

    // Detect recurring patterns on filtered transactions
    const recurringExpenses = this.recurringDetector.detect(filteredTransactions, 'expense');
    const recurringIncome = this.recurringDetector.detect(filteredTransactions, 'income');

    console.log(`[FutureProjectionView] Detected ${recurringExpenses.length} recurring expenses and ${recurringIncome.length} recurring income from filtered period`);

    // Add recurring expenses
    recurringExpenses.forEach(pattern => {
      this.projectionService.addRecurringItem({
        name: pattern.merchant,
        amount: -pattern.mostRecentAmount,
        category: pattern.category || 'OTHER',
        frequency: pattern.frequency,
        startDate: new Date(),
        endDate: null,
        isIncome: false
      });
    });

    // Add recurring income
    recurringIncome.forEach(pattern => {
      this.projectionService.addRecurringItem({
        name: pattern.merchant,
        amount: pattern.mostRecentAmount,
        category: pattern.category || 'OTHER_INCOME',
        frequency: pattern.frequency,
        startDate: new Date(),
        endDate: null,
        isIncome: true
      });
    });

    // Calculate and add category averages (excluding recurring)
    this.addCategoryAverages();

    // Save projections
    await this.projectionService.save();
    console.log('[FutureProjectionView] Auto-population complete');
  }

  /**
   * Calculate category averages and add as recurring items
   */
  addCategoryAverages() {
    if (!this.transactions || this.transactions.length === 0) {
      return;
    }

    const { startDate, endDate } = this.projectionService.getCategoryAveragesDateRange();

    // Get transactions from configured time period
    const recentTransactions = this.transactions.filter(t =>
      t.bookingDate >= startDate && t.bookingDate <= endDate
    );

    // Calculate number of months in the period
    const periodMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) + 1;

    console.log(`[FutureProjectionView] Calculating category averages from ${format(startDate, 'MMM yyyy')} - ${format(endDate, 'MMM yyyy')} (${recentTransactions.length} transactions)`);

    // Get recurring merchant names to exclude (from currently active projections)
    const recurringMerchants = new Set();
    const recurringItems = this.projectionService.getRecurringItems();
    recurringItems.forEach(item => {
      // Extract merchant name from item name (remove " (Avg)" suffix if present)
      const merchantName = item.name.replace(/ \(Avg\)$/, '');
      recurringMerchants.add(merchantName);
    });

    // Calculate category totals excluding recurring items
    const categoryTotals = {};
    const categoryCounts = {};

    recentTransactions.forEach(t => {
      const merchant = t.normalizedMerchant || t.payee;

      // Skip if this is a recurring merchant
      if (recurringMerchants.has(merchant)) {
        return;
      }

      const category = t.category;
      const amount = Math.abs(t.amount);
      const isIncome = t.isIncome();

      const key = `${category}_${isIncome ? 'income' : 'expense'}`;

      if (!categoryTotals[key]) {
        categoryTotals[key] = 0;
        categoryCounts[key] = 0;
      }

      categoryTotals[key] += amount;
      categoryCounts[key]++;
    });

    // Add category averages as monthly recurring items
    Object.entries(categoryTotals).forEach(([key, total]) => {
      const [category, type] = key.split('_');
      const count = categoryCounts[key];
      const monthlyAverage = total / periodMonths; // Average over the period

      // Only add if meaningful amount
      if (monthlyAverage > 10) {
        this.projectionService.addRecurringItem({
          name: `${category} (Avg)`,
          amount: type === 'income' ? monthlyAverage : -monthlyAverage,
          category: category,
          frequency: 'monthly',
          startDate: new Date(),
          endDate: null,
          isIncome: type === 'income'
        });
      }
    });

    console.log(`[FutureProjectionView] Added category averages from ${format(startDate, 'MMM yyyy')} - ${format(endDate, 'MMM yyyy')}`);
  }

  /**
   * Setup tab switching between Overview and Future
   */
  setupTabSwitching() {
    // Tab switching is handled by main.js
    // Just listen for when we switch to future view
    window.addEventListener('view-changed', (event) => {
      if (event.detail.view === 'future') {
        // Update future projection when switching to it
        this.updateProjection();
      }
    });

    // Listen for date range changes and auto-reload projections
    window.addEventListener('reload-projections-from-date-change', async () => {
      // Prevent infinite loops
      if (this.isReloading) {
        console.log('[FutureProjectionView] Already reloading, skipping...');
        return;
      }

      // Don't reload if we don't have any transaction data
      if (!this.transactions || this.transactions.length === 0) {
        console.log('[FutureProjectionView] No transaction data available, skipping reload');
        return;
      }

      // Don't reload if recurringDetector is not available
      if (!this.recurringDetector) {
        console.log('[FutureProjectionView] recurringDetector not available, skipping reload');
        return;
      }

      console.log('[FutureProjectionView] Date range changed, reloading projections...');

      // Set flag before showing confirm
      this.isReloading = true;

      try {
        // Show confirmation
        if (!confirm('Date range updated. Reload projections with new settings? This will recalculate based on the selected time period.')) {
          console.log('[FutureProjectionView] User cancelled reload');
          return;
        }

        // Clear all projections
        this.projectionService.clearAll();

        // Re-populate from overview with new date ranges
        await this.autoPopulateFromOverview();

        // Update display
        this.updateProjection();

        console.log('[FutureProjectionView] Projections reloaded with new date ranges');
      } catch (error) {
        console.error('[FutureProjectionView] Error reloading projections:', error);
        alert('Error reloading projections: ' + error.message);
      } finally {
        // Always reset the flag, even if user cancels
        this.isReloading = false;
      }
    });
  }

  /**
   * Setup add buttons for creating projections
   */
  setupAddButtons() {
    // Add buttons to future charts
    const futureRecurringChart = document.querySelector('#future-recurring-chart');
    const futureCategoryChart = document.querySelector('#future-category-chart');

    // Guard against missing DOM elements
    if (!futureRecurringChart || !futureCategoryChart) {
      console.warn('[FutureProjectionView] Chart containers not found, skipping button setup');
      return;
    }

    const futureRecurringContainer = futureRecurringChart.parentElement;
    const futureCategoryContainer = futureCategoryChart.parentElement;

    // Add recurring button
    if (futureRecurringContainer && !futureRecurringContainer.querySelector('.btn-add-recurring')) {
      const addRecurringBtn = document.createElement('button');
      addRecurringBtn.className = 'btn btn-primary btn-add-recurring';
      addRecurringBtn.innerHTML = '+ Add Recurring Item';
      addRecurringBtn.style.marginBottom = '1rem';
      futureRecurringContainer.insertBefore(addRecurringBtn, futureRecurringContainer.firstChild.nextSibling);

      addRecurringBtn.addEventListener('click', () => {
        this.showAddRecurringModal();
      });
    }

    // Add one-time button
    if (futureCategoryContainer && !futureCategoryContainer.querySelector('.btn-add-onetime')) {
      const addOneTimeBtn = document.createElement('button');
      addOneTimeBtn.className = 'btn btn-secondary btn-add-onetime';
      addOneTimeBtn.innerHTML = '+ Add One-Time Item';
      addOneTimeBtn.style.marginBottom = '1rem';
      futureCategoryContainer.insertBefore(addOneTimeBtn, futureCategoryContainer.firstChild.nextSibling);

      addOneTimeBtn.addEventListener('click', () => {
        this.showAddOneTimeModal();
      });
    }
  }

  /**
   * Reload projections from overview data
   */
  async reloadProjectionsFromOverview() {
    if (this.isReloading) {
      console.log('[FutureProjectionView] Already reloading, skipping...');
      return;
    }

    if (!confirm('This will clear all current projections and reload from overview data. Continue?')) {
      return;
    }

    this.isReloading = true;
    console.log('[FutureProjectionView] Reloading projections from overview...');

    try {
      // Clear all projections
      this.projectionService.clearAll();

      // Re-populate from overview
      await this.autoPopulateFromOverview();

      // Update display
      this.updateProjection();

      alert('Projections reloaded successfully!');
    } finally {
      // Always reset the flag
      this.isReloading = false;
    }
  }

  /**
   * Update projection display
   */
  updateProjection() {
    try {
      const now = new Date();
      const startDate = startOfYear(now);
      const endDate = endOfYear(now);

      // Generate projections
      const projections = this.projectionService.generateProjections(startDate, endDate);

      console.log('[FutureProjectionView] Generated projections:', projections);

      // Calculate summary statistics
      const monthlyIncome = projections
        .filter(p => p.isIncome)
        .reduce((sum, p) => sum + Math.abs(p.amount), 0) / 12;

      const monthlyExpenses = projections
        .filter(p => !p.isIncome)
        .reduce((sum, p) => sum + Math.abs(p.amount), 0) / 12;

      const monthlyBalance = monthlyIncome - monthlyExpenses;
      const yearlyTotal = monthlyBalance * 12;

      // Update summary cards (with null checks)
      const futureIncomeEl = document.getElementById('future-income');
      const futureExpensesEl = document.getElementById('future-expenses');
      const futureBalanceEl = document.getElementById('future-balance');
      const futureTotalEl = document.getElementById('future-total');

      if (futureIncomeEl) futureIncomeEl.textContent = formatCurrency(monthlyIncome);
      if (futureExpensesEl) futureExpensesEl.textContent = formatCurrency(monthlyExpenses);
      if (futureBalanceEl) futureBalanceEl.textContent = formatCurrency(monthlyBalance);
      if (futureTotalEl) futureTotalEl.textContent = formatCurrency(yearlyTotal);

      // Update projection items list
      this.renderProjectionItems();

      // Dispatch event to update charts
      window.dispatchEvent(new CustomEvent('update-future-projection', {
        detail: {
          projections,
          startDate,
          endDate,
          startingBalance: this.currentBalance || 0
        }
      }));
    } catch (error) {
      console.error('[FutureProjectionView] Error updating projection:', error);
    }
  }

  /**
   * Render projection items list with edit/delete
   */
  renderProjectionItems() {
    let container = document.getElementById('projection-items-list');

    // Create container if it doesn't exist
    if (!container) {
      const budgetSection = document.getElementById('future-budget-section');
      if (budgetSection) {
        container = document.createElement('div');
        container.id = 'projection-items-list';
        container.className = 'projection-items-list';
        budgetSection.parentElement.insertBefore(container, budgetSection);
      } else {
        return;
      }
    }

    const recurringItems = this.projectionService.getRecurringItems();
    const oneTimeItems = this.projectionService.getOneTimeItems();

    container.innerHTML = `
      <div class="card">
        <h2>Manage Projections</h2>

        <div class="projection-section">
          <h3>Recurring Items (${recurringItems.length})</h3>
          <div class="projection-items">
            ${recurringItems.length === 0 ? '<p class="empty-message">No recurring items</p>' : ''}
            ${recurringItems.map(item => this.renderRecurringItem(item)).join('')}
          </div>
        </div>

        <div class="projection-section">
          <h3>One-Time Items (${oneTimeItems.length})</h3>
          <div class="projection-items">
            ${oneTimeItems.length === 0 ? '<p class="empty-message">No one-time items</p>' : ''}
            ${oneTimeItems.map(item => this.renderOneTimeItem(item)).join('')}
          </div>
        </div>
      </div>
    `;

    // Add event listeners for edit/delete buttons
    container.querySelectorAll('.btn-edit-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemId;
        const itemType = btn.dataset.itemType;
        this.showEditModal(itemId, itemType);
      });
    });

    container.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.dataset.itemId;
        const itemType = btn.dataset.itemType;

        if (confirm('Delete this projection item?')) {
          if (itemType === 'recurring') {
            this.projectionService.removeRecurringItem(itemId);
          } else {
            this.projectionService.removeOneTimeItem(itemId);
          }

          await this.projectionService.save();
          this.updateProjection();
          this.showNotification('Item deleted', 'success');
        }
      });
    });
  }

  /**
   * Render recurring item
   */
  renderRecurringItem(item) {
    const hasOverrides = item.monthlyOverrides && Object.keys(item.monthlyOverrides).length > 0;
    const sparkline = hasOverrides ? this.renderSparkline(item) : '';

    return `
      <div class="projection-item ${item.isIncome ? 'income' : 'expense'} ${hasOverrides ? 'has-overrides' : ''}">
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">
            ${formatCurrency(Math.abs(item.amount))} · ${item.frequency} · ${item.category}
          </div>
          ${sparkline}
        </div>
        <div class="item-actions">
          <button class="btn-icon btn-edit-item" data-item-id="${item.id}" data-item-type="recurring" title="Edit">
            ✏️
          </button>
          <button class="btn-icon btn-delete-item" data-item-id="${item.id}" data-item-type="recurring" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render sparkline graph for item with overrides
   */
  renderSparkline(item) {
    const now = new Date();
    const startDate = startOfYear(now);
    const endDate = endOfYear(now);
    const values = [];
    const baseAmount = Math.abs(item.amount);

    // Get values for all months in current year
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    months.forEach(month => {
      const monthKey = format(month, 'yyyy-MM');

      const amount = item.monthlyOverrides && monthKey in item.monthlyOverrides
        ? Math.abs(item.monthlyOverrides[monthKey])
        : baseAmount;

      values.push(amount);
    });

    // Calculate min/max for scaling
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Generate SVG path
    const width = 200;
    const height = 40;
    const padding = 2;

    const points = values.map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 2 * padding) + padding;
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    return `
      <div class="sparkline-container">
        <svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <polyline
            points="${points}"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          ${values.map((value, index) => {
            const x = (index / (values.length - 1)) * (width - 2 * padding) + padding;
            const y = height - padding - ((value - min) / range) * (height - 2 * padding);
            return `<circle cx="${x}" cy="${y}" r="2" fill="currentColor"/>`;
          }).join('')}
        </svg>
        <span class="sparkline-label">Year variation</span>
      </div>
    `;
  }

  /**
   * Render one-time item
   */
  renderOneTimeItem(item) {
    return `
      <div class="projection-item ${item.isIncome ? 'income' : 'expense'}">
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">
            ${formatCurrency(Math.abs(item.amount))} · ${format(new Date(item.date), 'dd.MM.yyyy')} · ${item.category}
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-icon btn-edit-item" data-item-id="${item.id}" data-item-type="onetime" title="Edit">
            ✏️
          </button>
          <button class="btn-icon btn-delete-item" data-item-id="${item.id}" data-item-type="onetime" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show edit modal
   */
  showEditModal(itemId, itemType) {
    if (itemType === 'recurring') {
      const items = this.projectionService.getRecurringItems();
      const item = items.find(i => i.id === itemId);
      if (item) {
        this.showEditRecurringModal(item);
      }
    } else {
      const items = this.projectionService.getOneTimeItems();
      const item = items.find(i => i.id === itemId);
      if (item) {
        this.showEditOneTimeModal(item);
      }
    }
  }

  /**
   * Show edit recurring item modal
   */
  showEditRecurringModal(item) {
    const modal = this.createModal('Edit Recurring Item');

    const form = document.createElement('form');
    form.className = 'projection-form';
    form.innerHTML = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" required value="${item.name}">
      </div>

      <div class="form-group">
        <label>Type</label>
        <select name="type" required>
          <option value="expense" ${!item.isIncome ? 'selected' : ''}>Expense</option>
          <option value="income" ${item.isIncome ? 'selected' : ''}>Income</option>
        </select>
      </div>

      <div class="form-group">
        <label>Amount (€)</label>
        <input type="number" name="amount" step="0.01" inputmode="decimal" required value="${Math.abs(item.amount).toFixed(2)}">
      </div>

      <div class="form-group">
        <label>Category</label>
        <select name="category" required>
          ${this.renderCategoryOptions(item.category)}
        </select>
      </div>

      <div class="form-group">
        <label>Frequency</label>
        <select name="frequency" required>
          <option value="monthly" ${item.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
          <option value="weekly" ${item.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
          <option value="quarterly" ${item.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
          <option value="yearly" ${item.frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
        </select>
      </div>

      <div class="form-group">
        <label>Start Date</label>
        <input type="date" name="startDate" required value="${format(new Date(item.startDate), 'yyyy-MM-dd')}">
      </div>

      <div class="form-group">
        <label>End Date (optional)</label>
        <input type="date" name="endDate" value="${item.endDate ? format(new Date(item.endDate), 'yyyy-MM-dd') : ''}">
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" id="enable-monthly-overrides" ${item.monthlyOverrides && Object.keys(item.monthlyOverrides).length > 0 ? 'checked' : ''}>
          Set individual amounts for each month
        </label>
      </div>

      <div id="monthly-overrides-section" style="display: none;">
        <h4>Monthly Amounts</h4>
        <div class="monthly-overrides-grid">
          ${this.renderMonthlyOverrides(item)}
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Update Item</button>
      </div>
    `;

    // Setup monthly overrides toggle
    const checkbox = form.querySelector('#enable-monthly-overrides');
    const overridesSection = form.querySelector('#monthly-overrides-section');

    checkbox.addEventListener('change', () => {
      overridesSection.style.display = checkbox.checked ? 'block' : 'none';
    });

    // Show if already has overrides
    if (checkbox.checked) {
      overridesSection.style.display = 'block';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      const updates = {
        name: formData.get('name'),
        amount: parseFloat(formData.get('amount')) * (formData.get('type') === 'expense' ? -1 : 1),
        category: formData.get('category'),
        frequency: formData.get('frequency'),
        startDate: new Date(formData.get('startDate')),
        endDate: formData.get('endDate') ? new Date(formData.get('endDate')) : null,
        isIncome: formData.get('type') === 'income'
      };

      // Collect monthly overrides if enabled
      if (checkbox.checked) {
        const monthlyOverrides = {};
        const overrideInputs = form.querySelectorAll('.monthly-override-input');

        overrideInputs.forEach(input => {
          const month = input.dataset.month;
          const value = parseFloat(input.value);

          if (!isNaN(value) && value !== Math.abs(item.amount)) {
            monthlyOverrides[month] = value * (formData.get('type') === 'expense' ? -1 : 1);
          }
        });

        updates.monthlyOverrides = monthlyOverrides;
      } else {
        updates.monthlyOverrides = {};
      }

      this.projectionService.updateRecurringItem(item.id, updates);
      await this.projectionService.save();

      this.closeModal(modal);
      this.updateProjection();
      this.showNotification('Item updated successfully', 'success');
    });

    form.querySelector('.btn-cancel').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.querySelector('.modal-body').appendChild(form);
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
  }

  /**
   * Show edit one-time item modal
   */
  showEditOneTimeModal(item) {
    const modal = this.createModal('Edit One-Time Item');

    const form = document.createElement('form');
    form.className = 'projection-form';
    form.innerHTML = `
      <div class="form-group">
        <label>Description</label>
        <input type="text" name="name" required value="${item.name}">
      </div>

      <div class="form-group">
        <label>Type</label>
        <select name="type" required>
          <option value="expense" ${!item.isIncome ? 'selected' : ''}>Expense</option>
          <option value="income" ${item.isIncome ? 'selected' : ''}>Income</option>
        </select>
      </div>

      <div class="form-group">
        <label>Amount (€)</label>
        <input type="number" name="amount" step="0.01" inputmode="decimal" required value="${Math.abs(item.amount).toFixed(2)}">
      </div>

      <div class="form-group">
        <label>Category</label>
        <select name="category" required>
          ${this.renderCategoryOptions(item.category)}
        </select>
      </div>

      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" required value="${format(new Date(item.date), 'yyyy-MM-dd')}">
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Update Item</button>
      </div>
    `;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      // Remove old item
      this.projectionService.removeOneTimeItem(item.id);

      // Add updated item
      const newItem = {
        name: formData.get('name'),
        amount: parseFloat(formData.get('amount')) * (formData.get('type') === 'expense' ? -1 : 1),
        category: formData.get('category'),
        date: new Date(formData.get('date')),
        isIncome: formData.get('type') === 'income'
      };

      this.projectionService.addOneTimeItem(newItem);
      await this.projectionService.save();

      this.closeModal(modal);
      this.updateProjection();
      this.showNotification('Item updated successfully', 'success');
    });

    form.querySelector('.btn-cancel').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.querySelector('.modal-body').appendChild(form);
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
  }

  /**
   * Show modal for adding recurring item
   */
  showAddRecurringModal() {
    const modal = this.createModal('Add Recurring Item');

    const form = document.createElement('form');
    form.className = 'projection-form';
    form.innerHTML = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" required placeholder="e.g., Salary, Rent, Netflix">
      </div>

      <div class="form-group">
        <label>Type</label>
        <select name="type" required>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      <div class="form-group">
        <label>Amount (€)</label>
        <input type="number" name="amount" step="0.01" inputmode="decimal" required placeholder="0.00">
      </div>

      <div class="form-group">
        <label>Category</label>
        <select name="category" required>
          ${this.renderCategoryOptions()}
        </select>
      </div>

      <div class="form-group">
        <label>Frequency</label>
        <select name="frequency" required>
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div class="form-group">
        <label>Start Date</label>
        <input type="date" name="startDate" required value="${format(new Date(), 'yyyy-MM-dd')}">
      </div>

      <div class="form-group">
        <label>End Date (optional)</label>
        <input type="date" name="endDate">
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Item</button>
      </div>
    `;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      const item = {
        name: formData.get('name'),
        amount: parseFloat(formData.get('amount')) * (formData.get('type') === 'expense' ? -1 : 1),
        category: formData.get('category'),
        frequency: formData.get('frequency'),
        startDate: new Date(formData.get('startDate')),
        endDate: formData.get('endDate') ? new Date(formData.get('endDate')) : null,
        isIncome: formData.get('type') === 'income'
      };

      this.projectionService.addRecurringItem(item);
      await this.projectionService.save();

      this.closeModal(modal);
      this.updateProjection();
      this.showNotification('Recurring item added successfully', 'success');
    });

    form.querySelector('.btn-cancel').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.querySelector('.modal-body').appendChild(form);
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
  }

  /**
   * Show modal for adding one-time item
   */
  showAddOneTimeModal() {
    const modal = this.createModal('Add One-Time Item');

    const form = document.createElement('form');
    form.className = 'projection-form';
    form.innerHTML = `
      <div class="form-group">
        <label>Description</label>
        <input type="text" name="name" required placeholder="e.g., New laptop, Bonus">
      </div>

      <div class="form-group">
        <label>Type</label>
        <select name="type" required>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      <div class="form-group">
        <label>Amount (€)</label>
        <input type="number" name="amount" step="0.01" inputmode="decimal" required placeholder="0.00">
      </div>

      <div class="form-group">
        <label>Category</label>
        <select name="category" required>
          ${this.renderCategoryOptions()}
        </select>
      </div>

      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" required value="${format(new Date(), 'yyyy-MM-dd')}">
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Item</button>
      </div>
    `;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      const item = {
        name: formData.get('name'),
        amount: parseFloat(formData.get('amount')) * (formData.get('type') === 'expense' ? -1 : 1),
        category: formData.get('category'),
        date: new Date(formData.get('date')),
        isIncome: formData.get('type') === 'income'
      };

      this.projectionService.addOneTimeItem(item);
      await this.projectionService.save();

      this.closeModal(modal);
      this.updateProjection();
      this.showNotification('One-time item added successfully', 'success');
    });

    form.querySelector('.btn-cancel').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.querySelector('.modal-body').appendChild(form);
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
  }

  /**
   * Render monthly overrides for all months in current year
   */
  renderMonthlyOverrides(item) {
    const now = new Date();
    const startDate = startOfYear(now);
    const endDate = endOfYear(now);
    const months = [];

    const yearMonths = eachMonthOfInterval({ start: startDate, end: endDate });
    yearMonths.forEach(month => {
      const monthKey = format(month, 'yyyy-MM');
      const monthLabel = format(month, 'MMM yyyy');

      const defaultAmount = Math.abs(item.amount);
      const overrideAmount = item.monthlyOverrides && monthKey in item.monthlyOverrides
        ? Math.abs(item.monthlyOverrides[monthKey])
        : defaultAmount;

      months.push(`
        <div class="monthly-override-item">
          <label>${monthLabel}</label>
          <input
            type="number"
            class="monthly-override-input"
            data-month="${monthKey}"
            step="0.01" inputmode="decimal"
            value="${overrideAmount.toFixed(2)}"
            placeholder="${defaultAmount.toFixed(2)}"
          />
        </div>
      `);
    });

    return months.join('');
  }

  /**
   * Render category options
   */
  renderCategoryOptions(selectedCategory = null) {
    const categories = Object.keys(this.categorizer.categories).sort();
    return categories.map(cat =>
      `<option value="${cat}" ${cat === selectedCategory ? 'selected' : ''}>${cat}</option>`
    ).join('');
  }

  /**
   * Create modal element
   */
  createModal(title) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="btn-modal-close">×</button>
        </div>
        <div class="modal-body"></div>
      </div>
    `;

    modal.querySelector('.btn-modal-close').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal(modal);
      }
    });

    return modal;
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}
