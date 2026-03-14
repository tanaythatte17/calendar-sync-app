import { deleteAccountAndCleanup } from "../services/calendarAccountService.js";

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

    const result = await deleteAccountAndCleanup({ accountId, requesterUserId: req.user._id });
    return res.status(200).json(result);

  } catch (err) {
    console.error("❌ Error deleting calendar account:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
