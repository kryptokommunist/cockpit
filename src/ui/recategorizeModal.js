import { formatCurrency } from '../utils/numberUtils.js';

/**
 * Modal for recategorizing transactions
 */
export class RecategorizeModal {
  constructor(recategorizationService, categorizer) {
    this.recategorizationService = recategorizationService;
    this.categorizer = categorizer;
    this.transaction = null;
    this.modal = null;
  }

  /**
   * Show the modal for a transaction
   * @param {Object} transaction - Transaction to recategorize
   */
  show(transaction) {
    this.transaction = transaction;
    this.render();
  }

  /**
   * Render the modal
   */
  render() {
    // Remove existing modal if any
    if (this.modal) {
      this.modal.remove();
    }

    const normalizedMerchant = this.transaction.normalizedMerchant || this.transaction.payee.toUpperCase();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay';
    this.modal.innerHTML = `
      <div class="modal-content recategorize-modal">
        <div class="modal-header">
          <h3>Recategorize Transaction</h3>
          <button class="btn-modal-close">×</button>
        </div>

        <div class="modal-body">
          <div class="transaction-info">
            <div class="info-row">
              <span class="info-label">Merchant:</span>
              <span class="info-value">${this.transaction.payee}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Normalized:</span>
              <span class="info-value">${normalizedMerchant}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Amount:</span>
              <span class="info-value">${formatCurrency(Math.abs(this.transaction.amount))}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Current Category:</span>
              <span class="info-value category-badge">${this.transaction.category}</span>
            </div>
          </div>

          <div class="recategorize-options">
            <h4>Create Recategorization Rule:</h4>

            <div class="option-group">
              <label class="radio-option">
                <input type="radio" name="recategorize-type" value="merchant" checked>
                <div class="option-content">
                  <div class="option-title">By Merchant</div>
                  <div class="option-description">
                    Applies to all transactions from <strong>${normalizedMerchant}</strong>
                  </div>
                </div>
              </label>

              <label class="radio-option">
                <input type="radio" name="recategorize-type" value="merchant-amount">
                <div class="option-content">
                  <div class="option-title">By Merchant + Amount</div>
                  <div class="option-description">
                    Only applies to transactions from <strong>${normalizedMerchant}</strong>
                    with amount <strong>${formatCurrency(Math.abs(this.transaction.amount))}</strong>
                  </div>
                </div>
              </label>
            </div>

            <div class="category-selection">
              <label for="new-category">New Category:</label>
              <select id="new-category" class="category-select">
                ${this.renderCategoryOptions()}
              </select>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-cancel">Cancel</button>
          <button class="btn btn-primary" id="btn-apply">Apply Rule</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.setupEventListeners();

    // Show modal with animation
    setTimeout(() => this.modal.classList.add('show'), 10);
  }

  /**
   * Render category options for select
   * @returns {string} - HTML options
   */
  renderCategoryOptions() {
    const categories = Object.keys(this.categorizer.categories).sort();

    return categories.map(cat => {
      const selected = cat === this.transaction.category ? '' : '';
      return `<option value="${cat}" ${selected}>${cat}</option>`;
    }).join('');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const closeBtn = this.modal.querySelector('.btn-modal-close');
    const cancelBtn = this.modal.querySelector('#btn-cancel');
    const applyBtn = this.modal.querySelector('#btn-apply');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    applyBtn.addEventListener('click', () => this.applyRule());

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Apply the recategorization rule
   */
  async applyRule() {
    const type = this.modal.querySelector('input[name="recategorize-type"]:checked').value;
    const newCategory = this.modal.querySelector('#new-category').value;

    if (!newCategory) {
      alert('Please select a category');
      return;
    }

    const normalizedMerchant = this.transaction.normalizedMerchant || this.transaction.payee.toUpperCase();

    const rule = {
      merchant: normalizedMerchant,
      amount: type === 'merchant-amount' ? Math.abs(this.transaction.amount) : null,
      category: newCategory,
      originalCategory: this.transaction.category
    };

    // Add rule
    this.recategorizationService.addRule(rule);

    // Save rules
    await this.recategorizationService.save();

    // Notify app to reapply categorization
    window.dispatchEvent(new CustomEvent('recategorization-rules-changed'));

    this.showNotification('Recategorization rule created successfully', 'success');
    this.close();
  }

  /**
   * Close the modal
   */
  close() {
    if (this.modal) {
      this.modal.classList.remove('show');
      setTimeout(() => {
        this.modal.remove();
        this.modal = null;
      }, 300);
    }
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type
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
