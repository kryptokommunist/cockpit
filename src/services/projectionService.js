import { addMonths, format, startOfMonth } from 'date-fns';
import { eurosToCents, centsToEuros } from '../utils/numberUtils.js';

/**
 * Projection service for managing future financial projections
 *
 * IMPORTANT: All amounts are stored internally as integers representing cents
 * to avoid floating point precision issues. Use eurosToCents() when storing
 * and centsToEuros() when displaying.
 */
export class ProjectionService {
  constructor() {
    this.recurringItems = [];  // Recurring income and expenses
    this.oneTimeItems = [];     // One-time future transactions
    this.storageKey = 'financial-projections';

    // Time period settings for inference (specific date ranges)
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    this.timePeriodSettings = {
      categoryAverages: {
        startMonth: threeMonthsAgo.getMonth(),
        startYear: threeMonthsAgo.getFullYear(),
        endMonth: now.getMonth(),
        endYear: now.getFullYear()
      },
      recurringDetection: {
        startMonth: sixMonthsAgo.getMonth(),
        startYear: sixMonthsAgo.getFullYear(),
        endMonth: now.getMonth(),
        endYear: now.getFullYear()
      }
    };
  }

  /**
   * Add a recurring item (income or expense)
   * @param {Object} item - Recurring item
   * @param {string} item.name - Name of the item
   * @param {number} item.amount - Amount in EUROS (positive for income, negative for expense)
   * @param {string} item.category - Category
   * @param {string} item.frequency - 'monthly', 'weekly', 'quarterly', 'yearly'
   * @param {Date} item.startDate - Start date
   * @param {Date} [item.endDate] - Optional end date
   * @param {boolean} item.isIncome - True if income, false if expense
   * @param {Object} [item.monthlyOverrides] - Map of month (YYYY-MM) to custom amount in EUROS
   */
  addRecurringItem(item) {
    // Convert euros to cents for storage
    const amountCents = eurosToCents(item.amount);
    const overridesCents = {};
    if (item.monthlyOverrides) {
      Object.entries(item.monthlyOverrides).forEach(([month, amount]) => {
        overridesCents[month] = eurosToCents(amount);
      });
    }

    const newItem = {
      id: this.generateId(),
      name: item.name,
      amountCents: amountCents,  // Store as cents
      category: item.category,
      frequency: item.frequency,
      startDate: item.startDate,
      endDate: item.endDate || null,
      isIncome: item.isIncome,
      monthlyOverridesCents: overridesCents,  // Store overrides as cents
      createdAt: new Date().toISOString()
    };

    this.recurringItems.push(newItem);
    console.log('[ProjectionService] Added recurring item:', newItem);
    return newItem;
  }

  /**
   * Get amount in euros for a recurring item (converts from internal cents)
   * @param {Object} item - Recurring item
   * @returns {number} Amount in euros
   */
  getAmountInEuros(item) {
    // Support both old format (amount) and new format (amountCents)
    if (item.amountCents !== undefined) {
      return centsToEuros(item.amountCents);
    }
    return item.amount || 0;
  }

  /**
   * Get monthly override in euros for a recurring item
   * @param {Object} item - Recurring item
   * @param {string} monthKey - Month key in YYYY-MM format
   * @returns {number|null} Override amount in euros or null if no override
   */
  getMonthlyOverrideInEuros(item, monthKey) {
    // Support both old format (monthlyOverrides) and new format (monthlyOverridesCents)
    if (item.monthlyOverridesCents && monthKey in item.monthlyOverridesCents) {
      return centsToEuros(item.monthlyOverridesCents[monthKey]);
    }
    if (item.monthlyOverrides && monthKey in item.monthlyOverrides) {
      return item.monthlyOverrides[monthKey];
    }
    return null;
  }

  /**
   * Update a recurring item
   * @param {string} id - Item ID
   * @param {Object} updates - Properties to update (amounts in EUROS)
   */
  updateRecurringItem(id, updates) {
    const index = this.recurringItems.findIndex(i => i.id === id);
    if (index >= 0) {
      // Convert euros to cents for storage
      const convertedUpdates = { ...updates };

      if (updates.amount !== undefined) {
        convertedUpdates.amountCents = eurosToCents(updates.amount);
        delete convertedUpdates.amount;
      }

      if (updates.monthlyOverrides !== undefined) {
        const overridesCents = {};
        Object.entries(updates.monthlyOverrides).forEach(([month, amount]) => {
          overridesCents[month] = eurosToCents(amount);
        });
        convertedUpdates.monthlyOverridesCents = overridesCents;
        delete convertedUpdates.monthlyOverrides;
      }

      this.recurringItems[index] = {
        ...this.recurringItems[index],
        ...convertedUpdates
      };
      console.log('[ProjectionService] Updated recurring item:', this.recurringItems[index]);
      return this.recurringItems[index];
    }
    return null;
  }

  /**
   * Set monthly override for a recurring item
   * @param {string} id - Item ID
   * @param {string} month - Month in YYYY-MM format
   * @param {number} amount - Override amount in EUROS
   */
  setMonthlyOverride(id, month, amount) {
    const item = this.recurringItems.find(i => i.id === id);
    if (item) {
      if (!item.monthlyOverridesCents) {
        item.monthlyOverridesCents = {};
      }
      item.monthlyOverridesCents[month] = eurosToCents(amount);
      console.log(`[ProjectionService] Set override for ${item.name} in ${month}: ${amount} EUR (${eurosToCents(amount)} cents)`);
      return true;
    }
    return false;
  }

  /**
   * Remove a recurring item
   * @param {string} id - Item ID
   */
  removeRecurringItem(id) {
    const index = this.recurringItems.findIndex(i => i.id === id);
    if (index >= 0) {
      const removed = this.recurringItems.splice(index, 1)[0];
      console.log('[ProjectionService] Removed recurring item:', removed);
      return removed;
    }
    return null;
  }

  /**
   * Add a one-time item (future transaction)
   * @param {Object} item - One-time item
   * @param {string} item.name - Description
   * @param {number} item.amount - Amount in EUROS (positive for income, negative for expense)
   * @param {string} item.category - Category
   * @param {Date} item.date - Transaction date
   * @param {boolean} item.isIncome - True if income, false if expense
   */
  addOneTimeItem(item) {
    const newItem = {
      id: this.generateId(),
      name: item.name,
      amountCents: eurosToCents(item.amount),  // Store as cents
      category: item.category,
      date: item.date,
      isIncome: item.isIncome,
      createdAt: new Date().toISOString()
    };

    this.oneTimeItems.push(newItem);
    console.log('[ProjectionService] Added one-time item:', newItem);
    return newItem;
  }

  /**
   * Remove a one-time item
   * @param {string} id - Item ID
   */
  removeOneTimeItem(id) {
    const index = this.oneTimeItems.findIndex(i => i.id === id);
    if (index >= 0) {
      const removed = this.oneTimeItems.splice(index, 1)[0];
      console.log('[ProjectionService] Removed one-time item:', removed);
      return removed;
    }
    return null;
  }

  /**
   * Generate projected transactions for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} - Array of projected transactions
   */
  generateProjections(startDate, endDate) {
    const projections = [];

    // Generate recurring items
    this.recurringItems.forEach(item => {
      const itemProjections = this.generateRecurringProjections(item, startDate, endDate);
      projections.push(...itemProjections);
    });

    // Add one-time items within range
    this.oneTimeItems.forEach(item => {
      const itemDate = new Date(item.date);
      if (itemDate >= startDate && itemDate <= endDate) {
        // Get amount in euros (handles both old and new format)
        const amountEuros = item.amountCents !== undefined
          ? centsToEuros(item.amountCents)
          : (item.amount || 0);

        projections.push({
          id: item.id,
          name: item.name,
          amount: amountEuros,  // Return euros for display/calculation
          category: item.category,
          date: itemDate,
          isIncome: item.isIncome,
          type: 'one-time',
          sourceId: item.id
        });
      }
    });

    // Sort by date
    projections.sort((a, b) => a.date - b.date);

    return projections;
  }

  /**
   * Generate projections for a recurring item
   * @param {Object} item - Recurring item
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} - Array of projected transactions (amounts in EUROS)
   */
  generateRecurringProjections(item, startDate, endDate) {
    const projections = [];
    const itemStartDate = new Date(item.startDate);
    const itemEndDate = item.endDate ? new Date(item.endDate) : endDate;

    let currentDate = startOfMonth(itemStartDate > startDate ? itemStartDate : startDate);

    while (currentDate <= endDate && currentDate <= itemEndDate) {
      const monthKey = format(currentDate, 'yyyy-MM');

      // Get amount in euros (handles both old and new format)
      const overrideEuros = this.getMonthlyOverrideInEuros(item, monthKey);
      const baseAmountEuros = this.getAmountInEuros(item);
      const amountEuros = overrideEuros !== null ? overrideEuros : baseAmountEuros;

      // Only add if amount is not zero (allows skipping months)
      if (amountEuros !== 0) {
        projections.push({
          id: `${item.id}-${monthKey}`,
          name: item.name,
          amount: amountEuros,  // Return euros for display/calculation
          category: item.category,
          date: new Date(currentDate),
          isIncome: item.isIncome,
          type: 'recurring',
          sourceId: item.id,
          frequency: item.frequency
        });
      }

      // Increment based on frequency
      currentDate = this.incrementDate(currentDate, item.frequency);
    }

    return projections;
  }

  /**
   * Increment date based on frequency
   * @param {Date} date - Current date
   * @param {string} frequency - Frequency type
   * @returns {Date} - Next date
   */
  incrementDate(date, frequency) {
    switch (frequency) {
      case 'weekly':
        return addMonths(date, 0.25);  // Approximate
      case 'monthly':
        return addMonths(date, 1);
      case 'quarterly':
        return addMonths(date, 3);
      case 'yearly':
        return addMonths(date, 12);
      default:
        return addMonths(date, 1);
    }
  }

  /**
   * Get all recurring items (with amounts converted to euros for display)
   * @returns {Array}
   */
  getRecurringItems() {
    return this.recurringItems.map(item => {
      // Convert cents to euros for external use
      const result = { ...item };

      // Convert amount
      if (item.amountCents !== undefined) {
        result.amount = centsToEuros(item.amountCents);
      }

      // Convert monthly overrides
      if (item.monthlyOverridesCents) {
        result.monthlyOverrides = {};
        Object.entries(item.monthlyOverridesCents).forEach(([month, cents]) => {
          result.monthlyOverrides[month] = centsToEuros(cents);
        });
      }

      return result;
    });
  }

  /**
   * Get recurring income items
   * @returns {Array}
   */
  getRecurringIncome() {
    return this.recurringItems.filter(i => i.isIncome);
  }

  /**
   * Get recurring expense items
   * @returns {Array}
   */
  getRecurringExpenses() {
    return this.recurringItems.filter(i => !i.isIncome);
  }

  /**
   * Get all one-time items (with amounts converted to euros for display)
   * @returns {Array}
   */
  getOneTimeItems() {
    return this.oneTimeItems.map(item => {
      const result = { ...item };

      // Convert amount
      if (item.amountCents !== undefined) {
        result.amount = centsToEuros(item.amountCents);
      }

      return result;
    });
  }

  /**
   * Clear all projections
   */
  clearAll() {
    this.recurringItems = [];
    this.oneTimeItems = [];
    console.log('[ProjectionService] Cleared all projections');
  }

  /**
   * Save projections to localStorage and file
   */
  async save() {
    try {
      const data = {
        recurringItems: this.recurringItems,
        oneTimeItems: this.oneTimeItems,
        version: '1.0',
        lastModified: new Date().toISOString()
      };

      // Save to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log('[ProjectionService] Saved projections to localStorage');

      // Save to file in project folder
      await this.saveToFile(data);
    } catch (error) {
      console.error('[ProjectionService] Error saving projections:', error);
    }
  }

  /**
   * Load projections from localStorage
   */
  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);

        // Convert date strings back to Date objects
        this.recurringItems = parsed.recurringItems.map(item => ({
          ...item,
          startDate: new Date(item.startDate),
          endDate: item.endDate ? new Date(item.endDate) : null
        }));

        this.oneTimeItems = parsed.oneTimeItems.map(item => ({
          ...item,
          date: new Date(item.date)
        }));

        console.log(`[ProjectionService] Loaded ${this.recurringItems.length} recurring and ${this.oneTimeItems.length} one-time items`);
      } else {
        console.log('[ProjectionService] No saved projections found');
      }
    } catch (error) {
      console.error('[ProjectionService] Error loading projections:', error);
      this.recurringItems = [];
      this.oneTimeItems = [];
    }
  }

  /**
   * Save projections to file in project folder
   * @param {Object} data - Data to export
   */
  async saveToFile(data) {
    try {
      // Use File System Access API if available (modern browsers)
      if ('showSaveFilePicker' in window) {
        // This API requires user interaction, so we'll just save to a known location
        // For now, we'll continue using localStorage as primary storage
        console.log('[ProjectionService] File saved to localStorage (browser environment)');
      } else {
        // For server-side or Node environment, we could write to actual file
        // In browser, localStorage is the persistent storage
        console.log('[ProjectionService] Using localStorage as persistent storage');
      }

      // Create a JSON blob for manual download if user wants to backup
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Store the URL for manual download instead of auto-downloading
      this.backupUrl = url;
      console.log('[ProjectionService] Backup available for manual download');
    } catch (error) {
      console.error('[ProjectionService] Error creating backup:', error);
    }
  }

  /**
   * Manually download backup file (user-initiated)
   */
  downloadBackup() {
    if (!this.backupUrl) {
      console.error('[ProjectionService] No backup available');
      return;
    }

    const a = document.createElement('a');
    a.href = this.backupUrl;
    a.download = 'financial-projections.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('[ProjectionService] Downloaded backup file');
  }

  /**
   * Import projections from JSON
   * @param {Object} data - Data to import
   */
  importFromJSON(data) {
    try {
      this.recurringItems = data.recurringItems.map(item => ({
        ...item,
        startDate: new Date(item.startDate),
        endDate: item.endDate ? new Date(item.endDate) : null
      }));

      this.oneTimeItems = data.oneTimeItems.map(item => ({
        ...item,
        date: new Date(item.date)
      }));

      console.log('[ProjectionService] Imported projections from JSON');
      return true;
    } catch (error) {
      console.error('[ProjectionService] Error importing projections:', error);
      return false;
    }
  }

  /**
   * Generate unique ID
   * @returns {string}
   */
  generateId() {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics (amounts in euros)
   * @returns {Object}
   */
  getStats() {
    const recurringIncome = this.recurringItems.filter(i => i.isIncome);
    const recurringExpenses = this.recurringItems.filter(i => !i.isIncome);

    return {
      totalRecurring: this.recurringItems.length,
      recurringIncome: recurringIncome.length,
      recurringExpenses: recurringExpenses.length,
      oneTimeItems: this.oneTimeItems.length,
      monthlyRecurringIncome: recurringIncome
        .filter(i => i.frequency === 'monthly')
        .reduce((sum, i) => sum + this.getAmountInEuros(i), 0),
      monthlyRecurringExpenses: recurringExpenses
        .filter(i => i.frequency === 'monthly')
        .reduce((sum, i) => sum + Math.abs(this.getAmountInEuros(i)), 0)
    };
  }

  /**
   * Set time period for category averages
   * @param {Object} range - Date range
   * @param {number} range.startMonth - Start month (0-11)
   * @param {number} range.startYear - Start year
   * @param {number} range.endMonth - End month (0-11)
   * @param {number} range.endYear - End year
   */
  setCategoryAveragesPeriod(range) {
    this.timePeriodSettings.categoryAverages = range;
    console.log(`[ProjectionService] Category averages period set to ${range.startMonth + 1}/${range.startYear} - ${range.endMonth + 1}/${range.endYear}`);
  }

  /**
   * Set time period for recurring detection
   * @param {Object} range - Date range
   * @param {number} range.startMonth - Start month (0-11)
   * @param {number} range.startYear - Start year
   * @param {number} range.endMonth - End month (0-11)
   * @param {number} range.endYear - End year
   */
  setRecurringDetectionPeriod(range) {
    this.timePeriodSettings.recurringDetection = range;
    console.log(`[ProjectionService] Recurring detection period set to ${range.startMonth + 1}/${range.startYear} - ${range.endMonth + 1}/${range.endYear}`);
  }

  /**
   * Get time period settings
   * @returns {Object}
   */
  getTimePeriodSettings() {
    return {
      categoryAverages: { ...this.timePeriodSettings.categoryAverages },
      recurringDetection: { ...this.timePeriodSettings.recurringDetection }
    };
  }

  /**
   * Get date range for category averages
   * @returns {Object} { startDate, endDate }
   */
  getCategoryAveragesDateRange() {
    const settings = this.timePeriodSettings.categoryAverages;
    const startDate = new Date(settings.startYear, settings.startMonth, 1);
    const endDate = new Date(settings.endYear, settings.endMonth + 1, 0); // Last day of end month
    return { startDate, endDate };
  }

  /**
   * Get date range for recurring detection
   * @returns {Object} { startDate, endDate }
   */
  getRecurringDetectionDateRange() {
    const settings = this.timePeriodSettings.recurringDetection;
    const startDate = new Date(settings.startYear, settings.startMonth, 1);
    const endDate = new Date(settings.endYear, settings.endMonth + 1, 0); // Last day of end month
    return { startDate, endDate };
  }
}
