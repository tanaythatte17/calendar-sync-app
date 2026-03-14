// controllers/googleWebhookController.js
import { googleWebhookQueue, googleCalendarListQueue } from '../services/queueService.js';
import CalendarAccount from '../models/calendarAccountModel.js';

export const googleEventsWebhookHandler = async (req, res) => {
  console.log('Google webhook received');
  
  try {
    // Validation only - keep in controller
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

    // Add to queue - rest of processing happens async
    await googleWebhookQueue.add(
      'sync-calendar-events',
      {
        calendarId,
        accountId,
        receivedAt: new Date().toISOString(),
      },
      {
        jobId: `${accountId}-${calendarId}-${Date.now()}`,
        removeOnComplete: true,
      }
    );

    console.log(`✅ Job queued for calendar: ${calendarId}`);

    // Immediate 200 response
    return res.status(200).send("OK");
    
  } catch (err) {
    console.error("❌ Webhook validation error:", err);
    return res.status(500).send("Webhook failed");
  }
};

export const googleCalendarListWebhookHandler = async (req, res) => {
  try {
    console.log("Google calendar list webhook received:");
    console.log("Headers:", req.headers);

    // Validation only
    const channelId = req.headers["x-goog-channel-id"];
    if (!channelId) {
      console.error("Missing x-goog-channel-id header");
      return res.status(400).send("Missing channel ID");
    }

    // Find account by channel ID
    const calendarAccount = await CalendarAccount.findOne({
      "webhookChannels.calendarList.channelId": channelId
    });
    
    if (!calendarAccount) {
      console.error("No calendar account found for channel:", channelId);
      return res.status(404).send("Account not found");
    }

    // Add to queue - rest of processing happens async
    await googleCalendarListQueue.add(
      'sync-calendar-list',
      {
        accountId: calendarAccount._id.toString(),
        channelId,
        receivedAt: new Date().toISOString(),
      },
      {
        jobId: `calendar-list-${calendarAccount._id}-${Date.now()}`,
        removeOnComplete: true,
      }
    );

    console.log(`✅ Calendar list job queued for account: ${calendarAccount._id}`);

    // Immediate 200 response
    return res.status(200).send("OK");
    
  } catch (error) {
    console.error("Calendar List Webhook Handler Error:", error);
    return res.status(500).send("Internal server error");
  }
};