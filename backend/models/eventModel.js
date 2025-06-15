import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  calendarAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarAccount',
    required: true
  },
  externalId: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    default: ''
  },
  attendees: [String],
  isAllDay: Boolean,
  recurrence: [String],
  reminders: [Object],
  status: {
    type: String,
    enum: ['confirmed', 'tentative', 'cancelled'],
    default: 'confirmed'
  },
  raw: Object,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

eventSchema.index({ calendarAccount: 1, externalId: 1 }, { unique: true });

eventSchema.index({ start: 1 });
eventSchema.index({ end: 1 });

const Event = mongoose.model('Event', eventSchema);
export default Event;