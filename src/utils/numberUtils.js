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
 * @param {number} num - Number to format
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
