import { store } from '../store/actions.ts';

// Render the header component
export function renderHeader(container: HTMLElement): void {
  const { currentRoute } = store.getState();

  // Determine active link
  const isSubmitActive = currentRoute === '/' || currentRoute === '/submit';
  const isInboxActive = currentRoute === '/inbox' || currentRoute.startsWith('/preview');
  const isAuditActive = currentRoute.startsWith('/audit');
  const isPrinciplesActive = currentRoute.startsWith('/principles');

  container.innerHTML = `
    <div class="header">
      <a href="#/" class="header__logo">
        <span class="header__logo-text">BOSS OFFICE</span>
      </a>
      <nav class="header__nav">
        <a href="#/submit" class="header__link ${isSubmitActive ? 'header__link--active' : ''}">
          SUBMIT
        </a>
        <a href="#/inbox" class="header__link ${isInboxActive ? 'header__link--active' : ''}">
          INBOX
        </a>
        <a href="#/audit" class="header__link ${isAuditActive ? 'header__link--active' : ''}">
          AUDIT
        </a>
        <a href="#/principles" class="header__link ${isPrinciplesActive ? 'header__link--active' : ''}">
          PRINCIPLES
        </a>
      </nav>
    </div>
  `;
}
