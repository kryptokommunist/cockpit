import { LLMService } from '../services/llmService.js';

/**
 * Financial Q&A UI Component
 * Allows users to ask questions about their finances using AI
 */
export class FinancialQA {
  constructor(container, transactions, budgetCalculator, recurringDetector, categorizationStorage) {
    this.container = container;
    this.transactions = transactions;
    this.budgetCalculator = budgetCalculator;
    this.recurringDetector = recurringDetector;
    this.categorizationStorage = categorizationStorage;
    this.llmService = new LLMService();
    this.conversationHistory = [];

    this.render();
    this.checkLLMAvailability();
  }

  async checkLLMAvailability() {
    try {
      console.log('[FinancialQA] Checking LLM availability...');
      const available = await this.llmService.checkAvailability();
      console.log('[FinancialQA] LLM available:', available);
      if (!available) {
        this.showWarning('AI service is not available. Check if backend is running on port 3001.');
      } else {
        console.log('[FinancialQA] AI service is ready!');
      }
    } catch (error) {
      console.error('[FinancialQA] Error checking availability:', error);
      this.showWarning(`AI service error: ${error.message}`);
    }
  }

  update(transactions) {
    this.transactions = transactions;
  }

  render() {
    this.container.innerHTML = `
      <div class="financial-qa">
        <div class="qa-header">
          <h3>AI Financial Assistant</h3>
          <p class="qa-subtitle">Ask questions about your finances or get insights</p>
        </div>

        <div class="qa-quick-actions">
          <h4>Quick Actions:</h4>
          <div class="quick-buttons">
            <button class="btn-quick" data-action="current-month">What is my budget this month?</button>
            <button class="btn-quick" data-action="savings">How can I save more?</button>
            <button class="btn-quick" data-action="categories">What should I spend less on?</button>
            <button class="btn-quick" data-action="compare">Compare this month to last month</button>
          </div>
        </div>

        <div class="qa-tabs">
          <button class="qa-tab active" data-tab="chat">Chat</button>
          <button class="qa-tab" data-tab="debug">Debug</button>
          <div class="qa-history-indicator">
            <span id="qa-history-count">0 messages</span> in context
            <button id="clear-context-btn" class="btn-clear-context" title="Clear conversation context">×</button>
          </div>
        </div>

        <div class="qa-tab-content">
          <div class="qa-tab-panel active" id="qa-tab-chat">
            <div class="qa-conversation" id="qa-conversation">
              <div class="qa-welcome">
                <p><strong>Welcome to your AI Financial Assistant!</strong></p>
                <p>I can analyze your transactions and answer questions like:</p>
                <ul style="text-align: left; margin: 1rem auto; max-width: 400px;">
                  <li>"What is my budget for January 2026?"</li>
                  <li>"How can I balance my budget?"</li>
                  <li>"What should I spend less on?"</li>
                  <li>"Compare this month to last month"</li>
                  <li>"What are my biggest expenses?"</li>
                </ul>
                <p>Try the quick action buttons or ask your own question!</p>
              </div>
            </div>
          </div>

          <div class="qa-tab-panel" id="qa-tab-debug">
            <div class="qa-debug" id="qa-debug">
              <div class="debug-welcome">
                <p>Debug view - Shows all agent interactions</p>
                <p>Tool calls, inputs, and outputs will appear here as the agent works.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="qa-input-container">
          <input type="text" id="qa-input" placeholder="Ask a question about your finances..." />
          <button id="qa-send-btn" class="btn btn-primary">Send</button>
        </div>

        <div class="qa-ai-categorize">
          <button id="ai-categorize-btn" class="btn btn-secondary">
            Categorize All Transactions with AI
          </button>
          <div id="ai-categorize-progress" class="hidden">
            <p>Categorizing transactions with AI...</p>
            <div class="progress-bar">
              <div class="progress-fill" id="categorize-progress-fill"></div>
            </div>
            <p class="progress-text" id="categorize-progress-text">0 / 0</p>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const input = this.container.querySelector('#qa-input');
    const sendBtn = this.container.querySelector('#qa-send-btn');
    const quickButtons = this.container.querySelectorAll('.btn-quick');
    const aiCategorizeBtn = this.container.querySelector('#ai-categorize-btn');
    const tabs = this.container.querySelectorAll('.qa-tab');

    sendBtn.addEventListener('click', () => this.handleSendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      }
    });

    quickButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });

    aiCategorizeBtn.addEventListener('click', () => this.handleAICategorization());

    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Clear context button
    const clearContextBtn = this.container.querySelector('#clear-context-btn');
    if (clearContextBtn) {
      clearContextBtn.addEventListener('click', () => this.clearContext());
    }
  }

  clearContext() {
    if (this.conversationHistory.length === 0) return;

    if (confirm(`Clear conversation context? (${this.conversationHistory.length} messages will be removed)`)) {
      this.conversationHistory = [];
      this.updateHistoryIndicator();
      console.log('[FinancialQA] Conversation context cleared');

      // Show notification in chat
      const conversation = this.container.querySelector('#qa-conversation');
      const notice = document.createElement('div');
      notice.className = 'qa-context-notice';
      notice.textContent = '🔄 Conversation context cleared. Starting fresh conversation.';
      conversation.appendChild(notice);
      conversation.scrollTop = conversation.scrollHeight;
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    const tabs = this.container.querySelectorAll('.qa-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab panels
    const panels = this.container.querySelectorAll('.qa-tab-panel');
    panels.forEach(panel => {
      if (panel.id === `qa-tab-${tabName}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  async handleSendMessage() {
    const input = this.container.querySelector('#qa-input');
    const question = input.value.trim();

    if (!question) return;

    // Clear input
    input.value = '';

    // Add user message to conversation
    this.addMessage('user', question);
    this.addDebugEntry('user', question);

    // Create streaming message container
    const streamingId = this.addStreamingMessage();
    const thinkingId = this.addThinkingIndicator();

    try {
      // Get budget and recurring data
      const budget = this.budgetCalculator.calculate(this.transactions, 'all');
      const recurring = this.recurringDetector.detect(this.transactions);

      // Get AI response with streaming and conversation history
      await this.llmService.answerFinancialQuestion(
        question,
        this.transactions,
        budget,
        recurring,
        (toolName, toolInput, toolResult) => {
          this.updateThinkingIndicator(thinkingId, toolName);
          this.addDebugEntry('tool', toolName, toolInput, toolResult);
        },
        (chunk) => {
          // Stream text chunks
          this.appendToStreamingMessage(streamingId, chunk);
        },
        this.conversationHistory
      );

      // Remove thinking indicator
      this.removeMessage(thinkingId);

      // Finalize streaming message
      this.finalizeStreamingMessage(streamingId);

      // Save to history with pre-computed summary
      const finalText = this.getMessageContent(streamingId);
      const summary = this.llmService.summarizeResponse(finalText);

      this.conversationHistory.push({
        question,
        response: summary,  // Store summary instead of full response
        fullResponse: finalText,  // Keep full response for display
        timestamp: new Date()
      });

      console.log(`[FinancialQA] Added to history. Summary: "${summary.substring(0, 100)}..."`);

      // Update history indicator
      this.updateHistoryIndicator();

      this.addDebugEntry('assistant', finalText);
    } catch (error) {
      this.removeMessage(thinkingId);
      this.removeMessage(streamingId);
      this.addMessage('assistant', `Sorry, I encountered an error: ${error.message}`, false, true);
      this.addDebugEntry('error', error.message);
    }
  }

  addThinkingIndicator() {
    const conversation = this.container.querySelector('#qa-conversation');
    const thinkingId = `thinking-${Date.now()}`;

    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'qa-thinking';
    thinkingDiv.id = thinkingId;
    thinkingDiv.innerHTML = `
      <div class="thinking-header">
        <span class="thinking-icon">🤔</span>
        <span class="thinking-text">Analyzing your data...</span>
      </div>
      <div class="thinking-steps" id="${thinkingId}-steps"></div>
    `;

    conversation.appendChild(thinkingDiv);
    conversation.scrollTop = conversation.scrollHeight;

    return thinkingId;
  }

  updateThinkingIndicator(thinkingId, toolName) {
    const stepsContainer = this.container.querySelector(`#${thinkingId}-steps`);
    if (!stepsContainer) return;

    const toolLabels = {
      'get_budget_for_month': '📊 Getting budget data',
      'get_spending_by_category': '💰 Analyzing spending by category',
      'compare_periods': '📈 Comparing time periods',
      'get_transactions_by_category': '🔍 Examining individual transactions',
      'get_transactions_for_month': '📝 Retrieving transaction list',
      'search_transactions': '🔎 Searching transactions'
    };

    const label = toolLabels[toolName] || `🔧 Using ${toolName}`;

    const stepDiv = document.createElement('div');
    stepDiv.className = 'thinking-step';
    stepDiv.innerHTML = `<span class="step-icon">✓</span> ${label}`;

    stepsContainer.appendChild(stepDiv);

    // Scroll to bottom
    const conversation = this.container.querySelector('#qa-conversation');
    conversation.scrollTop = conversation.scrollHeight;
  }

  addStreamingMessage() {
    const conversation = this.container.querySelector('#qa-conversation');
    const messageId = `msg-${Date.now()}-${Math.random().toString().replace('.', '')}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'qa-message qa-message-assistant qa-message-streaming';
    messageDiv.id = messageId;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'qa-message-content';
    contentDiv.id = `${messageId}-content`;

    const cursorSpan = document.createElement('span');
    cursorSpan.className = 'streaming-cursor';
    cursorSpan.textContent = '▋';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'qa-message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();

    contentDiv.appendChild(cursorSpan);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);

    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;

    return messageId;
  }

  appendToStreamingMessage(messageId, chunk) {
    const contentDiv = this.container.querySelector(`#${messageId}-content`);
    if (!contentDiv) return;

    const cursor = contentDiv.querySelector('.streaming-cursor');

    // Create a text node for the chunk
    const textNode = document.createTextNode(chunk);

    // Insert before cursor
    if (cursor) {
      contentDiv.insertBefore(textNode, cursor);
    } else {
      contentDiv.appendChild(textNode);
    }

    // Scroll to bottom
    const conversation = this.container.querySelector('#qa-conversation');
    conversation.scrollTop = conversation.scrollHeight;
  }

  finalizeStreamingMessage(messageId) {
    const messageDiv = this.container.querySelector(`#${messageId}`);
    const contentDiv = this.container.querySelector(`#${messageId}-content`);
    if (!messageDiv || !contentDiv) return;

    // Remove streaming class and cursor
    messageDiv.classList.remove('qa-message-streaming');
    const cursor = contentDiv.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();

    // Get the text content
    const text = contentDiv.textContent;

    // Re-render with markdown
    contentDiv.innerHTML = this.renderMarkdown(text);
  }

  getMessageContent(messageId) {
    const contentDiv = this.container.querySelector(`#${messageId}-content`);
    if (!contentDiv) return '';

    return contentDiv.textContent.replace('▋', '').trim();
  }

  addDebugEntry(type, content, input = null, result = null) {
    const debugContainer = this.container.querySelector('#qa-debug');
    if (!debugContainer) return;

    const entryDiv = document.createElement('div');
    entryDiv.className = `debug-entry debug-entry-${type}`;

    const timestamp = new Date().toLocaleTimeString();

    switch (type) {
      case 'user':
        entryDiv.innerHTML = `
          <div class="debug-header">
            <span class="debug-badge debug-badge-user">USER</span>
            <span class="debug-time">${timestamp}</span>
          </div>
          <div class="debug-content">${this.escapeHtml(content)}</div>
        `;
        break;

      case 'assistant':
        entryDiv.innerHTML = `
          <div class="debug-header">
            <span class="debug-badge debug-badge-assistant">ASSISTANT</span>
            <span class="debug-time">${timestamp}</span>
          </div>
          <div class="debug-content">${this.escapeHtml(content.substring(0, 500))}${content.length > 500 ? '...' : ''}</div>
        `;
        break;

      case 'tool':
        entryDiv.innerHTML = `
          <div class="debug-header">
            <span class="debug-badge debug-badge-tool">TOOL</span>
            <span class="debug-tool-name">${content}</span>
            <span class="debug-time">${timestamp}</span>
          </div>
          ${input ? `<div class="debug-section">
            <strong>Input:</strong>
            <pre><code>${this.escapeHtml(JSON.stringify(input, null, 2))}</code></pre>
          </div>` : ''}
          ${result ? `<div class="debug-section">
            <strong>Result:</strong>
            <pre><code>${this.escapeHtml(JSON.stringify(result, null, 2).substring(0, 1000))}${JSON.stringify(result).length > 1000 ? '...' : ''}</code></pre>
          </div>` : ''}
        `;
        break;

      case 'error':
        entryDiv.innerHTML = `
          <div class="debug-header">
            <span class="debug-badge debug-badge-error">ERROR</span>
            <span class="debug-time">${timestamp}</span>
          </div>
          <div class="debug-content debug-error">${this.escapeHtml(content)}</div>
        `;
        break;
    }

    debugContainer.appendChild(entryDiv);

    // Auto-scroll debug view
    debugContainer.scrollTop = debugContainer.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateHistoryIndicator() {
    const indicator = this.container.querySelector('#qa-history-count');
    if (!indicator) return;

    const count = this.conversationHistory.length;
    if (count === 0) {
      indicator.textContent = '0 messages';
    } else if (count === 1) {
      indicator.textContent = '1 message';
    } else {
      indicator.textContent = `${count} messages`;
    }
  }

  async handleQuickAction(action) {
    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const questions = {
      'current-month': `What is my budget for ${currentMonth}? How can I balance it?`,
      savings: 'How can I save more money? What should I cut back on?',
      categories: 'What categories am I spending the most on? What should I spend less on to save money?',
      compare: `Compare my budget for ${currentMonth} with ${lastMonth}. What changed?`
    };

    const question = questions[action];
    if (question) {
      const input = this.container.querySelector('#qa-input');
      input.value = question;
      await this.handleSendMessage();
    }
  }

  async handleAICategorization() {
    console.log('[FinancialQA] AI Categorization started');
    const btn = this.container.querySelector('#ai-categorize-btn');
    const progressContainer = this.container.querySelector('#ai-categorize-progress');
    const progressFill = this.container.querySelector('#categorize-progress-fill');
    const progressText = this.container.querySelector('#categorize-progress-text');

    // Disable button and show progress
    btn.disabled = true;
    btn.textContent = 'Categorizing...';
    progressContainer.classList.remove('hidden');

    try {
      // Process all transactions (will recategorize already categorized ones)
      const transactionsToCategorize = this.transactions;
      console.log('[FinancialQA] Found', transactionsToCategorize.length, 'transactions to categorize');

      if (transactionsToCategorize.length === 0) {
        alert('No transactions to categorize!');
        // Reset UI before returning
        btn.disabled = false;
        btn.textContent = 'Use AI to Categorize Transactions';
        progressContainer.classList.add('hidden');
        return;
      }

      // Get existing categories from transactions
      const existingCategories = [...new Set(this.transactions.map(t => t.category))].filter(Boolean);
      console.log('[FinancialQA] Existing categories:', existingCategories);

      // Initialize progress display
      progressText.textContent = `Starting batch categorization...`;
      progressFill.style.width = '0%';
      progressFill.style.animation = 'none';

      const onProgress = (current, total, batch, totalBatches) => {
        console.log('[FinancialQA] Progress: Batch', batch, '/', totalBatches, '-', current, '/', total);
        const percentage = (current / total) * 100;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `Batch ${batch}/${totalBatches}: ${current} / ${total} transactions (${percentage.toFixed(0)}%)`;
      };

      console.log('[FinancialQA] Calling batchCategorize with existing categories...');

      // Batch categorize with existing categories
      const { results, newCategories } = await this.llmService.batchCategorize(
        transactionsToCategorize,
        existingCategories,
        onProgress
      );
      console.log('[FinancialQA] Got results:', results.size, 'categorized');
      console.log('[FinancialQA] New categories discovered:', newCategories);

      // Apply categories
      console.log('[FinancialQA] Applying categories to transactions...');
      let appliedCount = 0;
      results.forEach((category, transactionId) => {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (transaction) {
          transaction.category = category;
          appliedCount++;
        } else {
          console.warn('[FinancialQA] Could not find transaction with ID:', transactionId);
        }
      });
      console.log('[FinancialQA] Applied', appliedCount, 'categories');

      // Dispatch event with new categories for saving
      if (newCategories && newCategories.length > 0) {
        window.dispatchEvent(new CustomEvent('new-categories-discovered', {
          detail: { newCategories }
        }));
      }

      // Save categorizations to storage
      console.log('[FinancialQA] Saving categorizations...');
      if (this.categorizationStorage) {
        try {
          await this.categorizationStorage.save(results);
          console.log('[FinancialQA] Categorizations saved successfully');
        } catch (saveError) {
          console.error('[FinancialQA] Error saving categorizations:', saveError);
        }
      }

      // Notify success
      let successMessage = `Successfully categorized ${results.size} transactions with AI!`;
      if (newCategories && newCategories.length > 0) {
        successMessage += ` ${newCategories.length} new categories discovered: ${newCategories.join(', ')}`;
      }
      successMessage += ' Categorizations saved. Charts updated.';
      this.showSuccess(successMessage);

      // Trigger app update (would need to be passed from parent)
      window.dispatchEvent(new CustomEvent('transactions-updated'));
    } catch (error) {
      console.error('[FinancialQA] Error during categorization:', error);
      this.showError(`Error during AI categorization: ${error.message}`);
    } finally {
      // Reset UI
      btn.disabled = false;
      btn.textContent = 'Categorize All Transactions with AI';
      progressContainer.classList.add('hidden');
    }
  }

  addMessage(role, content, isLoading = false, isError = false) {
    const conversation = this.container.querySelector('#qa-conversation');
    const messageId = `msg-${Date.now()}-${Math.random().toString().replace('.', '')}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = `qa-message qa-message-${role}${isLoading ? ' loading' : ''}${isError ? ' error' : ''}`;
    messageDiv.id = messageId;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'qa-message-content';

    // Render markdown for assistant messages, plain text for user messages
    if (role === 'assistant' && !isLoading) {
      contentDiv.innerHTML = this.renderMarkdown(content);
    } else {
      contentDiv.textContent = content;
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'qa-message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);

    conversation.appendChild(messageDiv);

    // Scroll to bottom
    conversation.scrollTop = conversation.scrollHeight;

    return messageId;
  }

  /**
   * Markdown renderer with table support
   * Supports: headers, bold, italic, lists, code blocks, inline code, links, tables
   */
  renderMarkdown(text) {
    let html = text;

    // Escape HTML to prevent XSS
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Code blocks (```code```)
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Process tables
    html = this.processTables(html);

    // Headers (must be done before line breaks)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Process lists by finding consecutive list items
    const lines = html.split('\n');
    const processed = [];
    let inList = false;
    let listType = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip table lines
      if (line.includes('<table') || line.includes('</table>') || line.includes('<tr>') || line.includes('</tr>')) {
        if (inList) {
          processed.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        processed.push(line);
        continue;
      }

      // Unordered list item
      if (/^[\-\*]\s+(.+)$/.test(line)) {
        if (!inList || listType !== 'ul') {
          if (inList) processed.push(`</${listType}>`);
          processed.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        processed.push(line.replace(/^[\-\*]\s+(.+)$/, '<li>$1</li>'));
      }
      // Ordered list item
      else if (/^\d+\.\s+(.+)$/.test(line)) {
        if (!inList || listType !== 'ol') {
          if (inList) processed.push(`</${listType}>`);
          processed.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        processed.push(line.replace(/^\d+\.\s+(.+)$/, '<li>$1</li>'));
      }
      // Not a list item
      else {
        if (inList) {
          processed.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        processed.push(line);
      }
    }

    // Close any open list
    if (inList) {
      processed.push(`</${listType}>`);
    }

    html = processed.join('\n');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_) - but not in middle of words
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Paragraphs - split by double line breaks
    html = html.replace(/\n\n+/g, '</p><p>');

    // Single line breaks become <br>
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!html.match(/^<(h[1-6]|ul|ol|pre|p|table)/)) {
      html = '<p>' + html + '</p>';
    }

    return html;
  }

  /**
   * Process markdown tables
   * Format:
   * | Header 1 | Header 2 |
   * |----------|----------|
   * | Cell 1   | Cell 2   |
   */
  processTables(text) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;
    let isFirstRow = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this is a table line
      if (line.startsWith('|') && line.endsWith('|')) {
        // Check if next line is separator
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        const isSeparator = /^\|[\s\-:|]+\|$/.test(line);

        if (!inTable && nextLine.match(/^\|[\s\-:|]+\|$/)) {
          // Start of table - this is header row
          inTable = true;
          isFirstRow = true;
          result.push('<table class="markdown-table">');
          result.push('<thead>');
          result.push(this.parseTableRow(line, true));
          result.push('</thead>');
          result.push('<tbody>');
        } else if (isSeparator) {
          // Skip separator line
          continue;
        } else if (inTable) {
          // Regular table row
          result.push(this.parseTableRow(line, false));
        } else {
          // Not a table
          result.push(line);
        }
      } else {
        // End of table
        if (inTable) {
          result.push('</tbody>');
          result.push('</table>');
          inTable = false;
        }
        result.push(line);
      }
    }

    // Close table if still open
    if (inTable) {
      result.push('</tbody>');
      result.push('</table>');
    }

    return result.join('\n');
  }

  parseTableRow(line, isHeader) {
    const cells = line.split('|')
      .slice(1, -1)  // Remove first and last empty elements
      .map(cell => cell.trim());

    const tag = isHeader ? 'th' : 'td';
    const cellsHtml = cells.map(cell => `<${tag}>${cell}</${tag}>`).join('');

    return `<tr>${cellsHtml}</tr>`;
  }

  removeMessage(messageId) {
    const message = this.container.querySelector(`#${messageId}`);
    if (message) {
      message.remove();
    }
  }

  showWarning(message) {
    const conversation = this.container.querySelector('#qa-conversation');
    const warning = document.createElement('div');
    warning.className = 'qa-warning';
    warning.textContent = message;
    conversation.appendChild(warning);
  }

  showSuccess(message) {
    alert(message); // Simple for now, could be a better notification
  }

  showError(message) {
    alert(message); // Simple for now, could be a better notification
  }
}
