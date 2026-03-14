import { connect, callback, sync, createMicrosoftNotifications, renewMicrosoftNotification } from "../services/microsoftService.js";

export const connectMicrosoft = async (req, res) => {
  try{
    const url = await connect(req.query.userId || req.user?._id, req.token, res.cookie.bind(res), res.redirect.bind(res));
    res.json({ url });
  } catch(err){
    res.status(400).json({ error: 'Failed to start Microsoft connect' });
  }
};

export const microsoftCallback = async (req, res) => {
  console.log('Inside microsft');
  try{
    await callback(req.query, req.cookies, res.clearCookie.bind(res), res.redirect.bind(res));
  } catch(err){
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?message=${encodeURIComponent('Microsoft authentication failed')}`);
  }
};

export const syncMicrosoft = async (req, res) => {
  try{
    const result = await sync(req.user?._id, req.query.email || req.user?.email);
    res.json(result);
  } catch(err){
    res.status(err.statusCode || 500).json({ error: 'Microsoft sync failed', details: err.message });
  }
};

export { createMicrosoftNotifications, renewMicrosoftNotification };