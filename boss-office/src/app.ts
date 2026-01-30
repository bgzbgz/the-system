import { store } from './store/actions.ts';
import { renderHeader } from './components/header.ts';
import { renderToastContainer } from './components/toast.ts';
import { renderSubmissionView } from './views/submission.ts';
import { renderInboxView } from './views/inbox.ts';
import { renderPreviewView } from './views/preview.ts';
import { renderAuditView } from './views/audit.ts';
import { renderLogsView } from './views/logs/index.ts';
import { renderPrinciplesView } from './views/principles.ts';
import { parseHash } from './utils/router.ts';

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

// Render the current view based on route
function renderCurrentView(): void {
  if (!contentContainer) return;

  const match = parseHash();
  const { route, params } = match;

  // Clear current content
  contentContainer.innerHTML = '';

  // Render appropriate view
  switch (route) {
    case '/':
    case '/submit':
      renderSubmissionView(contentContainer);
      break;

    case '/inbox':
      renderInboxView(contentContainer);
      break;

    case '/preview/:jobId':
      renderPreviewView(contentContainer, params.jobId);
      break;

    case '/audit':
      renderAuditView(contentContainer);
      break;

    case '/audit/:jobId':
      renderAuditView(contentContainer, params.jobId);
      break;

    case '/logs/:jobId':
      renderLogsView(contentContainer, params.jobId);
      break;

    case '/principles':
      renderPrinciplesView(contentContainer);
      break;

    default:
      // 404 - redirect to submit
      contentContainer.innerHTML = `
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">?</div>
            <h2 class="empty-state__title">PAGE NOT FOUND</h2>
            <p class="empty-state__message">The page you're looking for doesn't exist.</p>
            <a href="#/submit" class="btn btn--primary">GO TO SUBMIT</a>
          </div>
        </div>
      `;
  }
}

// Get current content container (for components that need to update)
export function getContentContainer(): HTMLElement | null {
  return contentContainer;
}
