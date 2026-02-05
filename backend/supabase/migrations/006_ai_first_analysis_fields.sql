-- =============================================
-- AI-FIRST ANALYSIS FIELDS MIGRATION
-- =============================================
-- Adds support for the new AI-first tool creation flow:
-- 1. User uploads document
-- 2. AI analyzes and extracts understanding
-- 3. User confirms or edits the AI's understanding
-- 4. Confirmed specs feed into factory pipeline

-- =============================================
-- NEW COLUMNS ON JOBS TABLE
-- =============================================

-- AI's extracted analysis from the uploaded document
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS analysis_result JSONB;

-- Whether the user confirmed the AI's understanding
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS analysis_confirmed BOOLEAN DEFAULT FALSE;

-- Any edits the user made to the AI's understanding before confirming
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS analysis_edits JSONB;

-- Timestamp when analysis was generated
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Timestamp when user confirmed the analysis
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- =============================================
-- NEW STATUS FOR ANALYSIS WORKFLOW
-- =============================================

-- Add new status for jobs awaiting user confirmation
-- Note: PostgreSQL doesn't support ALTER TYPE ADD VALUE IF NOT EXISTS in a transaction
-- So we need to check if it exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'AWAITING_CONFIRMATION'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'job_status')
  ) THEN
    ALTER TYPE job_status ADD VALUE 'AWAITING_CONFIRMATION' AFTER 'DRAFT';
  END IF;
END$$;

-- =============================================
-- INDEX FOR ANALYSIS QUERIES
-- =============================================

-- Index for finding jobs awaiting confirmation
CREATE INDEX IF NOT EXISTS idx_jobs_analysis_confirmed
  ON jobs(tenant_id, analysis_confirmed)
  WHERE analysis_confirmed = FALSE;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON COLUMN jobs.analysis_result IS 'AI Content Analyzer output: core insight, framework, inputs, etc. (JSONB)';
COMMENT ON COLUMN jobs.analysis_confirmed IS 'Whether user has confirmed the AI understanding';
COMMENT ON COLUMN jobs.analysis_edits IS 'User edits to the AI understanding before confirmation';
COMMENT ON COLUMN jobs.analyzed_at IS 'When the AI analysis was generated';
COMMENT ON COLUMN jobs.confirmed_at IS 'When the user confirmed the analysis';
