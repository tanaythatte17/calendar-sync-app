import { connect, callback, createMicrosoftNotifications, renewMicrosoftNotification } from "../services/microsoftService.js";
import calendarAccountModel from "../models/calendarAccountModel.js";
import { microsoftInitialSyncQueue } from "../services/queueService.js";

/**
 * Initiate Microsoft Outlook Calendar OAuth connection.
 * Returns the Microsoft OAuth URL that user should visit.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} { url } - Microsoft OAuth authorization URL
 */
export const connectMicrosoft = async (req, res) => {
  try {
    const url = await connect(req.query.userId || req.user?._id, req.token, res.cookie.bind(res), res.redirect.bind(res));
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: 'Failed to start Microsoft connect' });
  }
};

/**
 * Handle Microsoft OAuth callback.
 * Creates/updates calendar account and performs initial sync.
 *
 * @param {Object} req - Express request object
 * @param {string} req.query.code - OAuth authorization code
 * @param {Object} res - Express response object
 * @returns Redirects to dashboard
 */
export const microsoftCallback = async (req, res) => {
  try {
    await callback(req.query, req.cookies, res.clearCookie.bind(res), res.redirect.bind(res));
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?message=${encodeURIComponent('Microsoft authentication failed')}`);
  }
};

/**
 * Trigger initial full sync of all Microsoft Outlook calendars for a user.
 * Enqueues a background job instead of syncing inline; the worker fetches
 * all calendars and events, sets up webhooks, and reports progress over SSE.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user
 * @param {string} req.query.email - Microsoft calendar account email
 * @param {Object} res - Express response object
 * @returns {Object} { status: 'queued', accountId, provider, email }
 */
export const syncMicrosoft = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userEmail = req.query.email || req.user?.email;
    if (!userId || !userEmail) {
      return res.status(400).json({ error: 'Missing userId or email in request.' });
    }

    const account = await calendarAccountModel.findOne({ userId, provider: 'microsoft', email: userEmail });
    if (!account) {
      return res.status(400).json({ error: 'No linked Microsoft account found.' });
    }

    account.syncStatus = 'queued';
    await account.save();

    await microsoftInitialSyncQueue.add(
      'initial-sync',
      { userId: userId.toString(), userEmail, accountId: account._id.toString(), requestedAt: new Date().toISOString() },
      { jobId: `initial-sync-${account._id}`, removeOnComplete: true }
    );

    res.status(202).json({ status: 'queued', accountId: account._id, provider: 'microsoft', email: userEmail });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: 'Failed to queue Microsoft initial sync', details: err.message });
  }
};

export { createMicrosoftNotifications, renewMicrosoftNotification };