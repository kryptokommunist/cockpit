import { formatCurrency } from '../utils/numberUtils.js';

/**
 * Settings view for managing recategorization rules
 */
export class SettingsView {
  constructor(container, recategorizationService) {
    this.container = container;
    this.recategorizationService = recategorizationService;
    this.render();
  }

  /**
   * Render the settings view
   */
  render() {
    this.container.innerHTML = `
      <div class="settings-view">
        <div class="settings-header">
          <h2>Settings</h2>
        </div>

        <div class="settings-section">
          <h3>Recategorization Rules</h3>
          <p class="settings-description">
            Manage automatic recategorization rules. These rules are applied to all transactions at startup and when uploading new data.
          </p>

          <div class="settings-stats">
            <div class="stat-card">
              <div class="stat-value" id="total-rules">0</div>
              <div class="stat-label">Total Rules</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="merchant-rules">0</div>
              <div class="stat-label">Merchant Rules</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="merchant-amount-rules">0</div>
              <div class="stat-label">Merchant + Amount Rules</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="categories-targeted">0</div>
              <div class="stat-label">Categories Targeted</div>
            </div>
          </div>

          <div class="settings-actions">
            <button class="btn btn-primary" id="btn-export-rules">
              Export Rules (CSV)
            </button>
            <button class="btn btn-secondary" id="btn-import-rules">
              Import Rules (CSV)
            </button>
            <input type="file" id="import-rules-input" accept=".csv" style="display: none;">
          </div>

          <div class="rules-list" id="rules-list">
            <!-- Rules will be rendered here -->
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.updateStats();
    this.renderRules();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Export button
    const exportBtn = this.container.querySelector('#btn-export-rules');
    exportBtn.addEventListener('click', () => this.exportRules());

    // Import button
    const importBtn = this.container.querySelector('#btn-import-rules');
    const importInput = this.container.querySelector('#import-rules-input');

    importBtn.addEventListener('click', () => importInput.click());

    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importRules(file);
      }
    });
  }

  /**
   * Update statistics display
   */
  updateStats() {
    const stats = this.recategorizationService.getStats();

    this.container.querySelector('#total-rules').textContent = stats.totalRules;
    this.container.querySelector('#merchant-rules').textContent = stats.merchantOnlyRules;
    this.container.querySelector('#merchant-amount-rules').textContent = stats.merchantAmountRules;
    this.container.querySelector('#categories-targeted').textContent = stats.categoriesTargeted;
  }

  /**
   * Render the list of rules
   */
  renderRules() {
    const rulesList = this.container.querySelector('#rules-list');
    const rules = this.recategorizationService.getAllRules();

    if (rules.length === 0) {
      rulesList.innerHTML = `
        <div class="rules-empty">
          <p>No recategorization rules yet.</p>
          <p class="text-secondary">Create rules by clicking the ⚙️ button on transactions in the category breakdown.</p>
        </div>
      `;
      return;
    }

    // Sort rules by merchant, then amount
    rules.sort((a, b) => {
      if (a.merchant !== b.merchant) {
        return a.merchant.localeCompare(b.merchant);
      }
      if (a.amount === null) return -1;
      if (b.amount === null) return 1;
      return a.amount - b.amount;
    });

    const rulesHTML = rules.map(rule => `
      <div class="rule-item" data-rule-id="${rule.id}">
        <div class="rule-info">
          <div class="rule-merchant">${rule.merchant}</div>
          <div class="rule-details">
            <span class="rule-amount">${rule.amount !== null ? formatCurrency(rule.amount) : 'All amounts'}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-category">${rule.category}</span>
          </div>
          ${rule.originalCategory ? `<div class="rule-original">Original: ${rule.originalCategory}</div>` : ''}
        </div>
        <div class="rule-actions">
          <button class="btn-rule-delete" data-rule-id="${rule.id}" title="Delete rule">🗑️</button>
        </div>
      </div>
    `).join('');

    rulesList.innerHTML = rulesHTML;

    // Add delete button handlers
    rulesList.querySelectorAll('.btn-rule-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const ruleId = btn.dataset.ruleId;
        this.deleteRule(ruleId);
      });
    });
  }

  /**
   * Delete a rule
   * @param {string} ruleId - Rule ID
   */
  async deleteRule(ruleId) {
    if (!confirm('Delete this recategorization rule?')) {
      return;
    }

    this.recategorizationService.removeRule(ruleId);
    await this.recategorizationService.save();

    // Refresh display
    this.updateStats();
    this.renderRules();

    // Notify app to reapply categorization
    window.dispatchEvent(new CustomEvent('recategorization-rules-changed'));

    this.showNotification('Rule deleted successfully', 'success');
  }

  /**
   * Export rules to CSV
   */
  async exportRules() {
    await this.recategorizationService.save();
    this.showNotification('Rules exported successfully', 'success');
  }

  /**
   * Import rules from CSV file
   * @param {File} file - CSV file
   */
  async importRules(file) {
    try {
      const text = await file.text();
      const count = this.recategorizationService.importFromCSV(text);
      await this.recategorizationService.save();

      // Refresh display
      this.updateStats();
      this.renderRules();

      // Notify app to reapply categorization
      window.dispatchEvent(new CustomEvent('recategorization-rules-changed'));

      this.showNotification(`Imported ${count} rules successfully`, 'success');
    } catch (error) {
      console.error('Error importing rules:', error);
      this.showNotification('Error importing rules', 'error');
    }
  }

  /**
   * Refresh the view
   */
  refresh() {
    this.updateStats();
    this.renderRules();
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
