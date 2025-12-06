// services/queueService.js
import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection config
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,
    age: 24 * 3600,
  },
  removeOnFail: {
    count: 500,
  },
};

// Queue for Google Calendar Events sync
export const googleWebhookQueue = new Queue('google-webhook', {
  connection: redisConnection,
  defaultJobOptions,
});

// Queue for Google Calendar List sync
export const googleCalendarListQueue = new Queue('google-calendar-list', {
  connection: redisConnection,
  defaultJobOptions,
});

// Queue fir Microsoft Calendar Events sync
export const microsoftWebhookQueue = new Queue('microsoft-webhook', {
  connection: redisConnection,
  defaultJobOptions,  
});

// Queue for Microsoft Calendar List sync
export const microsoftCalendarListQueue = new Queue('microsoft-calendar-list', {
  connection: redisConnection,
  defaultJobOptions,
});

console.log('✅ BullMQ queues initialized');