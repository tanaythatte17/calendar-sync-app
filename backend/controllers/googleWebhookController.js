import { googleWebhookQueue, googleCalendarListQueue } from '../services/queueService.js';
import CalendarAccount from '../models/calendarAccountModel.js';

/**
 * Handle Google Calendar push notifications for events.
 * Verifies webhook token and queues sync job to process changes asynchronously.
 * Responds immediately with 200 OK per Google Cloud Pub/Sub requirements.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.headers["x-goog-channel-token"] - Base64-encoded token with {calendarId, accountId}
 * @param {Object} res - Express response object
 * @returns 200 OK (async processing)
 */
export const googleEventsWebhookHandler = async (req, res) => {
  console.log('Google webhook received');

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

    // Add to BullMQ queue - async processing
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
    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook validation error:", err);
    return res.status(500).send("Webhook failed");
  }
};

/**
 * Handle Google Calendar List push notifications.
 * Detects when user's calendar list changes (adds/removes calendars).
 * Queues sync job to update calendar list and setup/remove webhooks.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.headers["x-goog-channel-id"] - Channel ID to lookup account
 * @param {Object} res - Express response object
 * @returns 200 OK (async processing)
 */
export const googleCalendarListWebhookHandler = async (req, res) => {
  try {
    console.log("Google calendar list webhook received:");
    console.log("Headers:", req.headers);

    const channelId = req.headers["x-goog-channel-id"];
    if (!channelId) {
      console.error("Missing x-goog-channel-id header");
      return res.status(400).send("Missing channel ID");
    }

    const calendarAccount = await CalendarAccount.findOne({
      "webhookChannels.calendarList.channelId": channelId
    });

    if (!calendarAccount) {
      console.error("No calendar account found for channel:", channelId);
      return res.status(404).send("Account not found");
    }

    // Add to BullMQ queue - async processing
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
    return res.status(200).send("OK");
  } catch (error) {
    console.error("Calendar List Webhook Handler Error:", error);
    return res.status(500).send("Internal server error");
  }
};