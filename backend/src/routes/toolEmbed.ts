/**
 * Tool Embed Routes
 *
 * Provides embeddable tool access widgets for LearnWorlds courses
 * User identifies with email, we verify via LearnWorlds API
 */

import { Router, Request, Response } from 'express';
import {
  getUserByEmail,
  logToolVisit
} from '../services/learnworlds';
import { isLearnWorldsConfigured } from '../config/learnworlds';

const router = Router();

/**
 * GET /api/embed/:toolSlug
 *
 * Renders an embeddable HTML page for tool access
 * Can be placed in an iframe in LearnWorlds courses
 */
router.get('/:toolSlug', (req: Request, res: Response) => {
  const { toolSlug } = req.params;
  const { redirect } = req.query;

  // The actual tool URL - can be customized per tool
  const toolBaseUrl = redirect || `https://bgzbgz.github.io/fast-track-tool-system-v4/tools/${toolSlug}.html`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Tool</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    .logo {
      text-align: center;
      margin-bottom: 24px;
    }

    .logo-text {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .logo-text span {
      color: #4f46e5;
    }

    h1 {
      font-size: 20px;
      color: #1a1a2e;
      margin-bottom: 8px;
      text-align: center;
    }

    .subtitle {
      color: #64748b;
      font-size: 14px;
      text-align: center;
      margin-bottom: 32px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 8px;
    }

    input[type="email"] {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      font-size: 16px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input[type="email"]:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    button {
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(79, 70, 229, 0.3);
    }

    button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    .error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
    }

    .success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #16a34a;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
      text-align: center;
    }

    .remembered {
      background: #f8fafc;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
      display: none;
    }

    .remembered-email {
      font-weight: 600;
      color: #1a1a2e;
    }

    .remembered-change {
      color: #4f46e5;
      font-size: 13px;
      cursor: pointer;
      text-decoration: underline;
    }

    .tool-name {
      color: #4f46e5;
      font-weight: 600;
    }

    .loading {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div class="logo-text">Fast<span>Track</span></div>
    </div>

    <h1>Access <span class="tool-name">${toolSlug.replace(/-/g, ' ')}</span></h1>
    <p class="subtitle">Enter your email to access this tool</p>

    <div class="error" id="error"></div>
    <div class="success" id="success">Verified! Opening tool...</div>

    <div class="remembered" id="remembered">
      <div>Continue as <span class="remembered-email" id="rememberedEmail"></span></div>
      <div class="remembered-change" onclick="changeEmail()">Use different email</div>
    </div>

    <form id="accessForm">
      <div class="form-group" id="emailGroup">
        <label for="email">Your Email Address</label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="you@company.com"
          required
        >
      </div>

      <button type="submit" id="submitBtn">
        Access Tool
      </button>
    </form>
  </div>

  <script>
    const toolSlug = '${toolSlug}';
    const toolUrl = '${toolBaseUrl}';
    const verifyUrl = '/api/tools/verify';

    const form = document.getElementById('accessForm');
    const emailInput = document.getElementById('email');
    const emailGroup = document.getElementById('emailGroup');
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    const rememberedDiv = document.getElementById('remembered');
    const rememberedEmail = document.getElementById('rememberedEmail');

    // Check for remembered email
    const savedEmail = localStorage.getItem('fasttrack_email');
    const savedUserId = localStorage.getItem('fasttrack_user_id');

    if (savedEmail) {
      rememberedEmail.textContent = savedEmail;
      rememberedDiv.style.display = 'block';
      emailGroup.style.display = 'none';
      emailInput.value = savedEmail;
    }

    function changeEmail() {
      localStorage.removeItem('fasttrack_email');
      localStorage.removeItem('fasttrack_user_id');
      rememberedDiv.style.display = 'none';
      emailGroup.style.display = 'block';
      emailInput.value = '';
      emailInput.focus();
    }

    function showError(message) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
    }

    function showSuccess() {
      errorDiv.style.display = 'none';
      successDiv.style.display = 'block';
    }

    function setLoading(loading) {
      if (loading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span>Verifying...';
      } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Access Tool';
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      if (!email) {
        showError('Please enter your email address');
        return;
      }

      setLoading(true);
      errorDiv.style.display = 'none';

      try {
        const response = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, toolSlug })
        });

        const data = await response.json();

        if (data.success) {
          // Save for next time
          localStorage.setItem('fasttrack_email', email);
          localStorage.setItem('fasttrack_user_id', data.user.id);

          showSuccess();

          // Redirect to tool after short delay
          setTimeout(() => {
            // Build tool URL with user params
            const url = new URL(toolUrl);
            url.searchParams.set('user_id', data.user.id);
            url.searchParams.set('email', data.user.email);
            url.searchParams.set('name', data.user.name || '');
            url.searchParams.set('company', data.user.company || '');

            // Open in same window or parent
            if (window.parent !== window) {
              window.parent.location.href = url.toString();
            } else {
              window.location.href = url.toString();
            }
          }, 1000);
        } else {
          showError(data.error || 'Could not verify your email. Please check and try again.');
          setLoading(false);
        }
      } catch (err) {
        showError('Connection error. Please try again.');
        setLoading(false);
      }
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * POST /api/tools/verify
 *
 * Verify user email and log tool access
 * Called by the embed widget
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { email, toolSlug } = req.body;

  if (!email || !toolSlug) {
    return res.status(400).json({
      success: false,
      error: 'Email and tool slug are required'
    });
  }

  if (!isLearnWorldsConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Service not configured'
    });
  }

  try {
    // Verify user exists in LearnWorlds
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Email not found. Please use the email you registered with.'
      });
    }

    // Log the visit
    await logToolVisit(toolSlug, user, {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    console.log(`[Tool Embed] ✓ Verified: ${user.email} accessing ${toolSlug}`);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
        company: user.fields?.company
      }
    });

  } catch (error) {
    console.error('[Tool Embed] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed. Please try again.'
    });
  }
});

export default router;
