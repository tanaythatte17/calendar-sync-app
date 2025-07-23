import mongoose from "mongoose";

const CalendarAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: { type: String, enum: ['google', 'microsoft'], required: true },
  email: { type: String, required: true },
  accessToken: { type: String },
  refreshToken: { type: String },
  syncToken: { type: String },     // Google sync token
  deltaLink: { type: String },     // Microsoft delta link
  lastSyncedAt: { type: Date },
  expiresAt: {  type: Date },
  calendarList: [{
    calendarId: { type: String, required: true }, // Unique per calendar
    name: { type: String },                       // Calendar display name
    syncToken: { type: String },                  // For Google calendars
    deltaLink: { type: String },                  // For Microsoft calendars
    color: { type: String },                      // UI color (Google: from calendar.colorId, Microsoft: custom if needed)
  }],
  calendarListSyncToken : { type: String}
});

const calendarAccount = mongoose.model("calendarAccount", CalendarAccountSchema);
export default calendarAccount;