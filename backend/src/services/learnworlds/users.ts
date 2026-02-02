/**
 * LearnWorlds Users Service
 *
 * Fetches and verifies user information from LearnWorlds API
 */

import { getLearnWorldsConfig } from '../../config/learnworlds';
import { getAccessToken } from './auth';

export interface LearnWorldsUser {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  tags?: string[];
  fields?: {
    company?: string;
    location?: string;
    phone?: string;
    bio?: string;
    [key: string]: any;
  };
  role?: {
    level: string;
    name: string;
  };
  created?: number;
  last_login?: number;
}

/**
 * Get user information from LearnWorlds by user ID
 */
export async function getUserById(userId: string): Promise<LearnWorldsUser | null> {
  const config = getLearnWorldsConfig();

  if (!config.isConfigured) {
    console.error('[LearnWorlds Users] Not configured');
    return null;
  }

  const token = await getAccessToken();
  if (!token) {
    console.error('[LearnWorlds Users] No access token available');
    return null;
  }

  try {
    console.log(`[LearnWorlds Users] Fetching user: ${userId}`);

    const response = await fetch(`${config.schoolUrl}/admin/api/v2/users/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Lw-Client': config.clientId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[LearnWorlds Users] User not found: ${userId}`);
        return null;
      }
      const errorText = await response.text();
      console.error(`[LearnWorlds Users] API error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json() as { user?: LearnWorldsUser };

    if (!data.user) {
      console.warn(`[LearnWorlds Users] No user data in response`);
      return null;
    }

    console.log(`[LearnWorlds Users] Found user: ${data.user.email}`);
    return data.user;

  } catch (error) {
    console.error('[LearnWorlds Users] Failed to fetch user:', error);
    return null;
  }
}

/**
 * Get user information from LearnWorlds by email
 */
export async function getUserByEmail(email: string): Promise<LearnWorldsUser | null> {
  const config = getLearnWorldsConfig();

  if (!config.isConfigured) {
    console.error('[LearnWorlds Users] Not configured');
    return null;
  }

  const token = await getAccessToken();
  if (!token) {
    console.error('[LearnWorlds Users] No access token available');
    return null;
  }

  try {
    console.log(`[LearnWorlds Users] Searching for user by email: ${email}`);

    const response = await fetch(`${config.schoolUrl}/admin/api/v2/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Lw-Client': config.clientId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LearnWorlds Users] API error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json() as { data?: LearnWorldsUser[] };

    if (!data.data || data.data.length === 0) {
      console.warn(`[LearnWorlds Users] No user found with email: ${email}`);
      return null;
    }

    const user = data.data[0];
    console.log(`[LearnWorlds Users] Found user: ${user.email} (${user.id})`);
    return user;

  } catch (error) {
    console.error('[LearnWorlds Users] Failed to search user:', error);
    return null;
  }
}
