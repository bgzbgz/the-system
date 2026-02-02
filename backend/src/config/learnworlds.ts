/**
 * LearnWorlds Configuration
 * Spec: 001-learnworlds-auth-bridge
 *
 * Manages LearnWorlds API credentials and connection settings
 */

export interface LearnWorldsConfig {
  schoolUrl: string;
  clientId: string;
  apiKey: string;
  webhookSecret: string;
  isConfigured: boolean;
}

let config: LearnWorldsConfig | null = null;

/**
 * Initialize LearnWorlds configuration from environment variables
 */
export function initializeLearnWorldsConfig(): LearnWorldsConfig {
  const schoolUrl = process.env.LW_SCHOOL_URL || '';
  const clientId = process.env.LW_CLIENT_ID || '';
  const apiKey = process.env.LW_API_KEY || '';
  const webhookSecret = process.env.LW_WEBHOOK_SECRET || '';

  const isConfigured = !!(schoolUrl && clientId && apiKey && webhookSecret);

  config = {
    schoolUrl: schoolUrl.replace(/\/$/, ''), // Remove trailing slash
    clientId,
    apiKey,
    webhookSecret,
    isConfigured
  };

  return config;
}

/**
 * Get current LearnWorlds configuration
 */
export function getLearnWorldsConfig(): LearnWorldsConfig {
  if (!config) {
    return initializeLearnWorldsConfig();
  }
  return config;
}

/**
 * Check if LearnWorlds integration is fully configured
 */
export function isLearnWorldsConfigured(): boolean {
  const cfg = getLearnWorldsConfig();
  return cfg.isConfigured;
}

/**
 * Log configuration status (without exposing secrets)
 */
export function logLearnWorldsConfigStatus(): void {
  const cfg = getLearnWorldsConfig();

  console.log('[LearnWorlds] Configuration status:');
  console.log(`  - School URL: ${cfg.schoolUrl ? '✓ configured' : '✗ missing'}`);
  console.log(`  - Client ID: ${cfg.clientId ? '✓ configured' : '✗ missing'}`);
  console.log(`  - API Key: ${cfg.apiKey ? '✓ configured' : '✗ missing'}`);
  console.log(`  - Webhook Secret: ${cfg.webhookSecret ? '✓ configured' : '✗ missing'}`);
  console.log(`  - Status: ${cfg.isConfigured ? 'READY' : 'INCOMPLETE'}`);
}
