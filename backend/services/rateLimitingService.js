import rateLimit from 'express-rate-limit';

import { ipKeyGenerator } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  // Use ipKeyGenerator helper for proper IPv6 handling
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req.ip);
    return `${ip}-${req.originalUrl || req.url}`;
  }
});

// General API limiter - 10 requests per minute PER endpoint
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req.ip);
    return `${ip}-${req.originalUrl || req.url}`;
  }
});

// Event fetching - 15 requests per minute PER endpoint
export const eventLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: {
    error: "Too many requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req.ip);
    return `${ip}-${req.originalUrl || req.url}`;
  }
});

// SSE connection limiter - 10 connection attempts per minute
export const sseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: 'Too many SSE connection attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req.ip);
    return `${ip}-${req.originalUrl || req.url}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many SSE connection attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});