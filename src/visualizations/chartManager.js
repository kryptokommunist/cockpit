import { TimelineChart } from './timelineChart.js';
import { CategoryChart } from './categoryChart.js';
import { RecurringChart } from './recurringChart.js';

/**
 * Chart manager - orchestrates all charts
 */
export class ChartManager {
  constructor(recurringDetector) {
    this.timelineChart = null;
    this.categoryChart = null;
    this.recurringChart = null;
    this.recurringDetector = recurringDetector;

    this.initializeCharts();
  }

  initializeCharts() {
    const timelineCanvas = document.getElementById('timeline-chart');
    const categoryCanvas = document.getElementById('category-chart');
    const recurringCanvas = document.getElementById('recurring-chart');

    if (timelineCanvas) {
      this.timelineChart = new TimelineChart(timelineCanvas);
    }

    if (categoryCanvas) {
      this.categoryChart = new CategoryChart(categoryCanvas);
    }

    if (recurringCanvas) {
      this.recurringChart = new RecurringChart(recurringCanvas, this.recurringDetector);
    }
  }

  /**
   * Update all charts with new data
   * @param {Array<Transaction>} transactions - Filtered transactions
   * @param {Object} recurring - Recurring patterns {expenses, income}
   */
  updateAll(transactions, recurring) {
    if (this.timelineChart) {
      this.timelineChart.update(transactions);
    }

    if (this.categoryChart) {
      // Pass recurring data to exclude from category breakdown
      this.categoryChart.setRecurringMerchants(recurring);
      this.categoryChart.update(transactions);
    }

    if (this.recurringChart) {
      this.recurringChart.update(recurring);
    }
  }

  /**
   * Destroy all charts
   */
  destroyAll() {
    if (this.timelineChart) {
      this.timelineChart.destroy();
    }

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    if (this.recurringChart) {
      this.recurringChart.destroy();
    }
  }
}
