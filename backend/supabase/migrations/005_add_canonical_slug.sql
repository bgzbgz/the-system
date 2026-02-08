-- Migration: 005_add_canonical_slug
-- Purpose: Add canonical_slug column to tool_defaults to bridge deployed slugs to schema_fields
-- Created: 2026-02-08

-- Add canonical_slug column to tool_defaults
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'tool_defaults' AND column_name = 'canonical_slug') THEN
        ALTER TABLE tool_defaults ADD COLUMN canonical_slug TEXT;
    END IF;
END $$;

-- Index for canonical_slug lookups
CREATE INDEX IF NOT EXISTS idx_tool_defaults_canonical ON tool_defaults(canonical_slug);

COMMENT ON COLUMN tool_defaults.canonical_slug IS 'Canonical slug matching schema_fields.produced_by_tool (e.g., cash-position vs deployed slug 06-v6u2y9)';
