/**
 * MongoDB Database Connection
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml: Connection pooling configuration
 * Database: fast_track_tools_v4
 */

import { MongoClient, Db, Collection, Document } from 'mongodb';

// ========== CONFIGURATION ==========

/**
 * Database configuration from environment
 */
export interface DatabaseConfig {
  uri: string;
  dbName: string;
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  serverSelectionTimeoutMS: number;
  connectTimeoutMS: number;
}

/**
 * Connection status for health checks
 */
export interface ConnectionStatus {
  connected: boolean;
  latency_ms?: number;
  error?: string;
}

// ========== SINGLETON ==========

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

// ========== CONFIGURATION ==========

/**
 * Get database configuration from environment
 * Per contracts/database.yaml connection options
 */
function getConfig(): DatabaseConfig {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  return {
    uri,
    dbName: process.env.MONGODB_DB_NAME || 'fast_track_tools_v4',
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10),
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '5', 10),
    maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '60000', 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
    connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000', 10)
  };
}

// ========== CONNECTION MANAGEMENT ==========

/**
 * Connect to MongoDB with connection pooling
 * Returns existing connection if already connected
 *
 * @returns MongoDB database instance
 */
export async function connectDB(): Promise<Db> {
  // Return existing connection
  if (db) {
    return db;
  }

  // Wait for in-progress connection
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = (async () => {
    try {
      const config = getConfig();

      console.log(`[MongoDB] Connecting to database: ${config.dbName}`);
      console.log(`[MongoDB] Pool size: ${config.minPoolSize}-${config.maxPoolSize}`);

      client = new MongoClient(config.uri, {
        maxPoolSize: config.maxPoolSize,
        minPoolSize: config.minPoolSize,
        maxIdleTimeMS: config.maxIdleTimeMS,
        serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
        connectTimeoutMS: config.connectTimeoutMS
      });

      await client.connect();
      db = client.db(config.dbName);

      console.log(`[MongoDB] Connected successfully to ${config.dbName}`);

      return db;
    } catch (error) {
      connectionPromise = null;
      console.error('[MongoDB] Connection failed:', error);
      throw error;
    }
  })();

  return connectionPromise;
}

/**
 * Get database instance
 * Throws if not connected
 *
 * @returns MongoDB database instance
 */
export function getDB(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

/**
 * Get database instance safely (returns null if not connected)
 *
 * @returns MongoDB database instance or null
 */
export function getDBSafe(): Db | null {
  return db;
}

/**
 * Check if database is connected
 *
 * @returns true if connected
 */
export function isConnected(): boolean {
  return db !== null && client !== null;
}

/**
 * Disconnect from MongoDB
 * Should be called on application shutdown
 */
export async function disconnectDB(): Promise<void> {
  if (client) {
    console.log('[MongoDB] Disconnecting...');
    await client.close();
    client = null;
    db = null;
    connectionPromise = null;
    console.log('[MongoDB] Disconnected');
  }
}

// ========== HEALTH CHECK ==========

/**
 * Check database connection health
 * Pings the database and measures latency
 *
 * @returns Connection status with latency
 */
export async function checkConnection(): Promise<ConnectionStatus> {
  if (!db || !client) {
    return {
      connected: false,
      error: 'Database not connected'
    };
  }

  try {
    const start = Date.now();
    await db.command({ ping: 1 });
    const latency = Date.now() - start;

    return {
      connected: true,
      latency_ms: latency
    };
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message
    };
  }
}

// ========== COLLECTION HELPERS ==========

/**
 * Collection names per spec
 */
export const COLLECTIONS = {
  JOBS: 'jobs',
  AUDIT_LOG: 'audit_log',
  SYSTEM_CONTEXT: 'system_context',
  DEPLOYED_TOOLS: 'deployed_tools'
} as const;

/**
 * Get a collection from the database
 *
 * @param name - Collection name
 * @returns MongoDB collection
 */
export function getCollection<T extends Document>(name: string): Collection<T> {
  return getDB().collection<T>(name);
}

/**
 * Get tool response collection name for a tool slug
 * Per spec: tool_{slug}_responses
 *
 * @param slug - Tool slug
 * @returns Collection name
 */
export function getToolResponseCollectionName(slug: string): string {
  return `tool_${slug}_responses`;
}
