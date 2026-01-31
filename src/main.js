import { CSVParser } from './parser/csvParser.js';
import { Categorizer } from './services/categorizer.js';
import { SettingsManager } from './services/settingsManager.js';
import { RecurringDetector } from './services/recurringDetector.js';
import { BudgetCalculator } from './services/budgetCalculator.js';
import { CategorizationStorage } from './services/categorizationStorage.js';
import { RecategorizationService } from './services/recategorizationService.js';
import { ProjectionService } from './services/projectionService.js';
import { DKBService } from './services/dkbService.js';
import { ChartManager } from './visualizations/chartManager.js';
import { FutureChartManager } from './visualizations/futureChartManager.js';
import { FileUpload } from './ui/fileUpload.js';
import { DKBModal } from './ui/dkbModal.js';
import { Sidebar } from './ui/sidebar.js';
import { TransactionList } from './ui/transactionList.js';
import { Filters } from './ui/filters.js';
import { BudgetView } from './ui/budgetView.js';
import { FinancialQA } from './ui/financialQA.js';
import { FutureFinancialQA } from './ui/futureFinancialQA.js';
import { TopMerchants } from './ui/topMerchants.js';
import { SettingsView } from './ui/settingsView.js';
import { RecategorizeModal } from './ui/recategorizeModal.js';
import { FutureProjectionView } from './ui/futureProjectionView.js';
import { Transaction } from './models/Transaction.js';
import { formatCurrency } from './utils/numberUtils.js';

/**
 * Main application class
 */
class App {
  constructor() {
    this.transactions = [];
    this.filteredTransactions = [];
    this.csvParser = new CSVParser();
    this.categorizer = new Categorizer();
    this.settingsManager = new SettingsManager();
    this.recurringDetector = new RecurringDetector();
    this.budgetCalculator = new BudgetCalculator();
    this.categorizationStorage = new CategorizationStorage();
    this.recategorizationService = new RecategorizationService();
    this.projectionService = new ProjectionService();
    this.dkbService = new DKBService();
    this.chartManager = null;
    this.futureChartManager = null;
    this.transactionList = null;
    this.filters = null;
    this.budgetView = null;
    this.financialQA = null;
    this.futureFinancialQA = null;
    this.topMerchants = null;
    this.settingsView = null;
    this.recategorizeModal = null;
    this.futureProjectionView = null;
    this.dkbModal = null;
    this.sidebar = null;
    this.settingsFileUpload = null;
    this.currentPage = 'dashboard'; // dashboard or settings
    this.currentTab = 'overview'; // overview or future (within dashboard)

    this.init();
  }

  async init() {
    console.log('Initializing Cockpit...');

    // Load settings
    await this.settingsManager.load();

    // Restore discovered categories from settings
    if (this.settingsManager.settings.discoveredCategories) {
      this.categorizer.addCategories(this.settingsManager.settings.discoveredCategories);
      console.log('Restored discovered categories:', this.settingsManager.settings.discoveredCategories);
    }

    // Load recategorization rules
    await this.recategorizationService.load();

    // Load projection data
    await this.projectionService.load();

    // Initialize recategorize modal
    this.recategorizeModal = new RecategorizeModal(this.recategorizationService, this.categorizer);

    // Initialize future projection view
    this.futureProjectionView = new FutureProjectionView(this.projectionService, this.categorizer);

    // Initialize future chart manager
    this.futureChartManager = new FutureChartManager(this.projectionService, this.categorizer);

    // Setup event listeners
    this.setupEventListeners();

    // Initialize sidebar (always available)
    const sidebarContainer = document.getElementById('sidebar-container');
    this.sidebar = new Sidebar(sidebarContainer, (view) => this.handleNavigation(view));

    // Initialize file upload for initial screen
    const uploadContainer = document.getElementById('file-upload-container');
    new FileUpload(
      uploadContainer,
      (file) => this.handleFileUpload(file),
      () => this.handleDKBConnect()
    );

    // Initialize file upload for settings page (will be used after data is loaded)
    const settingsUploadContainer = document.getElementById('settings-upload-container');
    this.settingsFileUpload = new FileUpload(
      settingsUploadContainer,
      (file) => this.handleFileUpload(file),
      () => this.handleDKBConnect()
    );

    // Try to load saved DKB transactions first, then fall back to CSV
    const loadedFromDKB = await this.tryLoadSavedDKBData();
    if (!loadedFromDKB) {
      await this.tryAutoLoadCSV();
    }

    console.log('App initialized');
  }

  /**
   * Try to load saved DKB transactions from localStorage
   */
  async tryLoadSavedDKBData() {
    try {
      const savedTransactions = DKBModal.getSavedTransactions();
      const savedCredentials = DKBModal.getSavedCredentials();
      const lastSync = DKBModal.getLastSyncTime();

      if (savedTransactions && savedTransactions.length > 0) {
        console.log(`[App] Loading ${savedTransactions.length} saved DKB transactions from localStorage`);

        // Convert saved data to Transaction objects
        this.transactions = savedTransactions.map(t => new Transaction({
          bookingDate: new Date(t.bookingDate),
          valueDate: new Date(t.valueDate),
          payee: t.payee,
          purpose: t.purpose,
          accountNumber: t.accountNumber || '',
          bankCode: t.bankCode || '',
          amount: t.amount,
          currency: t.currency || 'EUR'
        }));

        // Process transactions
        await this.processTransactions();

        // Show notification with last sync time
        const syncDate = lastSync ? new Date(lastSync).toLocaleString() : 'unknown';
        this.showNotification(`Loaded ${this.transactions.length} transactions from DKB (last sync: ${syncDate})`, 'success');

        return true;
      }
    } catch (error) {
      console.error('[App] Error loading saved DKB data:', error);
    }
    return false;
  }

  /**
   * Refresh DKB transactions using saved credentials
   */
  async refreshDKBTransactions() {
    const credentials = DKBModal.getSavedCredentials();
    if (!credentials) {
      this.showNotification('No saved DKB credentials found', 'error');
      return;
    }

    try {
      this.showNotification('Refreshing DKB data... Please confirm on your app', 'info');

      const result = await this.dkbService.fetchAllData(credentials.username, credentials.password);

      // Filter transactions for the saved account
      const accountTransactions = result.transactions.filter(t => t.accountId === credentials.account.id);

      // Save new transactions
      localStorage.setItem('dkb_transactions', JSON.stringify(accountTransactions));
      localStorage.setItem('dkb_last_sync', new Date().toISOString());

      // Process transactions
      await this.handleDKBTransactions(accountTransactions, credentials.account);

      this.showNotification(`Refreshed ${accountTransactions.length} transactions from DKB`, 'success');
    } catch (error) {
      console.error('[App] Error refreshing DKB data:', error);
      this.showNotification(`Error refreshing DKB data: ${error.message}`, 'error');
    }
  }

  async tryAutoLoadCSV() {
    try {
      console.log('Attempting to auto-load umsatz.csv...');

      // Try to fetch umsatz.csv from the same directory
      const response = await fetch('umsatz.csv');

      if (response.ok) {
        // Check content-type to ensure it's actually a CSV file
        // Vite dev server returns index.html (text/html) for non-existent files
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          console.log('umsatz.csv not found (received HTML fallback), waiting for manual upload');
          this.showNotification('No CSV file found. Please upload a file or connect to DKB.', 'info');
          return;
        }

        console.log('Found umsatz.csv, loading...');
        const csvText = await response.text();

        // Additional check: verify it looks like CSV content (not HTML)
        if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
          console.log('umsatz.csv not found (received HTML content), waiting for manual upload');
          this.showNotification('No CSV file found. Please upload a file or connect to DKB.', 'info');
          return;
        }

        // Create a File object from the text
        const blob = new Blob([csvText], { type: 'text/csv' });
        const file = new File([blob], 'umsatz.csv', { type: 'text/csv' });

        // Handle the file upload
        await this.handleFileUpload(file);

        this.showNotification('Automatically loaded umsatz.csv', 'success');
      } else {
        console.log('umsatz.csv not found, waiting for manual upload');
        this.showNotification('No CSV file found. Please upload a file or connect to DKB.', 'info');
      }
    } catch (error) {
      console.log('Could not auto-load umsatz.csv:', error.message);
      this.showNotification('No CSV file found. Please upload a file or connect to DKB.', 'info');
    }
  }

  /**
   * Handle DKB account connection
   */
  handleDKBConnect() {
    console.log('[App] Opening DKB connection modal');

    this.dkbModal = new DKBModal(
      this.dkbService,
      (transactions, account) => this.handleDKBTransactions(transactions, account)
    );

    this.dkbModal.show();
  }

  /**
   * Handle transactions from DKB
   */
  async handleDKBTransactions(transactionsData, account) {
    try {
      console.log('[App] Processing DKB transactions:', transactionsData.length);

      const hadPreviousData = this.transactions.length > 0;

      // Convert DKB transaction data to Transaction objects
      // This REPLACES any existing CSV data
      this.transactions = transactionsData.map(t => new Transaction({
        bookingDate: new Date(t.bookingDate),
        valueDate: new Date(t.valueDate),
        payee: t.payee,
        purpose: t.purpose,
        accountNumber: t.accountNumber,
        bankCode: t.bankCode,
        amount: t.amount,
        currency: t.currency
      }));

      console.log(`Converted ${this.transactions.length} transactions`);

      // Process transactions
      await this.processTransactions();

      // Notify user
      if (hadPreviousData) {
        this.showNotification(`Loaded ${this.transactions.length} transactions from DKB (replaced previous data)`, 'success');
      } else {
        this.showNotification(`Loaded ${this.transactions.length} transactions from DKB`, 'success');
      }
    } catch (error) {
      console.error('[App] Error processing DKB transactions:', error);
      this.showNotification(`Error: ${error.message}`, 'error');
    }
  }

  async handleFileUpload(file) {
    try {
      // Parse CSV
      console.log('Parsing CSV file...');
      this.transactions = await this.csvParser.parse(file);
      console.log(`Parsed ${this.transactions.length} transactions`);

      // Process transactions (common logic for CSV and DKB)
      await this.processTransactions();
    } catch (error) {
      console.error('Error handling file upload:', error);
      throw error;
    }
  }

  /**
   * Process transactions (common logic for CSV and DKB)
   */
  async processTransactions() {
    // Categorize transactions
    console.log('Categorizing transactions...');
    this.categorizer.categorizeAll(this.transactions, this.settingsManager.settings);
    console.log('Categorization complete');

    // Load and apply AI categorizations if available
    console.log('Loading AI categorizations...');
    await this.categorizationStorage.load();
    const appliedCount = this.categorizationStorage.applyCategorizations(this.transactions);
    if (appliedCount > 0) {
      console.log(`Applied ${appliedCount} AI categorizations from previous session`);
      this.showNotification(`Applied ${appliedCount} saved AI categorizations`, 'success');
    }

    // Apply recategorization rules
    console.log('Applying recategorization rules...');
    const recategorizedCount = this.recategorizationService.applyRules(this.transactions);
    if (recategorizedCount > 0) {
      console.log(`Applied ${recategorizedCount} recategorization rules`);
      this.showNotification(`Applied ${recategorizedCount} recategorization rules`, 'success');
    }

    // Apply filters (initially show all)
    this.filteredTransactions = [...this.transactions];

    // Detect recurring patterns (expenses and income)
    console.log('Detecting recurring patterns...');
    const recurringExpenses = this.recurringDetector.detect(this.transactions, 'expense');
    const recurringIncome = this.recurringDetector.detect(this.transactions, 'income');
    console.log(`Detected ${recurringExpenses.length} recurring expenses and ${recurringIncome.length} recurring income`);

    // Set transaction data for future projection view
    const recurringData = { expenses: recurringExpenses, income: recurringIncome };
    this.futureProjectionView.setTransactionData(this.transactions, recurringData, this.recurringDetector);

    // Auto-populate projections from overview data (only first time)
    await this.futureProjectionView.autoPopulateFromOverview();

    // Show dashboard
    this.showDashboard();

    // Initialize UI components
    this.initializeComponents();

    // Update all views
    this.updateAllViews();
  }

  setupEventListeners() {
    // Listen for DKB refresh request
    window.addEventListener('dkb-refresh-requested', () => {
      this.refreshDKBTransactions();
    });

    // Listen for DKB disconnect
    window.addEventListener('dkb-disconnected', () => {
      this.showNotification('DKB account disconnected', 'info');
    });

    // Listen for recategorize modal request
    window.addEventListener('show-recategorize-modal', (event) => {
      const { transaction } = event.detail;
      this.recategorizeModal.show(transaction);
    });

    // Listen for recategorization rules change
    window.addEventListener('recategorization-rules-changed', async () => {
      console.log('[App] Recategorization rules changed, reapplying...');
      // Reapply rules to all transactions
      this.recategorizationService.applyRules(this.transactions);
      // Update all views
      if (this.transactions.length > 0) {
        this.updateAllViews();
      }
    });
  }

  /**
   * Handle navigation from sidebar (page-level navigation)
   */
  handleNavigation(page) {
    console.log('[App] Navigating to page:', page);
    this.currentPage = page;

    const dashboard = document.getElementById('dashboard');
    const settingsView = document.getElementById('settings-view');

    if (page === 'dashboard') {
      // Show dashboard (with tabs)
      if (dashboard) {
        dashboard.classList.remove('hidden');
        dashboard.style.display = 'block';
      }
      if (settingsView) {
        settingsView.classList.remove('active');
      }

      // Show the current tab (overview or future)
      this.switchTab(this.currentTab);
    } else if (page === 'settings') {
      // Show settings page, hide dashboard
      if (dashboard) {
        dashboard.style.display = 'none';
      }
      if (settingsView) {
        settingsView.classList.add('active');
      }
    }

    // Update sidebar active state
    if (this.sidebar) {
      this.sidebar.setActive(page);
    }
  }

  /**
   * Switch between tabs within dashboard (overview/future)
   */
  switchTab(tab) {
    try {
      console.log('[App] Switching to tab:', tab);
      this.currentTab = tab;

      // Update tab buttons
      const tabs = document.querySelectorAll('.main-tab');
      tabs.forEach(t => {
        if (t.dataset.view === tab) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      // Update tab views
      const overviewView = document.getElementById('overview-view');
      const futureView = document.getElementById('future-view');

      if (tab === 'overview') {
        overviewView.classList.add('active');
        futureView.classList.remove('active');
      } else if (tab === 'future') {
        overviewView.classList.remove('active');
        futureView.classList.add('active');

        // Update future projection when switching to it
        if (this.futureProjectionView) {
          try {
            this.futureProjectionView.updateProjection();
          } catch (error) {
            console.error('[App] Error updating future projection:', error);
          }
        }
      }

      // Dispatch view change event
      window.dispatchEvent(new CustomEvent('view-changed', {
        detail: { view: tab }
      }));
    } catch (error) {
      console.error('[App] Error switching tab:', error);
    }
  }

  /**
   * Setup tab listeners for Overview/Future switching
   */
  setupTabListeners() {
    const tabs = document.querySelectorAll('.main-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        this.switchTab(view);
      });
    });
  }

  showDashboard() {
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('dashboard').classList.remove('hidden');

    // Setup tab listeners
    this.setupTabListeners();

    // Navigate to dashboard page with overview tab by default
    this.handleNavigation('dashboard');
    this.switchTab('overview');
  }

  initializeComponents() {
    // Initialize chart manager with recurring detector
    this.chartManager = new ChartManager(this.recurringDetector);

    // Initialize filters
    const filtersContainer = document.getElementById('filters-container');
    this.filters = new Filters(
      filtersContainer,
      this.transactions,
      (filtered) => this.handleFilterChange(filtered)
    );

    // Initialize transaction list
    const listContainer = document.getElementById('transaction-list-container');
    this.transactionList = new TransactionList(
      listContainer,
      this.filteredTransactions,
      (transaction, newCategory) => this.handleCategoryOverride(transaction, newCategory)
    );

    // Initialize budget view
    const budgetContainer = document.getElementById('budget-view-container');
    this.budgetView = new BudgetView(budgetContainer, this.transactions, this.budgetCalculator);

    // Initialize top merchants
    const topMerchantsContainer = document.getElementById('top-merchants-container');
    this.topMerchants = new TopMerchants(topMerchantsContainer);

    // Initialize financial Q&A
    const qaContainer = document.getElementById('qa-container');
    this.financialQA = new FinancialQA(
      qaContainer,
      this.transactions,
      this.budgetCalculator,
      this.recurringDetector,
      this.categorizationStorage
    );
    // Pass categorizer reference for dynamic category management
    this.financialQA.categorizer = this.categorizer;

    // Initialize future financial Q&A
    const futureQAContainer = document.getElementById('future-qa-container');
    this.futureFinancialQA = new FutureFinancialQA(
      futureQAContainer,
      this.projectionService
    );
    // Set initial transaction data for balance calculation
    this.futureFinancialQA.update(this.transactions);

    // Initialize settings view
    const settingsContainer = document.getElementById('settings-container');
    this.settingsView = new SettingsView(settingsContainer, this.recategorizationService);

    // Listen for transaction updates from AI categorization
    window.addEventListener('transactions-updated', () => {
      this.updateAllViews();
    });

    // Listen for recurring filter changes
    window.addEventListener('recurring-filter-changed', () => {
      this.updateAllViews();
    });

    // Listen for new categories discovered by AI
    window.addEventListener('new-categories-discovered', async (event) => {
      const { newCategories } = event.detail;
      console.log('[App] New categories discovered:', newCategories);

      // Add to categorizer
      this.categorizer.addCategories(newCategories);

      // Save to settings
      if (!this.settingsManager.settings.discoveredCategories) {
        this.settingsManager.settings.discoveredCategories = [];
      }
      // Add new categories that aren't already in the list
      newCategories.forEach(cat => {
        if (!this.settingsManager.settings.discoveredCategories.includes(cat)) {
          this.settingsManager.settings.discoveredCategories.push(cat);
        }
      });
      await this.settingsManager.save();

      console.log('[App] Saved new categories to settings');
    });
  }

  handleFilterChange(filteredTransactions) {
    this.filteredTransactions = filteredTransactions;
    this.updateAllViews();
  }

  async handleCategoryOverride(transaction, newCategory) {
    // Update transaction category
    transaction.category = newCategory;

    // Save override to settings
    this.settingsManager.settings.categoryOverrides[transaction.id] = newCategory;
    await this.settingsManager.save();

    // Update views
    this.updateAllViews();
  }

  updateAllViews() {
    // Update summary cards
    this.updateSummary();

    // Update charts
    if (this.chartManager) {
      const recurringExpenses = this.recurringDetector.detect(this.filteredTransactions, 'expense');
      const recurringIncome = this.recurringDetector.detect(this.filteredTransactions, 'income');
      const recurring = { expenses: recurringExpenses, income: recurringIncome };
      this.chartManager.updateAll(this.filteredTransactions, recurring);
    }

    // Update transaction list
    if (this.transactionList) {
      this.transactionList.update(this.filteredTransactions);
    }

    // Update budget view
    if (this.budgetView) {
      this.budgetView.update(this.filteredTransactions);
    }

    // Update financial Q&A
    if (this.financialQA) {
      this.financialQA.update(this.filteredTransactions);
    }

    // Update top merchants
    if (this.topMerchants) {
      this.topMerchants.update(this.filteredTransactions);
    }
  }

  updateSummary() {
    const totalTransactions = this.filteredTransactions.length;
    const totalIncome = this.filteredTransactions
      .filter(t => t.isIncome())
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = this.filteredTransactions
      .filter(t => t.isExpense())
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpenses;

    document.getElementById('total-transactions').textContent = totalTransactions;
    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('total-balance').textContent = formatCurrency(balance);

    // Color balance based on positive/negative
    const balanceElement = document.getElementById('total-balance');
    balanceElement.className = 'summary-value ' + (balance >= 0 ? 'positive' : 'negative');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to body
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 4 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
