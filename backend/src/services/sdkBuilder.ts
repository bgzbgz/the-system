/**
 * SDK Builder Service
 * Reads minified SDK and injects it into generated tool HTML
 */
import * as fs from 'fs';
import * as path from 'path';

const SDK_PATH = path.join(__dirname, '..', 'templates', 'sdk.min.js');

let cachedSDK: string | null = null;

/**
 * Get the minified SDK content
 * Caches the result for performance
 */
export function getMinifiedSDK(): string {
  if (cachedSDK) {
    return cachedSDK;
  }

  try {
    cachedSDK = fs.readFileSync(SDK_PATH, 'utf-8');
    return cachedSDK;
  } catch (error) {
    console.error('[sdkBuilder] Failed to read SDK file:', error);
    throw new Error('SDK file not found. Run npm run build:sdk first.');
  }
}

/**
 * Clear the SDK cache (useful for development/testing)
 */
export function clearSDKCache(): void {
  cachedSDK = null;
}

/**
 * Inject SDK into tool HTML
 * - Adds meta tag with tool slug in <head>
 * - Adds inline script before </body>
 *
 * @param html - The generated tool HTML
 * @param slug - The tool slug identifier
 * @returns HTML with SDK injected
 */
export function injectSDK(html: string, slug: string): string {
  const sdk = getMinifiedSDK();

  // Create meta tag for tool slug
  const metaTag = `<meta name="ft-tool-slug" content="${escapeHtml(slug)}">`;

  // Create inline script tag with SDK
  const scriptTag = `<script>${sdk}</script>`;

  // Inject meta tag before </head>
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${metaTag}\n</head>`);
  } else {
    // If no </head>, inject at start of body or document
    if (html.includes('<body')) {
      html = html.replace(/<body([^>]*)>/, `<body$1>\n${metaTag}`);
    } else {
      html = metaTag + '\n' + html;
    }
  }

  // Inject SDK script before </body>
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${scriptTag}\n</body>`);
  } else {
    // If no </body>, append to end
    html = html + '\n' + scriptTag;
  }

  return html;
}

/**
 * Escape HTML special characters in slug
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if SDK file exists and is valid
 */
export function isSDKAvailable(): boolean {
  try {
    fs.accessSync(SDK_PATH, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get SDK file size in bytes
 */
export function getSDKSize(): number {
  try {
    const stats = fs.statSync(SDK_PATH);
    return stats.size;
  } catch {
    return 0;
  }
}
