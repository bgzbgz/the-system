# Railway Environment Configuration Fix

**Critical**: Set NODE_ENV to production

## Why This is Important

Currently Railway has:
```
NODE_ENV=development
```

This causes:
- ❌ CORS allows ALL origins (security risk)
- ❌ Detailed error messages exposed
- ❌ No production optimizations

## How to Fix (Choose One Method)

### Method 1: Via Railway Dashboard (Easiest)

1. Go to https://railway.app
2. Select project "agile-compassion"
3. Click on service "the-system"
4. Go to "Variables" tab
5. Find `NODE_ENV`
6. Change value from `development` to `production`
7. Click "Save"
8. Service will automatically redeploy

### Method 2: Via Railway CLI

```bash
cd backend
railway variables set NODE_ENV=production --service the-system
```

### Method 3: Delete and Let Railway Set Default

```bash
# Delete the variable (Railway will set production as default)
railway variables delete NODE_ENV
```

## Verify the Fix

After changing:

```bash
# Check the variable
railway variables | grep NODE_ENV

# Expected output:
# NODE_ENV=production
```

## After Fixing

The system will:
- ✅ Only allow whitelisted CORS origins
- ✅ Return minimal error messages
- ✅ Enable production optimizations
- ✅ Pass the CORS test

## Impact

**Before Fix**: 75% infrastructure health (CORS test failing)
**After Fix**: 100% infrastructure health (all tests pass)

---

**Status**: Required before production deployment
**Time**: 2 minutes
**Risk**: None (service auto-restarts safely)
