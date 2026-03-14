import { connect, callback, sync, createGoogleNotifications, renewNotification } from "../services/googleService.js";

export const connectGoogle = async (req, res) => {
  try{
    const url = await connect(req.query.userId || req.user?._id, req.token, req.cookies, res.cookie.bind(res), res.redirect.bind(res));
    res.json({ url });
  } catch(err){
    res.status(400).json({ error: 'Failed to start Google connect' });
  }
};

export const googleCallback = async (req, res) => {
  try{
    await callback(req.query.code, req.query.state, req.cookies, res.clearCookie.bind(res), res.redirect.bind(res));
  } catch(err){
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?message=${encodeURIComponent('Google authentication failed')}`);
  }
};

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