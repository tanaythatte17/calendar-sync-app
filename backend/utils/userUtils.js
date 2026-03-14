import calendarAccount from "../models/calendarAccountModel.js";
import Event from "../models/eventModel.js";

export const getAllCalendarAccounts = async (userId) => {
  const accounts = await calendarAccount
    .find({ userId })
    .select('_id provider email accessToken expiresAt calendarList')
    .lean();
  
  return accounts.map(account => ({
    id: account._id.toString(),
    _id: account._id.toString(),
    provider: account.provider,
    email: account.email,
    isConnected: !!(account.accessToken && account.expiresAt > new Date()),
    calendarList: account.calendarList?.map(calendar => ({
      calendarId: calendar.calendarId,
      name: calendar.name,
      color: calendar.color
    })) || []
  }));
};

export const getAllUserEvents = async (userId) => {
  // Get the user's calendar account IDs (only fetch _id field)
  const accounts = await calendarAccount
    .find({ userId })
    .select('_id')
    .lean();
  
  const accountIds = accounts.map(acc => acc._id);

  // Get all events linked to those accounts
  return await Event.find({
    calendarAccountId: { $in: accountIds }
  }).lean();
};