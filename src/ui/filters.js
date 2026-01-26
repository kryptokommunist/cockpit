import { formatDateISO } from '../utils/dateUtils.js';
import { Categorizer } from '../services/categorizer.js';

/**
 * Transaction filters UI component
 */
export class Filters {
  constructor(container, transactions, onFilterChange) {
    this.container = container;
    this.allTransactions = transactions;
    this.onFilterChange = onFilterChange;
    this.categorizer = new Categorizer();

    this.filters = {
      dateFrom: null,
      dateTo: null,
      categories: [],
      search: '',
      amountMin: null,
      amountMax: null
    };

    this.debounceTimer = null;

    this.render();
  }

  render() {
    const categories = this.categorizer.getUsedCategories(this.allTransactions);
    const minDate = this.getMinDate();
    const maxDate = this.getMaxDate();

    this.container.innerHTML = `
      <div class="filters">
        <div class="filter-group">
          <label for="date-from">From Date:</label>
          <input type="date" id="date-from" value="${formatDateISO(minDate)}" />
        </div>

        <div class="filter-group">
          <label for="date-to">To Date:</label>
          <input type="date" id="date-to" value="${formatDateISO(maxDate)}" />
        </div>

        <div class="filter-group">
          <label for="category-filter">Categories:</label>
          <select id="category-filter" multiple size="5">
            ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label for="search-filter">Search:</label>
          <input type="text" id="search-filter" placeholder="Search merchant or purpose..." />
        </div>

        <div class="filter-group">
          <label for="amount-min">Min Amount (€):</label>
          <input type="number" id="amount-min" step="0.01" placeholder="Min" />
        </div>

        <div class="filter-group">
          <label for="amount-max">Max Amount (€):</label>
          <input type="number" id="amount-max" step="0.01" placeholder="Max" />
        </div>

        <div class="filter-actions">
          <button id="apply-filters" class="btn btn-primary">Apply Filters</button>
          <button id="reset-filters" class="btn btn-secondary">Reset</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const dateFrom = this.container.querySelector('#date-from');
    const dateTo = this.container.querySelector('#date-to');
    const categoryFilter = this.container.querySelector('#category-filter');
    const searchFilter = this.container.querySelector('#search-filter');
    const amountMin = this.container.querySelector('#amount-min');
    const amountMax = this.container.querySelector('#amount-max');
    const applyBtn = this.container.querySelector('#apply-filters');
    const resetBtn = this.container.querySelector('#reset-filters');

    applyBtn.addEventListener('click', () => this.applyFilters());
    resetBtn.addEventListener('click', () => this.resetFilters());

    // Auto-apply on input change (debounced)
    [dateFrom, dateTo, searchFilter, amountMin, amountMax].forEach(input => {
      input.addEventListener('input', () => this.debouncedApplyFilters());
    });

    categoryFilter.addEventListener('change', () => this.debouncedApplyFilters());
  }

  debouncedApplyFilters() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.applyFilters(), 300);
  }

  applyFilters() {
    const dateFrom = this.container.querySelector('#date-from').value;
    const dateTo = this.container.querySelector('#date-to').value;
    const categoryFilter = this.container.querySelector('#category-filter');
    const searchFilter = this.container.querySelector('#search-filter').value;
    const amountMin = this.container.querySelector('#amount-min').value;
    const amountMax = this.container.querySelector('#amount-max').value;

    const selectedCategories = Array.from(categoryFilter.selectedOptions).map(opt => opt.value);

    this.filters = {
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
      categories: selectedCategories,
      search: searchFilter.toLowerCase(),
      amountMin: amountMin ? parseFloat(amountMin) : null,
      amountMax: amountMax ? parseFloat(amountMax) : null
    };

    const filtered = this.filterTransactions();
    this.onFilterChange(filtered);
  }

  filterTransactions() {
    return this.allTransactions.filter(transaction => {
      // Date filter
      if (this.filters.dateFrom && transaction.bookingDate < this.filters.dateFrom) {
        return false;
      }
      if (this.filters.dateTo) {
        const endOfDay = new Date(this.filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (transaction.bookingDate > endOfDay) {
          return false;
        }
      }

      // Category filter
      if (this.filters.categories.length > 0 && !this.filters.categories.includes(transaction.category)) {
        return false;
      }

      // Search filter
      if (this.filters.search) {
        const searchText = this.filters.search;
        const matchesPayee = transaction.payee.toLowerCase().includes(searchText);
        const matchesPurpose = transaction.purpose.toLowerCase().includes(searchText);
        const matchesMerchant = transaction.normalizedMerchant.toLowerCase().includes(searchText);

        if (!matchesPayee && !matchesPurpose && !matchesMerchant) {
          return false;
        }
      }

      // Amount filter
      const absAmount = Math.abs(transaction.amount);
      if (this.filters.amountMin !== null && absAmount < this.filters.amountMin) {
        return false;
      }
      if (this.filters.amountMax !== null && absAmount > this.filters.amountMax) {
        return false;
      }

      return true;
    });
  }

  resetFilters() {
    const minDate = this.getMinDate();
    const maxDate = this.getMaxDate();

    this.container.querySelector('#date-from').value = formatDateISO(minDate);
    this.container.querySelector('#date-to').value = formatDateISO(maxDate);
    this.container.querySelector('#category-filter').selectedIndex = -1;
    this.container.querySelector('#search-filter').value = '';
    this.container.querySelector('#amount-min').value = '';
    this.container.querySelector('#amount-max').value = '';

    this.applyFilters();
  }

  getMinDate() {
    if (this.allTransactions.length === 0) return new Date();
    return this.allTransactions.reduce((min, t) => t.bookingDate < min ? t.bookingDate : min, this.allTransactions[0].bookingDate);
  }

  getMaxDate() {
    if (this.allTransactions.length === 0) return new Date();
    return this.allTransactions.reduce((max, t) => t.bookingDate > max ? t.bookingDate : max, this.allTransactions[0].bookingDate);
  }
}
