import calendarAccount from "../models/calendarAccountModel.js";
import Event from "../models/eventModel.js";
import User from "../models/userModel.js";
import axios from "axios";

export async function deleteAccountAndCleanup({ accountId, requesterUserId }) {
  const account = await calendarAccount.findById(accountId);
  if (!account) {
    const error = new Error("Calendar account not found");
    error.statusCode = 404;
    throw error;
  }

  try {
    if (account.provider === "microsoft") {
      await stopMicrosoftWebhooks(account);
    } else {
      await stopGoogleWebhooks(account);
    }
  } catch (err) {
    // keep going even if webhook stop fails
  }

  await Event.deleteMany({ calendarAccountId: accountId });
  await calendarAccount.deleteOne({ _id: accountId });
  await User.updateOne({ _id: requesterUserId }, { $pull: { calendarAccounts: accountId } });

  return { message: `Deleted calendar account ${accountId}` };
}

async function stopGoogleWebhooks(account) {
  try {
    if (account.webhookChannels?.calendarList?.channelId && account.webhookChannels?.calendarList?.resourceId) {
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
    }

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
        }
      }
    }
  } catch (err) {
    // swallow; best effort
  }
}

async function stopMicrosoftWebhooks(account) {
  const headers = {
    Authorization: `Bearer ${account.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    if (account.webhookChannels?.calendarList?.channelId) {
      await axios.delete(
        `https://graph.microsoft.com/v1.0/subscriptions/${account.webhookChannels.calendarList.channelId}`,
        { headers }
      );
    }

    if (Array.isArray(account.webhookChannels?.events)) {
      for (const evtChannel of account.webhookChannels.events) {
        if (evtChannel.channelId) {
          await axios.delete(
            `https://graph.microsoft.com/v1.0/subscriptions/${evtChannel.channelId}`,
            { headers }
          );
        }
      }
    }
  } catch (err) {
    // swallow; best effort
  }
}


