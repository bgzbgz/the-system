import { store } from '../store/actions.ts';

// Render the header component
export function renderHeader(container: HTMLElement): void {
  const { currentRoute } = store.getState();

  // Determine active link
  const isDashboardActive = currentRoute === '/';
  const isCreateActive = currentRoute === '/create' || currentRoute === '/submit';
  const isInboxActive = currentRoute === '/inbox' || currentRoute.startsWith('/job') || currentRoute.startsWith('/preview');
  const isFactoryActive = currentRoute === '/factory';
  const isMetricsActive = currentRoute === '/metrics';
  const isPrinciplesActive = currentRoute === '/principles';

  container.innerHTML = `
    <div class="header">
      <a href="#/" class="header__logo">
        <span class="header__logo-text">TOOL FACTORY</span>
      </a>
      <nav class="header__nav">
        <a href="#/" class="header__link ${isDashboardActive ? 'header__link--active' : ''}">
          DASHBOARD
        </a>
        <a href="#/create" class="header__link ${isCreateActive ? 'header__link--active' : ''}">
          CREATE
        </a>
        <a href="#/inbox" class="header__link ${isInboxActive ? 'header__link--active' : ''}">
          INBOX
        </a>
        <a href="#/factory" class="header__link ${isFactoryActive ? 'header__link--active' : ''}">
          FACTORY
        </a>
        <a href="#/metrics" class="header__link ${isMetricsActive ? 'header__link--active' : ''}">
          METRICS
        </a>
        <a href="#/principles" class="header__link ${isPrinciplesActive ? 'header__link--active' : ''}">
          PRINCIPLES
        </a>
      </nav>
    </div>
  `;
}
