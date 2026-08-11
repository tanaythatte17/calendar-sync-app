// workers/googleWebhookWorker.js
import { Worker } from 'bullmq';
import { google } from 'googleapis';
import CalendarAccount from '../models/calendarAccountModel.js';
import { performIncrementalSync, updateGoogleCalendarList } from '../services/googleService.js';
import sseService from '../services/sseService.js';
import dotenv from 'dotenv';
import logger from "../utils/logger.js";
import { bullmqRedisConnection } from '../config/bullmqConnection.js';

dotenv.config();

// Worker for Google Events Webhook
export const googleEventsWorker = new Worker(
  'google-webhook',
  async (job) => {
    const { calendarId, accountId } = job.data;

    logger.info(`Processing webhook job for calendar: ${calendarId}`);

    const calendarAccount = await CalendarAccount.findById(accountId);
    if (!calendarAccount || !calendarAccount.refreshToken) {
      throw new Error('Calendar account or refresh token not found');
    }

    logger.info('Calendar account found:', calendarAccount.email);
    
    const calendarInfo = calendarAccount.calendarList.find(
      (c) => c.calendarId === calendarId
    );
    
    if (!calendarInfo || !calendarInfo.syncToken) {
      throw new Error('No syncToken found for this calendar');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: calendarAccount.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const userId = calendarAccount.userId.toString();

    const { events, eventsProcessed, newSyncToken } = await performIncrementalSync(
      calendar,
      calendarId,
      calendarInfo.syncToken,
      accountId,
      userId
    );

    calendarInfo.syncToken = newSyncToken;
    await calendarAccount.save();

    sseService.sendSyncStatus(
      userId,
      'completed',
      `Synced ${eventsProcessed} events from Google Calendar`,
      { calendarId, eventsProcessed, provider: 'google' }
    );

    logger.info(`✅ Synced ${eventsProcessed} events for calendarId: ${calendarId}`);

    return {
      success: true,
      eventsProcessed,
      calendarId,
    };
  },
  {
    connection: bullmqRedisConnection,
    concurrency: 5, // Process up to 5 jobs simultaneously
  }
);

// Worker for Google Calendar List Webhook
export const googleCalendarListWorker = new Worker(
  'google-calendar-list',
  async (job) => {
    const { accountId } = job.data;

    logger.info(`Processing calendar list webhook job for account: ${accountId}`);

    const calendarAccount = await CalendarAccount.findById(accountId);
    if (!calendarAccount) {
      throw new Error('Calendar account not found');
    }

    // Perform calendar list sync
    await updateGoogleCalendarList(calendarAccount);

    // Send SSE update to user
    sseService.sendCalendarListUpdate(
      calendarAccount.userId.toString(),
      calendarAccount.calendarList,
      'updated'
    );

    logger.info(`✅ Calendar list synced for account: ${accountId}`);

    return {
      success: true,
      accountId,
    };
  },
  {
    connection: bullmqRedisConnection,
    concurrency: 3,
  }
);

// Event listeners for monitoring
googleEventsWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

googleEventsWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed with error:`, err.message);
});

googleCalendarListWorker.on('completed', (job) => {
  logger.info(`Calendar list job ${job.id} completed successfully`);
});

googleCalendarListWorker.on('failed', (job, err) => {
  logger.error(`Calendar list job ${job.id} failed with error:`, err.message);
});