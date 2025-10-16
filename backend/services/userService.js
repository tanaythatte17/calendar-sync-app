import { getAllCalendarAccounts } from "../utils/userUtils.js";
import User from "../models/userModel.js";
import calendarAccount from "../models/calendarAccountModel.js";
import Event from "../models/eventModel.js";

export async function getCalendarAccounts(userId) {
  if (!userId) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  const accounts = await getAllCalendarAccounts(userId);
  return accounts;
}

export async function getUserEvents(userId, { startDate, endDate }) {
  if (!userId) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  let start;
  let end;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err = new Error("Invalid date format");
      err.statusCode = 400;
      throw err;
    }
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > oneYearMs) {
      const err = new Error("Date range cannot exceed 1 year");
      err.statusCode = 400;
      throw err;
    }
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  }

  const accounts = await calendarAccount.find({ userId });
  if (!accounts.length) return [];
  const accountIds = accounts.map(a => a._id);

  const events = await Event.aggregate([
    {
      $match: {
        calendarAccountId: { $in: accountIds },
        status: { $ne: 'cancelled' },
        'start.dateTime': { $lte: end },
        'end.dateTime': { $gte: start },
      },
    },
    { $sort: { 'start.dateTime': 1 } },
  ]);
  return events;
}

export async function getProfile(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

export async function updateTimezone(userId, timezone) {
  if (!timezone) {
    const err = new Error('Timezone is required');
    err.statusCode = 400;
    throw err;
  }
  const user = await User.findByIdAndUpdate(userId, { timezone }, { new: true, select: '-password' });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

export async function getTimezone(userId) {
  const user = await User.findById(userId).select('timezone');
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return { timezone: user.timezone };
}


