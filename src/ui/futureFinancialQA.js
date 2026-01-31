import { BaseQA } from './baseQA.js';

/**
 * Future Financial Q&A UI Component
 * Allows users to ask questions about their future projections using AI
 */
export class FutureFinancialQA extends BaseQA {
  constructor(container, projectionService) {
    super(container);
    this.projectionService = projectionService;
    this.transactions = []; // Will be set by update()
    this.startingBalance = 0;

    this.render();
    this.checkLLMAvailability();
  }

  // Implement abstract methods from BaseQA
  getConversationId() {
    return 'future-qa-conversation';
  }

  getDebugId() {
    return 'future-qa-debug';
  }

  getHistoryCountId() {
    return 'future-qa-history-count';
  }

  getTabPanelPrefix() {
    return 'future-qa';
  }

  update(transactions, accountBalance = null) {
    this.transactions = transactions;
    // Use actual account balance if available (from DKB), otherwise calculate from transactions
    if (accountBalance !== null && accountBalance !== undefined) {
      this.startingBalance = accountBalance;
      console.log(`[FutureFinancialQA] Using DKB account balance: €${this.startingBalance.toFixed(2)}`);
    } else {
      this.startingBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
      console.log(`[FutureFinancialQA] Calculated starting balance: €${this.startingBalance.toFixed(2)}`);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="financial-qa">
        <div class="qa-header">
          <h3>AI Future Projection Assistant</h3>
          <p class="qa-subtitle">Ask questions about your future financial projections</p>
        </div>

        <div class="qa-quick-actions">
          <h4>Quick Actions:</h4>
          <div class="quick-buttons">
            <button class="btn-quick" data-action="next-month">What is my projected budget for next month?</button>
            <button class="btn-quick" data-action="recurring">What are my recurring costs?</button>
            <button class="btn-quick" data-action="savings-goal">Can I afford a €1000 purchase?</button>
            <button class="btn-quick" data-action="six-months">What will my balance be in 6 months?</button>
          </div>
        </div>

        <div class="qa-tabs">
          <button class="qa-tab active" data-tab="chat">Chat</button>
          <button class="qa-tab" data-tab="debug">Debug</button>
          <div class="qa-history-indicator">
            <span id="future-qa-history-count">0 messages</span> in context
            <button id="future-clear-context-btn" class="btn-clear-context" title="Clear conversation context">×</button>
          </div>
        </div>

        <div class="qa-tab-content">
          <div class="qa-tab-panel active" id="future-qa-tab-chat">
            <div class="qa-conversation" id="future-qa-conversation">
              <div class="qa-welcome">
                <p><strong>Welcome to your AI Future Projection Assistant!</strong></p>
                <p>I can analyze your future projections and answer questions like:</p>
                <ul style="text-align: left; margin: 1rem auto; max-width: 450px;">
                  <li>"What is my projected budget for March 2026?"</li>
                  <li>"What are my total recurring costs?"</li>
                  <li>"Can I afford a new subscription?"</li>
                  <li>"What will my balance be in 6 months?"</li>
                  <li>"How can I reduce my projected expenses?"</li>
                </ul>
                <p><em>Note: Make sure to add projections above first, or load from overview data!</em></p>
                <p>Try the quick action buttons or ask your own question!</p>
              </div>
            </div>
          </div>

          <div class="qa-tab-panel" id="future-qa-tab-debug">
            <div class="qa-debug" id="future-qa-debug">
              <div class="debug-welcome">
                <p>Debug view - Shows all agent interactions</p>
                <p>Tool calls, inputs, and outputs will appear here as the agent works.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="qa-input-container">
          <input type="text" id="future-qa-input" placeholder="Ask a question about your future projections..." />
          <button id="future-qa-send-btn" class="btn btn-primary">Send</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const input = this.container.querySelector('#future-qa-input');
    const sendBtn = this.container.querySelector('#future-qa-send-btn');
    const quickButtons = this.container.querySelectorAll('.btn-quick');
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


    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Clear context button
    const clearContextBtn = this.container.querySelector('#future-clear-context-btn');
    if (clearContextBtn) {
      clearContextBtn.addEventListener('click', () => this.clearContext());
    }
  }

  async handleSendMessage() {
    const input = this.container.querySelector('#future-qa-input');
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
      // Get projection data
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 12);
      const projections = this.projectionService.generateProjections(startDate, endDate);
      const recurringItems = this.projectionService.getRecurringItems();
      const oneTimeItems = this.projectionService.getOneTimeItems();

      // Package projection data
      const projectionData = {
        projections,
        recurringItems,
        oneTimeItems,
        startingBalance: this.startingBalance || 0
      };

      console.log('[FutureFinancialQA] Projection data:', {
        projectionsCount: projections.length,
        recurringItemsCount: recurringItems.length,
        oneTimeItemsCount: oneTimeItems.length,
        sampleProjection: projections[0],
        dateRange: { start: startDate, end: endDate },
        firstFewProjections: projections.slice(0, 3)
      });

      if (projections.length > 0) {
        console.log('[FutureFinancialQA] Sample projection details:', JSON.stringify(projections[0], null, 2));
      }
      if (recurringItems.length > 0) {
        console.log('[FutureFinancialQA] Sample recurring item:', JSON.stringify(recurringItems[0], null, 2));
      }

      // Check if we have any projections
      if (projections.length === 0 && recurringItems.length === 0 && oneTimeItems.length === 0) {
        this.removeMessage(thinkingId);
        this.removeMessage(streamingId);
        this.addMessage('assistant',
          'You don\'t have any future projections defined yet. Please go to the "Overview" tab and the system will automatically populate recurring expenses and income from your transaction history. You can also manually add projections in the Future Projection view above.',
          false,
          false
        );
        return;
      }

      // Get AI response with streaming and conversation history
      // Pass empty transactions array since we're using projections
      await this.llmService.answerFinancialQuestion(
        question,
        [], // No historical transactions needed for future projections
        projectionData, // Pass projection data as budget parameter
        recurringItems, // Pass recurring items
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

      console.log(`[FutureFinancialQA] Added to history. Summary: "${summary.substring(0, 100)}..."`);

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
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const sixMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    const sixMonthsName = sixMonthsLater.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const questions = {
      'next-month': `What is my projected budget for ${nextMonthName}?`,
      'recurring': 'What are my recurring costs? List all recurring income and expenses.',
      'savings-goal': 'Can I afford a €1000 purchase next month based on my projections?',
      'six-months': `What will my projected balance be in ${sixMonthsName} (6 months from now)?`
    };

    const question = questions[action];
    if (question) {
      const input = this.container.querySelector('#future-qa-input');
      input.value = question;
      await this.handleSendMessage();
    }
  }
}
