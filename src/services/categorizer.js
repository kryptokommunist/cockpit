/**
 * Transaction categorization service
 */
export class Categorizer {
  constructor() {
    this.categories = {
      GROCERIES: ['REWE', 'LIDL', 'ALDI', 'EDEKA', 'DM', 'ROSSMANN', 'PENNY', 'KAUFLAND', 'NETTO'],
      TRANSPORT: ['BOLT', 'UBER', 'TAXI', 'BVG', 'DB', 'DEUTSCHE BAHN', 'LIME', 'TIER'],
      FOOD_DELIVERY: ['HELLOFRESH', 'LIEFERANDO', 'WOLT', 'DELIVEROO', 'GORILLAS'],
      SUBSCRIPTIONS: ['SPOTIFY', 'APPLE', 'MICROSOFT', 'NETFLIX', 'AMAZON PRIME', 'GOOGLE'],
      UTILITIES: ['ENTEGA', 'VATTENFALL', 'STADTWERKE', 'TELEKOM', 'VODAFONE', 'O2'],
      INSURANCE: ['BARMER', 'TK', 'AOK', 'ALLIANZ', 'HUK'],
      RENT: ['MIETE', 'RENT', 'VERMIETUNG'],
      CASH: ['GELDAUTOMAT', 'ATM', 'BARGELD'],
      OTHER: []
    };

    // Income categories for better classification
    this.incomeCategories = {
      SALARY: ['GEHALT', 'LOHN', 'SALARY', 'WAGE', 'PAYROLL', 'ARBEITGEBER', 'EMPLOYER'],
      BENEFITS: ['KINDERGELD', 'BAFöG', 'WOHNGELD', 'ARBEITSLOSENGELD', 'RENTE', 'PENSION', 'BENEFIT'],
      REFUND: ['ERSTATTUNG', 'RÜCKERSTATTUNG', 'REFUND', 'REIMBURSEMENT', 'STORNO'],
      TRANSFER: ['ÜBERWEISUNG', 'TRANSFER', 'EINGANG', 'DEPOSIT'],
      RENTAL_INCOME: ['MIETEINNAHME', 'MIETE VON', 'RENTAL INCOME'],
      INVESTMENT: ['DIVIDENDE', 'ZINSEN', 'DIVIDEND', 'INTEREST', 'INVESTMENT'],
      FREELANCE: ['HONORAR', 'RECHNUNG', 'INVOICE', 'FREELANCE', 'AUFTRAG'],
      OTHER_INCOME: []
    };
  }

  /**
   * Normalize merchant name for consistent matching
   * Removes location suffixes, IDs, and special characters
   * @param {string} payee - Original payee/merchant name
   * @returns {string} - Normalized merchant name
   */
  normalizeMerchant(payee) {
    if (!payee) return '';

    return payee
      // Remove location suffix (e.g., "/Berlin", "/Tallinn")
      .replace(/\/[A-Za-zäöüÄÖÜß\s]+$/, '')
      // Remove transaction IDs (e.g., "O2601221237")
      .replace(/O\d{10,}/g, '')
      // Remove numbers at the end
      .replace(/\d+$/g, '')
      // Remove common suffixes
      .replace(/\s+(GmbH|AG|eG|KG|Markt|Zw|SRL|Ltd|Inc)\.?/gi, '')
      // Remove dots and special characters
      .replace(/[.\/\\]/g, ' ')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /**
   * Categorize a single transaction
   * @param {Transaction} transaction - Transaction to categorize
   * @param {Object} settings - Settings object with category rules and overrides
   * @returns {string} - Category name
   */
  categorize(transaction, settings = {}) {
    // Check for manual override first
    if (settings.categoryOverrides && settings.categoryOverrides[transaction.id]) {
      return settings.categoryOverrides[transaction.id];
    }

    const normalizedMerchant = this.normalizeMerchant(transaction.payee);
    transaction.normalizedMerchant = normalizedMerchant;

    // Check for income (positive amounts)
    if (transaction.isIncome()) {
      // Check specific income categories
      for (const [category, keywords] of Object.entries(this.incomeCategories)) {
        if (category === 'OTHER_INCOME') continue;

        // Check both payee and purpose for income classification
        if (this.matchesCategory(normalizedMerchant, keywords) ||
            this.matchesCategory(transaction.purpose.toUpperCase(), keywords)) {
          return category;
        }
      }
      // Generic income fallback
      return 'OTHER_INCOME';
    }

    // Check category rules from settings
    if (settings.categoryRules) {
      for (const [merchant, category] of Object.entries(settings.categoryRules)) {
        if (normalizedMerchant.includes(merchant.toUpperCase())) {
          return category;
        }
      }
    }

    // Check built-in categories
    for (const [category, keywords] of Object.entries(this.categories)) {
      if (category === 'OTHER' || category === 'INCOME') continue;

      if (this.matchesCategory(normalizedMerchant, keywords)) {
        return category;
      }
    }

    // Check purpose field for additional context
    const purpose = transaction.purpose.toUpperCase();
    for (const [category, keywords] of Object.entries(this.categories)) {
      if (category === 'OTHER' || category === 'INCOME') continue;

      if (this.matchesCategory(purpose, keywords)) {
        return category;
      }
    }

    return 'OTHER';
  }

  /**
   * Check if text matches any keyword in category
   * @param {string} text - Text to match
   * @param {Array<string>} keywords - Keywords to match against
   * @returns {boolean} - True if matches
   */
  matchesCategory(text, keywords) {
    if (!text) return false;

    return keywords.some(keyword => text.includes(keyword.toUpperCase()));
  }

  /**
   * Categorize all transactions
   * @param {Array<Transaction>} transactions - Transactions to categorize
   * @param {Object} settings - Settings object
   */
  categorizeAll(transactions, settings = {}) {
    transactions.forEach(transaction => {
      transaction.category = this.categorize(transaction, settings);
    });
  }

  /**
   * Get all categories used in transactions
   * @param {Array<Transaction>} transactions - Transactions
   * @returns {Array<string>} - List of unique categories
   */
  getUsedCategories(transactions) {
    const categories = new Set();
    transactions.forEach(t => categories.add(t.category));
    return Array.from(categories).sort();
  }

  /**
   * Add new categories discovered by AI
   * @param {Array<string>} newCategories - New category names
   */
  addCategories(newCategories) {
    newCategories.forEach(category => {
      if (!this.categories[category]) {
        // Add new category with empty keyword list
        // Categories discovered by AI don't need keywords since they're assigned directly
        this.categories[category] = [];
        console.log('[Categorizer] Added new category:', category);

        // Optionally generate a color for visualization
        this.generateColorForCategory(category);
      }
    });
  }

  /**
   * Generate a distinct color for a new category
   * @param {string} category - Category name
   */
  generateColorForCategory(category) {
    // Expanded vibrant color palette for dynamically discovered categories
    const dynamicColors = [
      '#E91E63', // Pink
      '#9C27B0', // Purple
      '#673AB7', // Deep Purple
      '#3F51B5', // Indigo
      '#00BCD4', // Cyan
      '#009688', // Teal
      '#8BC34A', // Light Green
      '#CDDC39', // Lime
      '#FFC107', // Amber
      '#FF9800', // Orange
      '#FF5722', // Deep Orange
      '#F44336', // Red
      '#E91E90', // Bright Pink
      '#AB47BC', // Light Purple
      '#5C6BC0', // Medium Indigo
      '#42A5F5', // Blue
      '#26C6DA', // Light Cyan
      '#66BB6A', // Green
      '#D4E157', // Lime Yellow
      '#FFCA28', // Yellow
      '#FFA726', // Light Orange
      '#FF7043', // Coral
      '#EC407A', // Hot Pink
      '#7E57C2', // Medium Purple
      '#5E35B1', // Dark Purple
      '#3949AB', // Deep Blue
      '#039BE5', // Light Blue
      '#00ACC1', // Dark Cyan
      '#00897B', // Dark Teal
      '#43A047'  // Dark Green
    ];

    // Generate a consistent hash from category name
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Use hash to pick a color
    const colorIndex = Math.abs(hash) % dynamicColors.length;
    this.dynamicCategoryColors = this.dynamicCategoryColors || {};
    this.dynamicCategoryColors[category] = dynamicColors[colorIndex];

    console.log(`[Categorizer] Generated color ${dynamicColors[colorIndex]} for category ${category}`);
  }

  /**
   * Get category color for visualization
   * @param {string} category - Category name
   * @returns {string} - CSS color
   */
  getCategoryColor(category) {
    const colors = {
      // Expense categories
      GROCERIES: '#4CAF50',
      TRANSPORT: '#2196F3',
      FOOD_DELIVERY: '#FF9800',
      SUBSCRIPTIONS: '#9C27B0',
      UTILITIES: '#00BCD4',
      INSURANCE: '#F44336',
      RENT: '#795548',
      CASH: '#9E9E9E',
      HEALTH: '#2196FF',
      OTHER: '#607D8B',

      // Income categories (green shades)
      SALARY: '#66BB6A',
      BENEFITS: '#81C784',
      REFUND: '#A5D6A7',
      TRANSFER: '#C8E6C9',
      RENTAL_INCOME: '#4DB6AC',
      INVESTMENT: '#26A69A',
      FREELANCE: '#80CBC4',
      OTHER_INCOME: '#8BC34A'
    };

    // Check static colors first
    if (colors[category]) {
      return colors[category];
    }

    // Check dynamic colors for AI-discovered categories
    if (this.dynamicCategoryColors && this.dynamicCategoryColors[category]) {
      return this.dynamicCategoryColors[category];
    }

    // If no color assigned yet, generate one
    // This handles cases where category was added but color not generated
    if (this.categories[category]) {
      this.generateColorForCategory(category);
      return this.dynamicCategoryColors[category];
    }

    // Fallback for unknown categories - generate vibrant color instead of grey
    const fallbackColors = [
      '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#00BCD4',
      '#009688', '#8BC34A', '#FFC107', '#FF5722', '#F44336'
    ];
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    return fallbackColors[Math.abs(hash) % fallbackColors.length];
  }
}
