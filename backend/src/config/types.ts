/**
 * Configuration & Secrets - Type Definitions
 * Spec: 012-config-secrets
 * Per data-model.md and contracts/config.yaml
 */

// ========== CONFIGURATION STATE ==========

/**
 * Configuration state enum
 * Per data-model.md: Determined at startup, not changed at runtime
 */
export enum ConfigurationState {
  /** All configuration validated successfully - normal operation */
  VALID = 'VALID',
  /** One or more configuration values invalid/missing - operations blocked */
  CONFIG_ERROR = 'CONFIG_ERROR'
}

// ========== AUTHENTICATION RESULT ==========

/**
 * Callback authentication result enum
 * Per contracts/callback-auth.yaml
 */
export enum CallbackAuthResult {
  /** Secret matches, authentication successful */
  VALID = 'VALID',
  /** Secret provided but doesn't match */
  INVALID = 'INVALID',
  /** No authentication header provided */
  MISSING = 'MISSING'
}

// ========== ENDPOINT STATUS ==========

/**
 * Webhook endpoint status enum
 * Per data-model.md
 */
export enum EndpointStatus {
  /** URL not set */
  UNCONFIGURED = 'UNCONFIGURED',
  /** URL set, not yet tested */
  CONFIGURED = 'CONFIGURED',
  /** Last call succeeded */
  OPERATIONAL = 'OPERATIONAL',
  /** Last call failed */
  ERROR = 'ERROR'
}

// ========== CONFIGURATION ==========

/**
 * Required configuration values
 * Per contracts/config.yaml: All fields MUST be non-empty strings
 */
export interface Configuration {
  /** URL for Factory webhook (tool generation) */
  FACTORY_WEBHOOK_URL: string;
  /** URL for Deployment webhook (publishing) */
  DEPLOY_WEBHOOK_URL: string;
  /** Shared secret for callback authentication - NEVER log or expose */
  CALLBACK_SECRET: string;
}

/**
 * Configuration field names (for type safety)
 */
export type ConfigurationField = keyof Configuration;

// ========== CONFIGURATION ERROR ==========

/**
 * Represents a specific configuration failure
 * Per data-model.md: field names only, NEVER values
 */
export interface ConfigurationError {
  /** Name of the configuration field that failed */
  field: ConfigurationField;
  /** Human-readable description of the failure */
  reason: string;
  /** When the error was detected (ISO 8601) */
  timestamp: string;
}

// ========== VALIDATION RESULT ==========

/**
 * Result of validating all configuration at startup
 * Per contracts/config.yaml
 */
export interface ConfigValidationResult {
  /** True if all configuration is valid */
  valid: boolean;
  /** VALID or CONFIG_ERROR */
  state: ConfigurationState;
  /** List of validation failures (empty if valid) */
  errors: ConfigurationError[];
  /** When validation was performed (ISO 8601) */
  validated_at: string;
}

// ========== WEBHOOK ENDPOINT ==========

/**
 * Represents a configured external endpoint
 * Per data-model.md
 */
export interface WebhookEndpoint {
  /** Endpoint identifier */
  name: 'FACTORY' | 'DEPLOY';
  /** The configured URL */
  url: string;
  /** Current operational status */
  status: EndpointStatus;
  /** When last called (ISO 8601 or null) */
  last_call_at: string | null;
  /** Last error message if failed */
  last_error: string | null;
}

// ========== HEALTH RESPONSE ==========

/**
 * Health endpoint response
 * Per contracts/health.yaml
 * SECURITY: errors contains field names only, NEVER values
 */
export interface HealthResponse {
  /** Overall system status */
  status: 'ok' | 'config_error';
  /** Configuration validation state */
  config_state: ConfigurationState;
  /** List of configuration field names with errors (no values) */
  errors?: string[];
  /** When health check was performed (ISO 8601) */
  timestamp: string;
  /** Application version (optional) */
  version?: string;
}
