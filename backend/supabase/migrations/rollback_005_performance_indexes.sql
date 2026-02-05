-- Rollback: 005_performance_indexes
-- Purpose: Remove performance indexes added in migration 005
-- Created: 2026-02-05

-- client_field_responses indexes
DROP INDEX IF EXISTS idx_cfr_tenant_user_tool;
DROP INDEX IF EXISTS idx_cfr_tenant_user_tool_draft;

-- tool_defaults indexes
DROP INDEX IF EXISTS idx_tool_defaults_tenant_sprint;

-- user_tool_progress indexes
DROP INDEX IF EXISTS idx_utp_tenant_user_status;

-- schema_fields indexes
DROP INDEX IF EXISTS idx_schema_fields_used_by_gin;
