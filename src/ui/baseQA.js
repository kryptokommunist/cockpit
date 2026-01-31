import { LLMService } from '../services/llmService.js';

/**
 * Base Q&A Component
 * Shared functionality for Financial and Future Q&A components
 */
export class BaseQA {
  constructor(container) {
    this.container = container;
    this.llmService = new LLMService();
    this.conversationHistory = [];
  }

  /**
   * Check LLM availability
   */
  async checkLLMAvailability() {
    try {
      console.log(`[${this.constructor.name}] Checking LLM availability...`);
      const available = await this.llmService.checkAvailability();
      console.log(`[${this.constructor.name}] LLM available:`, available);
      if (!available) {
        this.showWarning('AI service is not available. Check if backend is running on port 3001.');
      } else {
        console.log(`[${this.constructor.name}] AI service is ready!`);
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] Error checking availability:`, error);
      this.showWarning(`AI service error: ${error.message}`);
    }
  }

  /**
   * Attach event listeners - to be implemented by subclasses
   */
  attachEventListeners() {
    throw new Error('attachEventListeners must be implemented by subclass');
  }

  /**
   * Clear conversation context
   */
  clearContext() {
    if (this.conversationHistory.length === 0) return;

    if (confirm(`Clear conversation context? (${this.conversationHistory.length} messages will be removed)`)) {
      this.conversationHistory = [];
      this.updateHistoryIndicator();
      console.log(`[${this.constructor.name}] Conversation context cleared`);

      // Show notification in chat
      const conversation = this.container.querySelector(`#${this.getConversationId()}`);
      const notice = document.createElement('div');
      notice.className = 'qa-context-notice';
      notice.textContent = '🔄 Conversation context cleared. Starting fresh conversation.';
      conversation.appendChild(notice);
      conversation.scrollTop = conversation.scrollHeight;
    }
  }

  /**
   * Switch between tabs
   */
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
    const panelPrefix = this.getTabPanelPrefix();
    panels.forEach(panel => {
      if (panel.id === `${panelPrefix}-tab-${tabName}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  /**
   * Add thinking indicator
   */
  addThinkingIndicator() {
    const conversation = this.container.querySelector(`#${this.getConversationId()}`);
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

  /**
   * Update thinking indicator with current tool
   */
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
    const conversation = this.container.querySelector(`#${this.getConversationId()}`);
    conversation.scrollTop = conversation.scrollHeight;
  }

  /**
   * Add streaming message
   */
  addStreamingMessage() {
    const conversation = this.container.querySelector(`#${this.getConversationId()}`);
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

  /**
   * Append to streaming message
   */
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
    const conversation = this.container.querySelector(`#${this.getConversationId()}`);
    conversation.scrollTop = conversation.scrollHeight;
  }

  /**
   * Finalize streaming message
   */
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

  /**
   * Get message content
   */
  getMessageContent(messageId) {
    const contentDiv = this.container.querySelector(`#${messageId}-content`);
    if (!contentDiv) return '';

    return contentDiv.textContent.replace('▋', '').trim();
  }

  /**
   * Add message to conversation
   */
  addMessage(role, content, isLoading = false, isError = false) {
    const conversation = this.container.querySelector(`#${this.getConversationId()}`);
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
   * Remove message
   */
  removeMessage(messageId) {
    const message = this.container.querySelector(`#${messageId}`);
    if (message) {
      message.remove();
    }
  }

  /**
   * Add debug entry
   */
  addDebugEntry(type, content, input = null, result = null) {
    const debugContainer = this.container.querySelector(`#${this.getDebugId()}`);
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

  /**
   * Update history indicator
   */
  updateHistoryIndicator() {
    const indicator = this.container.querySelector(`#${this.getHistoryCountId()}`);
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

  /**
   * Parse a table row into HTML
   */
  parseTableRow(line, isHeader) {
    const cells = line.split('|')
      .slice(1, -1)  // Remove first and last empty elements
      .map(cell => cell.trim());

    const tag = isHeader ? 'th' : 'td';
    const cellsHtml = cells.map(cell => `<${tag}>${cell}</${tag}>`).join('');

    return `<tr>${cellsHtml}</tr>`;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show warning message
   */
  showWarning(message) {
    const conversation = this.container.querySelector(`#${this.getConversationId()}`);
    if (!conversation) return;

    const warning = document.createElement('div');
    warning.className = 'qa-warning';
    warning.textContent = message;
    conversation.appendChild(warning);
    conversation.scrollTop = conversation.scrollHeight;
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    alert(message);
  }

  /**
   * Show error message
   */
  showError(message) {
    alert(message);
  }

  // Abstract methods that must be implemented by subclasses
  getConversationId() {
    throw new Error('getConversationId must be implemented by subclass');
  }

  getDebugId() {
    throw new Error('getDebugId must be implemented by subclass');
  }

  getHistoryCountId() {
    throw new Error('getHistoryCountId must be implemented by subclass');
  }

  getTabPanelPrefix() {
    throw new Error('getTabPanelPrefix must be implemented by subclass');
  }
}
