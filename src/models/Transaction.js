/**
 * Transaction data model
 */
export class Transaction {
  constructor(data) {
    this.id = data.id || this.generateId(data);
    this.bookingDate = data.bookingDate; // Date object
    this.valueDate = data.valueDate; // Date object
    this.payee = data.payee || '';
    this.purpose = data.purpose || '';
    this.accountNumber = data.accountNumber || '';
    this.bankCode = data.bankCode || '';
    this.amount = data.amount || 0; // Number (positive for income, negative for expenses)
    this.currency = data.currency || 'EUR';
    this.category = data.category || 'OTHER';
    this.normalizedMerchant = data.normalizedMerchant || '';
  }

  /**
   * Generate a unique ID from transaction data
   * @param {Object} data - Transaction data
   * @returns {string} - Unique ID
   */
  generateId(data) {
    const dateStr = data.bookingDate ? data.bookingDate.getTime() : '';
    const amountStr = Math.abs(data.amount || 0).toFixed(2);
    const payeeStr = (data.payee || '').substring(0, 20);
    return `${dateStr}-${amountStr}-${payeeStr}`.replace(/[^a-zA-Z0-9-]/g, '');
  }

  /**
   * Check if transaction is income
   * @returns {boolean}
   */
  isIncome() {
    return this.amount > 0;
  }

  /**
   * Check if transaction is expense
   * @returns {boolean}
   */
  isExpense() {
    return this.amount < 0;
  }

  /**
   * Get absolute amount
   * @returns {number}
   */
  getAbsoluteAmount() {
    return Math.abs(this.amount);
  }

  /**
   * Convert to plain object for JSON serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      bookingDate: this.bookingDate?.toISOString(),
      valueDate: this.valueDate?.toISOString(),
      payee: this.payee,
      purpose: this.purpose,
      accountNumber: this.accountNumber,
      bankCode: this.bankCode,
      amount: this.amount,
      currency: this.currency,
      category: this.category,
      normalizedMerchant: this.normalizedMerchant
    };
  }
}
