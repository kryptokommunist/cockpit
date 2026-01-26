# Recategorization Feature

## Overview

The recategorization feature allows you to create persistent rules that automatically recategorize transactions based on merchant name or merchant + amount combinations. These rules are saved locally and applied automatically when loading transactions.

## Features

### 1. Create Recategorization Rules

When viewing transactions in the category breakdown chart, you can create rules by:

1. **Click on a category** in the doughnut chart to view transactions
2. **Click the ⚙️ button** on any transaction
3. **Choose rule type**:
   - **By Merchant**: Applies to all transactions from this merchant
   - **By Merchant + Amount**: Only applies to transactions with exact merchant and amount match

4. **Select new category** from dropdown
5. **Apply Rule** to save and activate

### 2. Rule Application

Rules are applied in this order:
1. **Merchant + Amount rules** (highest priority - most specific)
2. **Merchant-only rules** (lower priority - broader match)

### 3. Automatic Persistence

Rules are automatically:
- **Saved to localStorage** for instant access
- **Exported to CSV** for backup (downloaded on save)
- **Loaded on app startup** and applied to all transactions

### 4. Settings Management

View and manage all rules in the Settings section:
- **Statistics**: Total rules, rule types, categories targeted
- **Rule list**: All active rules with merchant, amount, and target category
- **Delete rules**: Remove individual rules
- **Export/Import**: Backup and restore rules via CSV

## User Workflow

### Creating a Rule

**Example**: You notice "BOLT" transactions are categorized as "OTHER" but should be "TRANSPORT"

1. Open the dashboard
2. Click on "OTHER" category in the doughnut chart
3. Scroll through transactions and find a BOLT transaction
4. Click the ⚙️ button on the BOLT transaction
5. Modal opens showing transaction details
6. Select "By Merchant" to apply to all BOLT transactions
7. Select "TRANSPORT" from category dropdown
8. Click "Apply Rule"

**Result**:
- Rule created: `BOLT → TRANSPORT`
- All BOLT transactions immediately recategorized
- Charts and views automatically updated
- Rule saved to localStorage and CSV downloaded
- Future BOLT transactions auto-categorized as TRANSPORT

### Creating a Specific Amount Rule

**Example**: Netflix charges €12.99 monthly (subscription) but also €5.99 for one-time rentals (entertainment)

1. Find a €5.99 Netflix transaction
2. Click ⚙️ button
3. Select "By Merchant + Amount"
4. Select "ENTERTAINMENT" category
5. Apply

**Result**:
- Rule created: `NETFLIX + €5.99 → ENTERTAINMENT`
- Only €5.99 Netflix charges categorized as ENTERTAINMENT
- €12.99 charges remain in SUBSCRIPTIONS
- Both rules coexist without conflict

## Technical Implementation

### Architecture

```
User Action
    ↓
RecategorizeModal (UI)
    ↓
RecategorizationService (Business Logic)
    ↓
localStorage + CSV Download (Persistence)
    ↓
Applied to Transactions (Data Layer)
    ↓
Update All Views (UI Refresh)
```

### Files

#### 1. `src/services/recategorizationService.js`
**Purpose**: Core service managing rules

**Key Methods**:
```javascript
addRule(rule)           // Add or update a rule
removeRule(ruleId)      // Delete a rule
applyRules(transactions) // Apply all rules to transactions
findMatchingRule(tx)    // Find rule for a transaction
save()                  // Save to localStorage + CSV
load()                  // Load from localStorage
```

**Rule Structure**:
```javascript
{
  id: "rule_1234567890_abc123",
  merchant: "BOLT",                    // Normalized merchant name
  amount: null,                        // null = all amounts, number = specific
  category: "TRANSPORT",               // Target category
  originalCategory: "OTHER",           // Original (for reference)
  createdAt: "2026-01-26T12:00:00Z"   // Timestamp
}
```

#### 2. `src/ui/recategorizeModal.js`
**Purpose**: Modal UI for creating rules

**Features**:
- Display transaction details
- Radio buttons for rule type selection
- Category dropdown
- Validation and submission

#### 3. `src/ui/settingsView.js`
**Purpose**: Settings UI for managing rules

**Features**:
- Statistics dashboard
- Rule list with delete functionality
- Export/import CSV
- Real-time updates

#### 4. `src/visualizations/categoryChart.js`
**Purpose**: Updated to show recategorize button

**Changes**:
- Added ⚙️ button to each transaction in category list
- Dispatches `'show-recategorize-modal'` event
- Triggers modal display

### Data Flow

#### Creating a Rule

```
1. User clicks ⚙️ on transaction
   ↓
2. Event: 'show-recategorize-modal' dispatched
   ↓
3. Main.js catches event, shows modal
   ↓
4. User selects options, clicks "Apply Rule"
   ↓
5. RecategorizationService.addRule(rule)
   ↓
6. Save to localStorage
   ↓
7. Generate and download CSV
   ↓
8. Event: 'recategorization-rules-changed' dispatched
   ↓
9. Main.js catches event, reapplies all rules
   ↓
10. All views updated with new categorizations
```

#### Loading on Startup

```
1. App initializes
   ↓
2. RecategorizationService.load()
   ↓
3. Read from localStorage
   ↓
4. Rules available in memory
   ↓
5. User uploads CSV
   ↓
6. Transactions parsed
   ↓
7. Categorizer categorizes (default)
   ↓
8. AI categorization applied (if saved)
   ↓
9. Recategorization rules applied (highest priority)
   ↓
10. Final categories displayed
```

### Priority Order

When multiple categorization sources exist:

1. **Recategorization Rules** (highest priority)
   - User-defined, most specific
   - Overrides everything else

2. **AI Categorization** (if saved)
   - From previous AI analysis
   - Applied before recategorization

3. **Manual Category Override** (transaction-specific)
   - Individual transaction changes
   - Not rule-based

4. **Default Categorizer** (fallback)
   - Built-in keyword matching
   - Initial categorization

### Storage Format

#### localStorage Key: `recategorization-rules`

```json
[
  {
    "id": "rule_1706270400000_abc123",
    "merchant": "BOLT",
    "amount": null,
    "category": "TRANSPORT",
    "originalCategory": "OTHER",
    "createdAt": "2026-01-26T12:00:00.000Z"
  },
  {
    "id": "rule_1706270450000_def456",
    "merchant": "NETFLIX",
    "amount": 5.99,
    "category": "ENTERTAINMENT",
    "originalCategory": "SUBSCRIPTIONS",
    "createdAt": "2026-01-26T12:05:00.000Z"
  }
]
```

#### CSV Export: `recategorization-rules.csv`

```csv
ID,Merchant,Amount,Category,Original Category,Created At
"rule_1706270400000_abc123","BOLT","ALL","TRANSPORT","OTHER","2026-01-26T12:00:00.000Z"
"rule_1706270450000_def456","NETFLIX","5.99","ENTERTAINMENT","SUBSCRIPTIONS","2026-01-26T12:05:00.000Z"
```

## Settings View

### Statistics Cards

- **Total Rules**: Count of all active rules
- **Merchant Rules**: Rules matching by merchant only
- **Merchant + Amount Rules**: Rules matching merchant and amount
- **Categories Targeted**: Number of unique categories in rules

### Actions

- **Export Rules (CSV)**: Download current rules as CSV backup
- **Import Rules (CSV)**: Upload CSV to restore rules
  - Replaces existing rules
  - Triggers reapplication to transactions

### Rules List

Each rule displayed with:
- **Merchant name** (normalized)
- **Amount** (specific or "All amounts")
- **Target category** (highlighted)
- **Original category** (reference)
- **Delete button** (🗑️)

## Use Cases

### 1. Fix Miscategorized Merchants

**Problem**: "DM DROGERIE" categorized as GROCERIES but should be HEALTH

**Solution**:
1. Find DM transaction in GROCERIES category
2. Create rule: DM → HEALTH (by merchant)
3. All DM transactions now in HEALTH category

### 2. Split Merchant by Amount

**Problem**: Amazon charges for subscriptions (€7.99) and shopping (various)

**Solution**:
1. Create rule: AMAZON + €7.99 → SUBSCRIPTIONS
2. All other AMAZON amounts remain in SHOPPING
3. Subscription charges correctly tracked

### 3. Consolidate Categories

**Problem**: Multiple food delivery services should be in one category

**Solution**:
1. Create rules:
   - LIEFERANDO → FOOD_DELIVERY
   - WOLT → FOOD_DELIVERY
   - DELIVEROO → FOOD_DELIVERY
2. All food delivery expenses consolidated

### 4. Handle Edge Cases

**Problem**: Grocery store gift card purchase (€50) shouldn't count as groceries

**Solution**:
1. Create rule: REWE + €50.00 → GIFTS
2. Only that specific amount recategorized
3. Regular grocery purchases unaffected

## Best Practices

### Rule Creation

1. **Start broad, refine later**
   - Create merchant-only rules first
   - Add specific amount rules as needed

2. **Use normalized merchant names**
   - System shows normalized name in modal
   - Rules match against normalized names

3. **Test after creating**
   - Check statistics to verify count
   - Review affected transactions in category breakdown

### Rule Management

1. **Export regularly**
   - CSV downloaded on every save
   - Keep backups before major changes

2. **Review periodically**
   - Check settings view for outdated rules
   - Delete rules for merchants no longer used

3. **Document special cases**
   - Add notes for complex amount-specific rules
   - Keep track of why rules were created

### Performance

1. **Rule count**
   - 100+ rules: No performance impact
   - 1000+ rules: Slight delay on load (< 1 second)

2. **Application speed**
   - Rules applied in single pass
   - O(n*m) where n=transactions, m=rules
   - Optimized with early exit for exact matches

## Troubleshooting

### Rules Not Applying

**Symptom**: Created rule but transactions not recategorized

**Checks**:
1. Verify merchant name matches normalized version
2. Check if amount-specific rule matches exactly
3. Refresh page to reload rules
4. Check browser console for errors

**Solution**:
- Delete and recreate rule
- Verify localStorage not cleared
- Check if more specific rule exists (takes priority)

### Rule Conflicts

**Symptom**: Transaction categorized unexpectedly

**Cause**: Multiple rules could match

**Resolution**:
1. Check Settings → Rules List
2. More specific rules (merchant+amount) take priority
3. Delete conflicting rules if needed

### CSV Import Fails

**Symptom**: Error importing CSV file

**Causes**:
- Invalid CSV format
- Missing required columns
- Malformed data

**Solution**:
- Use exported CSV as template
- Ensure columns: ID, Merchant, Amount, Category, Original Category, Created At
- Amounts: Use "ALL" for merchant-only or decimal number

### Lost Rules

**Symptom**: Rules disappeared after reload

**Cause**: localStorage cleared

**Solution**:
1. Import from last CSV export
2. Or recreate rules (CSV serves as backup)

## API Reference

### RecategorizationService

#### `addRule(rule)`
Add or update a recategorization rule.

**Parameters**:
- `rule.merchant` (string): Normalized merchant name
- `rule.amount` (number|null): Specific amount or null for all
- `rule.category` (string): Target category
- `rule.originalCategory` (string): Original category (optional)

**Returns**: Rule object with generated ID

**Example**:
```javascript
recategorizationService.addRule({
  merchant: "BOLT",
  amount: null,
  category: "TRANSPORT",
  originalCategory: "OTHER"
});
```

#### `removeRule(ruleId)`
Delete a rule by ID.

**Parameters**:
- `ruleId` (string): Rule ID

**Returns**: Deleted rule object or null

#### `applyRules(transactions)`
Apply all rules to transaction array.

**Parameters**:
- `transactions` (Array): Array of Transaction objects

**Returns**: Number of transactions recategorized

**Side Effects**:
- Modifies transaction.category
- Sets transaction.recategorized = true
- Sets transaction.recategorizationRule = ruleId

#### `findMatchingRule(transaction)`
Find matching rule for a transaction.

**Parameters**:
- `transaction` (Object): Transaction object

**Returns**: Matching rule object or null

**Logic**:
1. Check merchant + amount exact match
2. If not found, check merchant-only match
3. Return first match or null

#### `save()`
Save rules to localStorage and download CSV.

**Returns**: Promise

**Side Effects**:
- Updates localStorage
- Triggers CSV download

#### `load()`
Load rules from localStorage.

**Returns**: Promise resolving to rules array

### Events

#### `show-recategorize-modal`
Triggered when user clicks recategorize button.

**Detail**:
```javascript
{
  transaction: Transaction  // Transaction object
}
```

**Usage**:
```javascript
window.addEventListener('show-recategorize-modal', (event) => {
  const { transaction } = event.detail;
  modal.show(transaction);
});
```

#### `recategorization-rules-changed`
Triggered after rules are added, removed, or imported.

**Detail**: None

**Usage**:
```javascript
window.addEventListener('recategorization-rules-changed', () => {
  // Reapply rules to transactions
  recategorizationService.applyRules(transactions);
  // Update views
  updateAllViews();
});
```

## Future Enhancements

### Planned Features

1. **Rule Templates**
   - Pre-built rule sets for common scenarios
   - One-click category consolidation

2. **Smart Suggestions**
   - AI-powered rule recommendations
   - "Did you mean to recategorize similar transactions?"

3. **Batch Operations**
   - Select multiple transactions
   - Create rules for all at once

4. **Rule Analytics**
   - Impact analysis: "This rule affected 45 transactions"
   - Savings tracking per category

5. **Cloud Sync**
   - Sync rules across devices
   - Requires backend implementation

### Advanced Features

1. **Conditional Rules**
   - Date-based: "REWE before 2025 → GROCERIES"
   - Amount ranges: "BOLT > €20 → TRANSPORT_LONG_DISTANCE"

2. **Regular Expressions**
   - Pattern matching: "BOLT.*Tallinn → INTERNATIONAL_TRAVEL"

3. **Category Hierarchies**
   - Parent categories: FOOD → GROCERIES, RESTAURANTS
   - Drill-down analysis

## Summary

✅ Click-based recategorization from category breakdown
✅ Merchant-only or merchant+amount rules
✅ Automatic persistence to localStorage + CSV
✅ Settings view for rule management
✅ Export/import functionality
✅ Real-time application to all views
✅ Priority handling for specific rules
✅ Statistics and analytics
✅ Clean, intuitive UI

The recategorization feature provides powerful, flexible transaction categorization while maintaining simplicity and data persistence.
