import mongoose from "mongoose";

const EventSchema = new mongoose.Schema({
  calendarAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarAccount',
    required: true
  },
  source: {
    type: String,
    enum: ['google', 'microsoft'],
    required: true
  },
  externalId: { // ID from Google/Microsoft (used for sync updates)
    type: String,
    required: true,
    index: true
  },
  calendarId: { type: String },
  title: { type: String },
  description: { type: String },
  location: { type: String },

  start: {
    dateTime: { type: Date, required: true },
    timeZone: { type: String }
  },
  end: {
    dateTime: { type: Date, required: true },
    timeZone: { type: String }
  },
  isAllDay: { type: Boolean, default: false },

  organizer: {
    email: { type: String },
    name: { type: String }
  },
  attendees: [
    {
      email: String,
      name: String,
      responseStatus: String
    }
  ],

  isRecurring: { type: Boolean, default: false },
  recurringEventId: { type: String }, // For instances of recurring events

  status: { type: String, enum: ['confirmed', 'cancelled', 'tentative'], default: 'confirmed' },
  htmlLink: { type: String }, // Link to open event in calendar UI
  raw: { type: mongoose.Schema.Types.Mixed }, // Store original raw payload for debugging or future use

  updatedAt: { type: Date, default: Date.now }
});

const Event = mongoose.model("Event", EventSchema);
export default Event;