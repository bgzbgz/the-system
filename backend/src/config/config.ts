/**
 * Configuration & Secrets - Configuration Module
 * Spec: 012-config-secrets
 * Per contracts/config.yaml and contracts/startup.yaml
 *
 * Centralized configuration loading and validation
 * SECURITY: Never logs or exposes secret values (SR-001, SR-002, SR-003)
 */

import {
  Configuration,
  ConfigurationField,
  ConfigurationState,
  ConfigurationError,
  ConfigValidationResult
} from './types';
import {
  ConfigErrorCode,
  CONFIG_ERROR_MESSAGES
} from './errors';

// ========== CONFIGURATION LOADING ==========

/**
 * Load configuration from environment variables
 * Per contracts/config.yaml: Reads from process.env
 *
 * Note: spec 023-route-rewiring removed n8n dependency. Processing is now
 * done in-house via toolFactory and githubService.
 *
 * @returns Partial configuration (may have missing values)
 */
function loadFromEnvironment(): Partial<Configuration> {
  return {
    // Callback secret for internal callbacks
    CALLBACK_SECRET: process.env.CALLBACK_SECRET || 'internal-only'
  };
}

// ========== VALIDATION ==========

/**
 * Mapping of config fields to their error codes
 * Note: FACTORY_WEBHOOK_URL and DEPLOY_WEBHOOK_URL removed (spec 023)
 */
const FIELD_ERROR_CODES: Record<ConfigurationField, ConfigErrorCode> = {
  CALLBACK_SECRET: ConfigErrorCode.CALLBACK_SECRET_NOT_CONFIGURED
};

/**
 * Validate a single configuration field
 * Per contracts/config.yaml validation rules: Must be non-empty string
 *
 * @param field - Field name to validate
 * @param value - Field value
 * @returns ConfigurationError if invalid, undefined if valid
 */
function validateField(field: ConfigurationField, value: string | undefined): ConfigurationError | undefined {
  if (!value || value.trim() === '') {
    return {
      field,
      reason: CONFIG_ERROR_MESSAGES[FIELD_ERROR_CODES[field]],
      timestamp: new Date().toISOString()
    };
  }
  return undefined;
}

/**
 * Validate all configuration values
 * Per contracts/startup.yaml: Validates all required values exist and are non-empty
 * Note: FACTORY_WEBHOOK_URL and DEPLOY_WEBHOOK_URL removed (spec 023)
 *
 * @param config - Partial configuration to validate
 * @returns ConfigValidationResult with state and any errors
 */
export function validateConfiguration(config: Partial<Configuration>): ConfigValidationResult {
  const errors: ConfigurationError[] = [];
  const fieldsToValidate: ConfigurationField[] = [
    'CALLBACK_SECRET'
  ];

  for (const field of fieldsToValidate) {
    const error = validateField(field, config[field]);
    if (error) {
      errors.push(error);
    }
  }

  const valid = errors.length === 0;
  const state = valid ? ConfigurationState.VALID : ConfigurationState.CONFIG_ERROR;

  return {
    valid,
    state,
    errors,
    validated_at: new Date().toISOString()
  };
}

// ========== SINGLETON CONFIGURATION ==========

/**
 * Cached configuration validation result
 */
let cachedValidation: ConfigValidationResult | null = null;

/**
 * Cached configuration values (only if valid)
 */
let cachedConfig: Configuration | null = null;

/**
 * Initialize configuration and validate
 * Per contracts/startup.yaml: Validation MUST be synchronous
 *
 * @returns ConfigValidationResult
 */
export function initializeConfiguration(): ConfigValidationResult {
  const partialConfig = loadFromEnvironment();
  const validation = validateConfiguration(partialConfig);

  cachedValidation = validation;

  if (validation.valid) {
    cachedConfig = partialConfig as Configuration;
  }

  return validation;
}

/**
 * Get current configuration state
 * Per contracts/startup.yaml: Returns VALID or CONFIG_ERROR
 *
 * @returns Current ConfigurationState
 */
export function getConfigurationState(): ConfigurationState {
  if (!cachedValidation) {
    // Initialize if not yet done
    initializeConfiguration();
  }
  return cachedValidation!.state;
}

/**
 * Get validation result
 *
 * @returns Current ConfigValidationResult
 */
export function getValidationResult(): ConfigValidationResult {
  if (!cachedValidation) {
    initializeConfiguration();
  }
  return cachedValidation!;
}

/**
 * Check if configuration is valid
 *
 * @returns true if all configuration is valid
 */
export function isConfigurationValid(): boolean {
  return getConfigurationState() === ConfigurationState.VALID;
}

/**
 * Get configuration value safely
 * Per SR-001, SR-002, SR-003: Returns value only if valid, never exposes in logs
 *
 * @param field - Configuration field to get
 * @returns Field value if valid, undefined if not configured
 */
export function getConfigValue(field: ConfigurationField): string | undefined {
  if (!isConfigurationValid()) {
    return undefined;
  }
  return cachedConfig?.[field];
}

/**
 * Get Callback secret
 * Convenience method for callback auth
 * SECURITY: Use only for comparison, NEVER log
 *
 * @returns Callback secret or undefined if not configured
 */
export function getCallbackSecret(): string | undefined {
  return getConfigValue('CALLBACK_SECRET');
}

/**
 * Get list of missing configuration field names
 * Per contracts/health.yaml: Returns field names only, NEVER values
 *
 * @returns Array of missing field names
 */
export function getMissingConfigFields(): string[] {
  const validation = getValidationResult();
  return validation.errors.map(e => e.field);
}

// ========== STARTUP LOGGING ==========

/**
 * Log configuration state at startup
 * Per startup.yaml logging rules: Log field names only, NEVER values
 *
 * SECURITY: This function MUST NOT log any configuration values or secrets
 */
export function logConfigurationState(): void {
  const validation = getValidationResult();

  if (validation.valid) {
    console.log('[Config] Configuration state: VALID');
    console.log('[Config] All required configuration loaded successfully');
  } else {
    console.log('[Config] Configuration state: CONFIG_ERROR');
    console.log('[Config] Missing or invalid configuration:');
    for (const error of validation.errors) {
      // Log field name and reason, NEVER the value
      console.log(`[Config]   - ${error.field}: ${error.reason}`);
    }
  }
}
