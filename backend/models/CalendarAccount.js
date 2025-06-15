import mongoose from 'mongoose';

const calendarAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['google', 'microsoft'],
    required: true
  },
  email: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  tokenExpiry: {
    type: Date,
    required: true
  },
  isConnected: {
    type: Boolean,
    default: true
  },
  // Google Calendar sync token
  syncToken: {
    type: String,
    default: null
  },
  // Microsoft Calendar delta link
  deltaLink: {
    type: String,
    default: null
  },
  lastSynced: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
calendarAccountSchema.index({ userId: 1, provider: 1, email: 1 }, { unique: true });

const CalendarAccount = mongoose.model('CalendarAccount', calendarAccountSchema);

export default CalendarAccount; 