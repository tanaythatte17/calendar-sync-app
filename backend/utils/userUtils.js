import calendarAccount from "../models/calendarAccount.js";
import Event from "../models/Event.js";

export const getAllCalendarAccounts = async (userId) => {
  return await calendarAccount.find({ userId });
};

export const getAllUserEvents = async (userId) => {
  // first get the user’s calendar account IDs
  const accounts = await calendarAccount.find({ userId });
  const accountIds = accounts.map(acc => acc._id);

  // get all events linked to those accounts
  return await Event.find({
    calendarAccountId: { $in: accountIds }
  });
};