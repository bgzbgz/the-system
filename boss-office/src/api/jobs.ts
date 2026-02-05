import { api } from './client.ts';
import type {
  Job,
  JobStatus,
  JobResponse,
  CreateJobRequest,
} from '../types/index.ts';

// Backend response format for job list
interface BackendJobsResponse {
  data: Array<{
    job_id: string;
    file_name: string;
    slug: string;
    category: string;
    status: string;
    tool_name?: string;
    tool_html?: string; // Backend uses tool_html
    deployed_url?: string;
    workflow_error?: string; // Error message when factory/QA fails
    created_at: string;
    updated_at: string;
  }>;
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

// List all jobs with optional status filter
// Transforms backend snake_case to frontend camelCase
export async function listJobs(status?: JobStatus): Promise<Job[]> {
  const endpoint = status ? `/jobs?status=${status}` : '/jobs';
  const response = await api.get<BackendJobsResponse>(endpoint);

  // Transform backend format to frontend format
  return response.data.map((job) => ({
    _id: job.job_id,
    status: job.status as JobStatus,
    fileName: job.file_name,
    fileContent: '', // Not returned in list
    toolName: job.tool_name || null,
    category: job.category as Job['category'],
    questionnaire: {} as Job['questionnaire'], // Not returned in list
    generatedHtml: job.tool_html || null, // Backend uses tool_html
    qaReport: null, // Not returned in list
    deployedUrl: job.deployed_url || null,
    revisionNotes: [],
    workflowError: job.workflow_error || null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  }));
}

// Backend response format for single job
interface BackendJobResponse {
  data: {
    job_id: string;
    file_name: string;
    slug: string;
    category: string;
    status: string;
    tool_name?: string;
    file_content?: string;
    tool_html?: string; // Backend uses tool_html not generated_html
    deployed_url?: string;
    workflow_error?: string; // Error message when factory/QA fails
    decision?: string;
    teaching_point?: string;
    inputs?: string;
    verdict_criteria?: string;
    qa_report?: {
      passed: boolean;
      score: number;
      max_score: number;
      findings?: Array<{ check: string; passed: boolean; message?: string }>;
    };
    revision_notes?: string;
    revision_count?: number;
    created_at: string;
    updated_at: string;
  };
}

// Get a single job by ID
// Transforms backend snake_case to frontend camelCase
export async function getJob(jobId: string): Promise<Job> {
  const response = await api.get<BackendJobResponse>(`/jobs/${jobId}`);
  const job = response.data;

  return {
    _id: job.job_id,
    status: job.status as JobStatus,
    fileName: job.file_name,
    fileContent: job.file_content || '',
    toolName: job.tool_name || null,
    category: job.category as Job['category'],
    questionnaire: {
      category: job.category as Job['category'],
      decision: job.decision || '',
      teachingPoint: job.teaching_point || '',
      inputs: job.inputs || '',
      verdictCriteria: job.verdict_criteria || '',
    },
    generatedHtml: job.tool_html || null, // Backend uses tool_html
    qaReport: job.qa_report ? {
      passed: job.qa_report.passed,
      criteria: job.qa_report.findings?.map(f => ({
        name: f.check,
        passed: f.passed,
        feedback: f.message || null,
      })) || [],
      notes: null,
    } : null,
    deployedUrl: job.deployed_url || null,
    revisionNotes: job.revision_notes ? [job.revision_notes] : [],
    workflowError: job.workflow_error || null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

// Backend response format for job creation
interface BackendCreateJobResponse {
  success: boolean;
  job_id: string;
  status: string;
  slug: string;
  message: string;
}

// Create a new job (submit tool request)
// Transforms frontend camelCase to backend snake_case format
export async function createJob(data: CreateJobRequest): Promise<Job> {
  // Transform to backend expected format
  const backendPayload = {
    file_name: data.fileName,
    file_content: data.fileContent,
    category: data.questionnaire.category,
    decision: data.questionnaire.decision,
    teaching_point: data.questionnaire.teachingPoint,
    inputs: data.questionnaire.inputs,
    verdict_criteria: data.questionnaire.verdictCriteria,
  };

  const response = await api.post<BackendCreateJobResponse>('/jobs', backendPayload);

  // Return minimal job object (full details can be fetched with getJob)
  return {
    _id: response.job_id,
    status: response.status as JobStatus,
    fileName: data.fileName,
    fileContent: data.fileContent,
    toolName: null,
    category: data.questionnaire.category,
    questionnaire: data.questionnaire,
    generatedHtml: null,
    qaReport: null,
    deployedUrl: null,
    revisionNotes: [],
    workflowError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Backend response format for approve
interface BackendApproveResponse {
  success: boolean;
  job_id: string;
  status: string;
  deployed_url?: string;
  message: string;
  job?: {
    job_id: string;
    file_name: string;
    slug: string;
    category: string;
    status: string;
    tool_name?: string;
    tool_html?: string;
    deployed_url?: string;
    created_at: string;
    updated_at: string;
  };
}

// Approve job and trigger deployment
// Waits for deployment to complete and returns the deployed URL
export async function approveJob(jobId: string): Promise<JobResponse> {
  const response = await api.post<BackendApproveResponse>(`/jobs/${jobId}/approve`);

  // Transform backend response to frontend format
  const job: Job = response.job ? {
    _id: response.job.job_id,
    status: response.job.status as JobStatus,
    fileName: response.job.file_name,
    fileContent: '',
    toolName: response.job.tool_name || null,
    category: response.job.category as Job['category'],
    questionnaire: {} as Job['questionnaire'],
    generatedHtml: response.job.tool_html || null,
    qaReport: null,
    deployedUrl: response.job.deployed_url || response.deployed_url || null,
    revisionNotes: [],
    workflowError: null,
    createdAt: response.job.created_at,
    updatedAt: response.job.updated_at,
  } : {
    // Minimal job if backend didn't return full job
    _id: response.job_id,
    status: response.status as JobStatus,
    fileName: '',
    fileContent: '',
    toolName: null,
    category: 'B2C_SERVICE' as Job['category'],
    questionnaire: {} as Job['questionnaire'],
    generatedHtml: null,
    qaReport: null,
    deployedUrl: response.deployed_url || null,
    revisionNotes: [],
    workflowError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    job,
    deployedUrl: response.deployed_url,
  };
}

// Backend response format for revision
interface BackendRevisionResponse {
  data: {
    job_id: string;
    file_name: string;
    slug: string;
    category: string;
    status: string;
    tool_name?: string;
    tool_html?: string;
    revision_notes?: string;
    revision_count?: number;
    created_at: string;
    updated_at: string;
  };
}

// Request revision with notes
// Transforms frontend 'notes' to backend 'revision_notes'
export async function requestRevision(jobId: string, notes: string): Promise<Job> {
  const response = await api.post<BackendRevisionResponse>(`/jobs/${jobId}/revise`, { revision_notes: notes });
  const job = response.data;

  return {
    _id: job.job_id,
    status: job.status as JobStatus,
    fileName: job.file_name,
    fileContent: '',
    toolName: job.tool_name || null,
    category: job.category as Job['category'],
    questionnaire: {} as Job['questionnaire'],
    generatedHtml: job.tool_html || null,
    qaReport: null,
    deployedUrl: null,
    revisionNotes: job.revision_notes ? [job.revision_notes] : [],
    workflowError: null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

// Reject response shape from backend
interface RejectResponse {
  success: boolean;
  job_id: string;
  status: string;
  message: string;
}

// Reject job permanently
export async function rejectJob(jobId: string, reason: string = 'Rejected by boss'): Promise<RejectResponse> {
  const response = await api.post<RejectResponse>(`/jobs/${jobId}/reject`, { reason });
  return response;
}

// Cancel response shape from backend
interface CancelResponse {
  success: boolean;
  job_id: string;
  status: string;
  message: string;
}

// Cancel a stuck deployment or processing job
export async function cancelJob(jobId: string): Promise<CancelResponse> {
  const response = await api.post<CancelResponse>(`/jobs/${jobId}/cancel`);
  return response;
}

// ========== AI-FIRST ANALYSIS FLOW ==========

/**
 * Template description from backend
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  examples: string[];
  ideal_for: string;
}

/**
 * Content analysis result from AI
 */
export interface ContentAnalysisResult {
  coreInsight: string;
  framework: {
    name: string;
    items: Array<{
      number: number;
      name: string;
      description: string;
    }>;
  } | null;
  decisionType: 'go-no-go' | 'scoring' | 'comparison' | 'calculator';
  decisionQuestion: string;
  suggestedInputs: Array<{
    id: string;
    label: string;
    type: 'number' | 'currency' | 'percentage' | 'slider' | 'text' | 'select';
    hint?: string;
    options?: string[];
  }>;
  terminology: Array<{
    term: string;
    definition: string;
  }>;
  expertQuotes: Array<{
    quote: string;
    source: string;
  }>;
  goCondition: string;
  noGoCondition: string;
  confidence: number;
  suggestedToolName: string;
  toolPurpose: string;
}

/**
 * User edits to AI analysis
 */
export interface AnalysisEdits {
  coreInsight?: string;
  decisionType?: ContentAnalysisResult['decisionType'];
  decisionQuestion?: string;
  suggestedInputs?: ContentAnalysisResult['suggestedInputs'];
  goCondition?: string;
  noGoCondition?: string;
  additionalNotes?: string;
}

// Get template descriptions
interface TemplatesResponse {
  data: {
    templates: Template[];
  };
}

export async function getTemplates(): Promise<Template[]> {
  const response = await api.get<TemplatesResponse>('/jobs/templates');
  return response.data.templates;
}

// Analyze content request/response
interface AnalyzeRequest {
  file_name: string;
  file_content: string;
  category: 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE';
}

interface AnalyzeResponse {
  data: {
    success: boolean;
    analysis: ContentAnalysisResult;
    timing?: {
      duration: number;
      tokensUsed: {
        input: number;
        output: number;
      };
    };
  };
}

// Analyze uploaded content and get AI's understanding
export async function analyzeContent(
  fileName: string,
  fileContent: string,
  category: 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE'
): Promise<{ analysis: ContentAnalysisResult; timing?: { duration: number } }> {
  const payload: AnalyzeRequest = {
    file_name: fileName,
    file_content: fileContent,
    category,
  };

  const response = await api.post<AnalyzeResponse>('/jobs/analyze', payload);
  return {
    analysis: response.data.analysis,
    timing: response.data.timing,
  };
}

// Create job from confirmed analysis
interface CreateFromAnalysisRequest {
  file_name: string;
  file_content: string;
  category: 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE';
  analysis: ContentAnalysisResult;
  edits?: AnalysisEdits;
}

interface CreateFromAnalysisResponse {
  success: boolean;
  job_id: string;
  status: string;
  slug: string;
  tool_name: string;
  message: string;
}

export async function createJobFromAnalysis(
  fileName: string,
  fileContent: string,
  category: 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE',
  analysis: ContentAnalysisResult,
  edits?: AnalysisEdits
): Promise<Job> {
  const payload: CreateFromAnalysisRequest = {
    file_name: fileName,
    file_content: fileContent,
    category,
    analysis,
    edits,
  };

  const response = await api.post<CreateFromAnalysisResponse>('/jobs/create-from-analysis', payload);

  // Return minimal job object
  return {
    _id: response.job_id,
    status: response.status as JobStatus,
    fileName: fileName,
    fileContent: fileContent,
    toolName: response.tool_name || analysis.suggestedToolName,
    category: category,
    questionnaire: {
      category: category,
      decision: analysis.decisionQuestion,
      teachingPoint: analysis.coreInsight,
      inputs: analysis.suggestedInputs.map(i => `${i.label} (${i.type})`).join(', '),
      verdictCriteria: `GO: ${analysis.goCondition}\nNO-GO: ${analysis.noGoCondition}`,
    },
    generatedHtml: null,
    qaReport: null,
    deployedUrl: null,
    revisionNotes: [],
    workflowError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Export all functions as named exports for tree-shaking
export const jobsApi = {
  list: listJobs,
  get: getJob,
  create: createJob,
  approve: approveJob,
  revise: requestRevision,
  reject: rejectJob,
  cancel: cancelJob,
  // AI-first flow
  getTemplates,
  analyzeContent,
  createFromAnalysis: createJobFromAnalysis,
};
