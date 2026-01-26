/**
 * Settings manager for saving/loading settings to/from JSON file
 */
export class SettingsManager {
  constructor() {
    this.settingsPath = '/settings.json';
    this.settings = {
      version: '1.0',
      categoryOverrides: {},
      customCategories: [],
      categoryRules: {},
      filters: {},
      discoveredCategories: []  // AI-discovered categories
    };
  }

  /**
   * Load settings from JSON file and localStorage
   * @returns {Promise<Object>} - Settings object
   */
  async load() {
    try {
      // First try to load from settings.json file
      const response = await fetch(this.settingsPath);
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim()) {
          try {
            this.settings = JSON.parse(text);
            console.log('[SettingsManager] Settings loaded from settings.json');
          } catch (parseError) {
            console.log('[SettingsManager] settings.json exists but contains invalid JSON, using defaults');
          }
        } else {
          console.log('[SettingsManager] settings.json is empty, using defaults');
        }
      } else {
        console.log('[SettingsManager] No settings.json file found, using defaults');
      }
    } catch (error) {
      console.log('[SettingsManager] Could not fetch settings.json, using defaults');
    }

    // Then load from localStorage (will merge/override file settings)
    this.loadFromLocalStorage();

    return this.settings;
  }

  /**
   * Save settings to JSON file
   * Note: In a browser environment, we'll use localStorage as a fallback
   * For actual file system access, this would need a backend or File System Access API
   * @returns {Promise<void>}
   */
  async save() {
    try {
      // Save to localStorage as browser fallback
      localStorage.setItem('bankAnalyzerSettings', JSON.stringify(this.settings));
      console.log('Settings saved to localStorage');

      // For file system saving, we'd need backend or File System Access API
      // This is a client-side only app, so we use localStorage

      // Display save notification
      this.showSaveNotification();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Set category override for a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} category - New category
   */
  setCategoryOverride(transactionId, category) {
    this.settings.categoryOverrides[transactionId] = category;
  }

  /**
   * Get category override for a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {string|null} - Category or null if no override
   */
  getCategoryOverride(transactionId) {
    return this.settings.categoryOverrides[transactionId] || null;
  }

  /**
   * Add custom category
   * @param {string} category - Category name
   */
  addCustomCategory(category) {
    if (!this.settings.customCategories.includes(category)) {
      this.settings.customCategories.push(category);
    }
  }

  /**
   * Add category rule
   * @param {string} merchant - Merchant name
   * @param {string} category - Category
   */
  addCategoryRule(merchant, category) {
    this.settings.categoryRules[merchant] = category;
  }

  /**
   * Set filter settings
   * @param {Object} filters - Filter configuration
   */
  setFilters(filters) {
    this.settings.filters = filters;
  }

  /**
   * Export settings as JSON string
   * @returns {string} - JSON string
   */
  exportSettings() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON string
   * @param {string} jsonString - JSON string
   */
  importSettings(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.settings = { ...this.settings, ...imported };
      this.save();
    } catch (error) {
      console.error('Error importing settings:', error);
      throw new Error('Invalid settings JSON');
    }
  }

  /**
   * Show save notification
   */
  showSaveNotification() {
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.textContent = 'Settings saved';
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 2000);
  }

  /**
   * Load settings from localStorage on app start
   * This ensures persistence across sessions
   */
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('bankAnalyzerSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...this.settings, ...parsed };
        console.log('Settings loaded from localStorage');
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }
}
