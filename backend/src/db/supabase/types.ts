/**
 * Supabase Database Types
 *
 * Generated from schema.sql - keep in sync!
 */

// ========== ENUMS ==========

export type JobStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PROCESSING'
  | 'FACTORY_FAILED'
  | 'QA_FAILED'
  | 'ESCALATED'
  | 'READY_FOR_REVIEW'
  | 'REVISION_REQUESTED'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'DEPLOY_FAILED'
  | 'REJECTED';

export type CategoryType =
  | 'B2B_PRODUCT'
  | 'B2B_SERVICE'
  | 'B2C_PRODUCT'
  | 'B2C_SERVICE';

export type AuditAction =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEPLOYED'
  | 'FAILED';

// ========== TABLE TYPES ==========

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: string;
  learnworlds_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  tenant_id: string;
  slug: string;
  file_name: string;
  file_content: string;
  category: CategoryType;
  decision: string;
  teaching_point: string;
  inputs: string;
  verdict_criteria: string;
  status: JobStatus;
  tool_name: string | null;
  template_type: string | null;
  qa_report: QAReport | null;
  deployed_url: string | null;
  deployed_at: string | null;
  deploy_error: string | null;
  revision_notes: string | null;
  revision_count: number;
  revision_history: RevisionHistoryEntry[];
  workflow_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobArtifact {
  id: string;
  job_id: string;
  tenant_id: string;
  artifact_type: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  job_id: string | null;
  action: AuditAction;
  actor_type: string;
  actor_id: string | null;
  from_status: JobStatus | null;
  to_status: JobStatus | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ToolResponse {
  id: string;
  tenant_id: string;
  tool_slug: string;
  visitor_id: string;
  user_name: string | null;
  user_email: string | null;
  learnworlds_user_id: string | null;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  source: string;
  course_id: string | null;
  lesson_id: string | null;
  referrer: string | null;
  created_at: string;
}

export interface QualityScore {
  id: string;
  tenant_id: string;
  job_id: string | null;
  tool_slug: string;
  html_hash: string;
  overall_score: number;
  passed: boolean;
  criteria: CriterionScore[];
  prompt_versions: Record<string, string>;
  scoring_duration_ms: number | null;
  created_at: string;
}

export interface AICost {
  id: string;
  tenant_id: string;
  job_id: string | null;
  stage: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  used_fallback: boolean;
  created_at: string;
}

// ========== TOOL COLLECTION TYPES (Feature 021) ==========

export interface ToolDefault {
  id: string;
  tenant_id: string;
  tool_slug: string;
  tool_name: string;
  github_url: string | null;
  deployed_at: string | null;
  tool_config: Record<string, unknown>;
  course_context: Record<string, unknown>;
  quality_gate: {
    enabled: boolean;
    minimumScore: number;
  };
  created_at: string;
  updated_at: string;
}

export interface ToolResponseRow {
  id: string;
  tenant_id: string;
  tool_slug: string;
  response_id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  visitor_id: string;
  learnworlds_user_id: string | null;
  answers: Record<string, unknown>;
  result: Record<string, unknown> | null;
  score: number | null;
  verdict: string | null;
  status: string;
  source: string;
  course_id: string | null;
  lesson_id: string | null;
  referrer: string | null;
  created_at: string;
  completed_at: string | null;
}

// ========== NEW TABLE TYPES (Migration) ==========

export interface SystemContext {
  id: string;
  tenant_id: string;
  key: string;
  title: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ToolAnalysis {
  id: string;
  tenant_id: string;
  response_id: string;
  tool_slug: string;
  user_id: string | null;
  insights: ToolAnalysisInsight[];
  recommendations: ToolAnalysisRecommendation[];
  verdict_explanation: string | null;
  quality_score: ToolAnalysisQualityScore;
  course_references: string[];
  generated_at: string;
  generation_duration_ms: number | null;
  token_usage: TokenUsage | null;
  status: 'completed' | 'failed' | 'unavailable';
  error_message: string | null;
  created_at: string;
}

export interface AgentLog {
  id: string;
  tenant_id: string;
  job_id: string | null;
  stage: string;
  provider: string;
  model: string;
  prompt: string;
  response: string;
  prompt_truncated: boolean;
  response_truncated: boolean;
  tokens_input: number;
  tokens_output: number;
  duration_ms: number | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ToolVisit {
  id: string;
  tenant_id: string;
  tool_slug: string;
  tool_name: string | null;
  user_id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  company: string | null;
  tags: string[];
  source_course: string | null;
  visited_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PendingAccess {
  id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  tool_slug: string;
  user_name: string | null;
  company: string | null;
  tags: string[];
  created_at: string;
  expires_at: string;
  used: boolean;
}

export interface QualityPattern {
  id: string;
  tenant_id: string;
  criterion_id: string;
  failure_rate: number;
  sample_size: number;
  window_start: string;
  window_end: string;
  trend: 'improving' | 'stable' | 'worsening';
  correlations: PatternCorrelation[];
  status: 'active' | 'addressed' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export interface Suggestion {
  id: string;
  tenant_id: string;
  pattern_id: string | null;
  criterion_id: string;
  suggested_change: string;
  prompt_name: string;
  prompt_section: string | null;
  supporting_data: SuggestionSupportingData;
  status: 'pending' | 'approved' | 'dismissed' | 'deferred' | 'implemented';
  operator_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface PromptVersion {
  id: string;
  tenant_id: string;
  prompt_name: string;
  version: number;
  content: string;
  content_hash: string;
  author: string | null;
  change_summary: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ABTest {
  id: string;
  tenant_id: string;
  name: string;
  prompt_name: string;
  variant_a: ABTestVariant;
  variant_b: ABTestVariant;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  config: ABTestConfig;
  results: ABTestResults | null;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ABResult {
  id: string;
  tenant_id: string;
  ab_test_id: string;
  variant_id: 'A' | 'B';
  job_id: string | null;
  quality_score_id: string | null;
  created_at: string;
}

export interface DailyAggregate {
  id: string;
  tenant_id: string;
  date: string;
  total_tools: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
  criterion_pass_rates: Record<string, number>;
  prompt_versions_used: Record<string, Record<number, number>>;
  score_distribution: ScoreDistribution;
  created_at: string;
}

// ========== NESTED TYPES ==========

export interface QAReport {
  score: number;
  max_score: number;
  passed: boolean;
  findings?: QAFinding[];
}

export interface QAFinding {
  check: string;
  passed: boolean;
  message?: string;
}

export interface RevisionHistoryEntry {
  attempt: number;
  score: number;
  passed: boolean;
  failed_checks: string[];
  recommendations?: string[];
}

export interface CriterionScore {
  criterion_id: string;
  name: string;
  score: number;
  passed: boolean;
  feedback: string;
}

// Tool Analysis nested types
export interface ToolAnalysisInsight {
  text: string;
  courseReference: string | null;
  sentiment: 'positive' | 'warning' | 'critical';
  inputsInvolved: string[];
}

export interface ToolAnalysisRecommendation {
  targetInput: string;
  inputLabel: string;
  currentValue: string;
  recommendedRange: string;
  courseModule: string | null;
  courseModuleUrl: string | null;
  impactScore: number;
}

export interface ToolAnalysisQualityScore {
  completeness: number;
  realism: number;
  variance: number;
  overall: number;
  passedThreshold: boolean;
  thresholdValue: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Pattern and Suggestion nested types
export interface PatternCorrelation {
  factor: string;
  value: string;
  strength: number;
  sample_count: number;
}

export interface SuggestionSupportingData {
  failure_rate: number;
  sample_size: number;
  trend: 'improving' | 'stable' | 'worsening';
}

// A/B Test nested types
export interface ABTestVariant {
  variant_id: 'A' | 'B';
  prompt_version_id: string;
  description?: string;
}

export interface ABTestConfig {
  min_samples_per_variant: number;
  max_samples_total?: number;
  significance_threshold: number;
  auto_adopt: boolean;
  min_improvement: number;
}

export interface ABTestResults {
  variant_a_samples: number;
  variant_b_samples: number;
  variant_a_avg_score: number;
  variant_b_avg_score: number;
  p_value?: number;
  significant?: boolean;
  winner?: 'A' | 'B' | 'none';
  per_criterion?: Record<string, { variant_a_pass_rate: number; variant_b_pass_rate: number }>;
}

export interface ScoreDistribution {
  bucket_0_25: number;
  bucket_26_50: number;
  bucket_51_75: number;
  bucket_76_100: number;
}

// ========== DATABASE TYPE (for Supabase client) ==========

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Tenant, 'id'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<User, 'id'>>;
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'revision_count' | 'revision_history'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          revision_count?: number;
          revision_history?: RevisionHistoryEntry[];
        };
        Update: Partial<Omit<Job, 'id' | 'tenant_id'>>;
      };
      job_artifacts: {
        Row: JobArtifact;
        Insert: Omit<JobArtifact, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<JobArtifact, 'id' | 'job_id' | 'tenant_id'>>;
      };
      audit_log: {
        Row: AuditLogEntry;
        Insert: Omit<AuditLogEntry, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never; // Audit log is append-only
      };
      quality_scores: {
        Row: QualityScore;
        Insert: Omit<QualityScore, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never; // Scores are immutable
      };
      ai_costs: {
        Row: AICost;
        Insert: Omit<AICost, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never; // Costs are immutable
      };
      tool_defaults: {
        Row: ToolDefault;
        Insert: Omit<ToolDefault, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ToolDefault, 'id' | 'tenant_id' | 'tool_slug'>>;
      };
      tool_responses: {
        Row: ToolResponseRow;
        Insert: Omit<ToolResponseRow, 'id' | 'tenant_id' | 'created_at' | 'completed_at'> & {
          id?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: never; // Responses are immutable
      };
    };
    Enums: {
      job_status: JobStatus;
      category_type: CategoryType;
      audit_action: AuditAction;
    };
  };
}

// ========== HELPER TYPES ==========

export type JobInsert = Database['public']['Tables']['jobs']['Insert'];
export type JobUpdate = Database['public']['Tables']['jobs']['Update'];
export type JobRow = Database['public']['Tables']['jobs']['Row'];

export type ArtifactInsert = Database['public']['Tables']['job_artifacts']['Insert'];
export type ArtifactRow = Database['public']['Tables']['job_artifacts']['Row'];

export type ToolDefaultInsert = Database['public']['Tables']['tool_defaults']['Insert'];
export type ToolDefaultUpdate = Database['public']['Tables']['tool_defaults']['Update'];

export type ToolResponseInsert = Database['public']['Tables']['tool_responses']['Insert'];
