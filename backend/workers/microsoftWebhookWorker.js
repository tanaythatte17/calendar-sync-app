// workers/microsoftWebhookWorker.js
import { Worker } from 'bullmq';
import calendarAccount from '../models/calendarAccountModel.js';
import { refreshCalendarAccessToken } from '../utils/refreshToken.js';
import { updateMicrosoftCalendarList, performMicrosoftIncrementalSync, performMicrosoftFullSync } from '../services/microsoftService.js';
import sseService from '../services/sseService.js';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection config
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
};

// Worker for Microsoft Events Webhook
export const microsoftEventsWorker = new Worker(
  'microsoft-webhook',
  async (job) => {
    const { accountId, calendarId } = job.data;

    console.log(`Processing Microsoft webhook job for calendar: ${calendarId}`);

    // Fetch account
    const account = await calendarAccount.findById(accountId);
    if (!account) {
      throw new Error('Microsoft account not found');
    }

    // Find calendar entry
    const calendarEntry = (account.calendarList || []).find(c => c.calendarId === calendarId);
    const deltaLink = calendarEntry?.deltaLink || null;

    // Ensure fresh access token
    if (account.expiresAt && account.expiresAt < new Date()) {
      const tokens = await refreshCalendarAccessToken(
        account._id,
        account.refreshToken,
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        process.env.MICROSOFT_CLIENT_ID,
        process.env.MICROSOFT_CLIENT_SECRET
      );
      account.accessToken = tokens.accessToken;
      await account.save();
    }

    const headers = {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json'
    };

    // Define time range (2 years past/future)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 2);
    const endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 2);
    const startTime = startDate.toISOString();
    const endTime = endDate.toISOString();

    const persistDelta = async (newDeltaLink) => {
      if (!newDeltaLink) return;
      await calendarAccount.updateOne(
        { _id: account._id, 'calendarList.calendarId': calendarId },
        { $set: { 'calendarList.$.deltaLink': newDeltaLink } }
      );
    };

    let eventsProcessed = 0;
    const userId = account.userId.toString();

    try {
      if (deltaLink) {
        // Incremental sync
        const { eventsProcessed: incrementalEvents, newDeltaLink } = await performMicrosoftIncrementalSync(
          calendarId,
          deltaLink,
          headers,
          account._id,
          startTime,
          endTime,
          userId
        );
        eventsProcessed = incrementalEvents;
        await persistDelta(newDeltaLink);
      } else {
        // Full sync if no deltaLink
        const { eventsProcessed: fullEvents, newDeltaLink } = await performMicrosoftFullSync(
          calendarId,
          headers,
          account._id,
          startTime,
          endTime
        );
        eventsProcessed = fullEvents;
        await persistDelta(newDeltaLink);
      }

      // Send SSE update to user
      sseService.sendSyncStatus(
        userId,
        'completed',
        `Synced ${eventsProcessed} events from Microsoft Calendar`,
        { calendarId, eventsProcessed, provider: 'microsoft' }
      );

      console.log(`✅ Synced ${eventsProcessed} Microsoft events for calendar: ${calendarId}`);

      return {
        success: true,
        eventsProcessed,
        calendarId,
      };
    } catch (err) {
      // If deltaLink expired (HTTP 410), fallback to full sync
      if (err?.response?.status === 410) {
        console.log('Delta link expired, performing full sync...');
        const { eventsProcessed: fullEvents, newDeltaLink } = await performMicrosoftFullSync(
          calendarId,
          headers,
          account._id,
          startTime,
          endTime
        );
        await persistDelta(newDeltaLink);
        
        sseService.sendSyncStatus(
          userId,
          'completed',
          `Synced ${fullEvents} events from Microsoft Calendar (full sync)`,
          { calendarId, eventsProcessed: fullEvents, provider: 'microsoft' }
        );

        return {
          success: true,
          eventsProcessed: fullEvents,
          calendarId,
          fallbackToFull: true,
        };
      }
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Worker for Microsoft Calendar List Webhook
export const microsoftCalendarListWorker = new Worker(
  'microsoft-calendar-list',
  async (job) => {
    const { accountId } = job.data;

    console.log(`Processing Microsoft calendar list webhook job for account: ${accountId}`);

    const account = await calendarAccount.findById(accountId);
    if (!account) {
      throw new Error('Microsoft account not found');
    }

    // Ensure fresh access token
    if (account.expiresAt && account.expiresAt < new Date()) {
      const tokens = await refreshCalendarAccessToken(
        account._id,
        account.refreshToken,
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        process.env.MICROSOFT_CLIENT_ID,
        process.env.MICROSOFT_CLIENT_SECRET
      );
      account.accessToken = tokens.accessToken;
      await account.save();
    }

    const headers = {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json'
    };

    // Update calendar list
    await updateMicrosoftCalendarList(account, headers);

    // Send SSE update to user
    sseService.sendCalendarListUpdate(
      account.userId.toString(),
      account.calendarList,
      'updated'
    );

    console.log(`✅ Calendar list synced for Microsoft account: ${accountId}`);

    return {
      success: true,
      accountId,
    };
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Event listeners for monitoring
microsoftEventsWorker.on('completed', (job) => {
  console.log(`Microsoft events job ${job.id} completed successfully`);
});

microsoftEventsWorker.on('failed', (job, err) => {
  console.error(`Microsoft events job ${job.id} failed with error:`, err.message);
});

microsoftCalendarListWorker.on('completed', (job) => {
  console.log(`Microsoft calendar list job ${job.id} completed successfully`);
});

microsoftCalendarListWorker.on('failed', (job, err) => {
  console.error(`Microsoft calendar list job ${job.id} failed with error:`, err.message);
});