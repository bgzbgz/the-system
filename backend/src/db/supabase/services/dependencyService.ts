/**
 * Dependency Service (Supabase)
 *
 * Manages tool dependencies - fetching required field values from previous sprints
 * to display in locked boxes. Core service for the compounding work feature.
 */

import { getSupabase, getTenantId } from '../client';
import { ToolDependency, ClientFieldResponse } from '../types';
import { getFieldResponsesByIds } from './fieldResponseService';
import { getFieldsByIds } from './schemaFieldService';

/**
 * Dependency with fetched value
 */
export interface DependencyWithValue extends ToolDependency {
  value: unknown | null;
  is_locked: boolean; // true if value is null (not completed)
  field_name: string;
  source_sprint_number: number | null;
}

/**
 * Get dependencies configuration for a tool from tool_defaults.tool_config
 *
 * Implements FR-006: Define dependencies for each tool
 *
 * @param toolSlug - Tool identifier
 * @returns Array of ToolDependency objects from tool_config.dependencies
 */
export async function getDependenciesForTool(toolSlug: string): Promise<ToolDependency[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_defaults')
    .select('tool_config')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Tool not found - return empty dependencies
      return [];
    }
    throw new Error(`Failed to get dependencies for tool ${toolSlug}: ${error.message}`);
  }

  // Parse dependencies from tool_config JSONB
  const toolConfig = data.tool_config as any;
  const dependencies = toolConfig?.dependencies || [];

  // Validate dependency structure
  return dependencies.filter((dep: any) => {
    return (
      dep &&
      typeof dep.field_id === 'string' &&
      typeof dep.is_required === 'boolean' &&
      typeof dep.label === 'string'
    );
  }) as ToolDependency[];
}

/**
 * Fetch dependency values for a user
 *
 * Implements FR-007: Fetch dependency values from client_field_responses
 * Implements FR-044: Only status="submitted" responses are returned
 *
 * @param userId - User identifier
 * @param dependencies - Array of dependencies to fetch
 * @returns Array of dependencies with their values
 */
export async function fetchDependencyValues(
  userId: string,
  dependencies: ToolDependency[]
): Promise<DependencyWithValue[]> {
  if (dependencies.length === 0) {
    return [];
  }

  // Extract all field_ids needed
  const fieldIds = dependencies.map(dep => dep.field_id);

  // Batch fetch all field responses (only submitted ones - FR-044)
  const responses = await getFieldResponsesByIds(userId, fieldIds, 'submitted');

  // Batch fetch schema field metadata for field names and sprint numbers
  const schemaFields = await getFieldsByIds(fieldIds);
  const schemaFieldMap = new Map(schemaFields.map(f => [f.field_id, f]));

  // Create a map of field_id -> response for quick lookup
  const responseMap = new Map<string, ClientFieldResponse>();
  responses.forEach(response => {
    responseMap.set(response.field_id, response);
  });

  // Combine dependencies with their values
  return dependencies.map(dep => {
    const response = responseMap.get(dep.field_id);
    const schemaField = schemaFieldMap.get(dep.field_id);

    return {
      ...dep,
      value: response?.value || null,
      is_locked: !response, // Locked if no submitted response exists
      field_name: schemaField?.field_name || dep.field_id,
      source_sprint_number: schemaField?.sprint_number || null,
    };
  });
}

/**
 * Check if all required dependencies are satisfied
 *
 * Implements FR-009: Prevent access to tool if required dependencies incomplete
 * Implements FR-026: Check required dependencies validation
 *
 * @param userId - User identifier
 * @param dependencies - Array of dependencies to check
 * @returns Object with satisfied status and list of missing required fields
 */
export async function checkRequiredDependencies(
  userId: string,
  dependencies: ToolDependency[]
): Promise<{
  satisfied: boolean;
  missingRequired: string[];
  totalRequired: number;
  totalOptional: number;
}> {
  const requiredDeps = dependencies.filter(dep => dep.is_required);
  const optionalDeps = dependencies.filter(dep => !dep.is_required);

  if (requiredDeps.length === 0) {
    // No required dependencies - always satisfied
    return {
      satisfied: true,
      missingRequired: [],
      totalRequired: 0,
      totalOptional: optionalDeps.length,
    };
  }

  // Fetch values for required dependencies only
  const depsWithValues = await fetchDependencyValues(userId, requiredDeps);

  // Find which required dependencies are locked (missing)
  const missingRequired = depsWithValues
    .filter(dep => dep.is_locked)
    .map(dep => dep.field_id);

  return {
    satisfied: missingRequired.length === 0,
    missingRequired,
    totalRequired: requiredDeps.length,
    totalOptional: optionalDeps.length,
  };
}

/**
 * Get complete dependency data for a tool and user (with values)
 *
 * Implements FR-016: API endpoint to retrieve all dependencies with data
 * This is the main function used by the tool serving endpoint
 *
 * @param toolSlug - Tool identifier
 * @param userId - User identifier
 * @returns Object with dependencies, access check, and metadata
 */
export async function getDependenciesWithValues(
  toolSlug: string,
  userId: string
): Promise<{
  dependencies: DependencyWithValue[];
  access: {
    allowed: boolean;
    missingRequired: string[];
  };
  meta: {
    totalDependencies: number;
    requiredCount: number;
    optionalCount: number;
    satisfiedCount: number;
  };
}> {
  // Get dependency configuration
  const dependencies = await getDependenciesForTool(toolSlug);

  if (dependencies.length === 0) {
    return {
      dependencies: [],
      access: { allowed: true, missingRequired: [] },
      meta: {
        totalDependencies: 0,
        requiredCount: 0,
        optionalCount: 0,
        satisfiedCount: 0,
      },
    };
  }

  // Fetch values for all dependencies
  const depsWithValues = await fetchDependencyValues(userId, dependencies);

  // Check required dependencies
  const accessCheck = await checkRequiredDependencies(userId, dependencies);

  // Calculate metadata
  const satisfiedCount = depsWithValues.filter(dep => !dep.is_locked).length;

  return {
    dependencies: depsWithValues,
    access: {
      allowed: accessCheck.satisfied,
      missingRequired: accessCheck.missingRequired,
    },
    meta: {
      totalDependencies: dependencies.length,
      requiredCount: accessCheck.totalRequired,
      optionalCount: accessCheck.totalOptional,
      satisfiedCount,
    },
  };
}

/**
 * Get dependency status summary for multiple tools (for progress dashboard)
 *
 * @param userId - User identifier
 * @param toolSlugs - Array of tool identifiers
 * @returns Map of tool_slug -> dependency status
 */
export async function getDependencyStatusForTools(
  userId: string,
  toolSlugs: string[]
): Promise<Map<string, { satisfied: boolean; missingCount: number }>> {
  const statusMap = new Map<string, { satisfied: boolean; missingCount: number }>();

  // Process each tool
  for (const toolSlug of toolSlugs) {
    try {
      const dependencies = await getDependenciesForTool(toolSlug);
      const check = await checkRequiredDependencies(userId, dependencies);

      statusMap.set(toolSlug, {
        satisfied: check.satisfied,
        missingCount: check.missingRequired.length,
      });
    } catch (error) {
      // If tool doesn't exist or error, mark as satisfied (no dependencies)
      statusMap.set(toolSlug, {
        satisfied: true,
        missingCount: 0,
      });
    }
  }

  return statusMap;
}
