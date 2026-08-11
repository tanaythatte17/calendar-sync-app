// config/bullmqConnection.js
import dotenv from 'dotenv';

dotenv.config();

// Shared Redis connection options for all BullMQ Queues and Workers.
export const bullmqRedisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
};
