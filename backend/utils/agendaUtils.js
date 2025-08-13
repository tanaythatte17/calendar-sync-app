import Agenda from "agenda";
import { renewNotification } from "../controllers/googleController.js";
import dotenv from "dotenv";

dotenv.config();
// Initialize Agenda
const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: "agendaJobs" },
});

agenda.define("renewNotification", async (job) => {
  const { accountId, channelType, calendarId, channelId, resourceId } = job.attrs.data;
  console.log(`🔄 Renewing ${channelType} notification for account ${accountId}...`);

  await renewNotification(accountId, channelType, calendarId, channelId, resourceId);
});

export async function scheduleRenewal(expirationTime, accountId, channelType, calendarId, channelId, resourceId) {
  const expirationDate = new Date(expirationTime);
  const renewDate = new Date(expirationDate.getTime() - 2* 60 * 60 * 1000); // 6 hours before

  await agenda.schedule(renewDate, "renewNotification", {
    accountId,
    channelType, // "calendar-list" or "events"
    calendarId,
    channelId,
    resourceId
  });

  console.log(`📅 Renewal job scheduled for ${renewDate} (${channelType})`);
}

export default agenda;