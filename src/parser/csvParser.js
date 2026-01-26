import Papa from 'papaparse';
import { parseGermanDate } from '../utils/dateUtils.js';
import { parseGermanNumber } from '../utils/numberUtils.js';
import { Transaction } from '../models/Transaction.js';

/**
 * Parse German bank CSV export
 * Expected format:
 * - Delimiter: semicolon (;)
 * - First 4 lines: metadata
 * - Line 5: column headers
 * - Data starts at line 6
 * - Dates: DD.MM.YY
 * - Amounts: German format with comma decimal separator
 */
export class CSVParser {
  constructor() {
    this.metadataLines = 4; // Lines 1-4 (including empty line)
  }

  /**
   * Parse CSV file
   * @param {File} file - CSV file to parse
   * @returns {Promise<Array<Transaction>>} - Array of parsed transactions
   */
  async parse(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        delimiter: ';',
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions = this.processResults(results);
            resolve(transactions);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  /**
   * Process parsed CSV results
   * @param {Object} results - Papa Parse results
   * @returns {Array<Transaction>} - Array of transactions
   */
  processResults(results) {
    const rows = results.data;

    if (rows.length <= this.metadataLines + 1) {
      throw new Error('CSV file is too short or empty');
    }

    // Skip metadata lines, line 5 is headers
    const headers = rows[this.metadataLines];
    const dataRows = rows.slice(this.metadataLines + 1);

    console.log('CSV Headers:', headers);
    console.log('Total data rows:', dataRows.length);

    // Map headers to indices
    const headerMap = this.createHeaderMap(headers);

    // Parse each row into a transaction
    const transactions = dataRows
      .map((row, index) => this.parseRow(row, headerMap, index))
      .filter(t => t !== null);

    console.log('Parsed transactions:', transactions.length);

    return transactions;
  }

  /**
   * Create a map of header names to column indices
   * @param {Array<string>} headers - CSV headers
   * @returns {Object} - Header map
   */
  createHeaderMap(headers) {
    const map = {};

    headers.forEach((header, index) => {
      const normalized = header.trim().toLowerCase().replace(/\*/g, '');
      map[normalized] = index;
    });

    // Common German CSV column names
    // Buchungsdatum = Booking date
    // Wertstellung = Value date
    // Zahlungsempfänger*in = Payee/Recipient
    // Zahlungspflichtige*r = Payer
    // Verwendungszweck = Purpose
    // IBAN = IBAN
    // Betrag (€) = Amount
    // Kundenreferenz = Customer reference

    return map;
  }

  /**
   * Parse a single row into a Transaction
   * @param {Array<string>} row - CSV row
   * @param {Object} headerMap - Header to index map
   * @param {number} rowIndex - Row index for debugging
   * @returns {Transaction|null} - Parsed transaction or null if invalid
   */
  parseRow(row, headerMap, rowIndex) {
    try {
      // Skip empty rows
      if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        return null;
      }

      // Map to actual CSV columns
      const bookingDateIdx = headerMap['buchungsdatum'] ?? headerMap['buchungstag'] ?? 0;
      const valueDateIdx = headerMap['wertstellung'] ?? headerMap['valuta'] ?? 1;
      const payeeIdx = headerMap['zahlungsempfängerin'] ?? headerMap['auftraggeber/empfänger'] ?? headerMap['empfänger'] ?? 4;
      const purposeIdx = headerMap['verwendungszweck'] ?? headerMap['buchungstext'] ?? 5;
      const ibanIdx = headerMap['iban'] ?? 7;
      const amountIdx = headerMap['betrag (€)'] ?? headerMap['betrag'] ?? headerMap['umsatz'] ?? 8;
      const referenceIdx = headerMap['kundenreferenz'] ?? 11;

      const bookingDate = parseGermanDate(row[bookingDateIdx]);
      const valueDate = parseGermanDate(row[valueDateIdx]);
      const amount = parseGermanNumber(row[amountIdx]);

      if (!bookingDate) {
        console.warn(`Row ${rowIndex}: Invalid booking date "${row[bookingDateIdx]}"`);
        return null;
      }

      // Get payee/merchant name
      let payee = row[payeeIdx]?.trim() || '';

      // If payee is generic like "ISSUER", use purpose field to extract merchant
      if (payee === 'ISSUER' || !payee) {
        const purpose = row[purposeIdx]?.trim() || '';
        // Extract merchant from purpose (e.g., "VISA Debitkartenumsatz vom 22.01.2026" -> look for merchant in payee column)
        // Actually the merchant is still in the payee column even if marked as ISSUER
        payee = row[payeeIdx]?.trim() || purpose;
      }

      const transaction = new Transaction({
        bookingDate,
        valueDate: valueDate || bookingDate,
        payee,
        purpose: row[purposeIdx]?.trim() || '',
        accountNumber: row[ibanIdx]?.trim() || '',
        bankCode: '',
        amount,
        currency: 'EUR'
      });

      return transaction;
    } catch (error) {
      console.error(`Error parsing row ${rowIndex}:`, error, row);
      return null;
    }
  }

  /**
   * Parse CSV from text content
   * @param {string} csvText - CSV text content
   * @returns {Promise<Array<Transaction>>} - Array of parsed transactions
   */
  async parseText(csvText) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        delimiter: ';',
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions = this.processResults(results);
            resolve(transactions);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }
}
