import { formatCurrency } from '../utils/numberUtils.js';
import { formatDateGerman } from '../utils/dateUtils.js';

/**
 * Budget view UI component
 */
export class BudgetView {
  constructor(container, transactions, budgetCalculator) {
    this.container = container;
    this.transactions = transactions;
    this.budgetCalculator = budgetCalculator;
    this.currentPeriod = 'all';
    this.customRange = null;

    this.render();
  }

  update(transactions) {
    this.transactions = transactions;
    this.render();
  }

  render() {
    const budget = this.budgetCalculator.calculate(
      this.transactions,
      this.currentPeriod,
      this.customRange
    );

    this.container.innerHTML = `
      <div class="budget-view">
        <!-- Period Selector -->
        <div class="budget-controls">
          <label for="period-select">Time Period:</label>
          <select id="period-select">
            <option value="3months" ${this.currentPeriod === '3months' ? 'selected' : ''}>Last 3 Months</option>
            <option value="6months" ${this.currentPeriod === '6months' ? 'selected' : ''}>Last 6 Months</option>
            <option value="12months" ${this.currentPeriod === '12months' ? 'selected' : ''}>Last 12 Months</option>
            <option value="all" ${this.currentPeriod === 'all' ? 'selected' : ''}>All Time</option>
            <option value="custom" ${this.currentPeriod === 'custom' ? 'selected' : ''}>Custom Range</option>
          </select>

          ${this.currentPeriod === 'custom' ? this.renderCustomRange() : ''}

          <button id="export-budget-btn" class="btn btn-secondary">Export Budget</button>
        </div>

        <!-- Summary Cards -->
        <div class="budget-summary">
          <div class="budget-card">
            <h4>Period</h4>
            <p>${formatDateGerman(budget.startDate)} - ${formatDateGerman(budget.endDate)}</p>
            <p class="budget-meta">${budget.monthsInPeriod} months</p>
          </div>

          <div class="budget-card">
            <h4>Total Income</h4>
            <p class="budget-value positive">${formatCurrency(budget.totalIncome)}</p>
            <p class="budget-meta">${formatCurrency(budget.avgMonthlyIncome)}/month</p>
          </div>

          <div class="budget-card">
            <h4>Total Expenses</h4>
            <p class="budget-value negative">${formatCurrency(budget.totalExpenses)}</p>
            <p class="budget-meta">${formatCurrency(budget.avgMonthlyExpenses)}/month</p>
          </div>

          <div class="budget-card">
            <h4>Balance</h4>
            <p class="budget-value ${budget.balance >= 0 ? 'positive' : 'negative'}">
              ${formatCurrency(budget.balance)}
            </p>
            <p class="budget-meta">${formatCurrency(budget.avgMonthlyBalance)}/month</p>
          </div>

          <div class="budget-card">
            <h4>Savings Rate</h4>
            <p class="budget-value ${budget.savingsRate >= 0 ? 'positive' : 'negative'}">
              ${budget.savingsRate.toFixed(1)}%
            </p>
            <p class="budget-meta">${budget.transactionCount} transactions</p>
          </div>
        </div>

        <!-- Category Breakdown -->
        <div class="budget-breakdown">
          <h3>Expenses by Category</h3>
          <table class="budget-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total</th>
                <th>Monthly Average</th>
                <th>% of Expenses</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderCategoryRows(budget)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderCustomRange() {
    return `
      <div class="custom-range">
        <input type="date" id="custom-start" />
        <span>to</span>
        <input type="date" id="custom-end" />
        <button id="apply-custom-range" class="btn btn-primary">Apply</button>
      </div>
    `;
  }

  renderCategoryRows(budget) {
    if (budget.categoryBreakdown.length === 0) {
      return '<tr><td colspan="5">No data</td></tr>';
    }

    const totalExpenses = budget.categoryBreakdown
      .reduce((sum, cat) => sum + cat.expenses, 0);

    return budget.categoryBreakdown
      .filter(cat => cat.expenses > 0)
      .map(cat => {
        const percentage = totalExpenses > 0
          ? (cat.expenses / totalExpenses * 100).toFixed(1)
          : 0;
        const monthlyAvg = cat.expenses / budget.monthsInPeriod;

        return `
          <tr>
            <td><strong>${cat.category}</strong></td>
            <td>${formatCurrency(cat.expenses)}</td>
            <td>${formatCurrency(monthlyAvg)}</td>
            <td>${percentage}%</td>
            <td>${cat.count}</td>
          </tr>
        `;
      })
      .join('');
  }

  attachEventListeners() {
    const periodSelect = this.container.querySelector('#period-select');
    periodSelect.addEventListener('change', (e) => {
      this.currentPeriod = e.target.value;
      this.render();
    });

    // Custom range
    if (this.currentPeriod === 'custom') {
      const applyBtn = this.container.querySelector('#apply-custom-range');
      applyBtn.addEventListener('click', () => {
        const start = this.container.querySelector('#custom-start').value;
        const end = this.container.querySelector('#custom-end').value;

        if (start && end) {
          this.customRange = {
            start: new Date(start),
            end: new Date(end)
          };
          this.render();
        }
      });
    }

    // Export button
    const exportBtn = this.container.querySelector('#export-budget-btn');
    exportBtn.addEventListener('click', () => this.exportBudget());
  }

  exportBudget() {
    const budget = this.budgetCalculator.calculate(
      this.transactions,
      this.currentPeriod,
      this.customRange
    );

    const json = this.budgetCalculator.exportJSON(budget);

    // Create download link
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-${budget.period}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
