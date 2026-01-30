// Job status enum
export type JobStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PROCESSING'
  | 'QA_IN_PROGRESS'
  | 'QA_FAILED'
  | 'READY_FOR_REVIEW'
  | 'REVISION_REQUESTED'
  | 'DEPLOYED'
  | 'REJECTED';

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
