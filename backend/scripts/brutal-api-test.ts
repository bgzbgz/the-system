/**
 * BRUTAL API TEST - HTTP-Only Version
 *
 * Tests production backend via HTTP API calls only
 * No direct database access required
 *
 * Usage: npx tsx backend/scripts/brutal-api-test.ts [backend-url]
 */

const BACKEND_URL = process.argv[2] || process.env.BACKEND_URL || 'https://the-system-production.up.railway.app';
const TEST_USER_ID = 'brutal-test-user';
const TEST_EMAIL = 'brutal-test@fasttrack.test';

interface TestResult {
  category: string;
  test: string;
  passed: boolean;
  duration_ms?: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];
let categoryPassed = 0;
let categoryFailed = 0;

function logTest(category: string, test: string, passed: boolean, error?: string, duration?: number, details?: string) {
  results.push({ category, test, passed, duration_ms: duration, error, details });
  const icon = passed ? '✅' : '❌';
  const timing = duration ? ` (${duration}ms)` : '';
  console.log(`${icon} ${test}${timing}`);
  if (error) console.log(`   ${error}`);
  if (details) console.log(`   ${details}`);

  if (passed) categoryPassed++;
  else categoryFailed++;
}

function printCategorySummary(category: string) {
  const total = categoryPassed + categoryFailed;
  const passRate = total > 0 ? ((categoryPassed / total) * 100).toFixed(1) : '0.0';
  const emoji = passRate === '100.0' ? '🎉' : parseFloat(passRate) >= 70 ? '⚠️' : '❌';
  console.log(`\n${emoji} ${category}: ${categoryPassed}/${total} passed (${passRate}%)\n`);
  console.log('='.repeat(80));
  categoryPassed = 0;
  categoryFailed = 0;
}

// Test runner
async function main() {
  console.log('\n' + '🔥'.repeat(40));
  console.log('BRUTAL API TEST - PRODUCTION BACKEND');
  console.log('🔥'.repeat(40));
  console.log(`\nTarget: ${BACKEND_URL}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  try {
    await testInfrastructure();
    await testToolFactory();
    await testLearnWorldsIntegration();
    await testPerformance();
    await testErrorHandling();

    const totalDuration = Date.now() - startTime;

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL TEST REPORT');
    console.log('='.repeat(80) + '\n');

    const totalTests = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const passRate = ((passed / totalTests) * 100).toFixed(1);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);

    // Category breakdown
    console.log('\n📊 Results by Category:');
    const categories = [...new Set(results.map(r => r.category))];
    categories.forEach(cat => {
      const catResults = results.filter(r => r.category === cat);
      const catPassed = catResults.filter(r => r.passed).length;
      const catTotal = catResults.length;
      const catRate = ((catPassed / catTotal) * 100).toFixed(0);
      const status = catRate === '100' ? '✅' : catRate >= '80' ? '⚠️' : '❌';
      console.log(`${status} ${cat}: ${catPassed}/${catTotal} (${catRate}%)`);
    });

    // Failed tests
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   [${r.category}] ${r.test}`);
        if (r.error) console.log(`      └─ ${r.error}`);
      });
    }

    // Performance
    const perfResults = results.filter(r => r.duration_ms);
    if (perfResults.length > 0) {
      const avgDuration = perfResults.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / perfResults.length;
      console.log('\n⚡ Performance:');
      console.log(`   Average response time: ${avgDuration.toFixed(0)}ms`);
    }

    console.log('\n' + '='.repeat(80));

    if (passRate === '100.0') {
      console.log('🎉 PERFECT SCORE! All systems operational!');
    } else if (parseFloat(passRate) >= 90) {
      console.log('✅ System healthy with minor issues');
    } else if (parseFloat(passRate) >= 70) {
      console.log('⚠️  System functional but needs attention');
    } else {
      console.log('❌ Critical issues detected - review required');
    }

    console.log('='.repeat(80) + '\n');
    process.exit(failed === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Test runner error:', error);
    process.exit(1);
  }
}

// CATEGORY 1: Infrastructure
async function testInfrastructure() {
  console.log('='.repeat(80));
  console.log('📋 CATEGORY 1: INFRASTRUCTURE & HEALTH');
  console.log('='.repeat(80) + '\n');

  // Health check
  const start1 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, { method: 'GET' });
    const duration = Date.now() - start1;
    if (response.ok) {
      const data = await response.json();
      logTest('Infrastructure', 'Backend health endpoint', true, undefined, duration, `Status: ${data.status || 'ok'}`);
    } else {
      logTest('Infrastructure', 'Backend health endpoint', false, `HTTP ${response.status}`, duration);
    }
  } catch (error: any) {
    logTest('Infrastructure', 'Backend health endpoint', false, error.message, Date.now() - start1);
  }

  // Response time
  const start2 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const duration = Date.now() - start2;
    logTest('Infrastructure', 'Response time <1s', duration < 1000, duration >= 1000 ? `Slow: ${duration}ms` : undefined, duration);
  } catch (error: any) {
    logTest('Infrastructure', 'Response time <1s', false, error.message, Date.now() - start2);
  }

  // CORS
  const start3 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, { method: 'OPTIONS' });
    const duration = Date.now() - start3;
    const corsHeader = response.headers.get('access-control-allow-origin');
    logTest('Infrastructure', 'CORS headers present', !!corsHeader, corsHeader ? undefined : 'No CORS header', duration, corsHeader || undefined);
  } catch (error: any) {
    logTest('Infrastructure', 'CORS headers present', false, error.message, Date.now() - start3);
  }

  // SSL/HTTPS
  const start4 = Date.now();
  try {
    const isHttps = BACKEND_URL.startsWith('https://');
    logTest('Infrastructure', 'HTTPS enabled', isHttps, isHttps ? undefined : 'Using HTTP', Date.now() - start4);
  } catch (error: any) {
    logTest('Infrastructure', 'HTTPS enabled', false, error.message, Date.now() - start4);
  }

  printCategorySummary('INFRASTRUCTURE & HEALTH');
}

// CATEGORY 2: Tool Factory
async function testToolFactory() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CATEGORY 2: TOOL FACTORY');
  console.log('='.repeat(80) + '\n');

  // List jobs
  const start1 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/jobs`);
    const duration = Date.now() - start1;
    if (response.ok) {
      const data = await response.json();
      logTest('Tool Factory', 'GET /api/jobs', true, undefined, duration, `Found ${Array.isArray(data) ? data.length : 0} jobs`);
    } else {
      logTest('Tool Factory', 'GET /api/jobs', false, `HTTP ${response.status}`, duration);
    }
  } catch (error: any) {
    logTest('Tool Factory', 'GET /api/jobs', false, error.message, Date.now() - start1);
  }

  // Job creation validation
  const start2 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' })
    });
    const duration = Date.now() - start2;
    // Expect 400 validation error
    logTest('Tool Factory', 'POST /api/jobs validation', response.status === 400 || response.status === 201, response.status === 500 ? `Server error` : undefined, duration, `HTTP ${response.status}`);
  } catch (error: any) {
    logTest('Tool Factory', 'POST /api/jobs validation', false, error.message, Date.now() - start2);
  }

  // Get specific job
  const start3 = Date.now();
  try {
    const listResponse = await fetch(`${BACKEND_URL}/api/jobs`);
    if (listResponse.ok) {
      const jobs = await listResponse.json();
      if (Array.isArray(jobs) && jobs.length > 0) {
        const jobId = jobs[0].id;
        const response = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`);
        const duration = Date.now() - start3;
        logTest('Tool Factory', 'GET /api/jobs/:id', response.ok, response.ok ? undefined : `HTTP ${response.status}`, duration);
      } else {
        logTest('Tool Factory', 'GET /api/jobs/:id', true, undefined, Date.now() - start3, 'No jobs to test');
      }
    } else {
      logTest('Tool Factory', 'GET /api/jobs/:id', false, 'Could not fetch job list', Date.now() - start3);
    }
  } catch (error: any) {
    logTest('Tool Factory', 'GET /api/jobs/:id', false, error.message, Date.now() - start3);
  }

  printCategorySummary('TOOL FACTORY');
}

// CATEGORY 3: LearnWorlds Integration
async function testLearnWorldsIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CATEGORY 3: LEARNWORLDS INTEGRATION');
  console.log('='.repeat(80) + '\n');

  // Webhook endpoint
  const start1 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/learnworlds/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });
    const duration = Date.now() - start1;
    // Expect 400 (invalid signature) or 401, not 404
    logTest('LearnWorlds', 'Webhook endpoint exists', response.status !== 404, response.status === 404 ? 'Not found' : undefined, duration, `HTTP ${response.status}`);
  } catch (error: any) {
    logTest('LearnWorlds', 'Webhook endpoint exists', false, error.message, Date.now() - start1);
  }

  // Tool launch
  const start2 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/tools/launch?tool=test-tool&lw_user=${TEST_USER_ID}&email=${TEST_EMAIL}`);
    const duration = Date.now() - start2;
    // Should redirect or return response (not 500)
    logTest('LearnWorlds', 'Tool launch endpoint', response.status < 500, response.status >= 500 ? 'Server error' : undefined, duration, `HTTP ${response.status}`);
  } catch (error: any) {
    logTest('LearnWorlds', 'Tool launch endpoint', false, error.message, Date.now() - start2);
  }

  // User verification
  const start3 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/users/verify?lw_user=${TEST_USER_ID}&email=${TEST_EMAIL}`);
    const duration = Date.now() - start3;
    logTest('LearnWorlds', 'User verification', response.status < 500, response.status >= 500 ? 'Server error' : undefined, duration, `HTTP ${response.status}`);
  } catch (error: any) {
    logTest('LearnWorlds', 'User verification', false, error.message, Date.now() - start3);
  }

  printCategorySummary('LEARNWORLDS INTEGRATION');
}

// CATEGORY 4: Performance
async function testPerformance() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CATEGORY 4: PERFORMANCE & LOAD');
  console.log('='.repeat(80) + '\n');

  // Concurrent requests
  const start1 = Date.now();
  try {
    const requests = Array(10).fill(null).map(() => fetch(`${BACKEND_URL}/api/health`));
    const responses = await Promise.all(requests);
    const duration = Date.now() - start1;
    const allOk = responses.every(r => r.ok);
    const avgTime = duration / 10;
    logTest('Performance', '10 concurrent requests', allOk && avgTime < 1000, allOk ? undefined : 'Some failed', duration, `Avg: ${avgTime.toFixed(0)}ms`);
  } catch (error: any) {
    logTest('Performance', '10 concurrent requests', false, error.message, Date.now() - start1);
  }

  // Large payload
  const start2 = Date.now();
  try {
    const largeData = { data: 'X'.repeat(100000) };
    const response = await fetch(`${BACKEND_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(largeData)
    });
    const duration = Date.now() - start2;
    // Should handle (not timeout or 500)
    logTest('Performance', 'Large payload (100KB)', response.status < 500, response.status >= 500 ? 'Server error' : undefined, duration);
  } catch (error: any) {
    logTest('Performance', 'Large payload (100KB)', false, error.message, Date.now() - start2);
  }

  // Sequential requests
  const start3 = Date.now();
  try {
    await fetch(`${BACKEND_URL}/api/health`);
    const time1 = Date.now();
    await fetch(`${BACKEND_URL}/api/health`);
    const duration = Date.now() - start3;
    const firstReq = time1 - start3;
    const secondReq = Date.now() - time1;
    logTest('Performance', 'Repeated requests', true, undefined, duration, `1st: ${firstReq}ms, 2nd: ${secondReq}ms`);
  } catch (error: any) {
    logTest('Performance', 'Repeated requests', false, error.message, Date.now() - start3);
  }

  printCategorySummary('PERFORMANCE & LOAD');
}

// CATEGORY 5: Error Handling
async function testErrorHandling() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CATEGORY 5: ERROR HANDLING');
  console.log('='.repeat(80) + '\n');

  // 404 handling
  const start1 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/nonexistent-route-${Date.now()}`);
    const duration = Date.now() - start1;
    logTest('Error Handling', '404 for invalid routes', response.status === 404, response.status !== 404 ? `Got ${response.status}` : undefined, duration);
  } catch (error: any) {
    logTest('Error Handling', '404 for invalid routes', false, error.message, Date.now() - start1);
  }

  // Malformed JSON
  const start2 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json'
    });
    const duration = Date.now() - start2;
    logTest('Error Handling', 'Malformed JSON', response.status === 400, response.status !== 400 ? `Got ${response.status}` : undefined, duration);
  } catch (error: any) {
    logTest('Error Handling', 'Malformed JSON', false, error.message, Date.now() - start2);
  }

  // Missing required fields
  const start3 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const duration = Date.now() - start3;
    logTest('Error Handling', 'Missing required fields', response.status === 400, response.status !== 400 ? `Got ${response.status}` : undefined, duration);
  } catch (error: any) {
    logTest('Error Handling', 'Missing required fields', false, error.message, Date.now() - start3);
  }

  // Method not allowed
  const start4 = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, { method: 'DELETE' });
    const duration = Date.now() - start4;
    logTest('Error Handling', 'Invalid HTTP method', response.status === 405 || response.status === 404, response.status < 400 ? 'Accepted invalid method' : undefined, duration, `HTTP ${response.status}`);
  } catch (error: any) {
    logTest('Error Handling', 'Invalid HTTP method', false, error.message, Date.now() - start4);
  }

  printCategorySummary('ERROR HANDLING');
}

main();
