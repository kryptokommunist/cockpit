import { addMonths, format } from 'date-fns';
import { formatCurrency } from '../utils/numberUtils.js';

/**
 * Future Projection View Manager
 */
export class FutureProjectionView {
  constructor(projectionService, categorizer) {
    this.projectionService = projectionService;
    this.categorizer = categorizer;
    this.transactions = [];
    this.recurringData = null;
    this.setupTabSwitching();
    this.setupAddButtons();
  }

  /**
   * Set transaction data for auto-population
   * @param {Array} transactions - Historical transactions
   * @param {Object} recurringData - Detected recurring patterns
   */
  setTransactionData(transactions, recurringData) {
    this.transactions = transactions;
    this.recurringData = recurringData;

    // Calculate current balance
    this.currentBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`[FutureProjectionView] Current balance: €${this.currentBalance.toFixed(2)}`);
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

    console.log('[FutureProjectionView] Auto-populating from overview data...');

    // Add recurring expenses
    if (this.recurringData && this.recurringData.expenses) {
      this.recurringData.expenses.forEach(pattern => {
        this.projectionService.addRecurringItem({
          name: pattern.merchant,
          amount: -pattern.averageAmount,
          category: pattern.category || 'OTHER',
          frequency: pattern.frequency,
          startDate: new Date(),
          endDate: null,
          isIncome: false
        });
      });
      console.log(`[FutureProjectionView] Added ${this.recurringData.expenses.length} recurring expenses`);
    }

    // Add recurring income
    if (this.recurringData && this.recurringData.income) {
      this.recurringData.income.forEach(pattern => {
        this.projectionService.addRecurringItem({
          name: pattern.merchant,
          amount: pattern.averageAmount,
          category: pattern.category || 'INCOME',
          frequency: pattern.frequency,
          startDate: new Date(),
          endDate: null,
          isIncome: true
        });
      });
      console.log(`[FutureProjectionView] Added ${this.recurringData.income.length} recurring income`);
    }

    // Calculate and add category averages (3 months, excluding recurring)
    this.addCategoryAverages();

    // Save projections
    await this.projectionService.save();
    console.log('[FutureProjectionView] Auto-population complete');
  }

  /**
   * Calculate 3-month category averages and add as one-time items
   */
  addCategoryAverages() {
    if (!this.transactions || this.transactions.length === 0) {
      return;
    }

    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    // Get transactions from last 3 months
    const recentTransactions = this.transactions.filter(t =>
      t.bookingDate >= threeMonthsAgo
    );

    // Get recurring merchant names to exclude
    const recurringMerchants = new Set();
    if (this.recurringData) {
      if (this.recurringData.expenses) {
        this.recurringData.expenses.forEach(p => recurringMerchants.add(p.merchant));
      }
      if (this.recurringData.income) {
        this.recurringData.income.forEach(p => recurringMerchants.add(p.merchant));
      }
    }

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
      const monthlyAverage = total / 3; // 3 months

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

    console.log('[FutureProjectionView] Added category averages');
  }

  /**
   * Setup tab switching between Overview and Future
   */
  setupTabSwitching() {
    const tabs = document.querySelectorAll('.main-tab');
    const overviewView = document.getElementById('overview-view');
    const futureView = document.getElementById('future-view');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Switch views
        if (view === 'overview') {
          overviewView.classList.add('active');
          futureView.classList.remove('active');
        } else if (view === 'future') {
          overviewView.classList.remove('active');
          futureView.classList.add('active');

          // Update future projection when switching to it
          this.updateProjection();
        }
      });
    });
  }

  /**
   * Setup add buttons for creating projections
   */
  setupAddButtons() {
    // Add buttons to future charts
    const futureRecurringContainer = document.querySelector('#future-recurring-chart').parentElement;
    const futureCategoryContainer = document.querySelector('#future-category-chart').parentElement;

    // Add reload button at the top
    const futureView = document.getElementById('future-view');
    if (futureView && !futureView.querySelector('.btn-reload-projections')) {
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'reload-projections-container';
      buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 1rem;';

      const reloadBtn = document.createElement('button');
      reloadBtn.className = 'btn btn-secondary btn-reload-projections';
      reloadBtn.innerHTML = '🔄 Reload Projections from Overview';
      reloadBtn.addEventListener('click', () => {
        this.reloadProjectionsFromOverview();
      });

      buttonContainer.appendChild(reloadBtn);

      // Insert at the top of future view, after the section header
      const summarySection = futureView.querySelector('#future-summary-section');
      if (summarySection) {
        futureView.insertBefore(buttonContainer, summarySection);
      }
    }

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
    if (!confirm('This will clear all current projections and reload from overview data. Continue?')) {
      return;
    }

    console.log('[FutureProjectionView] Reloading projections from overview...');

    // Clear all projections
    this.projectionService.clearAll();

    // Re-populate from overview
    await this.autoPopulateFromOverview();

    // Update display
    this.updateProjection();

    alert('Projections reloaded successfully!');
  }

  /**
   * Update projection display
   */
  updateProjection() {
    const startDate = new Date();
    const endDate = addMonths(startDate, 12);

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

    // Update summary cards
    document.getElementById('future-income').textContent = formatCurrency(monthlyIncome);
    document.getElementById('future-expenses').textContent = formatCurrency(monthlyExpenses);
    document.getElementById('future-balance').textContent = formatCurrency(monthlyBalance);
    document.getElementById('future-total').textContent = formatCurrency(yearlyTotal);

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
    const startDate = new Date();
    const values = [];
    const baseAmount = Math.abs(item.amount);

    // Get values for next 12 months
    for (let i = 0; i < 12; i++) {
      const month = addMonths(startDate, i);
      const monthKey = format(month, 'yyyy-MM');

      const amount = item.monthlyOverrides && item.monthlyOverrides[monthKey]
        ? Math.abs(item.monthlyOverrides[monthKey])
        : baseAmount;

      values.push(amount);
    }

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
        <span class="sparkline-label">12-month variation</span>
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
        <input type="number" name="amount" step="0.01" required value="${Math.abs(item.amount)}">
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
        <input type="number" name="amount" step="0.01" required value="${Math.abs(item.amount)}">
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
        <input type="number" name="amount" step="0.01" required placeholder="0.00">
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
        <input type="number" name="amount" step="0.01" required placeholder="0.00">
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
   * Render monthly overrides for next 12 months
   */
  renderMonthlyOverrides(item) {
    const startDate = new Date();
    const months = [];

    for (let i = 0; i < 12; i++) {
      const month = addMonths(startDate, i);
      const monthKey = format(month, 'yyyy-MM');
      const monthLabel = format(month, 'MMM yyyy');

      const defaultAmount = Math.abs(item.amount);
      const overrideAmount = item.monthlyOverrides && item.monthlyOverrides[monthKey]
        ? Math.abs(item.monthlyOverrides[monthKey])
        : defaultAmount;

      months.push(`
        <div class="monthly-override-item">
          <label>${monthLabel}</label>
          <input
            type="number"
            class="monthly-override-input"
            data-month="${monthKey}"
            step="0.01"
            value="${overrideAmount.toFixed(2)}"
            placeholder="${defaultAmount.toFixed(2)}"
          />
        </div>
      `);
    }

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
