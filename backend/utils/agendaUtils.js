import Agenda from "agenda";
import { renewNotification } from "../services/googleService.js";
import { renewMicrosoftNotification } from "../services/microsoftService.js";
import dotenv from "dotenv";

dotenv.config();

// Initialize Agenda
const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: "agendaJobs" },
});

// Google notification renewal job
agenda.define("renewGoogleNotification", async (job) => {
  const { accountId, channelType, calendarId, channelId, resourceId } = job.attrs.data;
  console.log(`🔄 Renewing Google ${channelType} notification for account ${accountId}...`);

  try {
    await renewNotification(accountId, channelType, calendarId, channelId, resourceId);
    console.log(`✅ Successfully renewed Google ${channelType} notification for account ${accountId}`);
  } catch (error) {
    console.error(`❌ Failed to renew Google ${channelType} notification for account ${accountId}:`, error.message);
    throw error;
  }
});

// Microsoft notification renewal job
agenda.define("renewMicrosoftNotification", async (job) => {
  const { accountId, subscriptionType, calendarId, subscriptionId } = job.attrs.data;
  console.log(`🔄 Renewing Microsoft ${subscriptionType} subscription for account ${accountId}...`);

  try {
    await renewMicrosoftNotification(accountId, subscriptionType, calendarId, subscriptionId);
    console.log(`✅ Successfully renewed Microsoft ${subscriptionType} subscription for account ${accountId}`);
  } catch (error) {
    console.error(`❌ Failed to renew Microsoft ${subscriptionType} subscription for account ${accountId}:`, error.message);
    throw error;
  }
});

// Generic scheduling function for Google notifications
export async function scheduleRenewal(expirationTime, accountId, channelType, calendarId, channelId, resourceId) {
  const expirationDate = new Date(expirationTime);
  const renewDate = new Date(expirationDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before

  await agenda.schedule(renewDate, "renewGoogleNotification", {
    accountId,
    channelType, // "calendar-list" or "events"
    calendarId,
    channelId,
    resourceId
  });

  console.log(`📅 Google ${channelType} renewal job scheduled for ${renewDate} (Account: ${accountId})`);
}

// Scheduling function for Microsoft notifications
export async function scheduleMicrosoftRenewal(expirationTime, accountId, subscriptionType, calendarId, subscriptionId) {
  const expirationDate = new Date(expirationTime);
  const renewDate = new Date(expirationDate.getTime() - 60 * 60 * 1000); // 1 hour before (Microsoft has shorter expiration)

  await agenda.schedule(renewDate, "renewMicrosoftNotification", {
    accountId,
    subscriptionType, // "calendar-list" or "events"
    calendarId,
    subscriptionId
  });

  console.log(`📅 Microsoft ${subscriptionType} renewal job scheduled for ${renewDate} (Account: ${accountId})`);
}

// Optional: Cleanup expired jobs function
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

  console.log(`🧹 Cleaned up ${result.length} expired notification renewal jobs`);
}

export default agenda;