// Import styles
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';

// Import app modules
import { initRouter } from './utils/router.ts';
import { mountApp } from './app.ts';

// Initialize the application
function init(): void {
  const appRoot = document.querySelector<HTMLDivElement>('#app');

  if (!appRoot) {
    console.error('App root element not found');
    return;
  }

  // Mount the app shell
  mountApp(appRoot);

  // Initialize router
  initRouter((match) => {
    // Router callback is handled in app.ts via store subscription
    console.log('Route changed:', match.route, match.params);
  });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
