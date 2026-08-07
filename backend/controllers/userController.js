import { getCalendarAccounts, getUserEvents, getProfile, updateTimezone, getTimezone } from "../services/userService.js";
import logger from "../utils/logger.js";

export const getCalendarAccountsHandler = async (req, res) => {
  try {
    const accounts = await getCalendarAccounts(req.user?._id);
    res.json(accounts);
  } catch (err) {
    logger.error(err);
    res.status(500).send("Could not fetch calendar accounts");
  }
};

export const getUserEventsHandler = async (req, res) => {
  try {
    const events = await getUserEvents(req.user?._id, req.query || {});
    res.json(events);
  } catch (err) {
    logger.error('Error fetching user events:', err);
    res.status(500).send("Could not fetch user events");
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await getProfile(req.user._id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

export const updateUserTimezone = async (req, res) => {
  try {
    const user = await updateTimezone(req.user._id, req.body.timezone);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update timezone' });
  }
};

export const getUserTimezone = async (req, res) => {
  try {
    const tz = await getTimezone(req.user._id);
    res.json(tz);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user timezone' });
  }
};