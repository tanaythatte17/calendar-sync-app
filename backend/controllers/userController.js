import { getAllCalendarAccounts, getAllUserEvents } from "../utils/userUtils.js";
import User from "../models/userModel.js";

export const getCalendarAccountsHandler = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).send("Unauthorized");

    const accounts = await getAllCalendarAccounts(userId);
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).send("Could not fetch calendar accounts");
  }
};

export const getUserEventsHandler = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).send("Unauthorized");

    const events = await getAllUserEvents(userId);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).send("Could not fetch user events");
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

export const updateUserTimezone = async (req, res) => {
  try {
    const { timezone } = req.body;
    if (!timezone) return res.status(400).json({ error: 'Timezone is required' });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { timezone },
      { new: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update timezone' });
  }
};

export const getUserTimezone = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('timezone');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ timezone: user.timezone });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user timezone' });
  }
};