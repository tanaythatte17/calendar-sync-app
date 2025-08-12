import calendarAccount from "../models/calendarAccountModel.js";
import Event from "../models/eventModel.js";
import axios from "axios";

/**
 * Deletes a calendar account:
 * 1. Stops webhook notifications
 * 2. Deletes all events for that account
 * 3. Deletes the account from DB
 */
export async function deleteCalendarAccount(req, res) {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId parameter" });
    }

    const account = await calendarAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: "Calendar account not found" });
    }

    // 1️⃣ Stop webhook notifications
    try {
      await stopGoogleWebhooks(account);
    } catch (err) {
      console.error(`⚠️ Failed to stop Google webhooks for ${accountId}:`, err.message);
      // Continue even if stopping webhook fails
    }

    // 2️⃣ Delete all events for this account
    await Event.deleteMany({ accountId });

    // 3️⃣ Delete the account
    await calendarAccount.deleteOne({ _id: accountId });

    return res.status(200).json({ message: `Deleted calendar account ${accountId}` });

  } catch (err) {
    console.error("❌ Error deleting calendar account:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

/**
 * Stops Google webhook notifications for calendarList & all events
 */
async function stopGoogleWebhooks(account) {
  try {
    // Stop calendarList channel
    if (account.webhookChannels?.calendarList?.channelId &&
        account.webhookChannels?.calendarList?.resourceId) {
      await axios.post(
        "https://www.googleapis.com/calendar/v3/channels/stop",
        {
          id: account.webhookChannels.calendarList.channelId,
          resourceId: account.webhookChannels.calendarList.resourceId,
        },
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`🛑 Stopped calendarList webhook for ${account.email}`);
    }

    // Stop all events channels
    if (Array.isArray(account.webhookChannels?.events)) {
      for (const evtChannel of account.webhookChannels.events) {
        if (evtChannel.channelId && evtChannel.resourceId) {
          await axios.post(
            "https://www.googleapis.com/calendar/v3/channels/stop",
            {
              id: evtChannel.channelId,
              resourceId: evtChannel.resourceId,
            },
            {
              headers: {
                Authorization: `Bearer ${account.accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );
          console.log(
            `🛑 Stopped events webhook for ${evtChannel.calendarName || evtChannel.calendarId}`
          );
        }
      }
    }
  } catch (err) {
    console.error("❌ Failed to stop Google webhooks:", err.response?.data || err.message);
  }
}
