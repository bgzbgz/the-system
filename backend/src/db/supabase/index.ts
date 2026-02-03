/**
 * Supabase Database Layer
 *
 * Central export for all Supabase services.
 */

// Client
export {
  getSupabase,
  isSupabaseConfigured,
  testConnection,
  getTenantId,
  DEFAULT_TENANT_ID
} from './client';

// Types
export * from './types';

// Services
// Tier 1 - Foundation
export * as tenantService from './services/tenantService';
export * as userService from './services/userService';

// Tier 2 - Core
export * as jobService from './services/jobService';
export * as jobArtifactService from './services/jobArtifactService';
export * as auditService from './services/auditService';

// Tier 3 - Features
export * as toolResponseService from './services/toolResponseService';
export * as qualityScoreService from './services/qualityScoreService';
export * as costService from './services/costService';

// Feature 021 - Unified Tool Collections
export * as toolDefaultService from './services/toolDefaultService';
export * as toolResponseServiceV2 from './services/toolResponseService_v2';
