import { addMonths, format } from 'date-fns';
import { formatCurrency } from '../utils/numberUtils.js';

/**
 * Future Projection View Manager
 */
export class FutureProjectionView {
  constructor(projectionService, categorizer) {
    this.projectionService = projectionService;
    this.categorizer = categorizer;
    this.setupTabSwitching();
    this.setupAddButtons();
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

    // Dispatch event to update charts
    window.dispatchEvent(new CustomEvent('update-future-projection', {
      detail: { projections, startDate, endDate }
    }));
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
   * Render category options
   */
  renderCategoryOptions() {
    const categories = Object.keys(this.categorizer.categories).sort();
    return categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
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
