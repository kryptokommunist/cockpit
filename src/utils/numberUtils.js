/**
 * Parse German number format (comma as decimal separator) to float
 * @param {string} numStr - Number string in German format (e.g., "1.234,56" or "-123,45")
 * @returns {number} - Parsed number or 0 if invalid
 */
export function parseGermanNumber(numStr) {
  if (!numStr || typeof numStr !== 'string') {
    return 0;
  }

  try {
    // Remove thousand separators (dots) and replace comma with dot
    const normalized = numStr
      .trim()
      .replace(/\./g, '')  // Remove thousand separators
      .replace(',', '.');  // Replace decimal comma with dot

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    console.error('Error parsing number:', numStr, error);
    return 0;
  }
}

/**
 * Format number to German format with 2 decimal places
 * @param {number} num - Number to format
 * @returns {string} - Formatted number string
 */
export function formatGermanNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0,00';
  }

  return num.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format number as currency (EUR)
 * @param {number} num - Number to format (in euros, not cents)
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0,00 €';
  }

  return num.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR'
  });
}

/**
 * Convert euros to cents (integer)
 * @param {number} euros - Amount in euros (e.g., 20.50)
 * @returns {number} - Amount in cents as integer (e.g., 2050)
 */
export function eurosToCents(euros) {
  if (typeof euros !== 'number' || isNaN(euros)) {
    return 0;
  }
  // Round to avoid floating point precision issues
  return Math.round(euros * 100);
}

/**
 * Convert cents to euros
 * @param {number} cents - Amount in cents as integer (e.g., 2050)
 * @returns {number} - Amount in euros (e.g., 20.50)
 */
export function centsToEuros(cents) {
  if (typeof cents !== 'number' || isNaN(cents)) {
    return 0;
  }
  return cents / 100;
}

/**
 * Format cents as currency (EUR)
 * @param {number} cents - Amount in cents as integer
 * @returns {string} - Formatted currency string
 */
export function formatCentsAsCurrency(cents) {
  return formatCurrency(centsToEuros(cents));
}

/**
 * Parse euro input string to cents (handles both . and , as decimal separators)
 * @param {string} input - User input string (e.g., "20", "20.50", "20,50")
 * @returns {number} - Amount in cents as integer
 */
export function parseEuroInputToCents(input) {
  if (!input || typeof input !== 'string') {
    return 0;
  }

  // Normalize: replace comma with dot for decimal
  const normalized = input.trim().replace(',', '.');
  const euros = parseFloat(normalized);

  if (isNaN(euros)) {
    return 0;
  }

  return eurosToCents(euros);
}
