import { DKBModal } from './dkbModal.js';

/**
 * File upload UI component
 */
export class FileUpload {
  constructor(container, onFileLoaded, onDKBConnect, onDKBRefresh = null) {
    this.container = container;
    this.onFileLoaded = onFileLoaded;
    this.onDKBConnect = onDKBConnect;
    this.onDKBRefresh = onDKBRefresh;
    this.render();
  }

  render() {
    // Check if we have saved DKB credentials
    const hasSavedDKB = DKBModal.hasSavedCredentials();
    const savedCredentials = hasSavedDKB ? DKBModal.getSavedCredentials() : null;
    const lastSync = DKBModal.getLastSyncTime();
    const lastSyncStr = lastSync ? new Date(lastSync).toLocaleString() : 'never';

    this.container.innerHTML = `
      <div class="upload-options">
        ${hasSavedDKB ? `
        <div class="dkb-saved-account">
          <div class="saved-account-info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2"/>
              <path d="M2 10h20" stroke-width="2"/>
            </svg>
            <div class="saved-account-details">
              <span class="saved-account-name">${savedCredentials?.account?.name || 'DKB Account'}</span>
              <span class="saved-account-iban">${savedCredentials?.account?.iban || ''}</span>
              <span class="saved-account-sync">Last sync: ${lastSyncStr}</span>
            </div>
          </div>
          <div class="saved-account-actions">
            <button id="dkb-refresh-btn" class="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M23 4v6h-6M1 20v-6h6" stroke-width="2"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke-width="2"/>
              </svg>
              Refresh Data
            </button>
            <button id="dkb-disconnect-btn" class="btn btn-secondary btn-small">
              Disconnect
            </button>
          </div>
        </div>

        <div class="upload-divider">
          <span>OR</span>
        </div>
        ` : ''}

        <div class="file-upload">
          <input type="file" id="csv-file-input" accept=".csv" />
          <label for="csv-file-input" class="file-upload-label">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <span>Choose CSV File</span>
            <span class="file-upload-hint">or drag and drop here</span>
          </label>
        </div>

        ${!hasSavedDKB ? `
        <div class="upload-divider">
          <span>OR</span>
        </div>

        <div class="dkb-connect">
          <button id="dkb-connect-btn" class="btn btn-primary btn-dkb">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2"/>
              <path d="M2 10h20" stroke-width="2"/>
            </svg>
            <span>Connect DKB Bank Account</span>
          </button>
          <span class="dkb-hint">Load transactions directly from your DKB account</span>
        </div>
        ` : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const input = this.container.querySelector('#csv-file-input');
    const label = this.container.querySelector('.file-upload-label');
    const dkbButton = this.container.querySelector('#dkb-connect-btn');
    const refreshButton = this.container.querySelector('#dkb-refresh-btn');
    const disconnectButton = this.container.querySelector('#dkb-disconnect-btn');

    if (input) {
      input.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // Drag and drop
    if (label) {
      label.addEventListener('dragover', (e) => {
        e.preventDefault();
        label.classList.add('drag-over');
      });

      label.addEventListener('dragleave', () => {
        label.classList.remove('drag-over');
      });

      label.addEventListener('drop', (e) => {
        e.preventDefault();
        label.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
          input.files = files;
          this.handleFileSelect({ target: { files } });
        }
      });
    }

    // DKB connect button
    if (dkbButton && this.onDKBConnect) {
      dkbButton.addEventListener('click', () => this.onDKBConnect());
    }

    // DKB refresh button
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        if (this.onDKBRefresh) {
          this.onDKBRefresh();
        } else {
          // Dispatch event for main app to handle
          window.dispatchEvent(new CustomEvent('dkb-refresh-requested'));
        }
      });
    }

    // DKB disconnect button
    if (disconnectButton) {
      disconnectButton.addEventListener('click', () => {
        if (confirm('Disconnect DKB account? Your saved credentials will be removed.')) {
          DKBModal.clearSavedData();
          this.render(); // Re-render to show connect button
          window.dispatchEvent(new CustomEvent('dkb-disconnected'));
        }
      });
    }
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusElement = document.getElementById('upload-status');
    if (statusElement) {
      statusElement.innerHTML = '<p class="loading">Loading and parsing CSV file...</p>';
    }

    try {
      await this.onFileLoaded(file);
      if (statusElement) {
        statusElement.innerHTML = '<p class="success">File loaded successfully!</p>';
      }
    } catch (error) {
      console.error('Error loading file:', error);
      if (statusElement) {
        statusElement.innerHTML = `<p class="error">Error loading file: ${error.message}</p>`;
      }
    }
  }
}
