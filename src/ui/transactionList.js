import { formatDateGerman } from '../utils/dateUtils.js';
import { formatCurrency } from '../utils/numberUtils.js';
import { Categorizer } from '../services/categorizer.js';

/**
 * Transaction list UI component with sorting and category editing
 */
export class TransactionList {
  constructor(container, transactions, onCategoryChange) {
    this.container = container;
    this.transactions = transactions;
    this.onCategoryChange = onCategoryChange;
    this.categorizer = new Categorizer();

    this.sortColumn = 'bookingDate';
    this.sortDirection = 'desc';
    this.pageSize = 50;
    this.currentPage = 0;

    this.render();
  }

  update(transactions) {
    this.transactions = transactions;
    this.currentPage = 0;
    this.render();
  }

  render() {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    const sortedTransactions = this.sortTransactions();
    const displayTransactions = sortedTransactions.slice(start, end);
    const totalPages = Math.ceil(sortedTransactions.length / this.pageSize);

    this.container.innerHTML = `
      <div class="transaction-list">
        <div class="transaction-stats">
          <p>Showing ${start + 1}-${Math.min(end, sortedTransactions.length)} of ${sortedTransactions.length} transactions</p>
        </div>

        <div class="table-container">
          <table class="transaction-table">
            <thead>
              <tr>
                <th class="sortable ${this.sortColumn === 'bookingDate' ? 'sorted-' + this.sortDirection : ''}"
                    data-column="bookingDate">Date</th>
                <th class="sortable ${this.sortColumn === 'payee' ? 'sorted-' + this.sortDirection : ''}"
                    data-column="payee">Merchant</th>
                <th class="sortable ${this.sortColumn === 'purpose' ? 'sorted-' + this.sortDirection : ''}"
                    data-column="purpose">Purpose</th>
                <th class="sortable ${this.sortColumn === 'category' ? 'sorted-' + this.sortDirection : ''}"
                    data-column="category">Category</th>
                <th class="sortable ${this.sortColumn === 'amount' ? 'sorted-' + this.sortDirection : ''}"
                    data-column="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${displayTransactions.map(t => this.renderTransactionRow(t)).join('')}
            </tbody>
          </table>
        </div>

        ${totalPages > 1 ? this.renderPagination(totalPages) : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  renderTransactionRow(transaction) {
    const categoryColor = this.categorizer.getCategoryColor(transaction.category);
    const amountClass = transaction.isIncome() ? 'amount-positive' : 'amount-negative';

    return `
      <tr data-transaction-id="${transaction.id}">
        <td>${formatDateGerman(transaction.bookingDate)}</td>
        <td class="merchant-cell" title="${transaction.payee}">
          ${this.truncate(transaction.normalizedMerchant || transaction.payee, 30)}
        </td>
        <td class="purpose-cell" title="${transaction.purpose}">
          ${this.truncate(transaction.purpose, 40)}
        </td>
        <td>
          <span class="category-badge" style="background-color: ${categoryColor};"
                data-transaction-id="${transaction.id}">
            ${transaction.category}
          </span>
        </td>
        <td class="${amountClass}">${formatCurrency(transaction.amount)}</td>
      </tr>
    `;
  }

  renderPagination(totalPages) {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible);

    if (endPage - startPage < maxVisible) {
      startPage = Math.max(0, endPage - maxVisible);
    }

    return `
      <div class="pagination">
        <button class="btn-page" data-page="0" ${this.currentPage === 0 ? 'disabled' : ''}>First</button>
        <button class="btn-page" data-page="${this.currentPage - 1}" ${this.currentPage === 0 ? 'disabled' : ''}>Previous</button>

        ${Array.from({ length: endPage - startPage }, (_, i) => startPage + i).map(page => `
          <button class="btn-page ${page === this.currentPage ? 'active' : ''}" data-page="${page}">
            ${page + 1}
          </button>
        `).join('')}

        <button class="btn-page" data-page="${this.currentPage + 1}" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        <button class="btn-page" data-page="${totalPages - 1}" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>Last</button>
      </div>
    `;
  }

  attachEventListeners() {
    // Sort headers
    const headers = this.container.querySelectorAll('th.sortable');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const column = header.dataset.column;
        this.handleSort(column);
      });
    });

    // Category badges - click to edit
    const badges = this.container.querySelectorAll('.category-badge');
    badges.forEach(badge => {
      badge.addEventListener('click', (e) => {
        const transactionId = badge.dataset.transactionId;
        this.showCategoryEditor(badge, transactionId);
      });
    });

    // Pagination
    const pageButtons = this.container.querySelectorAll('.btn-page');
    pageButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (!isNaN(page) && page >= 0) {
          this.currentPage = page;
          this.render();
        }
      });
    });
  }

  handleSort(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc';
    }
    this.render();
  }

  sortTransactions() {
    const sorted = [...this.transactions];

    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (this.sortColumn) {
        case 'bookingDate':
          aVal = a.bookingDate.getTime();
          bVal = b.bookingDate.getTime();
          break;
        case 'payee':
          aVal = a.normalizedMerchant || a.payee;
          bVal = b.normalizedMerchant || b.payee;
          break;
        case 'purpose':
          aVal = a.purpose;
          bVal = b.purpose;
          break;
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        case 'amount':
          aVal = Math.abs(a.amount);
          bVal = Math.abs(b.amount);
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (this.sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return sorted;
  }

  showCategoryEditor(badgeElement, transactionId) {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const categories = Object.keys(this.categorizer.categories);
    const currentCategory = transaction.category;

    // Create dropdown
    const dropdown = document.createElement('select');
    dropdown.className = 'category-dropdown';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      option.selected = cat === currentCategory;
      dropdown.appendChild(option);
    });

    // Replace badge with dropdown
    const parent = badgeElement.parentElement;
    parent.replaceChild(dropdown, badgeElement);
    dropdown.focus();

    // Handle change
    const handleChange = () => {
      const newCategory = dropdown.value;
      if (newCategory !== currentCategory) {
        this.onCategoryChange(transaction, newCategory);
      }
      this.render();
    };

    // Handle blur (click outside)
    const handleBlur = () => {
      this.render();
    };

    dropdown.addEventListener('change', handleChange);
    dropdown.addEventListener('blur', handleBlur);
  }

  truncate(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
}
