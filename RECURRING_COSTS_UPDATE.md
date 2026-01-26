# Recurring Costs - Enhanced Filtering

## Changes Made

### 1. Time Period Filtering
The recurring costs chart now intelligently filters transactions by their payment frequency:

- **Weekly**: Shows only if paid in last 2 weeks
- **Monthly**: Shows only if paid in last month
- **Quarterly**: Shows only if paid in last quarter
- **Yearly**: Shows only if paid in last year

This ensures you only see recurring costs that are currently active and relevant.

### 2. Most Recent Amount
Instead of showing average amounts, the chart now displays the **most recent payment amount** for each recurring cost. This is more accurate when amounts change over time (e.g., subscription price increases).

### 3. Show All Option
A new checkbox has been added above the chart: **"Show all recurring costs"**

When **unchecked** (default):
- Only shows recently paid recurring costs
- Labels show: `Merchant (frequency)`
- Example: `Spotify (monthly)`

When **checked**:
- Shows all detected recurring costs regardless of when last paid
- Labels include last payment date: `Merchant (frequency, last: DD.MM.YYYY)`
- Example: `Spotify (monthly, last: 15.01.2026)`

### 4. Enhanced Tooltips
Hovering over a bar shows detailed information:
- Amount (most recent payment)
- Last paid date (when "Show all" is checked)
- Frequency (weekly/monthly/quarterly/yearly)
- Number of occurrences detected
- Next expected payment date

## How It Works

### Default View (Recent Only)
By default, you'll see only recurring costs that were paid in their relevant time period:
- A monthly subscription paid 2 months ago won't show
- A yearly insurance paid 2 years ago won't show
- This keeps the view focused on active recurring costs

### Show All View
Check the "Show all recurring costs" checkbox to see:
- All detected recurring patterns
- When each was last paid
- Useful for finding canceled subscriptions or identifying patterns

## Example Scenarios

### Canceled Subscription
- Default view: Won't show (not paid recently)
- Show all: Will show with old "last paid" date
- **Benefit**: Easy to identify subscriptions you forgot to cancel

### Price Change
- Shows most recent amount, not average
- **Example**: If Netflix increased from €9.99 to €12.99, shows €12.99

### Seasonal Payments
- Yearly insurance paid in December
- January-November: Won't show in default view (paid >1 year ago from current month)
- December-January: Shows in default view (paid in last year)
- **Benefit**: Only see it when it's relevant

## UI Location

The recurring costs chart is in the dashboard, typically showing as a horizontal bar chart with the top 10 recurring costs by amount.

**Look for:**
1. A checkbox above the chart labeled "Show all recurring costs"
2. Chart bars with merchant names and frequencies
3. Hover over bars for detailed tooltips

## Technical Details

### Filter Logic
```javascript
// Monthly example
const oneMonthAgo = subMonths(now, 1);
return lastDate >= oneMonthAgo;

// Quarterly example
const lastQuarterStart = startOfQuarter(subQuarters(now, 1));
return lastDate >= lastQuarterStart;

// Yearly example
const oneYearAgo = subYears(now, 1);
return lastDate >= oneYearAgo;
```

### Amount Selection
```javascript
// Uses most recent transaction amount
const mostRecentAmount = Math.abs(sorted[sorted.length - 1].amount);
```

## Benefits

1. **Cleaner View**: Only see currently active recurring costs by default
2. **Accurate Amounts**: Shows what you're actually paying now, not historical averages
3. **Flexibility**: Toggle to see all patterns when needed
4. **Better Insights**: Identify canceled subscriptions, seasonal payments, and price changes
5. **Time Context**: When showing all, see when each was last paid

## Next Steps

Try it out:
1. Upload your CSV at http://localhost:3000
2. View the recurring costs chart in the dashboard
3. Toggle "Show all recurring costs" to compare views
4. Hover over bars to see detailed information

The filtering helps you focus on what's currently costing you money, while still allowing full visibility when needed.
