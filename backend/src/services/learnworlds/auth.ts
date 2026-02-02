/**
 * LearnWorlds Authentication Service
 * Spec: 001-learnworlds-auth-bridge
 *
 * Handles OAuth2 token management for LearnWorlds API
 */

import { getLearnWorldsConfig, isLearnWorldsConfigured } from '../../config/learnworlds';

interface TokenData {
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
}

let currentToken: TokenData | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

/**
 * Get OAuth2 access token from LearnWorlds
 * Uses client credentials grant
 */
export async function getAccessToken(): Promise<string | null> {
  const config = getLearnWorldsConfig();

  if (!config.isConfigured) {
    console.log('[LearnWorlds Auth] Not configured, skipping token fetch');
    return null;
  }

  // Return cached token if still valid (with 5 minute buffer)
  if (currentToken && currentToken.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return currentToken.accessToken;
  }

  try {
    console.log('[LearnWorlds Auth] Fetching new access token...');

    const response = await fetch(`${config.schoolUrl}/admin/api/oauth2/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lw-Client': config.clientId
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.apiKey,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LearnWorlds Auth] Token request failed:', response.status, errorText);
      return null;
    }

    const data = await response.json() as {
      success?: boolean;
      tokenData?: {
        access_token?: string;
        token_type?: string;
        expires_in?: number;
      };
      errors?: Array<{ message: string }>;
    };

    if (!data.success || !data.tokenData?.access_token) {
      console.error('[LearnWorlds Auth] Invalid token response:', data.errors || 'Unknown error');
      return null;
    }

    // Store token with expiry time
    const expiresInMs = (data.tokenData.expires_in || 8000) * 1000;
    currentToken = {
      accessToken: data.tokenData.access_token,
      tokenType: data.tokenData.token_type || 'Bearer',
      expiresAt: new Date(Date.now() + expiresInMs)
    };

    console.log(`[LearnWorlds Auth] Token obtained, expires in ${Math.round(expiresInMs / 60000)} minutes`);

    // Schedule refresh 5 minutes before expiry
    scheduleTokenRefresh(expiresInMs - 5 * 60 * 1000);

    return currentToken.accessToken;
  } catch (error) {
    console.error('[LearnWorlds Auth] Failed to get access token:', error);
    return null;
  }
}

/**
 * Schedule automatic token refresh
 * Note: setTimeout max is ~24.8 days (2^31-1 ms), so we cap the delay
 */
function scheduleTokenRefresh(delayMs: number): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Cap delay to 24 hours (tokens are typically valid for much shorter)
  // If token is valid for longer, we'll refresh daily
  const maxDelay = 24 * 60 * 60 * 1000; // 24 hours
  const actualDelay = Math.min(delayMs, maxDelay);

  if (actualDelay > 0) {
    refreshTimer = setTimeout(async () => {
      console.log('[LearnWorlds Auth] Refreshing token...');
      await getAccessToken();
    }, actualDelay);
  }
}

/**
 * Get current token status (for health checks)
 */
export function getTokenStatus(): {
  hasToken: boolean;
  expiresAt: Date | null;
  isExpired: boolean;
} {
  if (!currentToken) {
    return { hasToken: false, expiresAt: null, isExpired: true };
  }

  return {
    hasToken: true,
    expiresAt: currentToken.expiresAt,
    isExpired: currentToken.expiresAt < new Date()
  };
}

/**
 * Initialize token on startup
 */
export async function initializeAuth(): Promise<boolean> {
  if (!isLearnWorldsConfigured()) {
    console.log('[LearnWorlds Auth] Skipping initialization - not configured');
    return false;
  }

  const token = await getAccessToken();
  return token !== null;
}

/**
 * Clear token (for testing or logout)
 */
export function clearToken(): void {
  currentToken = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
