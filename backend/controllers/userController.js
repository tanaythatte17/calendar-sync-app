import { getAllCalendarAccounts, getAllUserEvents } from "../utils/userUtils.js";
import User from "../models/userModel.js";
import calendarAccount from "../models/calendarAccountModel.js";
import Event from "../models/eventModel.js";

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

    // Extract date range parameters from query
    const { startDate, endDate } = req.query;
    
    let events;
    
    if (startDate && endDate) {
      // Parse dates and validate
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      // Validate date range (max 1 year to prevent abuse)
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > oneYearMs) {
        return res.status(400).json({ error: "Date range cannot exceed 1 year" });
      }
      
      events = await getUserEventsByDateRange(userId, start, end);
    } else {
      // Default behavior: get events for current month ±3 months
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0); // Last day of +3 month
      
      events = await getUserEventsByDateRange(userId, defaultStart, defaultEnd);
    }
    
    res.json(events);
  } catch (err) {
    console.error('Error fetching user events:', err);
    res.status(500).send("Could not fetch user events");
  }
};

export const getUserEventsByDateRange = async (userId, startDate, endDate) => {
  try {
    // Get all calendar accounts for the user
    const accounts = await calendarAccount.find({ 
      userId: userId,
    });
    console.log(`Found ${accounts.length} connected calendar accounts for user ${userId}`);
    if (!accounts.length) {
      return [];
    }
    
    const accountIds = accounts.map(account => account._id);
    
    // More efficient query using aggregation pipeline
    const events = await Event.aggregate([
      {
        $match: {
          calendarAccountId: { $in: accountIds },
          status: { $ne: 'cancelled' },
          // Simple overlap check: event start <= range end AND event end >= range start
          'start.dateTime': { $lte: endDate },
          'end.dateTime': { $gte: startDate }
        }
      },
      {
        $sort: { 'start.dateTime': 1 }
      }
    ]);
    console.log(`Fetched ${events.length} events for user ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    return events;
  } catch (error) {
    console.error('Error fetching events by date range:', error);
    throw error;
  }
}

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