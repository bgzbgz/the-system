/**
 * MongoDB Database Connection
 * Spec: 016-backend-api
 *
 * Connection pooling and database management for MongoDB
 */

import { MongoClient, Db, Collection } from 'mongodb';
import logger from '../utils/logger';

// ========== TYPES ==========

export interface DatabaseConfig {
  uri: string;
  dbName: string;
  maxPoolSize?: number;
  minPoolSize?: number;
  maxIdleTimeMS?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  latency_ms?: number;
  error?: string;
}

// ========== SINGLETON CONNECTION ==========

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

// ========== CONNECTION MANAGEMENT ==========

/**
 * Get MongoDB connection configuration from environment
 */
function getConfig(): DatabaseConfig {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  return {
    uri,
    dbName: process.env.MONGODB_DB_NAME || 'fast_track_tools',
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10),
    maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '30000', 10)
  };
}

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

      logger.info('Connecting to MongoDB', {
        dbName: config.dbName,
        maxPoolSize: config.maxPoolSize
      });

      client = new MongoClient(config.uri, {
        maxPoolSize: config.maxPoolSize,
        minPoolSize: config.minPoolSize,
        maxIdleTimeMS: config.maxIdleTimeMS
      });

      await client.connect();
      db = client.db(config.dbName);

      logger.info('MongoDB connected successfully', {
        dbName: config.dbName
      });

      return db;
    } catch (error) {
      connectionPromise = null;
      logger.logError('MongoDB connection failed', error as Error);
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
    logger.info('Disconnecting from MongoDB');
    await client.close();
    client = null;
    db = null;
    connectionPromise = null;
    logger.info('MongoDB disconnected');
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
 * Get a collection from the database
 *
 * @param name - Collection name
 * @returns MongoDB collection
 */
export function getCollection<T extends Document>(name: string): Collection<T> {
  return getDB().collection<T>(name);
}

/**
 * Collection names
 */
export const COLLECTIONS = {
  JOBS: 'jobs',
  AUDIT_EVENTS: 'audit_events'
} as const;

// ========== INDEX CREATION ==========

/**
 * Create required indexes for jobs collection
 */
export async function createJobIndexes(): Promise<void> {
  const jobs = getCollection(COLLECTIONS.JOBS);

  await jobs.createIndex({ job_id: 1 }, { unique: true });
  await jobs.createIndex({ slug: 1 }, { unique: true });
  await jobs.createIndex({ status: 1 });
  await jobs.createIndex({ created_at: -1 });

  logger.info('Job indexes created');
}

/**
 * Create required indexes for audit_events collection
 */
export async function createAuditIndexes(): Promise<void> {
  const auditEvents = getCollection(COLLECTIONS.AUDIT_EVENTS);

  await auditEvents.createIndex({ job_id: 1, timestamp: 1 });
  await auditEvents.createIndex({ timestamp: -1 });

  logger.info('Audit event indexes created');
}

/**
 * Create all required indexes
 * Call this after connecting to database
 */
export async function createAllIndexes(): Promise<void> {
  await createJobIndexes();
  await createAuditIndexes();
}

// ========== EXPORTS ==========

export default {
  connectDB,
  getDB,
  getDBSafe,
  isConnected,
  disconnectDB,
  checkConnection,
  getCollection,
  createAllIndexes,
  COLLECTIONS
};
