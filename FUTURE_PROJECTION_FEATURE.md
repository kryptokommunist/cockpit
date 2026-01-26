# Future Projection Feature

## Overview

The Future Projection feature allows users to create financial projections for the next 12 months by adding recurring income/expenses and one-time items. All projections are automatically visualized and saved locally.

## Features Implemented

### 1. Tab-Based Navigation

**Two Main Views:**
- **Overview Tab**: Current transaction analysis (original dashboard)
- **Future Projection Tab**: 12-month financial projection

### 2. Recurring Income Support

**Added to Recurring Costs Chart:**
- **Recurring Expenses Tab**: Shows recurring costs (original functionality)
- **Recurring Income Tab**: Detects and displays recurring income patterns
  - Salary payments
  - Regular transfers
  - Recurring deposits

**Implementation:**
- Updated `RecurringDetector` to detect both income and expense patterns
- Modified `RecurringChart` to show tabs and filter by type
- Detects patterns from historical transaction data

### 3. Projection Data Service

**File:** `src/services/projectionService.js`

**Capabilities:**
- Add/remove recurring items (income or expense)
- Add/remove one-time future transactions
- Set monthly overrides for recurring items
- Generate projections for any date range
- Save/load from localStorage with JSON backup

**Data Structure:**
```javascript
// Recurring Item
{
  id: "proj_123456789_abc",
  name: "Salary",
  amount: 3000,
  category: "INCOME",
  frequency: "monthly",  // weekly, monthly, quarterly, yearly
  startDate: Date,
  endDate: Date,  // optional
  isIncome: true,
  monthlyOverrides: {
    "2026-03": 3200  // Override for specific month
  }
}

// One-Time Item
{
  id: "proj_987654321_xyz",
  name: "Laptop Purchase",
  amount: -1500,
  category: "ELECTRONICS",
  date: Date,
  isIncome: false
}
```

### 4. Future Projection UI

**File:** `src/ui/futureProjectionView.js`

**Features:**
- Tab switching between Overview and Future views
- Add recurring items modal
- Add one-time items modal
- Auto-update projections when items added
- Summary cards showing projected monthly/yearly totals

**Summary Cards:**
- Projected Monthly Income
- Projected Monthly Expenses
- Projected Monthly Balance
- 12-Month Projection Total

### 5. Add Item Modals

**Recurring Item Modal:**
- Name/description
- Type (income/expense)
- Amount
- Category (from existing categories)
- Frequency (weekly/monthly/quarterly/yearly)
- Start date
- End date (optional)

**One-Time Item Modal:**
- Description
- Type (income/expense)
- Amount
- Category
- Date

### 6. Data Persistence

**Storage:**
- **localStorage**: `financial-projections`
- **JSON Backup**: Auto-downloaded on save as `financial-projections.json`

**Data Saved:**
- All recurring items
- All one-time items
- Monthly overrides
- Timestamps

**Auto-Load:**
- Projections loaded on app startup
- Applied automatically when viewing Future tab

## User Workflow

### Adding Recurring Income (e.g., Salary)

1. Switch to **Future Projection** tab
2. In **Projected Recurring** section, click **+ Add Recurring Item**
3. Fill in:
   - Name: "Monthly Salary"
   - Type: Income
   - Amount: 3000
   - Category: INCOME
   - Frequency: Monthly
   - Start Date: Today
4. Click **Add Item**
5. Projection automatically updates

### Adding Recurring Expense (e.g., Rent)

1. Click **+ Add Recurring Item**
2. Fill in:
   - Name: "Apartment Rent"
   - Type: Expense
   - Amount: 800
   - Category: RENT
   - Frequency: Monthly
   - Start Date: Today
3. Click **Add Item**
4. Charts update with new projection

### Adding One-Time Expense (e.g., Vacation)

1. In **Projected Categories** section, click **+ Add One-Time Item**
2. Fill in:
   - Description: "Summer Vacation"
   - Type: Expense
   - Amount: 1500
   - Category: TRAVEL
   - Date: 2026-07-15
3. Click **Add Item**
4. Timeline shows spike in July

### Monthly Overrides (Future Enhancement)

```javascript
// Set custom amount for specific month
projectionService.setMonthlyOverride('proj_123', '2026-12', 4000);
// December salary is €4000 instead of usual €3000
```

## Technical Implementation

### Architecture

```
User Input (Modal)
    ↓
ProjectionService
    ↓
localStorage + JSON Backup
    ↓
Generate Projections (12 months)
    ↓
Update Charts & Summary
```

### Data Flow

1. User adds item via modal
2. Item stored in ProjectionService
3. Saved to localStorage
4. JSON backup downloaded
5. Projections generated for 12 months
6. Event dispatched: `'update-future-projection'`
7. Charts listen and update
8. Summary cards recalculated

### Event System

**Event:** `'update-future-projection'`

**Detail:**
```javascript
{
  projections: Array,  // Generated projection transactions
  startDate: Date,
  endDate: Date        // 12 months from now
}
```

**Listeners:**
- Future timeline chart
- Future category chart
- Future recurring chart
- Budget projection view

## Integration Points

### Main App (main.js)

**Initialization:**
```javascript
// Load projection data on startup
this.projectionService = new ProjectionService();
await this.projectionService.load();

// Initialize future projection view
this.futureProjectionView = new FutureProjectionView(
  this.projectionService,
  this.categorizer
);
```

### Recurring Detection

**Updated to Support Income:**
```javascript
// Detect both expense and income patterns
const recurringExpenses = this.recurringDetector.detect(transactions, 'expense');
const recurringIncome = this.recurringDetector.detect(transactions, 'income');

const recurring = {
  expenses: recurringExpenses,
  income: recurringIncome
};
```

## Future Enhancements (TODO)

### 1. Timeline Chart with Projections
- Extend timeline 12 months into future
- Show historical data (solid line)
- Show projections (dashed line)
- Differentiate actual vs projected

### 2. Category Charts with Projections
- Show projected category breakdown
- Compare historical vs projected spending

### 3. Monthly Override UI
- Edit specific months for recurring items
- Visual calendar interface
- Bulk edit multiple months

### 4. Projection Scenarios
- Create multiple projection scenarios
- "Optimistic", "Realistic", "Pessimistic"
- Compare scenarios side-by-side

### 5. Goal Tracking
- Set savings goals
- Track progress toward goals
- Alert when off-track

### 6. Import/Export
- Import recurring items from CSV
- Export projections as report
- Share projection templates

### 7. Smart Suggestions
- AI suggests recurring items from history
- Predict one-time expenses
- Recommend budget adjustments

## Files Created

1. **`src/services/projectionService.js`**
   - Core projection data management
   - 400+ lines

2. **`src/ui/futureProjectionView.js`**
   - Future projection UI manager
   - Tab switching, modals, updates
   - 350+ lines

3. **`FUTURE_PROJECTION_FEATURE.md`**
   - This documentation

## Files Modified

1. **`src/main.js`**
   - Import ProjectionService and FutureProjectionView
   - Initialize projection service
   - Load projections on startup

2. **`src/services/recurringDetector.js`**
   - Added `type` parameter to detect()
   - Support income pattern detection
   - Filter transactions by type

3. **`src/visualizations/recurringChart.js`**
   - Added expense/income tabs
   - Update to handle {expenses, income} structure
   - Filter by viewType

4. **`index.html`**
   - Added main tabs (Overview/Future)
   - Added future-view section
   - Summary cards, charts containers

5. **`styles/main.css`**
   - Main tab styling
   - Tab view visibility
   - Tab switching animations

6. **`styles/components.css`**
   - Recurring tabs styling
   - Projection form styling
   - Form input/select styling
   - Add button styling

## API Reference

### ProjectionService

#### `addRecurringItem(item)`
Add a recurring income or expense.

```javascript
projectionService.addRecurringItem({
  name: "Salary",
  amount: 3000,
  category: "INCOME",
  frequency: "monthly",
  startDate: new Date(),
  endDate: null,
  isIncome: true
});
```

#### `addOneTimeItem(item)`
Add a one-time future transaction.

```javascript
projectionService.addOneTimeItem({
  name: "Laptop",
  amount: -1500,
  category: "ELECTRONICS",
  date: new Date("2026-03-15"),
  isIncome: false
});
```

#### `generateProjections(startDate, endDate)`
Generate all projections for date range.

```javascript
const projections = projectionService.generateProjections(
  new Date(),
  addMonths(new Date(), 12)
);
```

#### `save()` / `load()`
Persist to localStorage and download JSON backup.

```javascript
await projectionService.save();  // Save + download
await projectionService.load();  // Load on startup
```

### FutureProjectionView

#### `updateProjection()`
Recalculate and update all projections.

```javascript
futureProjectionView.updateProjection();
```

#### `showAddRecurringModal()`
Show modal to add recurring item.

#### `showAddOneTimeModal()`
Show modal to add one-time item.

## Testing Checklist

- [ ] Add recurring income (salary)
- [ ] Add recurring expense (rent)
- [ ] Add one-time income (bonus)
- [ ] Add one-time expense (purchase)
- [ ] Switch between Overview and Future tabs
- [ ] Verify summary cards update
- [ ] Check localStorage persistence
- [ ] Verify JSON backup downloads
- [ ] Reload app and verify data loads
- [ ] Test with different frequencies
- [ ] Test date ranges

## Summary

✅ Two-tab navigation (Overview/Future)
✅ Recurring income detection and display
✅ Projection data service with persistence
✅ Add recurring items (income/expense)
✅ Add one-time items (income/expense)
✅ Modal forms for data entry
✅ Auto-save to localStorage + JSON backup
✅ Auto-load on startup
✅ Summary statistics
✅ Event-driven updates

🚧 Timeline chart projection extension (next step)
🚧 Category chart projections (next step)
🚧 Monthly override UI (next step)

The foundation for financial projections is complete and functional. Users can now add projected income and expenses, and the system persists and loads this data automatically.
