import { store } from './store/actions.ts';
import { renderHeader } from './components/header.ts';
import { renderToastContainer } from './components/toast.ts';
import { parseHash, navigate } from './utils/router.ts';

// Views
import { renderDashboardView } from './views/dashboard.ts';
import { renderCreateToolView, cleanupCreateToolView } from './views/create-tool.ts';
import { renderInboxView, cleanupInboxView } from './views/inbox.ts';
import { renderJobDetailView, stopPolling as stopJobPolling } from './views/job-detail.ts';
import { renderAILogsView } from './views/ai-logs.ts';
import { renderMetricsView } from './views/metrics.ts';
import { renderFactoryFloorView, stopPolling as stopFactoryPolling } from './views/factory-floor.ts';

// Legacy views (kept for compatibility)
import { renderPrinciplesView } from './views/principles.ts';

// App container reference
let contentContainer: HTMLElement | null = null;

// Mount the main app shell
export function mountApp(container: HTMLElement): void {

  // Create app structure
  container.innerHTML = `
    <div class="app">
      <header id="header"></header>
      <main id="content" class="app__content"></main>
    </div>
  `;

  // Get content container
  contentContainer = container.querySelector('#content');

  // Render header
  const headerContainer = container.querySelector<HTMLElement>('#header');
  if (headerContainer) {
    renderHeader(headerContainer);
  }

  // Initialize toast container
  const toastContainer = document.querySelector<HTMLElement>('#toast-container');
  if (toastContainer) {
    renderToastContainer(toastContainer);
  }

  // Subscribe to state changes for routing
  store.subscribe((state, prevState) => {
    if (state.currentRoute !== prevState.currentRoute) {
      renderCurrentView();
    }

    // Update header active state
    if (headerContainer) {
      renderHeader(headerContainer);
    }
  });

  // Render initial view
  renderCurrentView();
}

// Cleanup function for view transitions
function cleanupCurrentView(): void {
  cleanupInboxView();
  cleanupCreateToolView();
  stopJobPolling();
  stopFactoryPolling();
}

// Render the current view based on route
function renderCurrentView(): void {
  if (!contentContainer) return;

  // Cleanup previous view
  cleanupCurrentView();

  const match = parseHash();
  const { route, params } = match;

  // Clear current content
  contentContainer.innerHTML = '';

  // Render appropriate view
  switch (route) {
    // New primary routes
    case '/':
      renderDashboardView(contentContainer);
      break;

    case '/create':
      renderCreateToolView(contentContainer);
      break;

    case '/inbox':
      renderInboxView(contentContainer);
      break;

    case '/job/:jobId':
      renderJobDetailView(contentContainer, params.jobId);
      break;

    case '/job/:jobId/logs':
      renderAILogsView(contentContainer, params.jobId);
      break;

    case '/metrics':
      renderMetricsView(contentContainer);
      break;

    case '/factory':
      renderFactoryFloorView(contentContainer);
      break;

    // Legacy routes (redirects and compatibility)
    case '/submit':
      // Redirect to new wizard
      navigate('/create');
      break;

    case '/preview/:jobId':
      // Redirect to new job detail
      navigate(`/job/${params.jobId}`);
      break;

    case '/audit':
      // Redirect to inbox
      navigate('/inbox');
      break;

    case '/audit/:jobId':
      // Redirect to job detail
      navigate(`/job/${params.jobId}`);
      break;

    case '/logs/:jobId':
      // Redirect to new AI logs view
      navigate(`/job/${params.jobId}/logs`);
      break;

    case '/principles':
      // Keep legacy principles view
      renderPrinciplesView(contentContainer);
      break;

    default:
      // 404 - redirect to dashboard
      contentContainer.innerHTML = `
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">?</div>
            <h2 class="empty-state__title">PAGE NOT FOUND</h2>
            <p class="empty-state__message">The page you're looking for doesn't exist.</p>
            <a href="#/" class="btn btn--primary">GO TO DASHBOARD</a>
          </div>
        </div>
      `;
  }
}

// Get current content container (for components that need to update)
export function getContentContainer(): HTMLElement | null {
  return contentContainer;
}
