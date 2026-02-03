-- =============================================
-- FAST TRACK TOOLS - SUPABASE SCHEMA
-- Fresh start - designed for multi-tenancy
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE job_status AS ENUM (
  'DRAFT',
  'SENT',
  'PROCESSING',
  'FACTORY_FAILED',
  'QA_FAILED',
  'ESCALATED',
  'READY_FOR_REVIEW',
  'REVISION_REQUESTED',
  'DEPLOYING',
  'DEPLOYED',
  'DEPLOY_FAILED',
  'REJECTED'
);

CREATE TYPE category_type AS ENUM (
  'B2B_PRODUCT',
  'B2B_SERVICE',
  'B2C_PRODUCT',
  'B2C_SERVICE'
);

CREATE TYPE audit_action AS ENUM (
  'CREATED',
  'STATUS_CHANGED',
  'REVISION_REQUESTED',
  'APPROVED',
  'REJECTED',
  'DEPLOYED',
  'FAILED'
);

-- =============================================
-- TABLES
-- =============================================

-- Tenants (organizations/companies)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  learnworlds_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs (main work items)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,

  -- Questionnaire input
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  category category_type NOT NULL,
  decision TEXT NOT NULL,
  teaching_point TEXT NOT NULL,
  inputs TEXT NOT NULL,
  verdict_criteria TEXT NOT NULL,

  -- Status
  status job_status NOT NULL DEFAULT 'SENT',

  -- Factory results
  tool_name TEXT,
  template_type TEXT,
  qa_report JSONB,

  -- Deployment
  deployed_url TEXT,
  deployed_at TIMESTAMPTZ,
  deploy_error TEXT,

  -- Revision
  revision_notes TEXT,
  revision_count INTEGER DEFAULT 0,
  revision_history JSONB DEFAULT '[]',

  -- Error tracking
  workflow_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(tenant_id, slug)
);

-- Job artifacts (large content stored separately)
CREATE TABLE job_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL, -- 'tool_html', 'preview_html', 'source_file'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, artifact_type)
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  actor_type TEXT NOT NULL, -- 'USER', 'SYSTEM', 'FACTORY'
  actor_id TEXT,
  from_status job_status,
  to_status job_status,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool responses (user submissions from deployed tools)
CREATE TABLE tool_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool_slug TEXT NOT NULL,

  -- User identity
  visitor_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  learnworlds_user_id TEXT,

  -- Response data
  inputs JSONB NOT NULL,
  result JSONB NOT NULL,

  -- Context
  source TEXT NOT NULL, -- 'learnworlds', 'direct', 'embed'
  course_id TEXT,
  lesson_id TEXT,
  referrer TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quality scores
CREATE TABLE quality_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  tool_slug TEXT NOT NULL,

  html_hash TEXT NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL,
  passed BOOLEAN NOT NULL,
  criteria JSONB NOT NULL,
  prompt_versions JSONB DEFAULT '{}',
  scoring_duration_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI cost tracking
CREATE TABLE ai_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  stage TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd NUMERIC(10,6) NOT NULL,
  used_fallback BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Jobs
CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_tenant_created ON jobs(tenant_id, created_at DESC);
CREATE INDEX idx_jobs_slug ON jobs(slug);

-- Job artifacts
CREATE INDEX idx_job_artifacts_job ON job_artifacts(job_id);

-- Audit log
CREATE INDEX idx_audit_tenant_job ON audit_log(tenant_id, job_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Tool responses
CREATE INDEX idx_tool_responses_tenant_tool ON tool_responses(tenant_id, tool_slug);
CREATE INDEX idx_tool_responses_visitor ON tool_responses(visitor_id);
CREATE INDEX idx_tool_responses_created ON tool_responses(created_at DESC);

-- Quality scores
CREATE INDEX idx_quality_scores_job ON quality_scores(job_id);
CREATE INDEX idx_quality_scores_tenant ON quality_scores(tenant_id, created_at DESC);

-- AI costs
CREATE INDEX idx_ai_costs_tenant ON ai_costs(tenant_id, created_at DESC);
CREATE INDEX idx_ai_costs_job ON ai_costs(job_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_costs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- Tenants: users can only see their own tenant
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  USING (id = get_current_tenant_id());

-- Users: users can only see users in their tenant
CREATE POLICY "Users can view tenant members"
  ON users FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Jobs: full tenant isolation
CREATE POLICY "Tenant isolation for jobs"
  ON jobs FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Job artifacts: full tenant isolation
CREATE POLICY "Tenant isolation for job_artifacts"
  ON job_artifacts FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Audit log: full tenant isolation
CREATE POLICY "Tenant isolation for audit_log"
  ON audit_log FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Tool responses: full tenant isolation
CREATE POLICY "Tenant isolation for tool_responses"
  ON tool_responses FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Quality scores: full tenant isolation
CREATE POLICY "Tenant isolation for quality_scores"
  ON quality_scores FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- AI costs: full tenant isolation
CREATE POLICY "Tenant isolation for ai_costs"
  ON ai_costs FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================
-- SERVICE ROLE BYPASS (for backend)
-- =============================================

-- The service_role key bypasses RLS
-- Use it in your backend for cross-tenant operations

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- SEED DATA (for development)
-- =============================================

-- Create a default tenant for testing
INSERT INTO tenants (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Fast Track', 'fast-track')
ON CONFLICT (slug) DO NOTHING;
