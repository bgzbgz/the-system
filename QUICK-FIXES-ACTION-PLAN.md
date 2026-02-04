# ⚡ QUICK FIXES - Action Plan

**Estimated Time**: 45 minutes total
**Impact**: Fixes critical issues before deployment

---

## 🔴 FIX #1: Set NODE_ENV to Production (5 min)

**Problem**: Railway has `NODE_ENV=development` which breaks CORS and security

**Fix**:
```bash
# In Railway dashboard or CLI
railway variables set NODE_ENV=production
```

**OR via Railway CLI**:
```bash
cd backend
railway variables set NODE_ENV=production --service the-system
```

**Verify**:
```bash
railway variables | grep NODE_ENV
```

---

## 🔴 FIX #2: Add Rate Limiting (30 min)

**Problem**: No rate limiting = vulnerable to spam and DoS

**Step 1**: Install package
```bash
cd backend
npm install express-rate-limit
```

**Step 2**: Create rate limit middleware
Create file: `backend/src/middleware/rateLimit.ts`

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for expensive operations
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many requests, please try again later',
});

// Very strict for field saves (Feature 001)
export const fieldSaveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 saves per 5 minutes = 1 save every 6 seconds
  message: 'Auto-save rate limit exceeded',
});
```

**Step 3**: Apply rate limiting
Edit: `backend/src/index.ts`

```typescript
// Add import at top
import { apiLimiter, strictLimiter, fieldSaveLimiter } from './middleware/rateLimit';

// Add BEFORE routes (around line 108)
app.use('/api', apiLimiter); // Apply to all API routes

// Apply stricter limits to expensive endpoints (around line 122)
app.use('/api/factory', strictLimiter);
app.use('/api/field-responses', fieldSaveLimiter);
```

**Step 4**: Test
```bash
# Run rapid requests
for i in {1..10}; do curl http://localhost:3000/api/health; done
```

---

## 🟠 FIX #3: Correct Test Paths (10 min)

**Problem**: Test checks wrong webhook path

**Fix**: Update test file
Edit: `backend/scripts/brutal-api-test.ts`

```typescript
// Line ~191 - Change this:
const response = await fetch(`${BACKEND_URL}/api/webhooks/learnworlds`, {

// To this:
const response = await fetch(`${BACKEND_URL}/api/learnworlds/webhooks`, {
```

**Then re-run test**:
```bash
npx tsx backend/scripts/brutal-api-test.ts
```

Expected: LearnWorlds test should now pass (3/3)

---

## 🟠 FIX #4: Add Feature 001 Health Check (Optional, 15 min)

**Problem**: Can't monitor if compounding work tables exist

**Fix**: Extend health endpoint
Edit: `backend/src/routes/health.ts`

Add this function:
```typescript
async function checkCompoundingWorkHealth(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('schema_fields')
      .select('count')
      .limit(1);

    return !error && data !== null;
  } catch {
    return false;
  }
}
```

Update the health endpoint:
```typescript
router.get('/health', async (req: Request, res: Response) => {
  const compoundingWorkHealthy = await checkCompoundingWorkHealth();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config_state: isConfigurationValid() ? 'VALID' : 'CONFIG_ERROR',
    features: {
      compounding_work: {
        status: compoundingWorkHealthy ? 'healthy' : 'unavailable',
        tables: ['schema_fields', 'client_field_responses', 'user_tool_progress']
      }
    }
  });
});
```

---

## ✅ DEPLOYMENT CHECKLIST

**Before Deploying**:
- [ ] ✅ Fix #1: NODE_ENV=production in Railway
- [ ] ✅ Fix #2: Rate limiting implemented
- [ ] ⚠️ Fix #3: Test paths corrected (optional - for local testing)
- [ ] ⚠️ Fix #4: Health check extended (optional)

**Commit Changes**:
```bash
cd backend

git add .
git commit -m "feat: Add rate limiting and fix production config

- Add express-rate-limit middleware
- Set NODE_ENV to production
- Add rate limits: API (100/15min), Factory (20/15min), Field save (50/5min)
- Extend health check with compounding work status

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin 001-compounding-client-work
```

**Deploy to Railway**:
```bash
cd backend
railway up
```

**Verify Deployment**:
```bash
# 1. Check health
curl https://the-system-production.up.railway.app/api/health

# 2. Test rate limit (should see 429 after 100 requests)
for i in {1..105}; do
  curl -s https://the-system-production.up.railway.app/api/health | jq .
done

# 3. Check logs
railway logs --follow
```

---

## 🧪 POST-DEPLOYMENT VALIDATION

**Step 1**: Run POC Setup
```bash
npx tsx backend/scripts/setup-sprint-15-poc.ts
```

**Step 2**: Test Critical Path
```bash
# Save field
curl -X POST https://the-system-production.up.railway.app/api/field-responses \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "poc-test-user",
    "tool_slug": "sprint-01-intro",
    "field_id": "foundation.intro.name",
    "value": "Test Company",
    "status": "draft"
  }'

# Get progress
curl "https://the-system-production.up.railway.app/api/users/poc-test-user/progress"

# Get dependencies
curl "https://the-system-production.up.railway.app/tools/sprint-15-value-prop/dependencies?user_id=poc-test-user"
```

**Step 3**: Monitor for 1 hour
```bash
railway logs --follow | grep -E "ERROR|WARN|rate limit"
```

---

## 🚨 ROLLBACK PLAN (If Issues Arise)

**Option 1**: Quick revert
```bash
git revert HEAD
git push origin 001-compounding-client-work
railway up
```

**Option 2**: Rollback Railway deployment
```bash
railway rollback
```

**Option 3**: Disable rate limiting
Edit `backend/src/index.ts`:
```typescript
// Comment out rate limiters
// app.use('/api', apiLimiter);
```

Then redeploy:
```bash
railway up
```

---

## 📊 SUCCESS CRITERIA

✅ **Deployment Successful If**:
1. Health endpoint returns 200
2. Rate limiting blocks 101st request in 15 minutes
3. LearnWorlds webhooks still work (check logs)
4. Feature 001 POC setup completes without errors
5. No errors in Railway logs for 1 hour

❌ **Rollback If**:
1. Health endpoint returns 500
2. LearnWorlds webhooks fail
3. Errors spike in logs
4. Response times > 2 seconds
5. Feature 001 endpoints return 500

---

**Time Investment**: 45 minutes
**Risk Reduction**: From MEDIUM to LOW
**Production Readiness**: From 75% to 90%
