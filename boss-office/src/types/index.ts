// Job status enum
export type JobStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PROCESSING'
  | 'QA_IN_PROGRESS'
  | 'QA_FAILED'
  | 'READY_FOR_REVIEW'
  | 'REVISION_REQUESTED'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'DEPLOY_FAILED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'FACTORY_FAILED'
  | 'FAILED_SEND'
  | 'DEPLOY_REQUESTED';

// Category enum
export type Category =
  | 'B2B_PRODUCT'
  | 'B2B_SERVICE'
  | 'B2C_PRODUCT'
  | 'B2C_SERVICE';

// Questionnaire answers
export interface Questionnaire {
  category: Category;
  decision: string;
  teachingPoint: string;
  inputs: string;
  verdictCriteria: string;
}

// QA criterion result
export interface QACriterion {
  name: string;
  passed: boolean;
  feedback: string | null;
}

// QA report
export interface QAReport {
  passed: boolean;
  criteria: QACriterion[];
  notes: string | null;
}

// Job entity
export interface Job {
  _id: string;
  status: JobStatus;
  fileName: string;
  fileContent: string;
  toolName: string | null;
  category: Category;
  questionnaire: Questionnaire;
  generatedHtml: string | null;
  qaReport: QAReport | null;
  deployedUrl: string | null;
  revisionNotes: string[];
  workflowError: string | null;  // Error message when factory/QA fails
  createdAt: string;
  updatedAt: string;
}

// Event type enum
export type EventType =
  | 'JOB_CREATED'
  | 'JOB_SUBMITTED'
  | 'PROCESSING_STARTED'
  | 'QA_STARTED'
  | 'QA_PASSED'
  | 'QA_FAILED'
  | 'REVISION_REQUESTED'
  | 'REVISION_APPLIED'
  | 'APPROVED'
  | 'DEPLOYED'
  | 'REJECTED';

// Audit event entity
export interface AuditEvent {
  _id: string;
  jobId: string;
  eventType: EventType;
  timestamp: string;
  details: Record<string, unknown>;
  actor: string;
}

// File type enum
export type FileType = 'pdf' | 'docx' | 'md' | 'txt';

// Upload status enum
export type UploadStatus = 'pending' | 'extracting' | 'ready' | 'error';

// File upload (client-side)
export interface FileUpload {
  file: File;
  name: string;
  size: number;
  type: FileType;
  extractedText: string | null;
  status: UploadStatus;
  error: string | null;
}

// Toast notification
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  dismissAt: number;
}

// Modal types
export type ModalType = 'revision' | 'success' | 'confirm' | null;

// App state
export interface AppState {
  // Navigation
  currentRoute: string;

  // Jobs
  jobs: Job[];
  jobsLoading: boolean;
  jobsError: string | null;

  // Current job (for preview/audit detail)
  currentJob: Job | null;
  currentJobLoading: boolean;

  // Submission form
  fileUpload: FileUpload | null;
  questionnaire: Partial<Questionnaire>;
  submitting: boolean;

  // UI state
  toasts: Toast[];
  modalOpen: ModalType;

  // Polling
  pollingActive: boolean;
  lastPollTime: number | null;
}

// API response types
export interface JobsListResponse {
  jobs: Job[];
}

export interface JobResponse {
  job: Job;
  deployedUrl?: string;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
}

export interface ApiError {
  error: string;
  message: string;
}

// Create job request
export interface CreateJobRequest {
  fileName: string;
  fileContent: string;
  questionnaire: Questionnaire;
}

// Revision request
export interface RevisionRequest {
  notes: string;
}

// ============================================================================
// WIZARD TYPES (5-Step Tool Creation)
// ============================================================================

// Sprint/Module for dropdown
export interface Sprint {
  id: string;
  name: string;
  moduleNumber: number;
}

// Input field types for dynamic input builder
export type InputFieldType = 'number' | 'currency' | 'percentage' | 'text' | 'dropdown' | 'slider';

// Dynamic input field definition
export interface InputFieldDefinition {
  id: string;
  label: string;
  type: InputFieldType;
  hint: string;
  required: boolean;
  minValue?: number;
  maxValue?: number;
  options?: string[]; // For dropdown type
}

// Wizard step state
export interface WizardState {
  currentStep: number;
  completedSteps: number[];

  // Step 1: Identity & Context
  toolName: string;
  sprintId: string;
  category: Category;
  fileUpload: FileUpload | null;

  // Step 2: Framework Selection
  frameworkDescription: string;
  keyTerminology: string[];
  expertQuotes: string[];

  // Step 3: Input Design
  inputFields: InputFieldDefinition[];

  // Step 4: Decision Logic
  decisionQuestion: string;
  verdictCriteria: string;

  // Validation state
  errors: Record<string, string>;
}

// Hardcoded sprint list (updated manually when sprints change)
export const SPRINTS: Sprint[] = [
  { id: 'sprint-1', name: 'Sprint 1: Foundation', moduleNumber: 1 },
  { id: 'sprint-2', name: 'Sprint 2: Discovery', moduleNumber: 2 },
  { id: 'sprint-3', name: 'Sprint 3: Analysis', moduleNumber: 3 },
  { id: 'sprint-4', name: 'Sprint 4: Strategy', moduleNumber: 4 },
  { id: 'sprint-5', name: 'Sprint 5: Execution', moduleNumber: 5 },
  { id: 'sprint-6', name: 'Sprint 6: Optimization', moduleNumber: 6 },
  { id: 'sprint-7', name: 'Sprint 7: Scaling', moduleNumber: 7 },
  { id: 'sprint-8', name: 'Sprint 8: Mastery', moduleNumber: 8 },
];

// Initial wizard state
export const INITIAL_WIZARD_STATE: WizardState = {
  currentStep: 1,
  completedSteps: [],
  toolName: '',
  sprintId: '',
  category: 'B2B_PRODUCT',
  fileUpload: null,
  frameworkDescription: '',
  keyTerminology: [],
  expertQuotes: [],
  inputFields: [],
  decisionQuestion: '',
  verdictCriteria: '',
  errors: {},
};

// ============================================================================
// QUALITY METRICS TYPES
// ============================================================================

// Quality criterion result
export interface CriterionResult {
  id: string;
  name: string;
  passed: boolean;
  score: number;
  feedback: string | null;
}

// Quality score for a job
export interface QualityScore {
  jobId: string;
  overallScore: number;
  passed: boolean;
  criteria: CriterionResult[];
  createdAt: string;
}

// Daily quality data point
export interface DailyQuality {
  date: string;
  averageScore: number;
  totalTools: number;
  passRate: number;
}

// Quality dashboard summary
export interface QualityDashboard {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  totalTools: number;
  averageScore: number;
  passRate: number;
  scoreTrend: 'up' | 'down' | 'stable';
  criterionPassRates: Record<string, number>;
  dailyScores: DailyQuality[];
}

// Quality trends response
export interface QualityTrends {
  daily: DailyQuality[];
  criterionTrends: Record<string, { date: string; passRate: number }[]>;
}

// ============================================================================
// PIPELINE STAGE TYPES
// ============================================================================

// Pipeline stage status
export type StageStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped';

// Pipeline stage definition
export interface PipelineStage {
  id: string;
  name: string;
  shortName: string;
  status: StageStatus;
  durationMs?: number;
  error?: string;
}

// Full pipeline stages for visualization
export const PIPELINE_STAGES: Omit<PipelineStage, 'status'>[] = [
  { id: 'secretary', name: 'Secretary', shortName: 'SEC' },
  { id: 'audience', name: 'Audience Profiler', shortName: 'AUD' },
  { id: 'examples', name: 'Example Generator', shortName: 'EXM' },
  { id: 'copy', name: 'Copy Writer', shortName: 'CPY' },
  { id: 'builder', name: 'Tool Builder', shortName: 'BLD' },
  { id: 'brand', name: 'Brand Guardian', shortName: 'BRD' },
  { id: 'qa', name: 'QA Department', shortName: 'QA' },
  { id: 'review', name: 'Review', shortName: 'REV' },
];

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

// Factory status counts
export interface FactoryStatus {
  active: number;
  review: number;
  deployed: number;
}

// Dashboard state
export interface DashboardState {
  factoryStatus: FactoryStatus;
  recentJobs: Job[];
  qualityDashboard: QualityDashboard | null;
  loading: boolean;
  error: string | null;
}
