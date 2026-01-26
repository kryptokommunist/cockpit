/**
 * Recategorization rule service
 * Manages rules for automatically recategorizing transactions by merchant or merchant+amount
 */
export class RecategorizationService {
  constructor() {
    this.rules = [];
    this.storageKey = 'recategorization-rules';
  }

  /**
   * Add a new recategorization rule
   * @param {Object} rule - Rule object
   * @param {string} rule.merchant - Normalized merchant name
   * @param {number} [rule.amount] - Optional amount (if null, applies to all amounts)
   * @param {string} rule.category - Target category
   * @param {string} [rule.originalCategory] - Original category (for display)
   * @returns {Object} - The added rule with ID
   */
  addRule(rule) {
    const newRule = {
      id: this.generateId(),
      merchant: rule.merchant,
      amount: rule.amount || null,
      category: rule.category,
      originalCategory: rule.originalCategory || null,
      createdAt: new Date().toISOString()
    };

    // Check if rule already exists
    const existingIndex = this.rules.findIndex(r =>
      r.merchant === newRule.merchant &&
      r.amount === newRule.amount
    );

    if (existingIndex >= 0) {
      // Update existing rule
      this.rules[existingIndex] = newRule;
      console.log('[Recategorization] Updated existing rule:', newRule);
    } else {
      // Add new rule
      this.rules.push(newRule);
      console.log('[Recategorization] Added new rule:', newRule);
    }

    return newRule;
  }

  /**
   * Remove a rule by ID
   * @param {string} ruleId - Rule ID
   */
  removeRule(ruleId) {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      const removed = this.rules.splice(index, 1)[0];
      console.log('[Recategorization] Removed rule:', removed);
      return removed;
    }
    return null;
  }

  /**
   * Get all rules
   * @returns {Array} - All rules
   */
  getAllRules() {
    return [...this.rules];
  }

  /**
   * Apply recategorization rules to transactions
   * @param {Array} transactions - Transactions to categorize
   * @returns {number} - Number of transactions recategorized
   */
  applyRules(transactions) {
    let recategorizedCount = 0;

    transactions.forEach(transaction => {
      const matchingRule = this.findMatchingRule(transaction);
      if (matchingRule) {
        transaction.category = matchingRule.category;
        transaction.recategorized = true;
        transaction.recategorizationRule = matchingRule.id;
        recategorizedCount++;
      }
    });

    console.log(`[Recategorization] Applied rules to ${recategorizedCount} transactions`);
    return recategorizedCount;
  }

  /**
   * Find matching rule for a transaction
   * @param {Object} transaction - Transaction
   * @returns {Object|null} - Matching rule or null
   */
  findMatchingRule(transaction) {
    const normalizedMerchant = transaction.normalizedMerchant || transaction.payee.toUpperCase();
    const amount = Math.abs(transaction.amount);

    // First try to find exact match (merchant + amount)
    const exactMatch = this.rules.find(rule =>
      rule.merchant === normalizedMerchant &&
      rule.amount !== null &&
      Math.abs(rule.amount - amount) < 0.01 // Float comparison with tolerance
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Then try merchant-only match
    const merchantMatch = this.rules.find(rule =>
      rule.merchant === normalizedMerchant &&
      rule.amount === null
    );

    return merchantMatch || null;
  }

  /**
   * Save rules to localStorage and generate CSV
   * @returns {Promise<void>}
   */
  async save() {
    try {
      // Save to localStorage
      const data = JSON.stringify(this.rules);
      localStorage.setItem(this.storageKey, data);
      console.log('[Recategorization] Saved rules to localStorage');

      // Generate CSV for download
      const csv = this.generateCSV();
      await this.downloadCSV(csv);
    } catch (error) {
      console.error('[Recategorization] Error saving rules:', error);
    }
  }

  /**
   * Load rules from localStorage
   * @returns {Promise<Array>} - Loaded rules
   */
  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.rules = JSON.parse(data);
        console.log(`[Recategorization] Loaded ${this.rules.length} rules from localStorage`);
      } else {
        console.log('[Recategorization] No saved rules found');
      }
    } catch (error) {
      console.error('[Recategorization] Error loading rules:', error);
      this.rules = [];
    }

    return this.rules;
  }

  /**
   * Generate CSV from rules
   * @returns {string} - CSV string
   */
  generateCSV() {
    const headers = ['ID', 'Merchant', 'Amount', 'Category', 'Original Category', 'Created At'];
    const rows = this.rules.map(rule => [
      rule.id,
      rule.merchant,
      rule.amount !== null ? rule.amount.toFixed(2) : 'ALL',
      rule.category,
      rule.originalCategory || '',
      rule.createdAt
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ];

    return csvLines.join('\n');
  }

  /**
   * Download CSV file
   * @param {string} csv - CSV content
   */
  async downloadCSV(csv) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recategorization-rules.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[Recategorization] Downloaded CSV file');
  }

  /**
   * Import rules from CSV
   * @param {string} csv - CSV content
   */
  importFromCSV(csv) {
    const lines = csv.split('\n');
    const imported = [];

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted fields)
      const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
      if (matches && matches.length >= 4) {
        const [id, merchant, amount, category, originalCategory, createdAt] = matches.map(m => m.replace(/^"|"$/g, ''));

        const rule = {
          id: id || this.generateId(),
          merchant,
          amount: amount === 'ALL' ? null : parseFloat(amount),
          category,
          originalCategory: originalCategory || null,
          createdAt: createdAt || new Date().toISOString()
        };

        imported.push(rule);
      }
    }

    this.rules = imported;
    console.log(`[Recategorization] Imported ${imported.length} rules from CSV`);
    return imported.length;
  }

  /**
   * Generate unique ID for rule
   * @returns {string}
   */
  generateId() {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics about rules
   * @returns {Object}
   */
  getStats() {
    return {
      totalRules: this.rules.length,
      merchantOnlyRules: this.rules.filter(r => r.amount === null).length,
      merchantAmountRules: this.rules.filter(r => r.amount !== null).length,
      categoriesTargeted: new Set(this.rules.map(r => r.category)).size
    };
  }
}
