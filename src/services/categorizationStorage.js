/**
 * Service for saving and loading AI categorization overrides
 */
export class CategorizationStorage {
  constructor() {
    this.filename = 'ai-categorization.csv';
    this.categorizations = new Map(); // transactionId -> category
  }

  /**
   * Load categorizations from CSV file
   * @returns {Promise<Map>} Map of transaction ID to category
   */
  async load() {
    try {
      console.log('[CategorizationStorage] Loading categorizations...');

      // Try to load from localStorage first (for persistence)
      const stored = localStorage.getItem('ai-categorization');
      if (stored) {
        const data = JSON.parse(stored);
        this.categorizations = new Map(Object.entries(data));
        console.log(`[CategorizationStorage] Loaded ${this.categorizations.size} categorizations from localStorage`);
        return this.categorizations;
      }

      // If not in localStorage, try to load from file
      // Check if file exists by trying to load it
      const fileHandle = await this.getFileHandle();
      if (fileHandle) {
        const file = await fileHandle.getFile();
        const text = await file.text();
        this.parseCSV(text);
        console.log(`[CategorizationStorage] Loaded ${this.categorizations.size} categorizations from file`);
      } else {
        console.log('[CategorizationStorage] No existing categorization file found');
      }

      return this.categorizations;
    } catch (error) {
      console.error('[CategorizationStorage] Error loading categorizations:', error);
      // Return empty map on error
      return this.categorizations;
    }
  }

  /**
   * Parse CSV text into categorizations map
   * @param {string} text - CSV text
   */
  parseCSV(text) {
    const lines = text.split('\n');

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted fields)
      const parts = this.parseCSVLine(line);
      if (parts.length >= 3) {
        const [transactionId, category] = parts;
        this.categorizations.set(transactionId, category);
      }
    }
  }

  /**
   * Parse a single CSV line (handles quoted fields)
   * @param {string} line - CSV line
   * @returns {Array<string>} - Array of field values
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Save categorizations to CSV file and localStorage
   * @param {Map} categorizations - Map of transaction ID to category
   * @returns {Promise<void>}
   */
  async save(categorizations) {
    try {
      console.log('[CategorizationStorage] Saving categorizations...');

      // Update internal map
      categorizations.forEach((category, id) => {
        this.categorizations.set(id, category);
      });

      // Save to localStorage
      const data = Object.fromEntries(this.categorizations);
      localStorage.setItem('ai-categorization', JSON.stringify(data));

      // Generate CSV content
      const csv = this.generateCSV();

      // Save to file
      await this.saveToFile(csv);

      console.log(`[CategorizationStorage] Saved ${this.categorizations.size} categorizations`);
    } catch (error) {
      console.error('[CategorizationStorage] Error saving categorizations:', error);
      throw error;
    }
  }

  /**
   * Generate CSV content from categorizations
   * @returns {string} CSV content
   */
  generateCSV() {
    let csv = 'TransactionID,Category,Timestamp\n';

    this.categorizations.forEach((category, id) => {
      const timestamp = new Date().toISOString();
      csv += `"${id}","${category}","${timestamp}"\n`;
    });

    return csv;
  }

  /**
   * Save CSV content to file
   * @param {string} csv - CSV content
   * @returns {Promise<void>}
   */
  async saveToFile(csv) {
    try {
      // Create a blob from the CSV content
      const blob = new Blob([csv], { type: 'text/csv' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.filename;

      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up
      URL.revokeObjectURL(url);

      console.log('[CategorizationStorage] File download triggered');
    } catch (error) {
      console.error('[CategorizationStorage] Error saving to file:', error);
      // Don't throw - localStorage save already succeeded
    }
  }

  /**
   * Get file handle from File System Access API (if supported)
   * @returns {Promise<FileSystemFileHandle|null>}
   */
  async getFileHandle() {
    try {
      // File System Access API is not widely supported
      // This is a placeholder for future enhancement
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Apply categorizations to transactions
   * @param {Array<Transaction>} transactions - Transactions to update
   * @returns {number} Number of transactions updated
   */
  applyCategorizations(transactions) {
    let updated = 0;

    transactions.forEach(transaction => {
      if (this.categorizations.has(transaction.id)) {
        const category = this.categorizations.get(transaction.id);
        transaction.category = category;
        updated++;
      }
    });

    console.log(`[CategorizationStorage] Applied ${updated} categorizations to transactions`);
    return updated;
  }

  /**
   * Get all categorizations
   * @returns {Map} Map of transaction ID to category
   */
  getCategorizations() {
    return this.categorizations;
  }

  /**
   * Clear all categorizations
   */
  clear() {
    this.categorizations.clear();
    localStorage.removeItem('ai-categorization');
    console.log('[CategorizationStorage] Cleared all categorizations');
  }

  /**
   * Get categorization stats
   * @returns {Object} Stats about categorizations
   */
  getStats() {
    const categories = {};

    this.categorizations.forEach(category => {
      categories[category] = (categories[category] || 0) + 1;
    });

    return {
      total: this.categorizations.size,
      byCategory: categories
    };
  }
}
