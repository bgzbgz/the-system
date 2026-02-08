/**
 * Tool Wrapper Service
 *
 * Fetches tool HTML from GitHub Pages, resolves sprint dependencies,
 * and injects a dependency banner + bridge script into the HTML.
 * Serves the enhanced page so tools gain compounding-work features
 * without any factory changes.
 */

import { getSupabase, getTenantId } from '../db/supabase/client';
import { DependencyWithValue } from '../db/supabase/services/dependencyService';

// ========== HTML CACHE ==========

interface CacheEntry {
  html: string;
  fetchedAt: number;
}

const htmlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch tool HTML from GitHub Pages with 10-minute in-memory cache
 */
export async function fetchToolHtml(githubUrl: string): Promise<string> {
  const now = Date.now();
  const cached = htmlCache.get(githubUrl);

  if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.html;
  }

  const response = await fetch(githubUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch tool HTML from ${githubUrl}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  htmlCache.set(githubUrl, { html, fetchedAt: now });

  return html;
}

// ========== DEPENDENCY RESOLUTION ==========

export interface SprintDependency {
  sprint: number;
  toolName: string;
  toolSlug: string;
  completed: boolean;
}

/**
 * Get sprint-level dependencies for a given sprint number.
 * Returns which prior sprints are needed and whether they're completed.
 */
export async function getSprintDependencies(
  sprintNumber: number,
  userId: string
): Promise<SprintDependency[]> {
  if (sprintNumber <= 1) return []; // Sprint 1 has no prerequisites

  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Get all tools with sprint_number < current, ordered by sprint
  const { data: priorTools, error } = await supabase
    .from('tool_defaults')
    .select('tool_slug, tool_name, sprint_number')
    .eq('tenant_id', tenantId)
    .lt('sprint_number', sprintNumber)
    .not('sprint_number', 'is', null)
    .order('sprint_number', { ascending: true });

  if (error || !priorTools) {
    console.warn(`[ToolWrapper] Failed to get prior sprints: ${error?.message}`);
    return [];
  }

  // Check completion status for each prior sprint tool
  const toolSlugs = priorTools.map(t => t.tool_slug);

  const { data: progressRecords } = await supabase
    .from('user_tool_progress')
    .select('tool_slug, status')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .in('tool_slug', toolSlugs);

  const progressMap = new Map(
    (progressRecords || []).map(r => [r.tool_slug, r.status])
  );

  return priorTools.map(tool => ({
    sprint: tool.sprint_number,
    toolName: tool.tool_name || `Sprint ${tool.sprint_number}`,
    toolSlug: tool.tool_slug,
    completed: progressMap.get(tool.tool_slug) === 'completed',
  }));
}

// ========== LOCKED BOXES HTML ==========

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Build HTML for the sprint dependency banner
 */
export function buildSprintBannerHtml(
  sprintNumber: number,
  dependencies: SprintDependency[]
): string {
  const completedCount = dependencies.filter(d => d.completed).length;
  const totalCount = dependencies.length;

  if (totalCount === 0) {
    // Sprint 1 or no prior sprints
    return `
      <div id="ft-sprint-banner" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <span style="font-weight: 600;">Sprint ${sprintNumber} of 31</span>
        <span style="opacity: 0.8;">|</span>
        <span>First sprint — no prerequisites needed</span>
      </div>
    `;
  }

  const allComplete = completedCount === totalCount;
  const bannerBg = allComplete
    ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';

  const sprintItems = dependencies.map(dep => {
    const icon = dep.completed ? '&#10003;' : '&#9679;';
    const style = dep.completed
      ? 'color: #27ae60; font-weight: 600;'
      : 'color: #e74c3c; font-weight: 600;';
    return `<span style="${style}">${icon} Sprint ${dep.sprint}</span>`;
  }).join(' ');

  return `
    <div id="ft-sprint-banner" style="
      background: ${bannerBg};
      color: white;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    ">
      <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;"
           onclick="document.getElementById('ft-sprint-details').style.display = document.getElementById('ft-sprint-details').style.display === 'none' ? 'block' : 'none'">
        <span style="font-weight: 600;">Sprint ${sprintNumber} of 31</span>
        <span style="opacity: 0.8;">|</span>
        <span>${completedCount} of ${totalCount} prerequisites completed</span>
        <span style="margin-left: auto; font-size: 12px;">&#9660;</span>
      </div>
      <div id="ft-sprint-details" style="
        display: none;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255,255,255,0.3);
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      ">
        ${sprintItems}
      </div>
    </div>
  `;
}

// ========== BRIDGE SCRIPT ==========

/**
 * Generate the bridge script that intercepts tool submissions
 * and triggers completion tracking
 */
export function buildBridgeScript(config: {
  apiBase: string;
  slug: string;
  userId: string;
  sprintNumber: number;
}): string {
  return `
<script>
(function() {
  var FT_CONFIG = {
    apiBase: ${JSON.stringify(config.apiBase)},
    slug: ${JSON.stringify(config.slug)},
    userId: ${JSON.stringify(config.userId)},
    sprintNumber: ${config.sprintNumber}
  };

  // Intercept fetch to detect tool response submissions
  var _fetch = window.fetch;
  window.fetch = function(url, opts) {
    var result = _fetch.apply(this, arguments);

    // Detect tool response POST (to /responses endpoint)
    if (typeof url === 'string' && url.indexOf('/responses') !== -1 && opts && opts.method === 'POST') {
      result.then(function(response) {
        if (response.ok) {
          // Fire-and-forget: mark sprint complete + unlock next
          _fetch(FT_CONFIG.apiBase + '/tools/' + FT_CONFIG.slug + '/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: FT_CONFIG.userId })
          }).catch(function() {});
        }
      }).catch(function() {});
    }

    return result;
  };

  console.log('[FastTrack] Bridge loaded for Sprint ' + FT_CONFIG.sprintNumber + ' (' + FT_CONFIG.slug + ')');
})();
</script>
`;
}

// ========== HTML INJECTION ==========

/**
 * Inject the dependency banner and bridge script into tool HTML.
 * Inserts banner after <body> and script before </body>.
 */
export function injectIntoToolHtml(
  toolHtml: string,
  bannerHtml: string,
  bridgeScript: string
): string {
  let result = toolHtml;

  // Inject banner after <body> tag
  const bodyOpenMatch = result.match(/<body[^>]*>/i);
  if (bodyOpenMatch) {
    const insertPos = (bodyOpenMatch.index || 0) + bodyOpenMatch[0].length;
    result = result.slice(0, insertPos) + '\n' + bannerHtml + '\n' + result.slice(insertPos);
  } else {
    // No <body> tag — prepend banner
    result = bannerHtml + '\n' + result;
  }

  // Inject bridge script before </body>
  const bodyCloseIndex = result.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    result = result.slice(0, bodyCloseIndex) + '\n' + bridgeScript + '\n' + result.slice(bodyCloseIndex);
  } else {
    // No </body> — append
    result = result + '\n' + bridgeScript;
  }

  return result;
}
