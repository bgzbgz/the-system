// Connection Banner Component - Shows when API is unavailable

let bannerElement: HTMLElement | null = null;
let isOnline = true;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;

// Create and show the connection banner
function showBanner(message: string): void {
  if (bannerElement) {
    bannerElement.querySelector('.connection-banner__text')!.textContent = message;
    return;
  }

  bannerElement = document.createElement('div');
  bannerElement.className = 'connection-banner';
  bannerElement.innerHTML = `
    <span class="connection-banner__text">${escapeHtml(message)}</span>
    <button class="connection-banner__retry" style="margin-left: var(--space-md); background: var(--color-yellow); color: var(--color-black); border: none; padding: var(--space-xs) var(--space-sm); cursor: pointer;">
      RETRY
    </button>
  `;

  bannerElement.querySelector('.connection-banner__retry')?.addEventListener('click', () => {
    checkConnection();
  });

  document.body.prepend(bannerElement);

  // Add padding to body to prevent content overlap
  document.body.style.paddingTop = '40px';
}

// Hide the connection banner
function hideBanner(): void {
  if (bannerElement) {
    bannerElement.remove();
    bannerElement = null;
    document.body.style.paddingTop = '0';
  }
}

// Check API connection
async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Initialize connection monitoring
export function initConnectionMonitor(): void {
  // Check connection status periodically
  const monitor = async () => {
    const connected = await checkConnection();

    if (connected && !isOnline) {
      // Connection restored
      isOnline = true;
      hideBanner();
    } else if (!connected && isOnline) {
      // Connection lost
      isOnline = false;
      showBanner('Connection lost - retrying...');
    }

    // Schedule next check
    retryTimeout = setTimeout(monitor, isOnline ? 30000 : 5000);
  };

  // Start monitoring
  monitor();

  // Also monitor browser online/offline events
  window.addEventListener('online', () => {
    checkConnection().then((connected) => {
      if (connected) {
        isOnline = true;
        hideBanner();
      }
    });
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    showBanner('No internet connection');
  });
}

// Stop connection monitoring
export function stopConnectionMonitor(): void {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  hideBanner();
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
