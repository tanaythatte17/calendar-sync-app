import { connect, callback, sync, createMicrosoftNotifications, renewMicrosoftNotification } from "../services/microsoftService.js";

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
 * Fetches all calendars and events, sets up webhooks.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user
 * @param {string} req.query.email - Microsoft calendar account email
 * @param {Object} res - Express response object
 * @returns {Object} Sync result with calendar count and event count
 */
export const syncMicrosoft = async (req, res) => {
  try {
    const result = await sync(req.user?._id, req.query.email || req.user?.email);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: 'Microsoft sync failed', details: err.message });
  }
};

export { createMicrosoftNotifications, renewMicrosoftNotification };