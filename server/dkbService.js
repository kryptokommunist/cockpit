import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DKB Bank Service
 *
 * This service provides integration with DKB bank using dkb-robo Python library.
 * Uses web scraping of DKB's REST API endpoints.
 */
export class DKBService {
  constructor() {
    this.accounts = new Map(); // accountId -> account data
    this.pythonScript = path.join(__dirname, 'dkb_fetch.py');
  }

  /**
   * Execute dkb-robo Python script
   */
  async executePythonScript(username, password, accountId = null, days = 90) {
    return new Promise((resolve, reject) => {
      const args = [
        this.pythonScript,
        '--username', username,
        '--password', password,
        '--days', days.toString()
      ];

      if (accountId) {
        args.push('--account-id', accountId);
      }

      console.log(`[DKB] Executing dkb-robo script...`);
      console.log(`[DKB] Command: python3 ${args.join(' ').replace(password, '***')}`);

      const pythonProcess = spawn('python3', args);
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        // Log stderr in real-time for debugging
        console.log(`[DKB] Python stderr:`, text);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`[DKB] Python script failed with code ${code}`);
          console.error(`[DKB] stdout:`, stdout);
          console.error(`[DKB] stderr:`, stderr);

          // Try to parse stdout as JSON error
          try {
            const errorResult = JSON.parse(stdout);
            if (errorResult.error) {
              reject(new Error(`Login failed: ${errorResult.error}`));
              return;
            }
          } catch (e) {
            // Not JSON, use stderr
          }

          reject(new Error(`dkb-robo script failed: ${stderr || stdout || 'Unknown error'}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          console.error(`[DKB] Failed to parse script output:`, stdout);
          reject(new Error(`Failed to parse script output: ${error.message}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error(`[DKB] Failed to start Python process:`, error);
        reject(new Error(`Failed to start dkb-robo: ${error.message}`));
      });
    });
  }

  /**
   * Fetch all data (accounts + transactions) in a single login session
   * @param {string} username - DKB username
   * @param {string} password - DKB password
   * @param {number} days - Number of days to fetch (default 1095 = ~3 years)
   * @returns {Promise<Object>} Accounts and transactions
   */
  async fetchAllInOneSession(username, password, days = 1095) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    console.log(`[DKB] Fetching all data for user: ${username} (${days} days of history)`);

    try {
      // Execute dkb-robo to get accounts AND transactions in one session
      const result = await this.executePythonScript(username, password, null, days);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data from DKB');
      }

      console.log(`[DKB] Fetched ${result.accounts.length} accounts and ${result.transactions.length} transactions`);

      // Map transactions to internal format
      const transactions = result.transactions.map(t => ({
        id: `dkb_${t.accountId}_${t.bookingDate}_${Math.abs(t.amount)}_${Math.random().toString(36).substr(2, 9)}`,
        bookingDate: this.parseDate(t.bookingDate),
        valueDate: this.parseDate(t.valueDate || t.bookingDate),
        payee: t.payee || '',
        purpose: t.purpose || '',
        accountNumber: t.accountIban || '',
        bankCode: '',
        amount: t.amount,
        currency: t.currency || 'EUR',
        accountId: t.accountId,
        source: 'dkb-robo'
      }));

      return {
        accounts: result.accounts,
        transactions
      };
    } catch (error) {
      console.error(`[DKB] Error fetching all data:`, error);
      throw new Error(`Failed to connect to DKB: ${error.message}`);
    }
  }

  /**
   * Authenticate and get available accounts (Step 1)
   * @param {Object} credentials
   * @param {string} credentials.username - DKB username
   * @param {string} credentials.password - DKB password
   * @returns {Promise<Object>} Session and available accounts
   */
  async createConsentAndGetAccounts(credentials) {
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    console.log(`[DKB] Fetching accounts for user: ${username}`);

    try {
      // Execute dkb-robo to get accounts (without fetching transactions yet)
      const result = await this.executePythonScript(username, password, null, 1);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch accounts');
      }

      console.log(`[DKB] Found ${result.accounts.length} accounts`);

      // Store credentials temporarily for later use
      const session = {
        username,
        password,
        timestamp: new Date().toISOString()
      };

      return {
        session,
        accounts: result.accounts,
        username,
        password
      };
    } catch (error) {
      console.error(`[DKB] Failed to fetch accounts:`, error);
      throw new Error(`Failed to connect to DKB: ${error.message}`);
    }
  }

  /**
   * Add account with selected account (Step 2)
   * @param {Object} params
   * @param {Object} params.session - Session from Step 1
   * @param {Object} params.selectedAccount - Selected account from list
   * @param {string} params.username - DKB username
   * @param {string} params.password - DKB password
   * @returns {Promise<Object>} Account information
   */
  async addAccountWithSelection(params) {
    const { session, selectedAccount, username, password } = params;

    if (!session || !selectedAccount) {
      throw new Error('Session and selected account are required');
    }

    // Generate account ID
    const id = `dkb_${Date.now()}`;

    // Store account data
    const account = {
      id,
      type: 'dkb',
      username,
      // WARNING: In production, encrypt this properly!
      password: Buffer.from(password).toString('base64'),
      accountId: selectedAccount.id,
      iban: selectedAccount.iban,
      accountName: selectedAccount.name || 'DKB Account',
      accountType: selectedAccount.type,
      currency: selectedAccount.currency || 'EUR',
      addedAt: new Date().toISOString(),
      lastSync: null,
      status: 'active'
    };

    this.accounts.set(id, account);

    console.log(`[DKB] Account ${id} added: ${account.iban || account.accountId}`);

    return {
      id,
      type: 'dkb',
      status: 'active',
      iban: selectedAccount.iban,
      accountName: account.accountName,
      message: 'Account connected successfully'
    };
  }

  /**
   * Fetch transactions from DKB account
   * @param {string} accountId - Internal account ID
   * @param {Object} options
   * @param {Date} options.startDate - Start date for transactions
   * @param {Date} options.endDate - End date for transactions
   * @returns {Promise<Array>} Array of transactions
   */
  async fetchTransactions(accountId, options = {}) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const { startDate, endDate } = options;
    const dateFrom = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dateTo = endDate || new Date();

    // Calculate days between dates
    const days = Math.ceil((dateTo - dateFrom) / (24 * 60 * 60 * 1000));

    console.log(`[DKB] Fetching transactions for account ${accountId}`);
    console.log(`[DKB] Date range: ${dateFrom.toISOString()} to ${dateTo.toISOString()} (${days} days)`);

    try {
      // Decode password
      const password = Buffer.from(account.password, 'base64').toString();

      // Execute dkb-robo to fetch transactions
      const result = await this.executePythonScript(
        account.username,
        password,
        account.accountId,
        days
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch transactions');
      }

      // Map transactions to internal format
      const transactions = result.transactions.map(t => ({
        bookingDate: this.parseDate(t.bookingDate),
        valueDate: this.parseDate(t.valueDate || t.bookingDate),
        payee: t.payee || '',
        purpose: t.purpose || '',
        accountNumber: t.accountIban || account.iban || '',
        bankCode: '',
        amount: t.amount,
        currency: t.currency || 'EUR',
        source: 'dkb-robo'
      }));

      // Update last sync time
      account.lastSync = new Date().toISOString();
      this.accounts.set(accountId, account);

      console.log(`[DKB] Fetched ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      console.error(`[DKB] Error fetching transactions:`, error);
      throw error;
    }
  }

  /**
   * Parse date string to Date object
   * @param {string} dateStr - Date string (various formats)
   * @returns {Date}
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date();

    // Try ISO format first
    if (dateStr.includes('-')) {
      return new Date(dateStr);
    }

    // Try DD.MM.YYYY format
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
        return new Date(year, month, day);
      }
    }

    return new Date(dateStr);
  }

  /**
   * Get account status
   * @param {string} accountId
   * @returns {Object} Account status
   */
  getAccountStatus(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return {
      id: account.id,
      type: account.type,
      status: account.status,
      lastSync: account.lastSync,
      error: account.error
    };
  }

  /**
   * Remove account
   * @param {string} accountId
   */
  removeAccount(accountId) {
    this.accounts.delete(accountId);
    console.log(`[DKB] Account ${accountId} removed`);
  }

  /**
   * List all accounts
   * @returns {Array} Array of account summaries
   */
  listAccounts() {
    return Array.from(this.accounts.values()).map(account => ({
      id: account.id,
      type: account.type,
      username: account.username,
      status: account.status,
      lastSync: account.lastSync,
      addedAt: account.addedAt
    }));
  }
}
