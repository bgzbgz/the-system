/**
 * Database Startup Hook
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml: Connect and initialize on server start
 */

import { connectDB, disconnectDB, isConnected, checkConnection } from './connection';
import { initializeDatabase } from './init';

/**
 * Startup result
 */
export interface StartupResult {
  success: boolean;
  connected: boolean;
  error?: string;
}

/**
 * Database startup hook
 * Call this on server start to:
 * 1. Connect to MongoDB
 * 2. Create indexes (idempotent)
 * 3. Seed system context (idempotent)
 *
 * @returns Startup result
 */
export async function startupDatabase(): Promise<StartupResult> {
  try {
    console.log('[Startup] Initializing database connection...');

    // Connect to MongoDB
    const db = await connectDB();

    // Initialize indexes and seed data
    await initializeDatabase(db);

    // Verify connection is healthy
    const status = await checkConnection();

    if (!status.connected) {
      return {
        success: false,
        connected: false,
        error: status.error || 'Connection verification failed'
      };
    }

    console.log(`[Startup] Database ready (latency: ${status.latency_ms}ms)`);

    return {
      success: true,
      connected: true
    };
  } catch (error) {
    console.error('[Startup] Database initialization failed:', error);

    return {
      success: false,
      connected: false,
      error: (error as Error).message
    };
  }
}

/**
 * Database shutdown hook
 * Call this on server shutdown to gracefully close connection
 */
export async function shutdownDatabase(): Promise<void> {
  try {
    await disconnectDB();
    console.log('[Shutdown] Database connection closed');
  } catch (error) {
    console.error('[Shutdown] Error closing database connection:', error);
  }
}

/**
 * Get database status for health checks
 */
export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  latency_ms?: number;
  error?: string;
}> {
  if (!isConnected()) {
    return {
      connected: false,
      error: 'Database not connected'
    };
  }

  return await checkConnection();
}
