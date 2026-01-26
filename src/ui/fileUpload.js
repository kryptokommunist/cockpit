/**
 * File upload UI component
 */
export class FileUpload {
  constructor(container, onFileLoaded) {
    this.container = container;
    this.onFileLoaded = onFileLoaded;
    this.render();
  }

  render() {
    this.container.innerHTML = `
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
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const input = this.container.querySelector('#csv-file-input');
    const label = this.container.querySelector('.file-upload-label');

    input.addEventListener('change', (e) => this.handleFileSelect(e));

    // Drag and drop
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

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusElement = document.getElementById('upload-status');
    statusElement.innerHTML = '<p class="loading">Loading and parsing CSV file...</p>';

    try {
      await this.onFileLoaded(file);
      statusElement.innerHTML = '<p class="success">File loaded successfully!</p>';
    } catch (error) {
      console.error('Error loading file:', error);
      statusElement.innerHTML = `<p class="error">Error loading file: ${error.message}</p>`;
    }
  }
}
