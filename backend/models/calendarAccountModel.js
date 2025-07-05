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
  expiresAt: {  type: Date }
});

const calendarAccount = mongoose.model("calendarAccount", CalendarAccountSchema);
export default calendarAccount;