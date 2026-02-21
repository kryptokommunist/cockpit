import { formatCurrency } from '../utils/numberUtils.js';
import { DKBModal } from './dkbModal.js';

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
    const dkbCredentials = DKBModal.getSavedCredentials();
    const lastSync = DKBModal.getLastSyncTime();
    const aiSettings = this.getAISettings();

    this.container.innerHTML = `
      <div class="settings-view">
        <div class="settings-header">
          <h2>Settings</h2>
        </div>

        <div class="settings-section">
          <h3>Data Source</h3>
          <p class="settings-description">
            Manage your transaction data source.
          </p>

          <div id="data-source-status">
            <!-- Will be populated dynamically -->
            <div class="connection-info">
              <div class="connection-status disconnected">
                <span class="status-icon">○</span>
                <span class="status-text">Loading...</span>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>AI API Configuration</h3>
          <p class="settings-description">
            Configure the AI API for transaction categorization and financial Q&A.
          </p>

          <div class="ai-settings-form">
            <div class="form-group">
              <label for="ai-base-url">API Base URL</label>
              <input type="text" id="ai-base-url" value="${aiSettings.baseUrl || ''}" placeholder="http://localhost:9988/anthropic/">
            </div>
            <div class="form-group">
              <label for="ai-token">API Token</label>
              <input type="password" id="ai-token" value="${aiSettings.token || ''}" placeholder="sk-...">
            </div>
            <div class="form-group">
              <label for="ai-model">Model</label>
              <input type="text" id="ai-model" value="${aiSettings.model || ''}" placeholder="anthropic--claude-4.5-sonnet">
            </div>
            <div class="ai-settings-actions">
              <button class="btn btn-secondary" id="btn-test-ai">Test Connection</button>
              <button class="btn btn-primary" id="btn-save-ai">Save Settings</button>
            </div>
            <div id="ai-test-result" class="ai-test-result" style="display: none;"></div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Data Management</h3>
          <p class="settings-description">
            Reset or clear application data.
          </p>

          <div class="data-management-actions">
            <div class="action-item">
              <div class="action-info">
                <strong>Reset Future Projections</strong>
                <p class="text-secondary">Clear all future projections and recalculate from overview data.</p>
              </div>
              <button class="btn btn-secondary" id="btn-reset-projections">Reset Projections</button>
            </div>
            <div class="action-item">
              <div class="action-info">
                <strong>Clear All Data</strong>
                <p class="text-secondary">Clear all loaded transactions, projections, and cached data. This will return the app to its initial state.</p>
              </div>
              <button class="btn btn-danger" id="btn-clear-all-data">Clear All Data</button>
            </div>
          </div>
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
    this.renderDataSourceStatus();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for DKB data refresh completion
    window.addEventListener('dkb-data-refreshed', () => {
      this.renderDataSourceStatus();
    });

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

    // AI settings buttons
    const testAiBtn = this.container.querySelector('#btn-test-ai');
    if (testAiBtn) {
      testAiBtn.addEventListener('click', () => this.testAIConnection());
    }

    const saveAiBtn = this.container.querySelector('#btn-save-ai');
    if (saveAiBtn) {
      saveAiBtn.addEventListener('click', () => this.saveAISettings());
    }

    // Data management buttons
    const resetProjectionsBtn = this.container.querySelector('#btn-reset-projections');
    if (resetProjectionsBtn) {
      resetProjectionsBtn.addEventListener('click', () => this.resetProjections());
    }

    const clearAllDataBtn = this.container.querySelector('#btn-clear-all-data');
    if (clearAllDataBtn) {
      clearAllDataBtn.addEventListener('click', () => this.clearAllData());
    }
  }

  /**
   * Render data source status section
   */
  renderDataSourceStatus() {
    const statusContainer = this.container.querySelector('#data-source-status');
    if (!statusContainer) return;

    const dkbCredentials = DKBModal.getSavedCredentials();
    const lastSync = DKBModal.getLastSyncTime();

    // Query the app for current data source
    let dataSourceInfo = { source: null, fileName: null, transactionCount: 0 };
    const event = new CustomEvent('get-data-source', {
      detail: {
        callback: (info) => { dataSourceInfo = info; }
      }
    });
    window.dispatchEvent(event);

    let html = '';

    if (dkbCredentials) {
      // DKB is connected
      html = `
        <div class="connection-info">
          <div class="connection-status connected">
            <span class="status-icon">✓</span>
            <span class="status-text">DKB Connected</span>
          </div>
          <div class="connection-details">
            <div class="detail-row">
              <span class="detail-label">Username:</span>
              <span class="detail-value">${dkbCredentials.username}</span>
            </div>
            ${dkbCredentials.account ? `
              <div class="detail-row">
                <span class="detail-label">Account:</span>
                <span class="detail-value">${dkbCredentials.account.name || 'Account'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">IBAN:</span>
                <span class="detail-value">${dkbCredentials.account.iban || 'N/A'}</span>
              </div>
              ${dkbCredentials.account.balance !== undefined ? `
                <div class="detail-row">
                  <span class="detail-label">Balance:</span>
                  <span class="detail-value">${dkbCredentials.account.balance.toFixed(2)} ${dkbCredentials.account.currency || 'EUR'}</span>
                </div>
              ` : ''}
            ` : ''}
            ${lastSync ? `
              <div class="detail-row">
                <span class="detail-label">Last Sync:</span>
                <span class="detail-value">${new Date(lastSync).toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Transactions:</span>
              <span class="detail-value">${dataSourceInfo.transactionCount}</span>
            </div>
          </div>
          <div class="connection-actions">
            <button class="btn btn-secondary" id="btn-refresh-dkb">Refresh Data</button>
            <button class="btn btn-danger" id="btn-disconnect-dkb">Disconnect</button>
          </div>
        </div>
      `;
    } else if (dataSourceInfo.source === 'csv') {
      // CSV is loaded
      html = `
        <div class="connection-info">
          <div class="connection-status connected">
            <span class="status-icon">✓</span>
            <span class="status-text">CSV Loaded</span>
          </div>
          <div class="connection-details">
            ${dataSourceInfo.fileName ? `
              <div class="detail-row">
                <span class="detail-label">File:</span>
                <span class="detail-value">${dataSourceInfo.fileName}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Transactions:</span>
              <span class="detail-value">${dataSourceInfo.transactionCount}</span>
            </div>
          </div>
          <div class="connection-actions">
            <button class="btn btn-secondary" id="btn-connect-dkb">Switch to DKB</button>
            <button class="btn btn-danger" id="btn-disconnect-csv">Clear CSV Data</button>
          </div>
        </div>
      `;
    } else {
      // No data loaded
      html = `
        <div class="connection-info">
          <div class="connection-status disconnected">
            <span class="status-icon">○</span>
            <span class="status-text">No Data Loaded</span>
          </div>
          <p class="text-secondary">Connect your DKB account or upload a CSV file to import transactions.</p>
          <button class="btn btn-primary" id="btn-connect-dkb">Connect DKB Account</button>
        </div>
      `;
    }

    statusContainer.innerHTML = html;

    // Attach event listeners for the buttons
    const connectDkbBtn = statusContainer.querySelector('#btn-connect-dkb');
    if (connectDkbBtn) {
      connectDkbBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('open-dkb-modal'));
      });
    }

    const refreshDkbBtn = statusContainer.querySelector('#btn-refresh-dkb');
    if (refreshDkbBtn) {
      refreshDkbBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('dkb-refresh-requested'));
      });
    }

    const disconnectDkbBtn = statusContainer.querySelector('#btn-disconnect-dkb');
    if (disconnectDkbBtn) {
      disconnectDkbBtn.addEventListener('click', () => this.disconnectDKB());
    }

    const disconnectCsvBtn = statusContainer.querySelector('#btn-disconnect-csv');
    if (disconnectCsvBtn) {
      disconnectCsvBtn.addEventListener('click', () => this.disconnectCSV());
    }
  }

  /**
   * Disconnect CSV data
   */
  disconnectCSV() {
    if (!confirm('Clear CSV data? This will remove all loaded transactions.')) {
      return;
    }

    window.dispatchEvent(new CustomEvent('csv-disconnect-requested'));
    this.renderDataSourceStatus();
    this.showNotification('CSV data cleared', 'success');
  }

  /**
   * Get AI settings from localStorage
   */
  getAISettings() {
    try {
      const settings = localStorage.getItem('ai_settings');
      return settings ? JSON.parse(settings) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Save AI settings to localStorage
   */
  saveAISettings() {
    const baseUrl = this.container.querySelector('#ai-base-url').value.trim();
    const token = this.container.querySelector('#ai-token').value.trim();
    const model = this.container.querySelector('#ai-model').value.trim();

    const settings = { baseUrl, token, model };
    localStorage.setItem('ai_settings', JSON.stringify(settings));

    this.showNotification('AI settings saved successfully', 'success');
  }

  /**
   * Test AI connection
   */
  async testAIConnection() {
    const resultDiv = this.container.querySelector('#ai-test-result');
    resultDiv.style.display = 'block';
    resultDiv.className = 'ai-test-result testing';
    resultDiv.textContent = 'Testing connection...';

    try {
      const response = await fetch('http://localhost:3005/api/test');
      const data = await response.json();

      if (data.success) {
        resultDiv.className = 'ai-test-result success';
        resultDiv.textContent = 'Connection successful!';
      } else {
        resultDiv.className = 'ai-test-result error';
        resultDiv.textContent = `Connection failed: ${data.error || 'Unknown error'}`;
      }
    } catch (error) {
      resultDiv.className = 'ai-test-result error';
      resultDiv.textContent = `Connection failed: ${error.message}`;
    }
  }

  /**
   * Disconnect DKB account
   */
  disconnectDKB() {
    if (!confirm('Disconnect DKB account? This will clear saved credentials and transactions.')) {
      return;
    }

    DKBModal.clearSavedData();
    window.dispatchEvent(new CustomEvent('dkb-disconnected'));
    this.renderDataSourceStatus();
    this.showNotification('DKB account disconnected', 'success');
  }

  /**
   * Reset future projections
   */
  resetProjections() {
    if (!confirm('Reset all future projections? They will be recalculated from overview data.')) {
      return;
    }

    // Clear projections from localStorage
    localStorage.removeItem('projections');

    // Dispatch event to trigger reload
    window.dispatchEvent(new CustomEvent('reset-projections-requested'));

    this.showNotification('Projections reset. Switch to Future tab to see recalculated projections.', 'success');
  }

  /**
   * Clear all application data
   */
  clearAllData() {
    if (!confirm('Clear ALL application data? This will remove:\n- Loaded transactions\n- DKB credentials and cached data\n- Future projections\n- AI categorizations\n- Recategorization rules\n\nThis action cannot be undone.')) {
      return;
    }

    // Clear all localStorage data
    localStorage.removeItem('dkb_credentials');
    localStorage.removeItem('dkb_transactions');
    localStorage.removeItem('dkb_last_sync');
    localStorage.removeItem('projections');
    localStorage.removeItem('ai_categorizations');
    localStorage.removeItem('recategorization_rules');
    localStorage.removeItem('ai_settings');

    // Dispatch event to reload app
    window.dispatchEvent(new CustomEvent('clear-all-data-requested'));

    this.showNotification('All data cleared. Refreshing page...', 'success');

    // Reload the page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1500);
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
