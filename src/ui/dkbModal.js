/**
 * DKB Connection Modal
 * Handles UI for connecting to DKB bank account
 */
export class DKBModal {
  constructor(dkbService, onSuccess) {
    this.dkbService = dkbService;
    this.onSuccess = onSuccess;
    this.modal = null;
    this.selectedAccountIndex = null;
  }

  /**
   * Show the DKB connection modal
   */
  show() {
    this.createModal();
    document.body.appendChild(this.modal);
    setTimeout(() => this.modal.classList.add('show'), 10);
  }

  /**
   * Create modal element
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay';
    this.modal.innerHTML = `
      <div class="modal-content dkb-modal">
        <div class="modal-header">
          <h3>Connect DKB Bank Account</h3>
          <button class="btn-modal-close">×</button>
        </div>
        <div class="modal-body">
          <p class="dkb-info">
            Enter your DKB online banking credentials to automatically load your transaction data.
            Your credentials are stored securely and used only to fetch your transactions.
          </p>

          <div class="dkb-warning">
            <strong>⚠️ Security Notice:</strong> This is a development/demo feature.
            In production, credentials should be encrypted and use OAuth or PSD2 banking APIs.
            For now, this connects directly to fetch your transaction data.
          </div>

          <form id="dkb-connect-form" class="dkb-form">
            <div class="form-group">
              <label for="dkb-username">Legitimations-ID / Username (PSU-ID)</label>
              <input
                type="text"
                id="dkb-username"
                name="username"
                required
                placeholder="Enter your DKB username"
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label for="dkb-password">PIN / Password</label>
              <input
                type="password"
                id="dkb-password"
                name="password"
                required
                placeholder="Enter your DKB password"
                autocomplete="current-password"
              />
            </div>

            <div class="dkb-features">
              <h4>What happens next:</h4>
              <ul>
                <li>✓ Secure connection to your DKB account</li>
                <li>✓ Automatic transaction import (full history)</li>
                <li>✓ Data saved locally for future sessions</li>
                <li>✓ No need to manually download CSV files</li>
              </ul>
            </div>

            <div id="dkb-error" class="error-message" style="display: none;"></div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary btn-connect">
                <span class="btn-text">Connect Account</span>
                <span class="btn-loading" style="display: none;">Connecting...</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const closeBtn = this.modal.querySelector('.btn-modal-close');
    const cancelBtn = this.modal.querySelector('.btn-cancel');
    const form = this.modal.querySelector('#dkb-connect-form');

    // Close button
    closeBtn.addEventListener('click', () => this.close());

    // Cancel button
    cancelBtn.addEventListener('click', () => this.close());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(form);
    });
  }

  /**
   * Handle form submission
   */
  async handleSubmit(form) {
    const formData = new FormData(form);
    const username = formData.get('username');
    const password = formData.get('password');

    const errorDiv = this.modal.querySelector('#dkb-error');
    const submitBtn = this.modal.querySelector('.btn-connect');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Clear previous error
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';

    try {
      console.log('[DKB Modal] Fetching accounts and transactions from DKB...');
      errorDiv.innerHTML = '<strong>⏳ Getting captcha token and authenticating...</strong><br>Please confirm the login on your DKB Banking app when prompted!';
      errorDiv.style.display = 'block';
      errorDiv.style.color = '#0066cc';

      // Fetch all accounts and transactions in one request
      const result = await this.dkbService.fetchAllData(username, password);

      // Clear the info message
      errorDiv.style.display = 'none';

      console.log('[DKB Modal] Found', result.accounts.length, 'accounts and', result.transactions.length, 'transactions');

      // Show account selection with transactions already loaded
      this.showAccountSelection(result.accounts, result.transactions, username, password);

    } catch (error) {
      console.error('[DKB Modal] Error:', error);

      errorDiv.textContent = error.message;
      errorDiv.style.color = '';
      errorDiv.style.display = 'block';

      // Reset button state
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
    }
  }

  /**
   * Show account selection step
   */
  showAccountSelection(accounts, transactions, username, password) {
    const modalBody = this.modal.querySelector('.modal-body');
    this.selectedAccountIndex = null;

    // Group transactions by account
    const transactionsByAccount = {};
    transactions.forEach(t => {
      const accId = t.accountId || 'unknown';
      if (!transactionsByAccount[accId]) {
        transactionsByAccount[accId] = [];
      }
      transactionsByAccount[accId].push(t);
    });

    modalBody.innerHTML = `
      <h4>Select Account</h4>
      <p>Choose which account to import (transactions already loaded):</p>

      <div class="account-list">
        ${accounts.map((account, index) => {
          const accTransactions = transactionsByAccount[account.id] || [];
          return `
          <div class="account-item" data-index="${index}">
            <div class="account-info">
              <div class="account-name">${account.name || account.product || 'Account'}</div>
              <div class="account-iban">${account.iban || 'No IBAN'}</div>
              <div class="account-balance">${account.balance ? account.balance.toFixed(2) : '0.00'} ${account.currency || 'EUR'}</div>
              <div class="account-transactions">${accTransactions.length} transactions available</div>
            </div>
            <button class="btn btn-primary btn-select-account" data-index="${index}">Select</button>
          </div>
        `}).join('')}
      </div>

      <div id="dkb-error" class="error-message" style="display: none;"></div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-confirm" disabled>Confirm Selection</button>
      </div>
    `;

    // Store data for later use
    this.pendingData = { accounts, transactions, username, password };

    // Attach event listeners for account selection
    const selectButtons = modalBody.querySelectorAll('.btn-select-account');
    const confirmBtn = modalBody.querySelector('.btn-confirm');
    const accountItems = modalBody.querySelectorAll('.account-item');

    selectButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);

        // Update visual selection
        accountItems.forEach((item, i) => {
          if (i === index) {
            item.classList.add('selected');
            item.querySelector('.btn-select-account').textContent = '✓ Selected';
            item.querySelector('.btn-select-account').classList.add('selected');
          } else {
            item.classList.remove('selected');
            item.querySelector('.btn-select-account').textContent = 'Select';
            item.querySelector('.btn-select-account').classList.remove('selected');
          }
        });

        this.selectedAccountIndex = index;
        confirmBtn.disabled = false;
      });
    });

    confirmBtn.addEventListener('click', () => {
      if (this.selectedAccountIndex !== null) {
        this.handleAccountConfirmation();
      }
    });

    const cancelBtn = modalBody.querySelector('.btn-cancel');
    cancelBtn.addEventListener('click', () => this.close());
  }

  /**
   * Handle account confirmation
   */
  async handleAccountConfirmation() {
    const { accounts, transactions, username, password } = this.pendingData;
    const selectedAccount = accounts[this.selectedAccountIndex];

    // Filter transactions for selected account
    const accountTransactions = transactions.filter(t => t.accountId === selectedAccount.id);

    console.log('[DKB Modal] Selected account:', selectedAccount.iban, 'with', accountTransactions.length, 'transactions');

    // Save credentials and account info to localStorage
    this.saveCredentials(username, password, selectedAccount);

    // Save transactions to localStorage
    this.saveTransactions(accountTransactions);

    // Close modal and call success callback
    this.close();

    if (this.onSuccess) {
      this.onSuccess(accountTransactions, selectedAccount);
    }

    this.showNotification(`DKB account connected! Loaded ${accountTransactions.length} transactions.`, 'success');
  }

  /**
   * Save credentials to localStorage (base64 encoded - NOT secure, just obfuscated)
   */
  saveCredentials(username, password, account) {
    const credentials = {
      username,
      password: btoa(password), // Base64 encode (NOT encryption!)
      account: {
        id: account.id,
        iban: account.iban,
        name: account.name,
        type: account.type,
        balance: account.balance,  // Store current balance for chart calculations
        currency: account.currency || 'EUR'
      },
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('dkb_credentials', JSON.stringify(credentials));
    console.log('[DKB Modal] Credentials saved to localStorage (balance:', account.balance, ')');
  }

  /**
   * Save transactions to localStorage
   */
  saveTransactions(transactions) {
    localStorage.setItem('dkb_transactions', JSON.stringify(transactions));
    localStorage.setItem('dkb_last_sync', new Date().toISOString());
    console.log('[DKB Modal] Saved', transactions.length, 'transactions to localStorage');
  }

  /**
   * Close modal
   */
  close() {
    this.modal.classList.remove('show');
    setTimeout(() => {
      if (this.modal && this.modal.parentNode) {
        this.modal.remove();
      }
    }, 300);
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

  /**
   * Check if saved credentials exist
   */
  static hasSavedCredentials() {
    return localStorage.getItem('dkb_credentials') !== null;
  }

  /**
   * Get saved credentials
   */
  static getSavedCredentials() {
    const data = localStorage.getItem('dkb_credentials');
    if (!data) return null;
    try {
      const creds = JSON.parse(data);
      creds.password = atob(creds.password); // Decode base64
      return creds;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get saved transactions
   */
  static getSavedTransactions() {
    const data = localStorage.getItem('dkb_transactions');
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  /**
   * Get last sync time
   */
  static getLastSyncTime() {
    return localStorage.getItem('dkb_last_sync');
  }

  /**
   * Clear saved data
   */
  static clearSavedData() {
    localStorage.removeItem('dkb_credentials');
    localStorage.removeItem('dkb_transactions');
    localStorage.removeItem('dkb_last_sync');
  }
}
