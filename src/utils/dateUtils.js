import { parse, format, isValid } from 'date-fns';

/**
 * Parse German date format (DD.MM.YY) to Date object
 * @param {string} dateStr - Date string in DD.MM.YY format
 * @returns {Date|null} - Parsed date or null if invalid
 */
export function parseGermanDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  try {
    // Handle DD.MM.YY format
    const date = parse(dateStr.trim(), 'dd.MM.yy', new Date());

    if (isValid(date)) {
      return date;
    }

    return null;
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return null;
  }
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
export function formatDateISO(date) {
  if (!date || !isValid(date)) {
    return '';
  }
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date to German format (DD.MM.YYYY)
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
export function formatDateGerman(date) {
  if (!date || !isValid(date)) {
    return '';
  }
  return format(date, 'dd.MM.yyyy');
}
