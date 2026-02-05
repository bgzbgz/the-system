-- Migration: 005_performance_indexes
-- Purpose: Add composite indexes for common query patterns in Feature 001
-- Created: 2026-02-05

-- ============================================================================
-- Index Analysis: Query patterns from fieldResponseService.ts & progressService.ts
--
-- Key queries that need optimization:
-- 1. changeStatusToSubmitted(): tenant_id + user_id + tool_slug + status='draft'
-- 2. getResponseCount(): tenant_id + user_id + tool_slug (+ optional status)
-- 3. getFieldResponsesByUser(): tenant_id + user_id (+ optional tool_slug, status, field_id)
-- 4. unlockNextTool(): tool_defaults by tenant_id + sprint_number
-- ============================================================================

-- ============================================================================
-- client_field_responses indexes
-- ============================================================================

-- Composite index for tool-specific user queries (changeStatusToSubmitted, getResponseCount)
-- Covers: WHERE tenant_id = X AND user_id = Y AND tool_slug = Z
CREATE INDEX IF NOT EXISTS idx_cfr_tenant_user_tool
  ON client_field_responses(tenant_id, user_id, tool_slug);

-- Composite index including status for filtered queries
-- Covers: WHERE tenant_id = X AND user_id = Y AND tool_slug = Z AND status = 'draft'
-- This is a partial index only for draft status (most common filter in submit workflow)
CREATE INDEX IF NOT EXISTS idx_cfr_tenant_user_tool_draft
  ON client_field_responses(tenant_id, user_id, tool_slug)
  WHERE status = 'draft';

-- ============================================================================
-- tool_defaults indexes
-- ============================================================================

-- Composite index for sprint lookup by tenant
-- Covers: WHERE tenant_id = X AND sprint_number = Y (used in unlockNextTool)
CREATE INDEX IF NOT EXISTS idx_tool_defaults_tenant_sprint
  ON tool_defaults(tenant_id, sprint_number);

-- ============================================================================
-- user_tool_progress indexes (already has good coverage via UNIQUE constraint)
-- ============================================================================

-- Composite index for status filtering by tenant+user
-- Covers: WHERE tenant_id = X AND user_id = Y AND status = Z
CREATE INDEX IF NOT EXISTS idx_utp_tenant_user_status
  ON user_tool_progress(tenant_id, user_id, status);

-- ============================================================================
-- schema_fields indexes (additional for dependency resolution)
-- ============================================================================

-- GIN index for array contains queries on used_by_tools
-- Covers: WHERE used_by_tools @> ARRAY['tool-slug']
CREATE INDEX IF NOT EXISTS idx_schema_fields_used_by_gin
  ON schema_fields USING GIN(used_by_tools);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON INDEX idx_cfr_tenant_user_tool IS 'Composite index for tool-specific user queries (changeStatusToSubmitted, getResponseCount)';
COMMENT ON INDEX idx_cfr_tenant_user_tool_draft IS 'Partial index for draft status filtering in submit workflow';
COMMENT ON INDEX idx_tool_defaults_tenant_sprint IS 'Composite index for sprint lookup by tenant (unlockNextTool)';
COMMENT ON INDEX idx_utp_tenant_user_status IS 'Composite index for status filtering in progress queries';
COMMENT ON INDEX idx_schema_fields_used_by_gin IS 'GIN index for array containment queries on tool dependencies';
