/**
 * Boss Office Backend - Server Entry Point
 * Spec: 012-config-secrets
 *
 * Validates configuration at startup and starts Express server
 * Per contracts/startup.yaml: Validation MUST complete before server accepts requests
 */

import 'dotenv/config';
import express from 'express';
import {
  initializeConfiguration,
  logConfigurationState,
  isConfigurationValid,
  getValidationResult
} from './config/config';
import { ConfigurationState } from './config/types';
import { CONFIG_BLOCKING_MESSAGE } from './config/errors';
import healthRouter from './routes/health';
import factoryRouter from './routes/factory';
import callbacksRouter from './routes/callbacks';
import jobsRouter from './routes/jobs';
import auditRouter from './routes/audit';
import principlesRouter from './routes/principles';
import learnworldsRouter from './routes/learnworlds';
import toolLaunchRouter from './routes/toolLaunch';
import toolEmbedRouter from './routes/toolEmbed';
import toolResponsesRouter from './routes/tools';
import automationWebhookRouter from './routes/automationWebhook';
import fieldResponsesRouter from './routes/fieldResponses';
import progressRouter from './routes/progress';
import toolServingRouter from './routes/toolServing';
import qualityRouter from './routes/quality';
import patternsRouter from './routes/patterns';
import suggestionsRouter from './routes/suggestions';
import experimentsRouter from './routes/experiments';
import configGuard from './middleware/configGuard';
import corsMiddleware from './middleware/cors';
import { requestLogger, lightRequestLogger } from './middleware/requestLogger';
import { apiLimiter, strictLimiter, fieldSaveLimiter, webhookLimiter } from './middleware/rateLimit';
import { seedExampleJobs } from './services/jobStore';
import { startupDatabase, shutdownDatabase, getDatabaseStatus } from './db/startup';
import { testConnection as testSupabaseConnection, isSupabaseConfigured } from './db/supabase';
import logger from './utils/logger';
import { aiService } from './services/ai';
import { initializePrompts } from './prompts';
import { preloadAllContext } from './context';
import { initializePromptLoader } from './services/promptLoader';
import { toolFactory } from './services/factory/index';
import { githubService } from './services/github';
import { ensureIndexes as ensureLogStoreIndexes, TTL_DAYS as LOG_TTL_DAYS } from './services/logStore';
import { initializeLearnWorldsConfig, logLearnWorldsConfigStatus, isLearnWorldsConfigured } from './config/learnworlds';
import { initializeAuth as initializeLearnWorldsAuth, ensureToolVisitsIndexes, ensurePendingAccessIndexes } from './services/learnworlds';

// ========== STARTUP VALIDATION ==========

/**
 * Perform startup validation
 * Per contracts/startup.yaml:
 * - Validation MUST be synchronous
 * - Validation MUST complete within 100ms
 * - Server MUST still start even if validation fails
 * - Server MUST block core operations if validation fails
 */
function performStartupValidation(): void {
  const startTime = Date.now();

  console.log('[Startup] Boss Office starting...');
  console.log('[Startup] Validating configuration...');

  // Initialize and validate configuration (synchronous)
  const validationResult = initializeConfiguration();

  const elapsed = Date.now() - startTime;
  console.log(`[Startup] Validation completed in ${elapsed}ms`);

  // Log configuration state (field names only, NEVER values)
  logConfigurationState();

  // Warn if validation took too long (should be < 100ms per spec)
  if (elapsed > 100) {
    console.warn(`[Startup] Warning: Validation took ${elapsed}ms (target: <100ms)`);
  }

  if (validationResult.state === ConfigurationState.CONFIG_ERROR) {
    console.log('[Startup] ================================');
    console.log(`[Startup] ${CONFIG_BLOCKING_MESSAGE}`);
    console.log('[Startup] Core operations will be blocked.');
    console.log('[Startup] ================================');
  }
}

// ========== EXPRESS APP ==========

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend (T059)
app.use(corsMiddleware);

// Parse JSON bodies (with 10MB limit for tool_html)
app.use(express.json({ limit: '10mb' }));

// Rate limiting (applied before routes)
app.use('/api', apiLimiter); // General API limit: 100 req/15min

// Request logging (T061 - use light logger for high-volume, full logger for jobs/audit)
app.use('/api/jobs', requestLogger);
app.use('/api/audit', requestLogger);
app.use('/api/factory', lightRequestLogger);
app.use('/api/health', lightRequestLogger);

// ========== ROUTES ==========

// Health endpoint - MUST be available even in CONFIG_ERROR state (no configGuard)
app.use('/api', healthRouter);

// Jobs routes - for Boss Office app
// Mounted at /api/jobs to match frontend expectations
app.use('/api/jobs', jobsRouter);

// Audit routes - for audit event queries (spec 016-backend-api)
app.use('/api/audit', auditRouter);

// Factory routes - protected by configGuard for core operations
// Apply strict rate limit: 20 requests per 15 minutes (expensive AI operations)
app.use('/api/factory', strictLimiter, factoryRouter);

// Callbacks routes - for n8n workflow callbacks (spec 016-backend-api)
app.use('/api/factory', callbacksRouter);

// Principles routes - serves Fast Track principle documents
app.use('/api/principles', principlesRouter);

// LearnWorlds routes - webhook receiver and health check (spec 001-learnworlds-auth-bridge)
// Apply webhook rate limit: 200 requests per 15 minutes
app.use('/api/learnworlds', webhookLimiter, learnworldsRouter);

// Tool Launch routes - secure tool access from LearnWorlds
app.use('/api/tools', toolLaunchRouter);

// Tool Responses routes - save/retrieve tool responses (spec 026-tool-response-api, feature 021)
app.use('/api/tools', toolResponsesRouter);

// Field Responses routes - field-by-field response storage (feature 001-compounding-client-work)
// Apply field save rate limit: 50 saves per 5 minutes (prevents auto-save spam)
app.use('/api/field-responses', fieldSaveLimiter);
app.use('/api', fieldResponsesRouter);

// Progress routes - user progress tracking across sprints (feature 001-compounding-client-work)
app.use('/api', progressRouter);

// Tool Serving routes - dynamic tool serving with dependencies (feature 001-compounding-client-work)
app.use('/', toolServingRouter);

// Tool Embed routes - embeddable widgets for LearnWorlds courses
app.use('/api/embed', toolEmbedRouter);

// Automation webhook routes - receives LearnWorlds automation webhooks
// Apply webhook rate limit: 200 requests per 15 minutes
app.use('/api/automation', webhookLimiter, automationWebhookRouter);

// Quality routes - quality scoring and prompt version management (spec 020-self-improving-factory)
app.use('/api/quality', qualityRouter);

// Pattern routes - pattern detection and weekly reports (spec 020-self-improving-factory)
app.use('/api/patterns', patternsRouter);

// Suggestion routes - improvement suggestions queue (spec 020-self-improving-factory)
app.use('/api/suggestions', suggestionsRouter);

// Experiments routes - A/B testing management (spec 020-self-improving-factory)
app.use('/api/experiments', experimentsRouter);

// Root endpoint - always available
app.get('/', (req, res) => {
  res.json({
    service: 'Boss Office API',
    version: '1.0.0',
    config_state: isConfigurationValid() ? 'VALID' : 'CONFIG_ERROR'
  });
});

// ========== SERVER STARTUP ==========

/**
 * Initialize Supabase connection
 * Tests connection and reports status
 */
async function initializeSupabase(): Promise<boolean> {
  // Skip if Supabase not configured
  if (!isSupabaseConfigured()) {
    console.log('[Startup] Supabase not configured (SUPABASE_URL/SERVICE_KEY missing)');
    return false;
  }

  try {
    const result = await testSupabaseConnection();

    if (!result.connected) {
      console.error('[Startup] Supabase connection failed:', result.error);
      return false;
    }

    console.log(`[Startup] Supabase connected (latency: ${result.latency_ms}ms)`);
    return true;
  } catch (error) {
    console.error('[Startup] Supabase connection test failed:', error);
    return false;
  }
}

/**
 * Initialize MongoDB connection
 * Spec: 017-mongodb-schema - Uses new db module for connection and initialization
 * NOTE: MongoDB is being phased out in favor of Supabase
 */
async function initializeDatabase(): Promise<boolean> {
  // Skip if MONGODB_URI not configured (use in-memory storage)
  if (!process.env.MONGODB_URI) {
    console.log('[Startup] MONGODB_URI not configured - using in-memory storage');
    return false;
  }

  try {
    // Use the new db/startup module which handles:
    // - Connection with proper pool config
    // - Index creation for all collections
    // - System context seeding
    const result = await startupDatabase();

    if (!result.success) {
      console.error('[Startup] Database initialization failed:', result.error);
      console.log('[Startup] Falling back to in-memory storage');
      return false;
    }

    console.log('[Startup] MongoDB connected and initialized (spec 017-mongodb-schema)');

    // Initialize agent logs indexes (spec 024-agent-reasoning-logs)
    await ensureLogStoreIndexes();
    console.log(`[Startup] Agent logs ready (TTL: ${LOG_TTL_DAYS} days)`);

    // Initialize tool visits indexes
    await ensureToolVisitsIndexes();
    console.log('[Startup] Tool visits tracking ready');

    // Initialize pending access indexes
    await ensurePendingAccessIndexes();
    console.log('[Startup] Pending access tracking ready');

    return true;
  } catch (error) {
    console.error('[Startup] MongoDB connection failed:', error);
    console.log('[Startup] Falling back to in-memory storage');
    return false;
  }
}

/**
 * Start the server
 * Per contracts/startup.yaml:
 * - Server MUST still start even in CONFIG_ERROR state
 * - Health endpoint MUST be available
 */
async function startServer(): Promise<void> {
  // Step 1: Validate configuration BEFORE accepting requests
  performStartupValidation();

  // Step 2: Initialize AI Service (spec 019-ai-service-layer)
  aiService.initialize();

  // Step 2b: Initialize Prompts and Context (spec 020-system-prompts)
  initializePrompts();
  preloadAllContext();
  console.log('[Startup] Context documents loaded: approach, criteria, feedback');

  // Step 2b-ii: Initialize Prompt Loader (GitHub repository)
  if (process.env.PROMPTS_REPO_OWNER && process.env.PROMPTS_REPO_NAME) {
    const promptLoader = initializePromptLoader({
      repoOwner: process.env.PROMPTS_REPO_OWNER,
      repoName: process.env.PROMPTS_REPO_NAME,
      branch: process.env.PROMPTS_REPO_BRANCH || 'main'
    });
    await promptLoader.preloadAllPrompts();
    console.log('[Startup] Prompts loaded from GitHub repository');
  } else {
    console.log('[Startup] Using hardcoded prompts (GitHub repo not configured)');
  }

  // Step 2c: Verify Tool Factory Engine (spec 021-tool-factory-engine)
  console.log('[Startup] Tool Factory Engine ready');

  // Step 2d: Verify GitHub Deploy Service (spec 022-github-deploy-service)
  if (githubService.isConfigured()) {
    const configInfo = githubService.getConfigInfo();
    console.log(`[Startup] GitHub Deploy Service ready (${configInfo?.owner}/${configInfo?.repo})`);
  } else {
    console.log('[Startup] GitHub Deploy Service not configured (GITHUB_TOKEN/OWNER/REPO missing)');
  }

  // Step 2e: Initialize LearnWorlds Integration (spec 001-learnworlds-auth-bridge)
  // Note: This is non-blocking - we don't wait for token fetch to complete
  initializeLearnWorldsConfig();
  logLearnWorldsConfigStatus();
  if (isLearnWorldsConfigured()) {
    // Initialize auth in background - don't block server startup
    initializeLearnWorldsAuth()
      .then(success => {
        if (success) {
          console.log('[Startup] LearnWorlds Integration ready');
        } else {
          console.log('[Startup] LearnWorlds Integration configured but token fetch failed');
        }
      })
      .catch(err => {
        console.error('[Startup] LearnWorlds auth initialization error:', err);
      });
    console.log('[Startup] LearnWorlds Integration initializing in background...');
  } else {
    console.log('[Startup] LearnWorlds Integration not configured (optional)');
  }

  // Step 3: Initialize Supabase (primary database)
  const usesSupabase = await initializeSupabase();

  // Step 3b: Initialize MongoDB (legacy - optional - T058)
  const usesMongoDB = await initializeDatabase();

  // Step 4: Seed example jobs for demo purposes (only for in-memory)
  if (!usesMongoDB && !usesSupabase) {
    seedExampleJobs();
  }

  // Step 5: Start HTTP server (even in CONFIG_ERROR state)
  app.listen(PORT, () => {
    console.log(`[Startup] Server running on port ${PORT}`);

    // Determine storage type
    let storageType = 'In-Memory';
    if (usesSupabase && usesMongoDB) {
      storageType = 'Supabase + MongoDB';
    } else if (usesSupabase) {
      storageType = 'Supabase';
    } else if (usesMongoDB) {
      storageType = 'MongoDB';
    }
    console.log(`[Startup] Storage: ${storageType}`);

    if (!isConfigurationValid()) {
      console.log('[Startup] WARNING: Server is running but core operations are BLOCKED');
      console.log('[Startup] Fix configuration and restart to enable operations');
    } else {
      console.log('[Startup] All systems operational');
    }
  });
}

// Start the server
startServer();

export default app;
