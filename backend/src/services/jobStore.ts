/**
 * Fast Track - In-Memory Job Store
 * Simple store for demo/development without MongoDB
 */

import { Job, JobStatus, FileType, CategoryType, jobToResponse, JobResponse } from '../models/job';
import * as fs from 'fs';
import * as path from 'path';

// In-memory storage
const jobs: Map<string, Job> = new Map();

/**
 * Save a job to the store
 */
export function saveJob(job: Job): void {
  jobs.set(job.job_id, { ...job });
  console.log(`[JobStore] Saved job ${job.job_id} (status: ${job.status})`);
}

/**
 * Get a job by ID
 */
export function getJob(jobId: string): Job | null {
  const job = jobs.get(jobId);
  return job ? { ...job } : null;
}

/**
 * Update a job
 */
export function updateJob(jobId: string, updates: Partial<Job>): Job | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  const updatedJob = { ...job, ...updates };
  jobs.set(jobId, updatedJob);
  console.log(`[JobStore] Updated job ${jobId} (status: ${updatedJob.status})`);
  return { ...updatedJob };
}

/**
 * Get all jobs
 */
export function getAllJobs(): Job[] {
  return Array.from(jobs.values()).map(job => ({ ...job }));
}

/**
 * Get jobs by status
 */
export function getJobsByStatus(status: JobStatus): Job[] {
  return Array.from(jobs.values())
    .filter(job => job.status === status)
    .map(job => ({ ...job }));
}

/**
 * Get jobs for inbox (READY_FOR_REVIEW status)
 */
export function getInboxJobs(): JobResponse[] {
  return getJobsByStatus(JobStatus.READY_FOR_REVIEW)
    .sort((a, b) => {
      const aTime = a.callback_received_at?.getTime() || a.created_at.getTime();
      const bTime = b.callback_received_at?.getTime() || b.created_at.getTime();
      return bTime - aTime; // Newest first
    })
    .map(job => jobToResponse(job));
}

/**
 * Get job detail with full HTML
 */
export function getJobDetail(jobId: string): Job | null {
  return getJob(jobId);
}

/**
 * Clear all jobs (for testing)
 */
export function clearJobs(): void {
  jobs.clear();
  console.log('[JobStore] Cleared all jobs');
}

/**
 * Get job count
 */
export function getJobCount(): number {
  return jobs.size;
}

/**
 * Seed example jobs for demo purposes
 * Uses the actual Hiring Decision Calculator and Market Size Tool
 */
export function seedExampleJobs(): void {
  const now = new Date();
  const exampleJobs: Partial<Job>[] = [
    {
      job_id: 'DEMO-001',
      slug: 'demo-hiring-calculator',
      file_name: 'hire.md',
      file_content: 'Demo content for hiring decision calculator',
      category: CategoryType.B2B_SERVICE,
      decision: 'Should I hire this candidate?',
      teaching_point: 'Hiring decisions require objective evaluation criteria',
      inputs: 'Candidate skills, experience, cultural fit',
      verdict_criteria: 'Score above 70% indicates strong candidate',
      original_filename: 'hire.md',
      file_type: FileType.MD,
      file_size_bytes: 15360,
      file_storage_key: 'demo/hire.md',
      created_at: new Date(Date.now() - 3600000), // 1 hour ago
      updated_at: new Date(Date.now() - 1800000),
      status: JobStatus.READY_FOR_REVIEW,
      submitted_at: new Date(Date.now() - 3500000),
      tool_id: 'tool-hiring-001',
      tool_name: 'Hiring Decision Calculator',
      tool_html: getHiringDecisionCalculatorHtml(),
      qa_status: 'PASS',
      qa_report: {
        score: 94,
        max_score: 100,
        passed: true,
        findings: [
          { check: 'Brand compliance', passed: true },
          { check: 'Mobile responsive', passed: true },
          { check: 'Input validation', passed: true },
          { check: 'Clear scoring', passed: true },
          { check: 'Multi-step flow', passed: true }
        ]
      },
      callback_received_at: new Date(Date.now() - 1800000) // 30 min ago
    },
    {
      job_id: 'DEMO-002',
      slug: 'demo-roi-calculator',
      file_name: 'roi-calculator.md',
      file_content: 'Demo content for ROI calculator',
      category: CategoryType.B2B_PRODUCT,
      decision: 'Is this investment worthwhile?',
      teaching_point: 'ROI calculation helps make informed investment decisions',
      inputs: 'Investment amount, expected returns, timeframe',
      verdict_criteria: 'ROI above 20% indicates good investment',
      original_filename: 'roi-calculator.md',
      file_type: FileType.MD,
      file_size_bytes: 12000,
      file_storage_key: 'demo/roi-calculator.md',
      created_at: new Date(Date.now() - 7200000), // 2 hours ago
      updated_at: new Date(Date.now() - 3600000),
      status: JobStatus.READY_FOR_REVIEW,
      submitted_at: new Date(Date.now() - 7000000),
      tool_id: 'tool-roi-001',
      tool_name: 'ROI Calculator',
      tool_html: getMarketSizeToolHtml(),
      qa_status: 'PASS',
      qa_report: {
        score: 91,
        max_score: 100,
        passed: true,
        findings: [
          { check: 'Brand compliance', passed: true },
          { check: 'Mobile responsive', passed: true },
          { check: 'Clear calculations', passed: true },
          { check: 'Investment analysis', passed: true }
        ]
      },
      callback_received_at: new Date(Date.now() - 3600000) // 1 hour ago
    }
  ];

  exampleJobs.forEach(job => {
    if (job.job_id && !jobs.has(job.job_id)) {
      jobs.set(job.job_id, job as Job);
      console.log(`[JobStore] Seeded example job: ${job.job_id}`);
    }
  });
}

/**
 * Get the Hiring Decision Calculator HTML from file
 */
function getHiringDecisionCalculatorHtml(): string {
  try {
    // Try to read from the generated-tool-demo.html file
    const projectRoot = path.resolve(__dirname, '../../..');
    const filePath = path.join(projectRoot, 'generated-tool-demo.html');
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('[JobStore] Failed to load Hiring Decision Calculator HTML:', error);
    return getFallbackHiringHtml();
  }
}

/**
 * Get a simple ROI Calculator HTML (works without external CDNs)
 */
function getMarketSizeToolHtml(): string {
  return getSimpleROICalculatorHtml();
}

/**
 * Simple ROI Calculator - vanilla JS, no external dependencies
 */
function getSimpleROICalculatorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROI Calculator | Fast Track</title>
    <style>
        @font-face {
            font-family: 'Plaak';
            src: url('https://fasttrack-diagnostic.com/fonts/Plaak3Trial-43-Bold.woff2') format('woff2');
            font-weight: bold;
        }
        @font-face {
            font-family: 'Riforma';
            src: url('https://fasttrack-diagnostic.com/fonts/RiformaLL-Regular.woff2') format('woff2');
            font-weight: normal;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
            --ft-black: #000000;
            --ft-white: #FFFFFF;
            --ft-grey: #B2B2B2;
            --ft-yellow: #FFF469;
            --ft-green: #4ECDC4;
            --ft-red: #FF6B6B;
            --font-heading: 'Plaak', 'Arial Black', sans-serif;
            --font-body: 'Riforma', 'Helvetica Neue', sans-serif;
        }
        html { font-size: 16px; }
        body {
            font-family: var(--font-body);
            background-color: var(--ft-black);
            color: var(--ft-white);
            min-height: 100vh;
            line-height: 1.6;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
        .cover-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 2rem;
        }
        .cover-page h1 {
            font-family: var(--font-heading);
            font-size: 3.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 1rem;
        }
        .cover-tagline { font-size: 1.5rem; color: var(--ft-grey); margin-bottom: 3rem; }
        .btn {
            font-family: var(--font-body);
            font-size: 1rem;
            padding: 1rem 2rem;
            border: 3px solid var(--ft-white);
            background: transparent;
            color: var(--ft-white);
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            transition: all 0.2s ease;
            border-radius: 0;
        }
        .btn:hover { background: var(--ft-white); color: var(--ft-black); }
        .btn-primary { background: var(--ft-yellow); border-color: var(--ft-yellow); color: var(--ft-black); }
        .btn-primary:hover { background: var(--ft-white); border-color: var(--ft-white); }
        .btn-secondary { border-color: var(--ft-grey); color: var(--ft-grey); }
        .btn-secondary:hover { background: var(--ft-grey); color: var(--ft-black); }
        .page { display: none; min-height: 100vh; padding: 2rem; }
        .page.active { display: block; }
        .intro-page { display: flex; flex-direction: column; justify-content: center; }
        .intro-page h2 { font-family: var(--font-heading); font-size: 2rem; margin-bottom: 2rem; }
        .intro-page p { font-size: 1.1rem; margin-bottom: 1.5rem; color: var(--ft-grey); }
        .intro-page .btn { align-self: flex-start; margin-top: 2rem; }
        .tool-page { padding-top: 4rem; }
        .progress-bar { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 3rem; }
        .progress-dot { width: 12px; height: 12px; border: 2px solid var(--ft-grey); background: transparent; }
        .progress-dot.active { background: var(--ft-yellow); border-color: var(--ft-yellow); }
        .progress-dot.completed { background: var(--ft-white); border-color: var(--ft-white); }
        .tool-step { max-width: 600px; margin: 0 auto; }
        .step-header { margin-bottom: 2rem; }
        .step-number { font-size: 0.875rem; color: var(--ft-grey); text-transform: uppercase; letter-spacing: 0.1em; }
        .step-title { font-family: var(--font-heading); font-size: 2rem; margin: 0.5rem 0; }
        .step-description { color: var(--ft-grey); }
        .input-group { margin-bottom: 1.5rem; }
        .input-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .tool-input {
            width: 100%;
            padding: 1rem;
            font-family: var(--font-body);
            font-size: 1rem;
            background: transparent;
            border: 3px solid var(--ft-white);
            color: var(--ft-white);
            border-radius: 0;
        }
        .tool-input:focus { outline: none; border-color: var(--ft-yellow); }
        .tool-input::placeholder { color: var(--ft-grey); }
        select.tool-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 1rem center; padding-right: 3rem; }
        .step-navigation { display: flex; justify-content: space-between; margin-top: 3rem; gap: 1rem; }
        .step-navigation .btn:only-child { margin-left: auto; }
        .results-page { text-align: center; padding-top: 4rem; }
        .results-page h2 { font-family: var(--font-heading); font-size: 2.5rem; margin-bottom: 1rem; }
        .score-display { margin: 3rem 0; }
        .score-number { font-family: var(--font-heading); font-size: 4rem; line-height: 1; }
        .verdict { font-family: var(--font-heading); font-size: 1.5rem; margin-top: 1rem; text-transform: uppercase; }
        .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 2rem 0; max-width: 500px; margin-left: auto; margin-right: auto; }
        .metric { padding: 1.5rem; border: 3px solid var(--ft-white); text-align: center; }
        .metric-label { font-size: 0.75rem; color: var(--ft-grey); text-transform: uppercase; margin-bottom: 0.5rem; }
        .metric-value { font-family: var(--font-heading); font-size: 1.5rem; }
        .recommendation { max-width: 500px; margin: 2rem auto; font-size: 1.1rem; color: var(--ft-grey); }
        .results-actions { display: flex; justify-content: center; gap: 1rem; margin-top: 3rem; flex-wrap: wrap; }
        .footer { text-align: center; padding: 2rem; color: var(--ft-grey); font-size: 0.875rem; }
        @media (max-width: 640px) {
            .cover-page h1 { font-size: 2.5rem; }
            .score-number { font-size: 3rem; }
            .step-navigation { flex-direction: column; }
            .metrics { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div id="cover" class="page active">
        <div class="cover-page">
            <h1>ROI Calculator</h1>
            <p class="cover-tagline">Make smarter investment decisions with data.</p>
            <button class="btn btn-primary" onclick="showPage('intro')">Start</button>
        </div>
    </div>
    <div id="intro" class="page">
        <div class="container intro-page">
            <h2>Is this investment worth it?</h2>
            <p>Return on Investment (ROI) is the key metric for evaluating whether an investment makes financial sense. A positive ROI means you're making money; a negative ROI means you're losing it.</p>
            <p>This tool helps you calculate ROI quickly and understand what your investment returns really mean for your business decisions.</p>
            <button class="btn btn-primary" onclick="showPage('tool')">Calculate ROI</button>
        </div>
    </div>
    <div id="tool" class="page">
        <div class="container tool-page">
            <div class="progress-bar" id="progressBar">
                <div class="progress-dot active" data-step="1"></div>
                <div class="progress-dot" data-step="2"></div>
            </div>
            <form id="toolForm">
                <div class="tool-step" data-step="1" style="display: block;">
                    <div class="step-header">
                        <span class="step-number">Step 1 of 2</span>
                        <h2 class="step-title">Investment Details</h2>
                        <p class="step-description">Enter your initial investment and expected costs.</p>
                    </div>
                    <div class="input-group">
                        <label for="investment">Initial Investment Amount ($)</label>
                        <input type="number" id="investment" class="tool-input" placeholder="e.g., 50000" data-input-id="investment">
                    </div>
                    <div class="input-group">
                        <label for="additionalCosts">Additional Costs ($)</label>
                        <input type="number" id="additionalCosts" class="tool-input" placeholder="e.g., 5000" data-input-id="additionalCosts">
                    </div>
                    <div class="input-group">
                        <label for="timeframe">Investment Timeframe</label>
                        <select id="timeframe" class="tool-input" data-input-id="timeframe">
                            <option value="">Select...</option>
                            <option value="6">6 months</option>
                            <option value="12">1 year</option>
                            <option value="24">2 years</option>
                            <option value="36">3 years</option>
                        </select>
                    </div>
                    <div class="step-navigation">
                        <button type="button" class="btn btn-primary next-btn">Next</button>
                    </div>
                </div>
                <div class="tool-step" data-step="2" style="display: none;">
                    <div class="step-header">
                        <span class="step-number">Step 2 of 2</span>
                        <h2 class="step-title">Expected Returns</h2>
                        <p class="step-description">Estimate your expected gains from this investment.</p>
                    </div>
                    <div class="input-group">
                        <label for="expectedReturn">Expected Total Return ($)</label>
                        <input type="number" id="expectedReturn" class="tool-input" placeholder="e.g., 75000" data-input-id="expectedReturn">
                    </div>
                    <div class="input-group">
                        <label for="confidence">Confidence Level</label>
                        <select id="confidence" class="tool-input" data-input-id="confidence">
                            <option value="">Select...</option>
                            <option value="high">High - Based on solid data</option>
                            <option value="medium">Medium - Reasonable estimates</option>
                            <option value="low">Low - Speculative</option>
                        </select>
                    </div>
                    <div class="step-navigation">
                        <button type="button" class="btn btn-secondary prev-btn">Previous</button>
                        <button type="button" class="btn btn-primary calculate-btn">Calculate</button>
                    </div>
                </div>
            </form>
        </div>
    </div>
    <div id="results" class="page">
        <div class="container results-page">
            <h2>Your ROI Results</h2>
            <div class="score-display">
                <div class="score-number" id="roiNumber">--</div>
                <div class="verdict" id="verdict">Calculating...</div>
            </div>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-label">Net Profit</div>
                    <div class="metric-value" id="netProfit">$0</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Total Cost</div>
                    <div class="metric-value" id="totalCost">$0</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Monthly Return</div>
                    <div class="metric-value" id="monthlyReturn">$0</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Payback Period</div>
                    <div class="metric-value" id="payback">-- months</div>
                </div>
            </div>
            <p class="recommendation" id="recommendation"></p>
            <div class="results-actions">
                <button class="btn btn-secondary" onclick="resetTool()">Start Over</button>
                <button class="btn btn-primary" onclick="exportResults()">Export Results</button>
            </div>
        </div>
    </div>
    <footer class="footer"><p>Powered by Fast Track | ROI Calculator</p></footer>
    <script>
        let currentStep = 1;
        let formData = {};
        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
            window.scrollTo(0, 0);
        }
        function showStep(stepNum) {
            document.querySelectorAll('.tool-step').forEach(s => s.style.display = 'none');
            const step = document.querySelector('[data-step="' + stepNum + '"]');
            if (step) step.style.display = 'block';
            document.querySelectorAll('.progress-dot').forEach((dot, i) => {
                dot.classList.remove('active', 'completed');
                if (i + 1 < stepNum) dot.classList.add('completed');
                if (i + 1 === stepNum) dot.classList.add('active');
            });
            currentStep = stepNum;
        }
        function calculateROI() {
            const investment = parseFloat(document.getElementById('investment').value) || 0;
            const additionalCosts = parseFloat(document.getElementById('additionalCosts').value) || 0;
            const expectedReturn = parseFloat(document.getElementById('expectedReturn').value) || 0;
            const timeframe = parseFloat(document.getElementById('timeframe').value) || 12;
            const confidence = document.getElementById('confidence').value;

            const totalCost = investment + additionalCosts;
            const netProfit = expectedReturn - totalCost;
            const roi = totalCost > 0 ? ((netProfit / totalCost) * 100) : 0;
            const monthlyReturn = netProfit / timeframe;
            const paybackMonths = monthlyReturn > 0 ? Math.ceil(totalCost / monthlyReturn) : 0;

            document.getElementById('roiNumber').textContent = roi.toFixed(1) + '%';
            document.getElementById('netProfit').textContent = '$' + netProfit.toLocaleString();
            document.getElementById('totalCost').textContent = '$' + totalCost.toLocaleString();
            document.getElementById('monthlyReturn').textContent = '$' + Math.round(monthlyReturn).toLocaleString();
            document.getElementById('payback').textContent = paybackMonths > 0 ? paybackMonths + ' months' : 'N/A';

            let verdict, color, recommendation;
            if (roi >= 50) {
                verdict = 'Excellent Investment';
                color = '#4ECDC4';
                recommendation = 'This investment shows strong potential returns. Consider moving forward with confidence, but always maintain risk management practices.';
            } else if (roi >= 20) {
                verdict = 'Good Investment';
                color = '#FFF469';
                recommendation = 'This investment shows positive returns. Proceed with standard due diligence and monitor performance closely.';
            } else if (roi >= 0) {
                verdict = 'Marginal Investment';
                color = '#FFF469';
                recommendation = 'Returns are minimal. Consider if there are better alternatives or ways to reduce costs and increase returns.';
            } else {
                verdict = 'Poor Investment';
                color = '#FF6B6B';
                recommendation = 'This investment shows negative returns. Reconsider the investment or find ways to significantly improve the expected outcome.';
            }

            document.getElementById('roiNumber').style.color = color;
            document.getElementById('verdict').textContent = verdict;
            document.getElementById('verdict').style.color = color;
            document.getElementById('recommendation').textContent = recommendation;

            showPage('results');
        }
        function resetTool() {
            document.getElementById('toolForm').reset();
            currentStep = 1;
            showStep(1);
            showPage('cover');
        }
        function exportResults() {
            const roi = document.getElementById('roiNumber').textContent;
            const verdict = document.getElementById('verdict').textContent;
            const netProfit = document.getElementById('netProfit').textContent;
            const text = 'ROI Calculator Results\\n\\nROI: ' + roi + '\\nVerdict: ' + verdict + '\\nNet Profit: ' + netProfit;
            const blob = new Blob([text], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'roi-calculator-results.txt';
            a.click();
        }
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('.next-btn').forEach(btn => {
                btn.addEventListener('click', () => showStep(currentStep + 1));
            });
            document.querySelectorAll('.prev-btn').forEach(btn => {
                btn.addEventListener('click', () => showStep(currentStep - 1));
            });
            document.querySelectorAll('.calculate-btn').forEach(btn => {
                btn.addEventListener('click', calculateROI);
            });
        });
    </script>
</body>
</html>`;
}

/**
 * Fallback Hiring Decision Calculator if file not found
 */
function getFallbackHiringHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hiring Decision Calculator | Fast Track</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #000; color: #fff; padding: 24px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; max-width: 600px; }
    h1 { font-size: 32px; text-transform: uppercase; margin-bottom: 24px; }
    p { color: #B2B2B2; margin-bottom: 24px; }
    .btn { padding: 16px 32px; background: #FFF469; color: #000; font-size: 16px; font-weight: bold; border: none; cursor: pointer; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hiring Decision Calculator</h1>
    <p>Take the guesswork out of your next hiring decision.</p>
    <button class="btn">Tool Loading Error - Please refresh</button>
  </div>
</body>
</html>`;
}

/**
 * Fallback Market Size Tool if file not found
 */
function getFallbackMarketSizeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Market Size Tool | Fast Track</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #000; color: #fff; padding: 24px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; max-width: 600px; }
    h1 { font-size: 32px; text-transform: uppercase; margin-bottom: 24px; }
    p { color: #B2B2B2; margin-bottom: 24px; }
    .btn { padding: 16px 32px; background: #FFF469; color: #000; font-size: 16px; font-weight: bold; border: none; cursor: pointer; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Market Size Tool</h1>
    <p>Calculate your Total Addressable Market and 3-year forecast.</p>
    <button class="btn">Tool Loading Error - Please refresh</button>
  </div>
</body>
</html>`;
}
