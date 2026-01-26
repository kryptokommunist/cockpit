# 🛩️ Cockpit - Financial Control Center

Your personal financial command center. Analyze and visualize bank transactions from German CSV exports, with automatic categorization, recurring cost detection, budget calculation, future projections, and AI-powered financial insights.

## Features

### Core Features
- ✅ **CSV Import** - Parse German bank CSV exports (semicolon-delimited, German date/number format)
- ✅ **Automatic Categorization** - Rule-based categorization with German merchants (REWE, LIDL, BOLT, etc.)
- ✅ **Manual Override** - Click any category to change it, persisted to localStorage
- ✅ **Transaction List** - Sortable, filterable list with pagination
- ✅ **Recurring Cost Detection** - Automatically detect weekly, monthly, quarterly, and yearly recurring payments
- ✅ **Budget Calculator** - Calculate budget for custom time periods with monthly averages
- ✅ **Interactive Charts** - Timeline, category breakdown, and recurring costs visualizations
- ✅ **Filters** - Date range, category, search, and amount filters
- ✅ **Export** - Export budget reports and filtered transactions

### AI Features (NEW)
- 🤖 **AI Categorization** - Use Claude AI to automatically categorize transactions
- 🤖 **Financial Q&A** - Ask questions about your finances and get intelligent answers
- 🤖 **Spending Insights** - Get AI-powered insights and recommendations
- 🤖 **Smart Analysis** - AI analyzes patterns and provides actionable advice

### Privacy First
- ✅ All processing happens in your browser
- ✅ No data sent to external servers (except optional AI features)
- ✅ Settings stored in localStorage
- ✅ CSV data never leaves your machine

## Tech Stack

- **Framework**: Vite + Vanilla JavaScript (ES6+)
- **Visualization**: Chart.js for financial charts
- **CSV Parsing**: PapaParse library
- **Date Handling**: date-fns for date manipulation
- **AI**: Anthropic Claude API (optional)
- **Storage**: localStorage for settings
- **Docker**: Containerized deployment

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Bank CSV file in German format

### Start the Application

```bash
# Clone or navigate to the project directory
cd /Users/I771869/Documents/Code/cockpit

# Build and start the container
docker-compose up --build

# Application will be available at http://localhost:3000
```

### Stop the Application

```bash
docker-compose down
```

## CSV Format

The application expects German bank CSV exports with the following format:

- **Delimiter**: Semicolon (;)
- **Date Format**: DD.MM.YY (e.g., "25.01.26")
- **Amount Format**: German decimal (comma separator, e.g., "123,45")
- **Structure**: First 4 lines are metadata, line 5 contains headers, data starts at line 6

### Expected Columns
- Buchungstag (Booking Date)
- Wertstellung (Value Date)
- Auftraggeber/Empfänger (Payee/Merchant)
- Verwendungszweck (Purpose)
- Kontonummer (Account Number)
- BLZ (Bank Code)
- Betrag (Amount)
- Währung (Currency)

## AI Configuration

⚠️ **IMPORTANT**: AI features require CORS configuration on your API proxy. See [AI_SETUP.md](./AI_SETUP.md) for detailed instructions.

The AI features use Anthropic's Claude API through a local proxy at `http://127.0.0.1:9988/anthropic/`.

**Configuration Steps:**

1. **Open Settings**: Click ⚙️ button in app header
2. **Enter API Details**:
   - Base URL: `http://127.0.0.1:9988/anthropic/`
   - API Token: Your token from `~/.claude/settings.json`
   - Model: `anthropic--claude-4.5-sonnet`
3. **Configure CORS**: Your API proxy must allow requests from `http://localhost:3000`
4. **Test Connection**: Click "Test Connection" button

**CORS Issue?** The browser blocks requests due to CORS policy. See [AI_SETUP.md](./AI_SETUP.md) for solutions.

### AI Features

1. **AI Categorization**
   - Automatically categorize transactions using Claude AI
   - Batch processing with progress indicator
   - Only categorizes transactions marked as "OTHER"
   - Click "Use AI to Categorize Transactions" button

2. **Financial Q&A**
   - Ask questions like:
     - "How can I save more money?"
     - "What are my biggest expenses?"
     - "Analyze my spending by category"
   - Get personalized insights based on your actual data
   - Conversation history maintained during session

3. **Quick Actions**
   - Pre-defined questions for common queries
   - One-click insights generation
   - Spending analysis
   - Recurring cost summary

## Categories

The following categories are automatically detected:

- **GROCERIES** - REWE, Lidl, ALDI, EDEKA, DM, Rossmann, Penny, Kaufland, Netto
- **TRANSPORT** - BOLT, Uber, Taxi, BVG, DB, Deutsche Bahn, Lime, Tier
- **FOOD_DELIVERY** - HelloFresh, Lieferando, Wolt, Deliveroo, Gorillas
- **SUBSCRIPTIONS** - Spotify, Apple, Microsoft, Netflix, Amazon Prime, Google
- **UTILITIES** - ENTEGA, Vattenfall, Stadtwerke, Telekom, Vodafone, O2
- **INSURANCE** - BARMER, TK, AOK, Allianz, HUK
- **INCOME** - Salary, payments received
- **RENT** - Housing rent
- **CASH** - ATM withdrawals
- **OTHER** - Uncategorized

## Usage Guide

### 1. Upload CSV File
- Click "Choose CSV File" or drag and drop your bank CSV
- Application will parse and display transaction count
- All transactions will be automatically categorized

### 2. View Dashboard
- **Summary Cards**: See totals for transactions, income, expenses, and balance
- **Timeline Chart**: Visualize income/expenses over time (monthly aggregation)
- **Category Chart**: See spending distribution by category (doughnut chart)
- **Recurring Costs**: View detected recurring payments (bar chart)

### 3. Filter Transactions
Use filters to narrow down your view:
- **Date Range**: Select start and end dates
- **Categories**: Multi-select categories to include
- **Search**: Search by merchant name or purpose
- **Amount**: Filter by minimum/maximum amount

### 4. Manage Categories
- Click on any category badge in the transaction list
- Select a new category from the dropdown
- Changes are automatically saved to localStorage
- Charts and summaries update automatically

### 5. Calculate Budget
- Select time period: 3, 6, 12 months, all time, or custom range
- View total and monthly average income/expenses
- See detailed category breakdown with percentages
- Export budget as JSON file

### 6. Use AI Features (Optional)
- **Ask Questions**: Type any financial question in the AI Assistant
- **Quick Actions**: Use pre-defined questions for common insights
- **AI Categorization**: Let Claude automatically categorize uncategorized transactions
- **Get Insights**: Receive personalized spending recommendations

### 7. Export Data
- **Budget Report**: Export detailed budget calculation as JSON
- **Transactions**: Export filtered transactions as CSV
- **Settings**: Export category overrides and custom rules

## Project Structure

```
cockpit/
├── index.html                          # Main HTML entry
├── package.json                        # Dependencies
├── vite.config.js                      # Vite configuration
├── settings.json                       # Default settings
├── Dockerfile                          # Docker container config
├── docker-compose.yml                  # Docker Compose config
├── src/
│   ├── main.js                         # Application initialization
│   ├── parser/
│   │   └── csvParser.js                # CSV parser for German format
│   ├── models/
│   │   └── Transaction.js              # Transaction data model
│   ├── services/
│   │   ├── categorizer.js              # Auto-categorization engine
│   │   ├── recurringDetector.js        # Recurring cost detection
│   │   ├── budgetCalculator.js         # Budget calculations
│   │   ├── settingsManager.js          # Settings persistence
│   │   └── llmService.js               # AI integration (Claude API)
│   ├── visualizations/
│   │   ├── chartManager.js             # Chart.js orchestration
│   │   ├── timelineChart.js            # Timeline visualization
│   │   ├── categoryChart.js            # Category breakdown
│   │   └── recurringChart.js           # Recurring costs view
│   ├── ui/
│   │   ├── fileUpload.js               # CSV file upload handler
│   │   ├── filters.js                  # Date/category filters
│   │   ├── transactionList.js          # Transaction table
│   │   ├── budgetView.js               # Budget calculation UI
│   │   └── financialQA.js              # AI Q&A interface
│   └── utils/
│       ├── dateUtils.js                # German date parsing
│       └── numberUtils.js              # German number parsing
└── styles/
    ├── main.css                        # Global styles
    ├── components.css                  # Component styles
    └── charts.css                      # Chart customizations
```

## Development

### Running Locally (without Docker)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Customizing Categories

Edit `settings.json` to add custom category rules:

```json
{
  "categoryRules": {
    "YOUR_MERCHANT": "CUSTOM_CATEGORY"
  },
  "customCategories": ["DINING", "ENTERTAINMENT"]
}
```

## Algorithms

### Merchant Normalization
Removes location suffixes, transaction IDs, and special characters to group similar merchants:
- `"BOLT.EUO2601221237/Tallinn"` → `"BOLT"`
- `"REWE.Markt.GmbH.Zw/Berlin"` → `"REWE"`

### Recurring Detection
1. Group transactions by normalized merchant
2. Calculate intervals between consecutive transactions
3. Detect patterns: weekly (~7 days), monthly (~30 days), quarterly (~90 days), yearly (~365 days)
4. Verify amount consistency (±15% variance)
5. Require minimum 3 occurrences with 70% interval consistency
6. Calculate confidence score based on consistency

### Budget Calculation
1. Filter transactions by selected date range
2. Calculate total months in period
3. Sum income and expenses by category
4. Calculate monthly averages
5. Include recurring costs separately
6. Compute balance and savings rate

## Performance

- Initial CSV load: < 2 seconds for 1,500 transactions
- Categorization: < 500ms for 1,500 transactions
- Chart rendering: < 1 second per chart
- Filter updates: < 200ms (debounced)
- AI categorization: ~10-20 transactions per second

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design

## Troubleshooting

### CSV Upload Issues
- Ensure file uses semicolon (;) delimiter
- Check date format is DD.MM.YY
- Verify amount format uses comma for decimals
- Make sure first 4 lines contain metadata

### AI Features Not Working
- Check if `~/.claude/settings.json` exists and is configured
- Verify API endpoint is accessible
- Ensure API key is valid
- Check browser console for error messages

### Charts Not Displaying
- Ensure transactions are loaded
- Check browser console for JavaScript errors
- Try refreshing the page
- Clear browser cache

## Future Enhancements

- Multi-account support
- Budget goals and tracking
- Expense categories customization UI
- Transaction tagging and notes
- Multi-currency support
- PDF report generation
- Email notifications for budgets
- Mobile app version

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on the project repository.

## Acknowledgments

- Built with Vite, Chart.js, PapaParse, and date-fns
- AI powered by Anthropic Claude
- Designed for German banking CSV formats
