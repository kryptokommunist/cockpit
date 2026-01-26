import { formatCurrency } from '../utils/numberUtils.js';
import { subDays, subMonths, subYears } from 'date-fns';

/**
 * Top Merchants UI Component
 * Displays top N merchants by spending
 */
export class TopMerchants {
  constructor(container) {
    this.container = container;
    this.transactions = [];
    this.timePeriod = 'all';
    this.topN = 10;

    this.render();
    this.attachEventListeners();
  }

  update(transactions) {
    this.transactions = transactions;
    this.renderMerchants();
  }

  render() {
    this.container.innerHTML = `
      <div class="top-merchants-card">
        <div class="top-merchants-header">
          <h3>Top Merchants</h3>
          <div class="top-merchants-controls">
            <label>
              Show:
              <select id="top-merchants-count">
                <option value="5">Top 5</option>
                <option value="10" selected>Top 10</option>
                <option value="15">Top 15</option>
                <option value="20">Top 20</option>
              </select>
            </label>
            <label>
              Period:
              <select id="top-merchants-period">
                <option value="all">All Time</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="last3months">Last 3 Months</option>
                <option value="last6months">Last 6 Months</option>
                <option value="lastyear">Last Year</option>
              </select>
            </label>
          </div>
        </div>
        <div id="top-merchants-list" class="top-merchants-list">
          <p class="empty-state">Upload transactions to see top merchants</p>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const countSelect = this.container.querySelector('#top-merchants-count');
    const periodSelect = this.container.querySelector('#top-merchants-period');

    countSelect.addEventListener('change', (e) => {
      this.topN = parseInt(e.target.value);
      this.renderMerchants();
    });

    periodSelect.addEventListener('change', (e) => {
      this.timePeriod = e.target.value;
      this.renderMerchants();
    });
  }

  filterByTimePeriod(transactions) {
    if (this.timePeriod === 'all') {
      return transactions;
    }

    const now = new Date();
    let cutoffDate;

    switch (this.timePeriod) {
      case 'last7days':
        cutoffDate = subDays(now, 7);
        break;
      case 'last30days':
        cutoffDate = subDays(now, 30);
        break;
      case 'last3months':
        cutoffDate = subMonths(now, 3);
        break;
      case 'last6months':
        cutoffDate = subMonths(now, 6);
        break;
      case 'lastyear':
        cutoffDate = subYears(now, 1);
        break;
      default:
        return transactions;
    }

    return transactions.filter(t => t.bookingDate >= cutoffDate);
  }

  renderMerchants() {
    const listContainer = this.container.querySelector('#top-merchants-list');

    if (this.transactions.length === 0) {
      listContainer.innerHTML = '<p class="empty-state">Upload transactions to see top merchants</p>';
      return;
    }

    // Filter by time period
    const filteredTransactions = this.filterByTimePeriod(this.transactions);

    if (filteredTransactions.length === 0) {
      listContainer.innerHTML = '<p class="empty-state">No transactions in selected period</p>';
      return;
    }

    // Group by merchant (only expenses)
    const merchantTotals = {};

    filteredTransactions
      .filter(t => t.isExpense())
      .forEach(t => {
        const merchant = t.normalizedMerchant || t.payee;
        if (!merchantTotals[merchant]) {
          merchantTotals[merchant] = {
            total: 0,
            count: 0,
            category: t.category
          };
        }
        merchantTotals[merchant].total += Math.abs(t.amount);
        merchantTotals[merchant].count++;
      });

    // Sort by total amount (descending)
    const sortedMerchants = Object.entries(merchantTotals)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, this.topN);

    if (sortedMerchants.length === 0) {
      listContainer.innerHTML = '<p class="empty-state">No expenses in selected period</p>';
      return;
    }

    // Calculate total for percentage
    const grandTotal = sortedMerchants.reduce((sum, [, data]) => sum + data.total, 0);

    // Render list
    listContainer.innerHTML = sortedMerchants.map(([merchant, data], index) => {
      const percentage = ((data.total / grandTotal) * 100).toFixed(1);
      return `
        <div class="merchant-item">
          <div class="merchant-rank">${index + 1}</div>
          <div class="merchant-info">
            <div class="merchant-name">${this.truncateMerchant(merchant)}</div>
            <div class="merchant-meta">
              <span class="merchant-category">${data.category}</span>
              <span class="merchant-count">${data.count} transactions</span>
            </div>
          </div>
          <div class="merchant-amount">
            <div class="merchant-total">${formatCurrency(data.total)}</div>
            <div class="merchant-percentage">${percentage}%</div>
          </div>
        </div>
      `;
    }).join('');
  }

  truncateMerchant(merchant) {
    return merchant.length > 35 ? merchant.substring(0, 35) + '...' : merchant;
  }
}
