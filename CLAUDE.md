# v4 tool system Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-02

## Active Technologies
- TypeScript 5.x, Node.js 20+ + Express.js, Anthropic SDK (Claude), Google AI SDK (Gemini), MongoDB (017-bulletproof-factory)
- MongoDB Atlas (existing) (017-bulletproof-factory)
- TypeScript 5.x, Node.js 20+ + Express.js, Anthropic SDK (Claude), MongoDB, existing Tool Factory pipeline (018-tool-intelligence)
- MongoDB Atlas (extend existing `tool_{slug}_responses` collections with analysis data) (018-tool-intelligence)
- MongoDB Atlas (existing database: `fast_track_tools_v4`) (019-multistep-wizard-tools)
- TypeScript 5.x, Node.js 20+ + Express.js, MongoDB driver 6.x, Anthropic SDK (Claude) (021-unified-tool-collection)
- MongoDB Atlas (database: `fast_track_tools_v4`) (021-unified-tool-collection)

- TypeScript 5.x, Node.js 20+ + Express.js, MongoDB, Anthropic SDK (Claude), Google AI SDK (Gemini) (main)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x, Node.js 20+: Follow standard conventions

## Recent Changes
- 021-unified-tool-collection: Added TypeScript 5.x, Node.js 20+ + Express.js, MongoDB driver 6.x, Anthropic SDK (Claude)
- 020-self-improving-factory: Added TypeScript 5.x, Node.js 20+ + Express.js, Anthropic SDK (Claude), Google AI SDK (Gemini), MongoDB
- 019-multistep-wizard-tools: Added TypeScript 5.x, Node.js 20+ + Express.js, Anthropic SDK (Claude), Google AI SDK (Gemini), MongoDB


<!-- MANUAL ADDITIONS START -->

## Tool Intelligence Service (018-tool-intelligence)

AI-powered analysis layer for generated tools that transforms static GO/NO-GO verdicts into personalized coaching experiences.

### Service Location
`backend/src/services/toolIntelligence/`

### API Endpoints
- `POST /api/tools/:slug/analyze` - Request AI analysis for a tool submission
- `GET /api/tools/:slug/analysis/:responseId` - Get cached analysis
- `POST /api/tools/:slug/validate-input` - Get real-time feedback for an input value
- `GET /api/tools/:slug/ranges` - Get input ranges for contextual feedback
- `PUT /api/tools/:slug/quality-gate` - Configure quality gate (admin)
- `GET /api/tools/:slug/analyses` - List all analyses for a tool (admin)

### Key Types
- `ToolAnalysis` - AI-generated analysis document
- `Insight` - Single coaching observation
- `Recommendation` - Improvement suggestion
- `QualityScore` - Engagement metrics (completeness, realism, variance)
- `InputRange` - Course-based range for input feedback

### Quality Score Formula
`overall = completeness(40%) + realism(40%) + variance(20%)`

### Rate Limiting
1 analysis per user per tool per 5 minutes

### Token Budget
~2000 tokens max per AI analysis call

## Tool Depth Validation (017-bulletproof-factory)

Ensures generated tools maintain connection to course content through strict validation.

### CourseContext Endpoint
`GET /api/tools/:slug/context` - Returns full course context for a tool

**Response:**
```json
{
  "success": true,
  "tool_slug": "value-prop",
  "tool_name": "Value Proposition Calculator",
  "courseContext": {
    "terminology": [{ "term": "Power of One", "definition": "..." }],
    "frameworks": [{ "name": "7 Levers", "items": [...] }],
    "expertQuotes": [{ "quote": "...", "source": "..." }],
    "inputRanges": [{ "fieldId": "revenue", "min": 0, "max": 1000000 }]
  }
}
```

### Output Validation Retry Mechanism
When tool HTML is generated, output validation checks for required course content. If validation fails:

1. **First attempt**: Generate HTML normally
2. **If validation fails**: Build explicit fix instructions from errors
3. **Retry up to 2 more times** with fix instructions appended to prompt
4. **After 3 attempts**: Proceed to QA (which can also catch issues)

**Max retries**: 2 (3 total attempts)

### Validation Error Types

| Error Code | Severity | Description |
|------------|----------|-------------|
| `FRAMEWORK_ITEM_MISSING_IN_HTML` | ERROR | Framework item not in generated HTML |
| `EXPERT_QUOTE_MISSING_IN_HTML` | ERROR | Expert quote not displayed |
| `CRITICAL_TERMINOLOGY_MISSING` | ERROR | Term from framework missing in HTML |
| `TERMINOLOGY_GENERICIZED` | WARNING | Non-critical term may be missing |

**Critical vs Non-Critical Terminology:**
- Terms appearing in framework item labels/definitions → CRITICAL (blocking error)
- Other course terms → non-critical (warning only)

### Key Files
- `backend/src/services/factory/validation.ts` - Validation functions
- `backend/src/services/factory/index.ts` - Retry loop implementation
- `backend/src/services/factory/stages/toolBuilder.ts` - Fix instructions handling
- `backend/src/routes/tools.ts` - CourseContext endpoint

## Multi-Step Wizard Tools (019-multistep-wizard-tools)

Transforms single-step calculator tools into multi-step wizard tools with conditional branching. Tools become guided decision journeys that teach while they calculate.

### Architecture
- **Wizard Mode**: When `toolSpec.phases[]` exists, tools generate with phase-based navigation
- **Classic Mode**: When `phases[]` is undefined, tools generate with typeform-style slides (backward compatible)

### Phase Structure
- Minimum 3 phases, maximum 5 phases
- Maximum 6 inputs per phase (progressive disclosure)
- Each phase has: `id`, `name`, `description`, `order`, `inputs[]`, `summaryTemplate`
- Optional: `teachingMomentTag`, `branchConditions[]`

### Branch Conditions
```typescript
interface BranchCondition {
  sourceField: string;      // Input to evaluate
  operator: BranchOperator; // equals, gt, lt, contains, etc.
  targetValue: string | number;
  action: 'show' | 'hide';
  targetPhase?: string;     // Phase to show/hide
}
```

### Wizard State (sessionStorage)
```typescript
interface WizardState {
  toolSlug: string;
  currentPhaseId: string;
  completedPhases: string[];
  phaseInputs: Record<string, Record<string, unknown>>;
  activeBranches: string[];
  startedAt: number;
  lastUpdatedAt: number;
}
```
- 30-minute session timeout
- State persists across tab closes (within timeout)

### Rich Results (5 Sections)
1. **Situation Summary** - Synthesized from all phase summaries
2. **The Analysis** - Methodology application, key findings
3. **The Verdict** - GO/NO-GO/CONDITIONAL with reasoning
4. **Action Plan** - WWW (Who, What, When) + immediate actions
5. **Course Resources** - Relevant module links

### Key Files
- `backend/src/prompts/types.ts` - Phase, BranchCondition, WizardState types
- `backend/src/prompts/knowledgeArchitect.ts` - Phase design rules
- `backend/src/prompts/toolBuilder.ts` - Wizard HTML/JS/CSS generation
- `backend/src/services/factory/validation.ts` - validatePhases() function
- `backend/src/services/factory/courseProcessor.ts` - Phase pipeline integration

### Type Guards
- `isMultiPhaseSpec(spec)` - Check if tool should use wizard mode

### Constants
- `MIN_PHASES = 3`
- `MAX_PHASES = 5`
- `MAX_INPUTS_PER_PHASE = 6`
- `WIZARD_SESSION_TIMEOUT_MS = 30 * 60 * 1000` (30 minutes)

## Unified Tool Collection (021-unified-tool-collection)

Single collection per tool (`tool_{slug}`) containing both defaults and responses, replacing the old dual-collection pattern (`deployed_tools` + `tool_{slug}_responses`).

### Collection Structure
Each `tool_{slug}` collection contains:
- **One defaults document** (`type: "defaults"`) - Tool configuration, courseContext, qualityGate
- **Multiple response documents** (`type: "response"`) - User submissions

### Service Location
`backend/src/db/services/toolCollectionService.ts`

### Key Functions
- `saveDefaults(slug, input)` - Create/update defaults document
- `getDefaults(slug)` - Get tool configuration
- `updateDefaults(slug, updates)` - Partial update defaults
- `saveResponse(slug, input)` - Store user response
- `getResponses(slug, options)` - Paginated response list
- `getResponsesByUser(slug, userId)` - User's responses
- `getStats(slug)` - Aggregated statistics
- `getToolWithStats(slug)` - Defaults + stats combined

### Document Types
```typescript
// Defaults document
{
  type: "defaults",
  tool_id: string,
  tool_slug: string,
  tool_name: string,
  github_url: string,
  courseContext?: { terminology, frameworks, expertQuotes, inputRanges },
  qualityGate?: { enabled, minimumScore },
  created_at: Date,
  updated_at: Date
}

// Response document
{
  type: "response",
  response_id: string,
  tool_id: string,
  tool_slug: string,
  user_id: string,
  answers: Record<string, unknown>,
  score: number,
  verdict: string,
  status: "completed" | "abandoned",
  completed_at: Date
}
```

### API Endpoints (updated for unified collection)
- `POST /api/tools/:slug/responses` - Save response to unified collection
- `GET /api/tools/:slug/responses` - Get responses (page-based pagination)
- `GET /api/tools/:slug/stats` - Get statistics (filters by type: "response")

### Deprecated
- `deployed_tools` collection - Use unified collection defaults instead
- `tool_{slug}_responses` pattern - Replaced by `tool_{slug}` with type discriminator
- `deployedToolService.ts` - Use toolCollectionService.ts
- `responseService.ts` - Use toolCollectionService.ts

<!-- MANUAL ADDITIONS END -->
