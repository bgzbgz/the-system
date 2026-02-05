-- =============================================
-- ROLLBACK: AI-FIRST ANALYSIS FIELDS MIGRATION
-- =============================================

-- Drop index
DROP INDEX IF EXISTS idx_jobs_analysis_confirmed;

-- Remove columns from jobs table
ALTER TABLE jobs DROP COLUMN IF EXISTS analysis_result;
ALTER TABLE jobs DROP COLUMN IF EXISTS analysis_confirmed;
ALTER TABLE jobs DROP COLUMN IF EXISTS analysis_edits;
ALTER TABLE jobs DROP COLUMN IF EXISTS analyzed_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS confirmed_at;

-- Note: PostgreSQL doesn't support removing enum values
-- The AWAITING_CONFIRMATION status will remain but be unused
-- This is safe - unused enum values don't cause issues
