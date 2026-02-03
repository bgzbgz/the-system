-- =============================================
-- TOOL COLLECTIONS MIGRATION (Feature 021)
-- =============================================
-- Creates tool_defaults and tool_responses tables
-- Each deployed tool gets its own "collection space"
-- with tenant isolation via RLS

-- =============================================
-- TOOL DEFAULTS TABLE
-- =============================================
-- Stores tool configurations (questions, prompts, settings)
-- One row per tool per tenant

CREATE TABLE tool_defaults (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool_slug TEXT NOT NULL,
  tool_name TEXT NOT NULL,

  -- Tool metadata
  github_url TEXT,
  deployed_at TIMESTAMPTZ,

  -- Tool configuration (questions, prompts, validation rules)
  tool_config JSONB DEFAULT '{}',

  -- Course context (terminology, frameworks, input ranges)
  course_context JSONB DEFAULT '{}',

  -- Quality gate settings
  quality_gate JSONB DEFAULT '{"enabled": false, "minimumScore": 70}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(tenant_id, tool_slug)
);

-- =============================================
-- TOOL RESPONSES TABLE
-- =============================================
-- Stores client submissions from deployed tools
-- Many rows per tool (one per submission)

CREATE TABLE tool_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool_slug TEXT NOT NULL,
  response_id TEXT NOT NULL,

  -- User identity
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  user_name TEXT,
  visitor_id TEXT NOT NULL,

  -- LearnWorlds integration
  learnworlds_user_id TEXT,

  -- Response data
  answers JSONB NOT NULL,
  result JSONB,

  -- Quality metrics
  score NUMERIC(5,2),
  verdict TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'completed',  -- 'completed', 'abandoned'

  -- Context
  source TEXT NOT NULL,  -- 'learnworlds', 'direct', 'embed'
  course_id TEXT,
  lesson_id TEXT,
  referrer TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(tenant_id, tool_slug, response_id)
);

-- =============================================
-- INDEXES
-- =============================================

-- Tool defaults indexes
CREATE INDEX idx_tool_defaults_tenant ON tool_defaults(tenant_id);
CREATE INDEX idx_tool_defaults_slug ON tool_defaults(tool_slug);
CREATE INDEX idx_tool_defaults_tenant_slug ON tool_defaults(tenant_id, tool_slug);

-- Tool responses indexes
CREATE INDEX idx_tool_responses_tenant_tool ON tool_responses(tenant_id, tool_slug);
CREATE INDEX idx_tool_responses_user ON tool_responses(user_id);
CREATE INDEX idx_tool_responses_visitor ON tool_responses(visitor_id);
CREATE INDEX idx_tool_responses_created ON tool_responses(created_at DESC);
CREATE INDEX idx_tool_responses_completed ON tool_responses(completed_at DESC);
CREATE INDEX idx_tool_responses_status ON tool_responses(status);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE tool_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_responses ENABLE ROW LEVEL SECURITY;

-- Tenant isolation for tool_defaults
CREATE POLICY "Tenant isolation for tool_defaults"
  ON tool_defaults FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Tenant isolation for tool_responses
CREATE POLICY "Tenant isolation for tool_responses"
  ON tool_responses FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at for tool_defaults
CREATE TRIGGER update_tool_defaults_updated_at
  BEFORE UPDATE ON tool_defaults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE tool_defaults IS 'Tool configurations - one row per deployed tool';
COMMENT ON TABLE tool_responses IS 'Client submissions - many rows per tool';

COMMENT ON COLUMN tool_defaults.tool_config IS 'Questions, prompts, validation rules (JSONB)';
COMMENT ON COLUMN tool_defaults.course_context IS 'Course terminology, frameworks, input ranges (JSONB)';
COMMENT ON COLUMN tool_defaults.quality_gate IS 'Quality gate settings: {"enabled": bool, "minimumScore": number}';

COMMENT ON COLUMN tool_responses.answers IS 'Client answers to tool questions (JSONB)';
COMMENT ON COLUMN tool_responses.result IS 'Tool output/verdict/recommendations (JSONB)';
COMMENT ON COLUMN tool_responses.visitor_id IS 'Anonymous visitor tracking ID';
