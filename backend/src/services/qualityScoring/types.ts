/**
 * Self-Improving Tool Factory - Type Definitions
 * Feature: 020-self-improving-factory
 *
 * These types define the data structures for quality scoring,
 * pattern detection, prompt versioning, suggestions, and A/B testing.
 */

// ========== QUALITY SCORING TYPES ==========

/**
 * Criterion identifiers matching the 8-point quality criteria
 */
export type CriterionId =
  | 'decision'        // Forces concrete decision (GO/NO-GO)
  | 'zero_questions'  // Zero instructions needed (placeholders, labels)
  | 'easy_steps'      // Easy first steps (simple entry point)
  | 'feedback'        // Instant feedback (validation, indicators)
  | 'gamification'    // Progress feels rewarding (bars, achievements)
  | 'results'         // Crystal clear verdict (specific next action)
  | 'commitment'      // Public commitment (WWW, sharing)
  | 'brand';          // Fast Track DNA (colors, fonts, language)

/**
 * Individual criterion assessment result
 */
export interface CriterionScore {
  /** Which criterion was assessed */
  criterion_id: CriterionId;
  /** Score: 0 (fail), 0.5 (partial), 1 (pass) */
  score: 0 | 0.5 | 1;
  /** True if score equals 1 */
  passed: boolean;
  /** Human-readable explanation of the score */
  reason: string;
  /** Evidence found (matched patterns, elements) */
  evidence?: string[];
}

/**
 * Complete quality assessment for a generated tool
 */
export interface QualityScore {
  /** Unique identifier */
  _id?: string;
  /** Reference to the job that generated this tool */
  job_id: string;
  /** Tool identifier (slug) */
  tool_slug: string;
  /** SHA-256 hash of the tool HTML */
  html_hash: string;
  /** Aggregated score 0-100 */
  overall_score: number;
  /** True if all 8 criteria pass */
  passed: boolean;
  /** Individual criterion results */
  criteria: CriterionScore[];
  /** Map of agent_name to prompt_version_id used */
  prompt_versions: Record<string, string>;
  /** Time taken to score in milliseconds */
  scoring_duration_ms: number;
  /** When scoring was performed */
  created_at: Date;
}

/**
 * Input for scoring a tool
 */
export interface ScoreToolRequest {
  /** Job ID */
  job_id: string;
  /** Tool slug */
  tool_slug: string;
  /** Complete HTML content of the tool */
  html_content: string;
}

/**
 * Response from scoring a tool
 */
export interface ScoreToolResponse {
  /** The computed quality score */
  score: QualityScore;
  /** Any warnings during scoring */
  warnings?: string[];
}

// ========== PROMPT VERSIONING TYPES ==========

/**
 * Agent identifiers for prompts
 */
export type PromptName =
  | 'secretary'
  | 'toolBuilder'
  | 'templateDecider'
  | 'qaDepartment'
  | 'feedbackApplier'
  | 'knowledgeArchitect'
  | 'courseAnalyst'
  | 'contentSummarizer';

/**
 * A versioned snapshot of a prompt
 */
export interface PromptVersion {
  /** Unique identifier */
  _id?: string;
  /** Agent this prompt belongs to */
  prompt_name: PromptName;
  /** Sequential version number */
  version: number;
  /** Full prompt content */
  content: string;
  /** SHA-256 hash for deduplication */
  content_hash: string;
  /** Who made the change */
  author?: string;
  /** Description of what changed */
  change_summary?: string;
  /** When version was created */
  created_at: Date;
  /** True if this is the current production version */
  is_active: boolean;
}

/**
 * Request to create a new prompt version
 */
export interface CreatePromptVersionRequest {
  /** Which prompt to version */
  prompt_name: PromptName;
  /** New content */
  content: string;
  /** Who is making the change */
  author?: string;
  /** What changed */
  change_summary?: string;
}

/**
 * Response when retrieving prompt versions
 */
export interface PromptVersionListResponse {
  /** Prompt name */
  prompt_name: PromptName;
  /** All versions, newest first */
  versions: PromptVersion[];
  /** Currently active version number */
  active_version: number;
}

// ========== PATTERN DETECTION TYPES ==========

/**
 * Trend direction for a pattern
 */
export type PatternTrend = 'improving' | 'stable' | 'worsening';

/**
 * Status of a detected pattern
 */
export type PatternStatus = 'active' | 'addressed' | 'dismissed';

/**
 * Correlation between a factor and quality failures
 */
export interface Correlation {
  /** What factor (e.g., "course_type", "input_count") */
  factor: string;
  /** Specific value (e.g., "B2B Service", ">10") */
  value: string;
  /** Correlation strength 0-1 */
  strength: number;
  /** Number of samples with this factor */
  sample_count: number;
}

/**
 * Detected trend in quality failures
 */
export interface QualityPattern {
  /** Unique identifier */
  _id?: string;
  /** Which criterion this pattern affects */
  criterion_id: CriterionId;
  /** Percentage of tools failing (0-100) */
  failure_rate: number;
  /** Number of tools in analysis window */
  sample_size: number;
  /** Start of analysis window */
  window_start: Date;
  /** End of analysis window */
  window_end: Date;
  /** Direction of trend */
  trend: PatternTrend;
  /** Factors correlated with failures */
  correlations?: Correlation[];
  /** Pattern status */
  status: PatternStatus;
  /** When pattern was detected */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
}

/**
 * Weekly pattern report
 */
export interface WeeklyPatternReport {
  /** Report period start */
  week_start: Date;
  /** Report period end */
  week_end: Date;
  /** Top 3 quality issues */
  top_issues: Array<{
    criterion_id: CriterionId;
    failure_rate: number;
    trend: PatternTrend;
  }>;
  /** Total tools analyzed */
  total_tools: number;
  /** Average quality score for the week */
  average_score: number;
}

// ========== SUGGESTION TYPES ==========

/**
 * Status of an improvement suggestion
 */
export type SuggestionStatus = 'pending' | 'approved' | 'dismissed' | 'deferred' | 'implemented';

/**
 * System-generated improvement recommendation
 */
export interface Suggestion {
  /** Unique identifier */
  _id?: string;
  /** Reference to QualityPattern that triggered this */
  pattern_id: string;
  /** Which criterion to improve */
  criterion_id: CriterionId;
  /** What to change in prompt */
  suggested_change: string;
  /** Which prompt to modify */
  prompt_name: PromptName;
  /** Specific section within prompt */
  prompt_section?: string;
  /** Supporting data for the suggestion */
  supporting_data: {
    failure_rate: number;
    sample_size: number;
    trend: PatternTrend;
  };
  /** Suggestion status */
  status: SuggestionStatus;
  /** Notes from operator review */
  operator_notes?: string;
  /** Who reviewed */
  reviewed_by?: string;
  /** When reviewed */
  reviewed_at?: Date;
  /** When suggestion generated */
  created_at: Date;
}

/**
 * Request to update suggestion status
 */
export interface UpdateSuggestionRequest {
  /** New status */
  status: SuggestionStatus;
  /** Optional operator notes */
  operator_notes?: string;
}

// ========== A/B TESTING TYPES ==========

/**
 * Status of an A/B test
 */
export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

/**
 * A variant in an A/B test
 */
export interface PromptVariant {
  /** Variant identifier */
  variant_id: 'A' | 'B';
  /** Reference to PromptVersion */
  prompt_version_id: string;
  /** Description of what's different */
  description?: string;
}

/**
 * Configuration for an A/B test
 */
export interface ABTestConfig {
  /** Minimum tools per variant before calculating significance */
  min_samples_per_variant: number;
  /** Maximum tools before auto-stop */
  max_samples_total?: number;
  /** p-value threshold for significance (default 0.05) */
  significance_threshold: number;
  /** Auto-adopt winner when significant */
  auto_adopt: boolean;
  /** Minimum score improvement % to adopt (e.g., 10 = 10%) */
  min_improvement: number;
}

/**
 * Results of an A/B test
 */
export interface ABTestResults {
  /** Tools assigned to variant A */
  variant_a_samples: number;
  /** Tools assigned to variant B */
  variant_b_samples: number;
  /** Average quality score for A */
  variant_a_avg_score: number;
  /** Average quality score for B */
  variant_b_avg_score: number;
  /** Statistical significance (p-value) */
  p_value?: number;
  /** True if p < threshold */
  significant?: boolean;
  /** Winner if significant */
  winner?: 'A' | 'B' | 'none';
  /** Breakdown by criterion */
  per_criterion?: Record<CriterionId, {
    variant_a_pass_rate: number;
    variant_b_pass_rate: number;
  }>;
}

/**
 * An A/B test experiment
 */
export interface ABTest {
  /** Unique identifier */
  _id?: string;
  /** Human-readable test name */
  name: string;
  /** Which prompt is being tested */
  prompt_name: PromptName;
  /** Control variant (current production) */
  variant_a: PromptVariant;
  /** Test variant (proposed change) */
  variant_b: PromptVariant;
  /** Test status */
  status: ABTestStatus;
  /** Test configuration */
  config: ABTestConfig;
  /** Calculated results */
  results?: ABTestResults;
  /** Who created the test */
  created_by: string;
  /** When test was created */
  created_at: Date;
  /** When test started running */
  started_at?: Date;
  /** When test ended */
  completed_at?: Date;
}

/**
 * Individual tool result within an A/B test
 */
export interface ABResult {
  /** Unique identifier */
  _id?: string;
  /** Reference to ABTest */
  ab_test_id: string;
  /** Which variant */
  variant_id: 'A' | 'B';
  /** Reference to job */
  job_id: string;
  /** Reference to QualityScore */
  quality_score_id: string;
  /** When result recorded */
  created_at: Date;
}

/**
 * Request to create an A/B test
 */
export interface CreateABTestRequest {
  /** Test name */
  name: string;
  /** Which prompt to test */
  prompt_name: PromptName;
  /** Variant B prompt version ID (A uses current active) */
  variant_b_version_id: string;
  /** Variant B description */
  variant_b_description?: string;
  /** Test configuration */
  config?: Partial<ABTestConfig>;
}

// ========== DASHBOARD / ANALYTICS TYPES ==========

/**
 * Pre-computed daily statistics
 */
export interface DailyAggregate {
  /** Unique identifier */
  _id?: string;
  /** Day this aggregate covers (midnight UTC) */
  date: Date;
  /** Tools scored this day */
  total_tools: number;
  /** Average overall score */
  average_score: number;
  /** Tools that passed all criteria */
  pass_count: number;
  /** Tools with any failing criterion */
  fail_count: number;
  /** Map of criterion_id to pass rate */
  criterion_pass_rates: Record<CriterionId, number>;
  /** Map of prompt_name to version count used */
  prompt_versions_used: Record<PromptName, Record<number, number>>;
  /** Score distribution buckets */
  score_distribution: {
    bucket_0_25: number;
    bucket_26_50: number;
    bucket_51_75: number;
    bucket_76_100: number;
  };
}

/**
 * Dashboard summary response
 */
export interface DashboardSummary {
  /** Period covered */
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  /** Total tools in period */
  total_tools: number;
  /** Overall average score */
  average_score: number;
  /** Pass rate (all criteria) */
  pass_rate: number;
  /** Score trend (current week vs previous) */
  score_trend: 'up' | 'down' | 'stable';
  /** Per-criterion pass rates */
  criterion_pass_rates: Record<CriterionId, number>;
  /** Daily data points for trend chart */
  daily_scores: Array<{
    date: string;
    average_score: number;
    total_tools: number;
  }>;
  /** Prompt version performance */
  prompt_performance: Array<{
    prompt_name: PromptName;
    version: number;
    tools_generated: number;
    average_score: number;
  }>;
}

// ========== API RESPONSE TYPES ==========

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
