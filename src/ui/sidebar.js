/**
 * Sidebar navigation component
 */
export class Sidebar {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.isExpanded = false;
    this.currentView = 'dashboard';
    this.render();
  }

  /**
   * Render the sidebar
   */
  render() {
    this.container.innerHTML = `
      <div class="sidebar ${this.isExpanded ? 'expanded' : ''}">
        <button class="sidebar-toggle" id="sidebar-toggle" title="Toggle sidebar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <nav class="sidebar-nav">
          <a href="#" class="sidebar-item active" data-view="dashboard">
            <svg class="sidebar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span class="sidebar-label">Dashboard</span>
          </a>

          <a href="#" class="sidebar-item" data-view="settings">
            <svg class="sidebar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
            </svg>
            <span class="sidebar-label">Settings</span>
          </a>
        </nav>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const toggle = this.container.querySelector('#sidebar-toggle');
    const navItems = this.container.querySelectorAll('.sidebar-item');

    // Toggle sidebar
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSidebar();
    });

    // Navigation items
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.navigateTo(view);
      });
    });

    // Close sidebar when clicking outside (on mobile)
    document.addEventListener('click', (e) => {
      if (this.isExpanded && !this.container.contains(e.target)) {
        this.collapseSidebar();
      }
    });
  }

  /**
   * Toggle sidebar expanded/collapsed
   */
  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
    const sidebar = this.container.querySelector('.sidebar');

    if (this.isExpanded) {
      sidebar.classList.add('expanded');
    } else {
      sidebar.classList.remove('expanded');
    }
  }

  /**
   * Collapse sidebar
   */
  collapseSidebar() {
    this.isExpanded = false;
    const sidebar = this.container.querySelector('.sidebar');
    sidebar.classList.remove('expanded');
  }

  /**
   * Navigate to a view
   * @param {string} view - View name
   */
  navigateTo(view) {
    this.currentView = view;

    // Update active state
    const navItems = this.container.querySelectorAll('.sidebar-item');
    navItems.forEach(item => {
      if (item.dataset.view === view) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Collapse sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      this.collapseSidebar();
    }

    // Call navigation callback
    if (this.onNavigate) {
      this.onNavigate(view);
    }
  }

  /**
   * Set active view
   * @param {string} view - View name
   */
  setActive(view) {
    this.currentView = view;

    const navItems = this.container.querySelectorAll('.sidebar-item');
    navItems.forEach(item => {
      if (item.dataset.view === view) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}
