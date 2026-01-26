# AI Category Persistence

## Overview

When Claude AI discovers new transaction categories (like "ENTERTAINMENT", "HEALTHCARE", "DINING"), they are automatically saved and loaded on app restart. This ensures that:
1. Categories discovered once are available for future categorizations
2. Visualizations use consistent colors for AI-discovered categories
3. No need to re-discover categories each session

## How It Works

### 1. Category Discovery

When you run AI categorization:
```
User: "Categorize all uncategorized transactions"
↓
Claude analyzes transactions
↓
Discovers new categories: ["ENTERTAINMENT", "HEALTHCARE", "DINING"]
↓
Applies categories to transactions
```

### 2. Automatic Persistence

The app automatically saves discovered categories:

```javascript
// In financialQA.js - After AI categorization completes
window.dispatchEvent(new CustomEvent('new-categories-discovered', {
  detail: { newCategories: ["ENTERTAINMENT", "HEALTHCARE"] }
}));
```

```javascript
// In main.js - Event listener saves to settings
window.addEventListener('new-categories-discovered', async (event) => {
  const { newCategories } = event.detail;

  // Add to categorizer (in-memory)
  this.categorizer.addCategories(newCategories);

  // Save to localStorage
  if (!this.settingsManager.settings.discoveredCategories) {
    this.settingsManager.settings.discoveredCategories = [];
  }
  newCategories.forEach(cat => {
    if (!this.settingsManager.settings.discoveredCategories.includes(cat)) {
      this.settingsManager.settings.discoveredCategories.push(cat);
    }
  });
  await this.settingsManager.save();
});
```

### 3. Loading on Restart

On app initialization:

```javascript
// In main.js - init()
await this.settingsManager.load();

// Restore discovered categories
if (this.settingsManager.settings.discoveredCategories) {
  this.categorizer.addCategories(this.settingsManager.settings.discoveredCategories);
  console.log('Restored discovered categories:', this.settingsManager.settings.discoveredCategories);
}
```

## Storage Location

**localStorage Key**: `bankAnalyzerSettings`

**Structure**:
```json
{
  "version": "1.0",
  "categoryOverrides": {
    "486022454562030": "TRANSPORT"
  },
  "customCategories": [],
  "categoryRules": {},
  "filters": {},
  "discoveredCategories": [
    "ENTERTAINMENT",
    "HEALTHCARE",
    "DINING"
  ]
}
```

## Color Assignment

AI-discovered categories automatically get distinct colors:

```javascript
// In categorizer.js
generateColorForCategory(category) {
  const dynamicColors = [
    '#E91E63', '#673AB7', '#3F51B5', '#009688',
    '#4CAF50', '#CDDC39', '#FFC107', '#FF5722',
    '#795548', '#607D8B', '#9C27B0', '#00BCD4'
  ];

  // Generate consistent hash from category name
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Pick color based on hash
  const colorIndex = Math.abs(hash) % dynamicColors.length;
  this.dynamicCategoryColors[category] = dynamicColors[colorIndex];
}
```

**Benefits**:
- Same category always gets same color (hash-based)
- Visually distinct from built-in categories
- Works in charts and UI elements

## Complete Flow

### First Session
```
1. User runs AI categorization
2. AI discovers: ENTERTAINMENT, HEALTHCARE, DINING
3. Categories applied to transactions
4. Event dispatched: 'new-categories-discovered'
5. Categories saved to localStorage under 'discoveredCategories'
6. Colors generated for each category
7. Charts/UI use new categories with colors
```

### Subsequent Sessions
```
1. App starts
2. settingsManager.load() reads localStorage
3. Discovers: discoveredCategories = ["ENTERTAINMENT", "HEALTHCARE", "DINING"]
4. categorizer.addCategories() adds them to in-memory categories
5. Colors regenerated (consistent via hash)
6. Categories available for:
   - Future AI categorizations
   - Manual category overrides
   - Visualization in charts
   - Transaction filtering
```

## Verification

To verify categories are persisted:

### Check localStorage
Open browser DevTools → Application → Local Storage → `http://localhost:5173`
Look for key: `bankAnalyzerSettings`
Verify: `discoveredCategories` array contains your categories

### Check Console Logs
On app start, you should see:
```
Settings loaded from localStorage
Restored discovered categories: ["ENTERTAINMENT", "HEALTHCARE", "DINING"]
[Categorizer] Added new category: ENTERTAINMENT
[Categorizer] Added new category: HEALTHCARE
[Categorizer] Added new category: DINING
```

### Check Categorizer
In browser console:
```javascript
// Get app instance
const app = window.app; // If exposed

// Check categories
console.log(app.categorizer.categories);
// Should show: ENTERTAINMENT: [], HEALTHCARE: [], DINING: []

// Check colors
console.log(app.categorizer.getCategoryColor('ENTERTAINMENT'));
// Should show: "#E91E63" or similar
```

## Edge Cases

### Category Already Exists
If AI "discovers" a category that already exists (e.g., GROCERIES):
- Event still dispatched
- Categorizer checks: `if (!this.categories[category])`
- Skips adding if already present
- No duplicate in discoveredCategories

### Settings Reset
If user clears localStorage:
- discoveredCategories lost
- Built-in categories still work (hard-coded)
- AI-discovered categories need to be re-discovered
- Re-categorization will re-save them

### Settings File vs localStorage
Priority:
1. Fetch `/settings.json` (if exists)
2. Load from localStorage
3. Merge (localStorage overwrites file settings)

This allows:
- Pre-seeding categories via settings.json
- Runtime changes saved to localStorage
- localStorage persists across reloads

## Benefits

**For Users**:
- No need to re-run AI categorization every session
- Consistent category names across sessions
- Faster app startup (categories already loaded)

**For Performance**:
- Reduces API calls (no re-categorization)
- Faster transaction loading
- Instant color assignment

**For Data Integrity**:
- Categories consistent across reloads
- Historical data maintains meaning
- No category drift

## Example Session

### Day 1
```
User: "Categorize all my uncategorized transactions"
AI: Found 500 uncategorized transactions
AI: Discovered new categories: ENTERTAINMENT, HEALTHCARE
AI: Applied categories
[System]: Saved ENTERTAINMENT, HEALTHCARE to discoveredCategories
```

### Day 2 (App Restart)
```
[System]: Loading settings from localStorage
[System]: Restored discovered categories: ["ENTERTAINMENT", "HEALTHCARE"]
[System]: Added ENTERTAINMENT with color #E91E63
[System]: Added HEALTHCARE with color #673AB7

User uploads new CSV with 200 new transactions
AI categorizes using existing categories + discovers DINING
AI: Applied ENTERTAINMENT to 50 transactions
AI: Applied HEALTHCARE to 30 transactions
AI: Discovered new category: DINING (20 transactions)
[System]: Saved DINING to discoveredCategories
```

### Day 3 (App Restart)
```
[System]: Restored discovered categories: ["ENTERTAINMENT", "HEALTHCARE", "DINING"]
[System]: All 3 categories available
User can filter by ENTERTAINMENT, HEALTHCARE, DINING
Charts show consistent colors
```

## Files Involved

1. **`src/services/settingsManager.js`**
   - Loads/saves settings to localStorage
   - Contains `discoveredCategories` array
   - Updated `load()` to call `loadFromLocalStorage()`

2. **`src/services/categorizer.js`**
   - `addCategories()` - Adds new categories to in-memory map
   - `generateColorForCategory()` - Creates consistent colors
   - `getCategoryColor()` - Returns color (static or dynamic)

3. **`src/main.js`**
   - Initialization: Loads settings, restores categories
   - Event listener: Saves newly discovered categories
   - Auto-load: Applies categories to transactions

4. **`src/ui/financialQA.js`**
   - Dispatches `'new-categories-discovered'` event after AI categorization
   - Passes new categories to main app

## Technical Implementation Details

### Why localStorage?
- **Browser-only**: No backend needed (client-side app)
- **Fast**: Synchronous read/write
- **Persistent**: Survives page reloads
- **Simple**: No database setup
- **Privacy**: Data stays local

### Why Not File System?
- **Browser limitations**: Can't write to arbitrary files without user interaction
- **File System Access API**: Requires user permission per write
- **localStorage is better**: For browser apps, localStorage is the standard

### Why Event-Driven?
- **Decoupling**: financialQA doesn't need direct reference to main app
- **Flexibility**: Other components can listen to same event
- **Clean**: Follows browser event model
- **Extensibility**: Easy to add more listeners

## Troubleshooting

### Categories Not Persisting

**Problem**: AI-discovered categories disappear on reload

**Check**:
1. Open DevTools → Console
2. Look for: "Restored discovered categories"
3. If empty, check localStorage
4. Run: `localStorage.getItem('bankAnalyzerSettings')`
5. Verify `discoveredCategories` array exists

**Fix**:
- Re-run AI categorization
- Check for console errors during save
- Ensure settingsManager.save() is called

### Colors Not Consistent

**Problem**: Same category shows different colors

**Cause**: Hash function uses category name, so spelling matters

**Check**:
- "ENTERTAINMENT" vs "Entertainment" = different colors
- AI should use consistent uppercase
- Verify with: `console.log(app.categorizer.dynamicCategoryColors)`

### Categories Not Used in New Categorizations

**Problem**: Newly uploaded transactions don't use discovered categories

**Cause**: AI independently categorizes each time

**Solution**:
- AI makes its own decisions based on transaction content
- Discovered categories are available but not enforced
- Use conversation context to remind AI of existing categories

Example prompt:
```
User: "Categorize new transactions. Use these existing categories:
ENTERTAINMENT, HEALTHCARE, DINING. Only create new categories if needed."
```

## Future Enhancements

Potential improvements:
1. **Export/Import**: Download discoveredCategories as JSON
2. **Category Management UI**: View/edit/delete discovered categories
3. **Category Merging**: Combine similar categories (FOOD vs DINING)
4. **Category Rules**: Auto-apply categories based on merchant patterns
5. **Cloud Sync**: Sync categories across devices (requires backend)
6. **Category Descriptions**: Add metadata to categories
7. **Color Picker**: Let users choose category colors

## Summary

✅ AI-discovered categories automatically persist to localStorage
✅ Categories loaded on app restart
✅ Consistent colors generated via hash function
✅ No re-discovery needed across sessions
✅ Event-driven architecture for clean separation
✅ Works seamlessly with existing categorization system
