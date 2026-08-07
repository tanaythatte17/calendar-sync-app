import Agenda from "agenda";
import { renewNotification } from "../services/googleService.js";
import { renewMicrosoftNotification } from "../services/microsoftService.js";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

/**
 * Agenda scheduler instance for recurring jobs.
 * Uses MongoDB to persist job state across server restarts.
 * Manages webhook renewal jobs for Google and Microsoft.
 */
const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: "agendaJobs" },
});

/**
 * Job definition: Renew Google push notification channel.
 * Stops old channel and creates new 3-day subscription.
 * Triggered 2 hours before channel expiration.
 */
agenda.define("renewGoogleNotification", async (job) => {
  const { accountId, channelType, calendarId, channelId, resourceId } = job.attrs.data;
  logger.info(`🔄 Renewing Google ${channelType} notification for account ${accountId}...`);

  try {
    await renewNotification(accountId, channelType, calendarId, channelId, resourceId);
    logger.info(`✅ Successfully renewed Google ${channelType} notification for account ${accountId}`);
  } catch (error) {
    logger.error(`❌ Failed to renew Google ${channelType} notification for account ${accountId}:`, error.message);
    throw error;
  }
});

/**
 * Job definition: Renew Microsoft change notification subscription.
 * Stops old subscription and creates new 1-day subscription.
 * Triggered 1 hour before subscription expiration.
 */
agenda.define("renewMicrosoftNotification", async (job) => {
  const { accountId, subscriptionType, calendarId, subscriptionId } = job.attrs.data;
  logger.info(`🔄 Renewing Microsoft ${subscriptionType} subscription for account ${accountId}...`);

  try {
    await renewMicrosoftNotification(accountId, subscriptionType, calendarId, subscriptionId);
    logger.info(`✅ Successfully renewed Microsoft ${subscriptionType} subscription for account ${accountId}`);
  } catch (error) {
    logger.error(`❌ Failed to renew Microsoft ${subscriptionType} subscription for account ${accountId}:`, error.message);
    throw error;
  }
});

/**
 * Schedule Google webhook renewal job.
 * Renews 2 hours before channel expiration to provide buffer.
 *
 * @param {number} expirationTime - Milliseconds since epoch when channel expires
 * @param {string} accountId - CalendarAccount ID
 * @param {string} channelType - 'calendar-list' or 'events'
 * @param {string} calendarId - Calendar ID (null for calendar-list)
 * @param {string} channelId - Google channel ID
 * @param {string} resourceId - Google resource ID for channel
 */
export async function scheduleRenewal(expirationTime, accountId, channelType, calendarId, channelId, resourceId) {
  const expirationDate = new Date(expirationTime);
  const renewDate = new Date(expirationDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before

  await agenda.schedule(renewDate, "renewGoogleNotification", {
    accountId,
    channelType,
    calendarId,
    channelId,
    resourceId
  });

  logger.info(`📅 Google ${channelType} renewal job scheduled for ${renewDate} (Account: ${accountId})`);
}

/**
 * Schedule Microsoft webhook renewal job.
 * Renews 1 hour before subscription expiration (Microsoft has shorter TTL).
 *
 * @param {number} expirationTime - Milliseconds since epoch when subscription expires
 * @param {string} accountId - CalendarAccount ID
 * @param {string} subscriptionType - 'calendar-list' or 'events'
 * @param {string} calendarId - Calendar ID (null for calendar-list)
 * @param {string} subscriptionId - Microsoft subscription ID
 */
export async function scheduleMicrosoftRenewal(expirationTime, accountId, subscriptionType, calendarId, subscriptionId) {
  const expirationDate = new Date(expirationTime);
  const renewDate = new Date(expirationDate.getTime() - 60 * 60 * 1000); // 1 hour before

  await agenda.schedule(renewDate, "renewMicrosoftNotification", {
    accountId,
    subscriptionType,
    calendarId,
    subscriptionId
  });

  logger.info(`📅 Microsoft ${subscriptionType} renewal job scheduled for ${renewDate} (Account: ${accountId})`);
}

/**
 * Clean up expired renewal jobs from database.
 * Useful for maintenance but not required for normal operation.
 */
export async function cleanupExpiredJobs() {
  const now = new Date();
  const result = await agenda.jobs({
    nextRunAt: { $lt: now },
    $or: [
      { name: "renewGoogleNotification" },
      { name: "renewMicrosoftNotification" }
    ]
  });

  for (const job of result) {
    await job.remove();
  }

  logger.info(`🧹 Cleaned up ${result.length} expired notification renewal jobs`);
}

export default agenda;