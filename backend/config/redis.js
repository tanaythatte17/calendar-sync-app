import Redis from 'ioredis';

// Create Redis client
export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Retry strategy
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Connection options
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // Timeouts
  connectTimeout: 10000,
  commandTimeout: 5000,
});

// Connection event handlers
redisClient.on('connect', () => {
  console.log('✅ Redis: Connecting...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis: Connected and ready');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redisClient.on('close', () => {
  console.log('⚠️  Redis: Connection closed');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis: Reconnecting...');
});

// Helper functions for common operations
export const redisHelpers = {
  /**
   * Get and parse JSON from Redis
   */
  async getJSON(key) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Redis getJSON error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set JSON with optional TTL
   */
  async setJSON(key, value, ttlSeconds = null) {
    try {
      const stringified = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.setex(key, ttlSeconds, stringified);
      } else {
        await redisClient.set(key, stringified);
      }
      return true;
    } catch (error) {
      console.error(`Redis setJSON error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete one or multiple keys
   */
  async del(...keys) {
    try {
      await redisClient.del(...keys);
      return true;
    } catch (error) {
      console.error(`Redis del error:`, error);
      return false;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Set key with TTL
   */
  async setWithTTL(key, value, ttlSeconds) {
    try {
      await redisClient.setex(key, ttlSeconds, value);
      return true;
    } catch (error) {
      console.error(`Redis setWithTTL error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get TTL for a key
   */
  async getTTL(key) {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      console.error(`Redis getTTL error for key ${key}:`, error);
      return -1;
    }
  },

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error(`Redis deletePattern error for pattern ${pattern}:`, error);
      return 0;
    }
  },

  /**
   * Ping Redis to check connection
   */
  async ping() {
    try {
      const result = await redisClient.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping error:', error);
      return false;
    }
  },
};

// Health check endpoint helper
export async function getRedisHealth() {
  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      connected: redisClient.status === 'ready',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      connected: false,
    };
  }
}

export default redisClient;