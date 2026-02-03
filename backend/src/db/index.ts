/**
 * Database Module - Barrel Export
 * Spec: 017-mongodb-schema
 *
 * Central export for all database types, services, and utilities
 */

// ========== CONNECTION ==========
export {
  connectDB,
  getDB,
  getDBSafe,
  isConnected,
  disconnectDB,
  checkConnection,
  getCollection,
  getToolCollectionName,
  getToolResponseCollectionName, // @deprecated - use getToolCollectionName
  COLLECTIONS
} from './connection';

// ========== STARTUP ==========
export {
  startupDatabase,
  shutdownDatabase,
  getDatabaseStatus
} from './startup';

// ========== INITIALIZATION ==========
export {
  initializeDatabase,
  createAllIndexes,
  createToolResponseIndexes,
  seedSystemContext,
  ensureToolResponseCollection
} from './init';

// ========== TYPES ==========
export {
  JobStatus,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  canTransition,
  isTerminalStatus,
  getValidNextStatuses,
  getTransitionError,
  isValidJobStatus
} from './types/status';

export {
  EventTypes,
  ALL_EVENT_TYPES,
  isValidEventType
} from './types/eventTypes';
export type { EventType } from './types/eventTypes';

export {
  ContextKeys,
  REQUIRED_CONTEXTS,
  CONTEXT_TITLES,
  getContextTitle,
  isValidContextKey
} from './types/contextKeys';
export type { ContextKey } from './types/contextKeys';

// ========== UTILS ==========
export { generateUUID, isValidUUID } from './utils/uuid';

// ========== MODELS ==========
export {
  VALID_CATEGORIES,
  isValidCategory,
  createJobDocument,
  jobToListItem,
  jobToDetail
} from './models/job';
export type {
  Job,
  CreateJobInput,
  Questionnaire,
  QAReport,
  QACriterionDetail,
  Revision,
  CategoryType,
  JobListItem,
  JobDetail
} from './models/job';

export {
  createQAReport,
  validateQAReportInput
} from './models/qaReport';
export type { CreateQAReportInput } from './models/qaReport';

export {
  createRevision,
  completeRevision,
  validateRevisionInput
} from './models/revision';
export type { CreateRevisionInput } from './models/revision';

export {
  createAuditLogDocument,
  auditLogToResponse
} from './models/auditLog';
export type {
  AuditLogEntry,
  CreateAuditLogInput,
  AuditLogResponse,
  AuditLogListResponse
} from './models/auditLog';

export {
  systemContextToResponse
} from './models/systemContext';
export type {
  SystemContext,
  UpdateContextInput,
  SystemContextResponse,
  SystemContextListResponse
} from './models/systemContext';

export {
  createDeployedToolDocument,
  deployedToolToResponse
} from './models/deployedTool';
export type {
  DeployedTool,
  RegisterToolInput,
  DeployedToolResponse,
  DeployedToolListResponse
} from './models/deployedTool';

export {
  createToolResponseDocument,
  toolResponseToResponse
} from './models/toolResponse';
export type {
  ToolResponse,
  RecordResponseInput,
  ToolResponseResponse,
  ToolResponseListResponse
} from './models/toolResponse';

// Feature 021: Unified tool collection model
export {
  TOOL_DOC_TYPES,
  isDefaults,
  isResponse,
  createDefaultsDocument,
  createResponseDocument as createUnifiedResponseDocument,
  defaultsToResponse,
  responseToApiResponse
} from './models/toolCollection';
export type {
  ToolDocType,
  ToolDefaults,
  ToolResponse as UnifiedToolResponse,
  ToolCollectionDocument,
  Question,
  TermDefinition,
  Framework,
  ExpertQuote,
  InputRange,
  CourseContext,
  QualityGate,
  ResponseStatus,
  AnalysisReference,
  CreateDefaultsInput,
  CreateResponseInput as CreateUnifiedResponseInput,
  ToolDefaultsResponse,
  ToolResponseApiResponse
} from './models/toolCollection';

// ========== SERVICES ==========
export * as jobStore from './services/jobStore';
export * as auditService from './services/auditService';
export * as contextService from './services/contextService';

// Feature 021: Unified tool collection service (primary)
export * as toolCollectionService from './services/toolCollectionService';

// @deprecated - Use toolCollectionService instead (Feature 021)
export * as deployedToolService from './services/deployedToolService';
// @deprecated - Use toolCollectionService instead (Feature 021)
export * as responseService from './services/responseService';

// Re-export common types from services
export type { UpdateResult as JobUpdateResult } from './services/jobStore';
export { DUPLICATE_KEY_ERROR_CODE, isDuplicateKeyError } from './services/jobStore';
