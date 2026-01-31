import { BaseQA } from './baseQA.js';

/**
 * Financial Q&A UI Component
 * Allows users to ask questions about their finances using AI
 */
export class FinancialQA extends BaseQA {
  constructor(container, transactions, budgetCalculator, recurringDetector, categorizationStorage) {
    super(container);
    this.transactions = transactions;
    this.budgetCalculator = budgetCalculator;
    this.recurringDetector = recurringDetector;
    this.categorizationStorage = categorizationStorage;

    this.render();
    this.checkLLMAvailability();
  }

  // Implement abstract methods from BaseQA
  getConversationId() {
    return 'qa-conversation';
  }

  getDebugId() {
    return 'qa-debug';
  }

  getHistoryCountId() {
    return 'qa-history-count';
  }

  getTabPanelPrefix() {
    return 'qa';
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
}
