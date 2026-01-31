/**
 * DKB Bank Service (Frontend)
 * Communicates with backend DKB service
 */
export class DKBService {
  constructor() {
    this.baseURL = 'http://localhost:3001';
    this.accounts = [];
  }

  /**
   * Fetch all data (accounts and transactions) in a single login session
   * @param {string} username - DKB username/legitimation number (PSU-ID)
   * @param {string} password - DKB password
   * @returns {Promise<Object>} Accounts and transactions
   */
  async fetchAllData(username, password) {
    try {
      const response = await fetch(`${this.baseURL}/api/dkb/fetch-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch data from DKB');
      }

      console.log('[DKB Service] Fetched', data.accounts.length, 'accounts and', data.transactions.length, 'transactions');

      return {
        accounts: data.accounts,
        transactions: data.transactions
      };
    } catch (error) {
      console.error('[DKB Service] Error fetching all data:', error);
      throw error;
    }
  }

  /**
   * Refresh transactions for a saved account
   * @param {string} username - DKB username
   * @param {string} password - DKB password
   * @param {string} accountId - Account ID to filter
   * @returns {Promise<Array>} Transactions for the account
   */
  async refreshTransactions(username, password, accountId) {
    try {
      const result = await this.fetchAllData(username, password);

      // Filter transactions for the specific account
      const accountTransactions = result.transactions.filter(t => t.accountId === accountId);

      console.log('[DKB Service] Refreshed', accountTransactions.length, 'transactions for account', accountId);

      return accountTransactions;
    } catch (error) {
      console.error('[DKB Service] Error refreshing transactions:', error);
      throw error;
    }
  }

  /**
   * Authenticate and get available accounts (Step 1) - Legacy method
   * @param {string} username - DKB username/legitimation number (PSU-ID)
   * @param {string} password - DKB password
   * @returns {Promise<Object>} Session and available accounts
   */
  async authenticate(username, password) {
    // Use fetchAllData instead for single-login experience
    const result = await this.fetchAllData(username, password);
    return {
      session: { timestamp: new Date().toISOString() },
      accounts: result.accounts,
      transactions: result.transactions,
      username,
      password
    };
  }

  /**
   * Load list of DKB accounts
   * @returns {Promise<Array>} Array of accounts
   */
  async loadAccounts() {
    try {
      const response = await fetch(`${this.baseURL}/api/dkb/accounts`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load accounts');
      }

      this.accounts = data.accounts;
      console.log('[DKB Service] Loaded accounts:', this.accounts.length);

      return this.accounts;
    } catch (error) {
      console.error('[DKB Service] Error loading accounts:', error);
      this.accounts = [];
      throw error;
    }
  }

  /**
   * Get list of accounts
   * @returns {Array} Array of accounts
   */
  getAccounts() {
    return this.accounts;
  }

  /**
   * Check if any DKB accounts are configured
   * @returns {boolean}
   */
  hasAccounts() {
    return this.accounts.length > 0;
  }
}
