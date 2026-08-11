// workers/googleInitialSyncWorker.js
import { Worker } from 'bullmq';
import CalendarAccount from '../models/calendarAccountModel.js';
import { sync } from '../services/googleService.js';
import sseService from '../services/sseService.js';
import dotenv from 'dotenv';
import logger from "../utils/logger.js";
import { bullmqRedisConnection } from '../config/bullmqConnection.js';

dotenv.config();

// Worker for Google initial (first-time) full calendar sync
export const googleInitialSyncWorker = new Worker(
  'google-initial-sync',
  async (job) => {
    const { userId, userEmail, accountId } = job.data;

    logger.info(`Processing Google initial sync job for account: ${accountId}`);

    await CalendarAccount.updateOne({ _id: accountId }, { syncStatus: 'syncing' });

    sseService.sendSyncStatus(
      userId,
      'started',
      'Starting initial calendar sync...',
      { provider: 'google', email: userEmail, accountId }
    );

    const result = await sync(userId, userEmail);

    await CalendarAccount.updateOne({ _id: accountId }, { syncStatus: 'idle' });

    sseService.sendSyncStatus(
      userId,
      'completed',
      'Initial calendar sync complete',
      {
        provider: 'google',
        email: userEmail,
        accountId,
        calendarsSynced: result.calendars,
        eventsProcessed: result.totalEventsProcessed,
      }
    );

    logger.info(`✅ Google initial sync complete for account: ${accountId}`);

    return {
      success: true,
      accountId,
      calendarsSynced: result.calendars,
      eventsProcessed: result.totalEventsProcessed,
    };
  },
  {
    connection: bullmqRedisConnection,
    concurrency: 2, // Heavier job than webhook deltas: full multi-calendar, multi-year fetch
  }
);

googleInitialSyncWorker.on('completed', (job) => {
  logger.info(`Google initial sync job ${job.id} completed successfully`);
});

googleInitialSyncWorker.on('failed', async (job, err) => {
  logger.error(`Google initial sync job ${job.id} failed with error:`, err.message);

  if (job.attemptsMade >= job.opts.attempts) {
    const { userId, userEmail, accountId } = job.data;
    await CalendarAccount.updateOne({ _id: accountId }, { syncStatus: 'error' });
    sseService.sendSyncStatus(
      userId,
      'error',
      'Calendar sync failed',
      { provider: 'google', email: userEmail, accountId, error: err.message }
    );
  }
});
