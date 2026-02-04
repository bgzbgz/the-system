/**
 * Progress Service (Supabase)
 *
 * Manages user_tool_progress table for tracking tool unlock status
 * and sequential progression through the 31-sprint program.
 */

import { getSupabase, getTenantId } from '../client';
import { UserToolProgress, UserToolProgressInsert, ToolProgressStatus } from '../types';

/**
 * Get progress for a specific user and tool
 *
 * Implements FR-010: Track tool access status
 *
 * @param userId - User identifier
 * @param toolSlug - Tool identifier
 * @returns UserToolProgress or null if not found
 */
export async function getToolStatus(
  userId: string,
  toolSlug: string
): Promise<UserToolProgress | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('user_tool_progress')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('tool_slug', toolSlug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get tool status: ${error.message}`);
  }

  return data;
}

/**
 * Get all progress records for a user
 *
 * Implements FR-019: API endpoint to retrieve user progress across all sprints
 *
 * @param userId - User identifier
 * @returns Array of UserToolProgress objects ordered by sprint_number
 */
export async function getUserProgress(userId: string): Promise<UserToolProgress[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Join with tool_defaults to get sprint_number for sorting
  const { data, error } = await supabase
    .from('user_tool_progress')
    .select(`
      *,
      tool_defaults!inner(sprint_number, module_number, tool_name)
    `)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('sprint_number', { foreignTable: 'tool_defaults', ascending: true });

  if (error) {
    throw new Error(`Failed to get user progress: ${error.message}`);
  }

  return data || [];
}

/**
 * Update tool status for a user
 *
 * Implements FR-010: Track tool access status
 *
 * @param userId - User identifier
 * @param toolSlug - Tool identifier
 * @param status - New status
 * @param timestamps - Optional timestamps to set
 * @returns Updated UserToolProgress
 */
export async function updateToolStatus(
  userId: string,
  toolSlug: string,
  status: ToolProgressStatus,
  timestamps?: {
    started_at?: string;
    completed_at?: string;
  }
): Promise<UserToolProgress> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Prepare update data
  const updateData: any = {
    status,
    last_updated_at: new Date().toISOString(),
  };

  if (timestamps?.started_at) {
    updateData.started_at = timestamps.started_at;
  }
  if (timestamps?.completed_at) {
    updateData.completed_at = timestamps.completed_at;
  }

  // Upsert the progress record
  const { data, error } = await supabase
    .from('user_tool_progress')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        tool_slug: toolSlug,
        ...updateData,
      },
      {
        onConflict: 'tenant_id,user_id,tool_slug',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update tool status: ${error.message}`);
  }

  return data;
}

/**
 * Mark tool as in_progress when user starts
 *
 * @param userId - User identifier
 * @param toolSlug - Tool identifier
 * @returns Updated UserToolProgress
 */
export async function markToolAsInProgress(
  userId: string,
  toolSlug: string
): Promise<UserToolProgress> {
  return updateToolStatus(userId, toolSlug, 'in_progress', {
    started_at: new Date().toISOString(),
  });
}

/**
 * Mark tool as completed when user submits
 *
 * @param userId - User identifier
 * @param toolSlug - Tool identifier
 * @returns Updated UserToolProgress
 */
export async function markToolAsCompleted(
  userId: string,
  toolSlug: string
): Promise<UserToolProgress> {
  return updateToolStatus(userId, toolSlug, 'completed', {
    completed_at: new Date().toISOString(),
  });
}

/**
 * Unlock the next tool in sequence
 *
 * Implements FR-011: Automatically unlock next sprint when current submitted
 *
 * @param userId - User identifier
 * @param currentToolSlug - Tool that was just completed
 * @returns Updated UserToolProgress for next tool, or null if no next tool
 */
export async function unlockNextTool(
  userId: string,
  currentToolSlug: string
): Promise<UserToolProgress | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Get current tool's sprint_number
  const { data: currentTool, error: currentError } = await supabase
    .from('tool_defaults')
    .select('sprint_number')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', currentToolSlug)
    .single();

  if (currentError || !currentTool?.sprint_number) {
    throw new Error(`Failed to get current tool sprint number: ${currentError?.message}`);
  }

  const nextSprintNumber = currentTool.sprint_number + 1;

  // Get next tool in sequence
  const { data: nextTool, error: nextError } = await supabase
    .from('tool_defaults')
    .select('tool_slug')
    .eq('tenant_id', tenantId)
    .eq('sprint_number', nextSprintNumber)
    .single();

  if (nextError) {
    if (nextError.code === 'PGRST116') {
      // No next tool - this is the last sprint
      return null;
    }
    throw new Error(`Failed to get next tool: ${nextError.message}`);
  }

  // Unlock the next tool
  return updateToolStatus(userId, nextTool.tool_slug, 'unlocked');
}

/**
 * Initialize progress for a new user
 *
 * Sets Sprint 1 as unlocked, all others as locked
 *
 * @param userId - User identifier
 * @returns Array of created UserToolProgress records
 */
export async function initializeUserProgress(userId: string): Promise<UserToolProgress[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Get all tools ordered by sprint_number
  const { data: tools, error: toolsError } = await supabase
    .from('tool_defaults')
    .select('tool_slug, sprint_number')
    .eq('tenant_id', tenantId)
    .order('sprint_number', { ascending: true });

  if (toolsError) {
    throw new Error(`Failed to get tools for initialization: ${toolsError.message}`);
  }

  if (!tools || tools.length === 0) {
    return [];
  }

  // Create progress records for all tools
  const progressRecords: UserToolProgressInsert[] = tools.map((tool, index) => ({
    tenant_id: tenantId,
    user_id: userId,
    tool_slug: tool.tool_slug,
    status: index === 0 ? 'unlocked' : 'locked', // First tool unlocked, rest locked
    started_at: null,
    completed_at: null,
  }));

  // Batch insert all progress records
  const { data, error } = await supabase
    .from('user_tool_progress')
    .upsert(progressRecords, {
      onConflict: 'tenant_id,user_id,tool_slug',
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    throw new Error(`Failed to initialize user progress: ${error.message}`);
  }

  return data || [];
}

/**
 * Get progress statistics for a user
 *
 * @param userId - User identifier
 * @returns Progress statistics object
 */
export async function getProgressStats(userId: string): Promise<{
  total: number;
  locked: number;
  unlocked: number;
  in_progress: number;
  completed: number;
  completion_percentage: number;
}> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('user_tool_progress')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to get progress stats: ${error.message}`);
  }

  const records = data || [];
  const total = records.length;
  const locked = records.filter(r => r.status === 'locked').length;
  const unlocked = records.filter(r => r.status === 'unlocked').length;
  const in_progress = records.filter(r => r.status === 'in_progress').length;
  const completed = records.filter(r => r.status === 'completed').length;

  return {
    total,
    locked,
    unlocked,
    in_progress,
    completed,
    completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Check if user has access to a tool (status is unlocked, in_progress, or completed)
 *
 * @param userId - User identifier
 * @param toolSlug - Tool identifier
 * @returns true if user can access tool, false otherwise
 */
export async function hasToolAccess(userId: string, toolSlug: string): Promise<boolean> {
  const status = await getToolStatus(userId, toolSlug);

  if (!status) {
    // No progress record - check if this is Sprint 1 and initialize if needed
    const supabase = getSupabase();
    const tenantId = getTenantId();

    const { data: tool } = await supabase
      .from('tool_defaults')
      .select('sprint_number')
      .eq('tenant_id', tenantId)
      .eq('tool_slug', toolSlug)
      .single();

    if (tool?.sprint_number === 1) {
      // Initialize progress and allow access to Sprint 1
      await initializeUserProgress(userId);
      return true;
    }

    return false;
  }

  // User has access if status is not 'locked'
  return status.status !== 'locked';
}
