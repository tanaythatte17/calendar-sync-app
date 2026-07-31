import { connect, callback, sync, createGoogleNotifications, renewNotification } from "../services/googleService.js";

/**
 * Initiate Google Calendar OAuth connection.
 * Returns the Google OAuth URL that user should visit.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} { url } - Google OAuth authorization URL
 */
export const connectGoogle = async (req, res) => {
  try {
    const url = await connect(req.query.userId || req.user?._id, req.token, req.cookies, res.cookie.bind(res), res.redirect.bind(res));
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: 'Failed to start Google connect' });
  }
};

/**
 * Handle Google OAuth callback.
 * Creates/updates calendar account and performs initial sync.
 *
 * @param {Object} req - Express request object
 * @param {string} req.query.code - OAuth authorization code
 * @param {string} req.query.state - OAuth state parameter (contains userId)
 * @param {Object} res - Express response object
 * @returns Redirects to dashboard
 */
export const googleCallback = async (req, res) => {
  try {
    await callback(req.query.code, req.query.state, req.cookies, res.clearCookie.bind(res), res.redirect.bind(res));
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?message=${encodeURIComponent('Google authentication failed')}`);
  }
};

/**
 * Trigger initial full sync of all Google calendars for a user.
 * Fetches all calendars and events, sets up webhooks.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user
 * @param {string} req.query.email - Google calendar account email
 * @param {Object} res - Express response object
 * @returns {Object} Sync result with calendar count and event count
 */
export const syncGoogle = async (req, res) => {
  try {
    const result = await sync(req.user?._id, req.query.email || req.user?.email);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: 'Google initial sync failed', details: err.message });
  }
};

export { createGoogleNotifications };

export { renewNotification };