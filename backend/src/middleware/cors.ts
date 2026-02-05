/**
 * CORS Configuration Middleware
 * Spec: 016-backend-api (T059)
 *
 * Configures Cross-Origin Resource Sharing for the API
 */

import cors from 'cors';

/**
 * Allowed origins for CORS
 * Includes all common dev ports to prevent port conflicts
 */
const ALLOWED_ORIGINS = [
  // Common dev server ports
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4173', // Vite preview
  'http://localhost:5173', // Vite dev server
  'http://localhost:5174', // Vite fallback port
  'http://localhost:5175', // Vite fallback port
  'http://localhost:5176', // Vite fallback port
  'http://localhost:5177', // Vite fallback port
  'http://localhost:5178', // Vite fallback port
  'http://localhost:8000',
  'http://localhost:8080',
  // GitHub Pages - deployed tools
  'https://bgzbgz.github.io',
  // Railway production - Boss Office frontend
  'https://bossoffice.up.railway.app',
];

/**
 * Allowed HTTP methods
 */
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

/**
 * Allowed headers
 */
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Callback-Secret' // For n8n callbacks
];

/**
 * CORS middleware configuration
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Allow any origin in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ALLOWED_METHODS,
  allowedHeaders: ALLOWED_HEADERS,
  credentials: true,
  maxAge: 86400 // 24 hours
});

export default corsMiddleware;
