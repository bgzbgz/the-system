/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DoS attacks
 *
 * Per backend/docs/rate-limiting.md recommendations
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limit
 * Applied to all /api routes
 *
 * Allows 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased for development)
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.log(`[Rate Limit] IP ${req.ip} exceeded general API limit`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Strict rate limit for expensive operations
 * Applied to AI-powered endpoints (tool factory)
 *
 * Allows 20 requests per 15 minutes per IP
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many tool generation requests, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[Rate Limit] IP ${req.ip} exceeded factory limit`);
    res.status(429).json({
      error: 'Too many tool generation requests, please try again later',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Field save rate limit (Feature 001 - Compounding Work)
 * Applied to /api/field-responses endpoint
 *
 * Allows 50 saves per 5 minutes per IP
 * This prevents auto-save spam while allowing normal usage
 * (50 saves / 5 min = 1 save every 6 seconds)
 */
export const fieldSaveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 saves per 5 minutes
  message: {
    error: 'Auto-save rate limit exceeded, please slow down',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[Rate Limit] IP ${req.ip} exceeded field save limit`);
    res.status(429).json({
      error: 'Auto-save rate limit exceeded, please slow down',
      retryAfter: '5 minutes'
    });
  }
});

/**
 * Webhook rate limit
 * Applied to webhook endpoints (LearnWorlds, automation)
 *
 * More lenient to accommodate legitimate webhook traffic
 * Allows 200 requests per 15 minutes per IP
 */
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 webhooks per 15 minutes
  message: {
    error: 'Webhook rate limit exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[Rate Limit] IP ${req.ip} exceeded webhook limit`);
    res.status(429).json({
      error: 'Webhook rate limit exceeded',
      retryAfter: '15 minutes'
    });
  }
});

export default apiLimiter;
