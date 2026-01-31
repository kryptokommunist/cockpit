/**
 * Month Range Selector Component
 * Allows users to select a start and end month/year
 */
export class MonthRangeSelector {
  constructor(container, label, defaultRange, onChange) {
    this.container = container;
    this.label = label;
    this.defaultRange = defaultRange;
    this.onChange = onChange;
    this.isExpanded = false;
    this.autoCollapseTimeout = null;
    this.isInitializing = true; // Flag to prevent onChange during init
    this.render();
    this.isInitializing = false; // Ready for user interactions
  }

  /**
   * Get available months for selection
   */
  getAvailableMonths() {
    return [
      { value: 0, label: 'Jan' },
      { value: 1, label: 'Feb' },
      { value: 2, label: 'Mar' },
      { value: 3, label: 'Apr' },
      { value: 4, label: 'May' },
      { value: 5, label: 'Jun' },
      { value: 6, label: 'Jul' },
      { value: 7, label: 'Aug' },
      { value: 8, label: 'Sep' },
      { value: 9, label: 'Oct' },
      { value: 10, label: 'Nov' },
      { value: 11, label: 'Dec' }
    ];
  }

  /**
   * Get available years for selection
   */
  getAvailableYears() {
    const currentYear = new Date().getFullYear();
    const years = [];
    // Show last 3 years and current year
    for (let i = 3; i >= 0; i--) {
      years.push(currentYear - i);
    }
    return years;
  }

  /**
   * Render the selector
   */
  render() {
    const months = this.getAvailableMonths();
    const years = this.getAvailableYears();

    const monthOptions = months.map(m =>
      `<option value="${m.value}">${m.label}</option>`
    ).join('');

    const yearOptions = years.map(y =>
      `<option value="${y}">${y}</option>`
    ).join('');

    // Format current range for display
    const currentRangeText = this.formatRangeText(this.defaultRange);

    this.container.innerHTML = `
      <div class="month-range-selector collapsible">
        <button class="range-toggle-btn" type="button">
          <span class="range-toggle-icon">⚙️</span>
          <span class="range-toggle-text">${this.label}</span>
          <span class="range-current-value">${currentRangeText}</span>
          <span class="range-toggle-arrow">▼</span>
        </button>
        <div class="range-inputs collapsed">
          <div class="range-input-group">
            <label class="input-sublabel">From</label>
            <div class="month-year-picker">
              <select class="month-select start-month">
                ${monthOptions}
              </select>
              <select class="year-select start-year">
                ${yearOptions}
              </select>
            </div>
          </div>
          <span class="range-separator">—</span>
          <div class="range-input-group">
            <label class="input-sublabel">To</label>
            <div class="month-year-picker">
              <select class="month-select end-month">
                ${monthOptions}
              </select>
              <select class="year-select end-year">
                ${yearOptions}
              </select>
            </div>
          </div>
        </div>
      </div>
    `;

    // Set default values
    this.container.querySelector('.start-month').value = this.defaultRange.startMonth;
    this.container.querySelector('.start-year').value = this.defaultRange.startYear;
    this.container.querySelector('.end-month').value = this.defaultRange.endMonth;
    this.container.querySelector('.end-year').value = this.defaultRange.endYear;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Format range as readable text
   */
  formatRangeText(range) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[range.startMonth]} ${range.startYear} - ${months[range.endMonth]} ${range.endYear}`;
  }

  /**
   * Toggle expanded/collapsed state
   */
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    const rangeInputs = this.container.querySelector('.range-inputs');
    const toggleBtn = this.container.querySelector('.range-toggle-btn');
    const toggleArrow = this.container.querySelector('.range-toggle-arrow');

    if (this.isExpanded) {
      rangeInputs.classList.remove('collapsed');
      toggleBtn.classList.add('expanded');
      toggleArrow.textContent = '▲';
      this.startAutoCollapseTimer();
    } else {
      rangeInputs.classList.add('collapsed');
      toggleBtn.classList.remove('expanded');
      toggleArrow.textContent = '▼';
      this.clearAutoCollapseTimer();
    }
  }

  /**
   * Collapse the selector
   */
  collapse() {
    if (this.isExpanded) {
      this.isExpanded = false;
      const rangeInputs = this.container.querySelector('.range-inputs');
      const toggleBtn = this.container.querySelector('.range-toggle-btn');
      const toggleArrow = this.container.querySelector('.range-toggle-arrow');

      rangeInputs.classList.add('collapsed');
      toggleBtn.classList.remove('expanded');
      toggleArrow.textContent = '▼';
      this.clearAutoCollapseTimer();
    }
  }

  /**
   * Start auto-collapse timer (20 seconds)
   */
  startAutoCollapseTimer() {
    this.clearAutoCollapseTimer();
    this.autoCollapseTimeout = setTimeout(() => {
      this.collapse();
    }, 20000); // 20 seconds
  }

  /**
   * Clear auto-collapse timer
   */
  clearAutoCollapseTimer() {
    if (this.autoCollapseTimeout) {
      clearTimeout(this.autoCollapseTimeout);
      this.autoCollapseTimeout = null;
    }
  }

  /**
   * Reset auto-collapse timer (on user interaction)
   */
  resetAutoCollapseTimer() {
    if (this.isExpanded) {
      this.startAutoCollapseTimer();
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const startMonth = this.container.querySelector('.start-month');
    const startYear = this.container.querySelector('.start-year');
    const endMonth = this.container.querySelector('.end-month');
    const endYear = this.container.querySelector('.end-year');
    const toggleBtn = this.container.querySelector('.range-toggle-btn');

    // Toggle button click
    toggleBtn.addEventListener('click', () => {
      this.toggleExpanded();
    });

    const handleChange = () => {
      // Don't trigger onChange during initialization
      if (this.isInitializing) {
        console.log('[MonthRangeSelector] Change event blocked - still initializing');
        return;
      }

      console.log('[MonthRangeSelector] Change event triggered - processing');

      const range = {
        startMonth: parseInt(startMonth.value),
        startYear: parseInt(startYear.value),
        endMonth: parseInt(endMonth.value),
        endYear: parseInt(endYear.value)
      };

      // Validate range
      if (this.isValidRange(range)) {
        console.log('[MonthRangeSelector] Range valid, calling onChange callback');
        if (this.onChange) {
          this.onChange(range);
        }
        // Update the displayed current value
        const currentValueEl = this.container.querySelector('.range-current-value');
        if (currentValueEl) {
          currentValueEl.textContent = this.formatRangeText(range);
        }
        // Collapse after successful change
        this.collapse();
      } else {
        console.log('[MonthRangeSelector] Range invalid');
        this.showError('Invalid date range: End date must be after start date');
        this.resetAutoCollapseTimer();
      }
    };

    // Reset timer on any interaction with the selects
    const resetTimer = () => {
      this.resetAutoCollapseTimer();
    };

    startMonth.addEventListener('change', handleChange);
    startYear.addEventListener('change', handleChange);
    endMonth.addEventListener('change', handleChange);
    endYear.addEventListener('change', handleChange);

    startMonth.addEventListener('focus', resetTimer);
    startYear.addEventListener('focus', resetTimer);
    endMonth.addEventListener('focus', resetTimer);
    endYear.addEventListener('focus', resetTimer);
  }

  /**
   * Validate that end date is after start date
   */
  isValidRange(range) {
    const startDate = new Date(range.startYear, range.startMonth, 1);
    const endDate = new Date(range.endYear, range.endMonth, 1);
    return endDate >= startDate;
  }

  /**
   * Show error message
   */
  showError(message) {
    // Create temporary error message
    let errorEl = this.container.querySelector('.range-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'range-error';
      this.container.querySelector('.month-range-selector').appendChild(errorEl);
    }

    errorEl.textContent = message;
    errorEl.style.display = 'block';

    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 3000);
  }

  /**
   * Get current selected range
   */
  getValue() {
    return {
      startMonth: parseInt(this.container.querySelector('.start-month').value),
      startYear: parseInt(this.container.querySelector('.start-year').value),
      endMonth: parseInt(this.container.querySelector('.end-month').value),
      endYear: parseInt(this.container.querySelector('.end-year').value)
    };
  }

  /**
   * Set range value
   */
  setValue(range) {
    this.container.querySelector('.start-month').value = range.startMonth;
    this.container.querySelector('.start-year').value = range.startYear;
    this.container.querySelector('.end-month').value = range.endMonth;
    this.container.querySelector('.end-year').value = range.endYear;
  }
}
