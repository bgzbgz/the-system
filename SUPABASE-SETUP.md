# Supabase Setup Guide

## ✅ Migration Status

**COMPLETED** - The backend has been successfully migrated to Supabase!

### What's Using Supabase:
- ✅ Jobs (all CRUD operations)
- ✅ Job Artifacts (tool_html, preview_html, source_file)
- ✅ Audit Logs (via auditService)
- ✅ AI Cost Tracking (via costService)
- ✅ Health checks

### Routes Updated:
- ✅ `/api/jobs` - All job endpoints
- ✅ `/api/health` - Database connection check
- ✅ `/api/audit` - Audit log queries
- ✅ `/api/factory/callback` - Factory callbacks (deprecated)
- ✅ `/api/factory/deploy-callback` - Deploy callbacks (deprecated)

### Services Created:
**Tier 1 - Foundation:**
- ✅ tenantService - Tenant management
- ✅ userService - User management

**Tier 2 - Core:**
- ✅ jobService - Job CRUD operations
- ✅ jobArtifactService - Artifact storage

**Tier 3 - Features:**
- ✅ toolResponseService - Tool response tracking
- ✅ qualityScoreService - Quality scoring
- ✅ auditService - Audit logging
- ✅ costService - AI cost tracking

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - **Name:** `fast-track-tools`
   - **Database Password:** (save this!)
   - **Region:** Choose closest to your users
4. Wait ~2 minutes for setup

## Step 2: Get Your Credentials

Go to **Settings → API** and copy:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc... (public key)
SUPABASE_SERVICE_KEY=eyJhbGc... (secret key - for backend)
```

## Step 3: Run the Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Copy the contents of `backend/supabase/schema.sql`
4. Paste and click **Run**

This creates:
- ✅ 8 tables (tenants, users, jobs, job_artifacts, audit_log, tool_responses, quality_scores, ai_costs)
- ✅ All indexes
- ✅ RLS policies for tenant isolation
- ✅ Default tenant for testing

## Step 4: Update Your .env

Add to `backend/.env`:

```env
# ===========================================
# SUPABASE (replacing MongoDB)
# ===========================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 5: Install Supabase SDK

```bash
cd backend
npm install @supabase/supabase-js
```

## Step 6: Verify Migration ✅

The migration is complete! The backend now uses Supabase for all job-related operations.

### Verification Checklist:

1. **Check Startup Logs:**
   ```
   [Startup] Supabase connected (latency: XXms)
   [Startup] Storage: Supabase + MongoDB
   ```

2. **Test Health Endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should show: `"database": { "status": "connected", "latency_ms": XX }`

3. **Test Job Creation:**
   ```bash
   curl -X POST http://localhost:3001/api/jobs \
     -H "Content-Type: application/json" \
     -d '{
       "file_name": "Test Tool",
       "file_content": "A test tool for verification",
       "category": "B2C_SERVICE",
       "decision": "Test decision",
       "teaching_point": "Test learning",
       "inputs": "Test inputs",
       "verdict_criteria": "Test criteria"
     }'
   ```

4. **Verify in Supabase Dashboard:**
   - Go to Table Editor → `jobs` table
   - Check that the test job appears
   - Go to `job_artifacts` table
   - Verify artifacts are stored separately

### What Still Uses MongoDB (Optional):

The following collections still use MongoDB if configured:
- Agent logs (spec 024-agent-reasoning-logs)
- Tool visits tracking
- Pending access tracking
- System context documents

These can be migrated later if needed.

---

## What You Get with Supabase

### 🔒 Automatic Tenant Isolation
Every query is automatically filtered by tenant:
```typescript
// You write this:
const jobs = await jobService.listJobs({ status: 'READY_FOR_REVIEW' });

// Supabase RLS adds:
// WHERE tenant_id = 'your-tenant-id' automatically!
```

### 📊 Built-in Dashboard
- View data in Supabase Table Editor
- Run SQL queries
- Monitor performance

### 🔄 Real-time (Future)
Can add live updates for job status:
```typescript
supabase
  .channel('jobs')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' },
    payload => console.log('Job updated:', payload))
  .subscribe()
```

### 💰 Cost Tracking
AI costs are now persisted and can be analyzed in SQL.

---

## Files Created

```
backend/
├── supabase/
│   └── schema.sql              # Database schema (run this in Supabase)
└── src/db/supabase/
    ├── index.ts                # Main exports
    ├── client.ts               # Supabase client singleton
    ├── types.ts                # TypeScript types
    └── services/
        ├── index.ts
        ├── jobService.ts       # Jobs CRUD
        ├── auditService.ts     # Audit log
        └── costService.ts      # AI cost tracking
```

---

## Troubleshooting

### "SUPABASE_URL not configured"
- Make sure you added the environment variables to `.env`, GitHub Secrets, and Railway
- Restart the server after adding variables

### "Failed to get job"
- Check that the schema.sql was run successfully in Supabase
- Verify the default tenant exists: `SELECT * FROM tenants;`
- Check RLS policies are enabled

### Job creation works but no HTML preview
- Verify job_artifacts table has the tool_html entry
- Check that `jobArtifactService.saveToolHtml()` is being called
- Look for errors in server logs related to artifact storage

### Migration Complete! 🎉

The backend now uses Supabase for persistent storage with:
- Multi-tenant support via RLS
- Automatic tenant isolation
- Separate artifact storage for large HTML files
- Built-in connection pooling and optimization
