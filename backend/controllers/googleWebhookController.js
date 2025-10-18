import {google} from "googleapis";
import CalendarAccount from "../models/calendarAccountModel.js";
import dotenv from "dotenv";
import { performIncrementalSync, updateGoogleCalendarList } from "../services/googleService.js";
import sseService from "../services/sseService.js";

dotenv.config();
export const googleEventsWebhookHandler = async (req, res) => {
  console.log('Google webhook recieved');
  try {
    const tokenHeader = req.headers["x-goog-channel-token"];
    if (!tokenHeader) {
      return res.status(400).send("Missing x-goog-channel-token");
    }

    let calendarId, accountId;
    try {
        const decodedPayload = JSON.parse(
            Buffer.from(tokenHeader, "base64").toString("utf8")
        );
        console.log("Decoded payload:", decodedPayload);
        calendarId = decodedPayload.calendarId;
        accountId = decodedPayload.accountId;
    } catch (e) {
        console.error("Invalid base64 JSON in x-goog-channel-token:", e);
        return res.status(400).send("Invalid token");
    }

    if (!calendarId || !accountId) {
        console.error("Missing calendarId or accountId in token");
        return res.status(400).send("Missing calendarId or accountId in token");
    }

    // 🔐 1. Fetch calendar account and refresh token
    const calendarAccount = await CalendarAccount.findById(accountId);
    if (!calendarAccount || !calendarAccount.refreshToken) {
        console.error("Calendar account or refresh token not found");
      return res.status(404).send("Calendar account or tokens not found");
    }
    console.log("Calendar account found:", calendarAccount.email);
    const calendarInfo = calendarAccount.calendarList.find(
      (c) => c.calendarId === calendarId
    );
    if (!calendarInfo || !calendarInfo.syncToken) {
        console.error("No syncToken found for this calendar webhook");
      return res.status(400).send("No syncToken found for this calendar");
    }

    // 🔐 2. Create OAuth2 client using `google.auth.OAuth2`
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: calendarAccount.refreshToken,
    });

    // 🔄 3. Google Calendar API client
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 🔁 4. Perform incremental sync
    const { eventsProcessed, newSyncToken } = await performIncrementalSync(
      calendar,
      calendarId,
      calendarInfo.syncToken,
      accountId
    );

    // 💾 5. Save new syncToken
    calendarInfo.syncToken = newSyncToken;
    await calendarAccount.save();

    console.log(
      `✅ Synced ${eventsProcessed} events for calendarId: ${calendarId}`
    );
    
    // Send SSE update to user
    sseService.sendSyncStatus(
      calendarAccount.userId.toString(),
      'completed',
      `Synced ${eventsProcessed} events from Google Calendar`,
      { calendarId, eventsProcessed, provider: 'google' }
    );
    
    return res.status(200).send("Sync complete");
  } catch (err) {
    console.error("❌ Webhook processing error:", err?.response?.data || err);
    return res.status(500).send("Webhook failed");
  }
};

export const googleCalendarListWebhookHandler = async (req, res) => {
  try {
    console.log("Google calendar list webhook received:");
    console.log("Headers:", req.headers);

    const channelId = req.headers["x-goog-channel-id"];
    if (!channelId) {
      console.error("Missing x-goog-channel-id header");
      return res.status(400).send("Missing channel ID");
    }

    // Step 1: Find account by channel ID
    const calendarAccount = await CalendarAccount.findOne({
      "webhookChannels.calendarList.channelId": channelId
    });
    if (!calendarAccount) {
      console.error("No calendar account found for channel:", channelId);
      return res.status(404).send("Account not found");
    }

    // Step 3: Perform calendar list sync
    await updateGoogleCalendarList(calendarAccount);

    // Send SSE update to user
    sseService.sendCalendarListUpdate(
      calendarAccount.userId.toString(),
      calendarAccount.calendarList,
      'updated'
    );

    res.status(200).send("OK");
  } catch (error) {
    console.error("Calendar List Webhook Handler Error:", error);
    res.status(500).send("Internal server error");
  }
};