const mongoose = require('mongoose');

const cachedEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: ['google', 'microsoft'], required: true },
  providerEventId: { type: String, required: true },
  calendarAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'CalendarAccount', required: true },
  summary: String,
  description: String,
  start: {
    dateTime: Date,
    timeZone: String
  },
  end: {
    dateTime: Date,
    timeZone: String
  },
  status: String,
  htmlLink: String,
  lastSynced: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Compound index for efficient querying
cachedEventSchema.index({ user: 1, provider: 1, providerEventId: 1 }, { unique: true });
cachedEventSchema.index({ user: 1, start: 1, end: 1 });
cachedEventSchema.index({ lastSynced: 1 });

// Static method to get events within a date range
cachedEventSchema.statics.getEventsInRange = async function(userId, startDate, endDate, provider = null) {
  const query = {
    user: userId,
    start: { $gte: startDate },
    end: { $lte: endDate },
    isDeleted: false
  };

  if (provider) {
    query.provider = provider;
  }

  return this.find(query).sort({ start: 1 });
};

// Static method to update or create events in bulk
cachedEventSchema.statics.bulkUpsert = async function(events, userId, provider, calendarAccountId) {
  const operations = events.map(event => ({
    updateOne: {
      filter: {
        user: userId,
        provider,
        providerEventId: event.id
      },
      update: {
        $set: {
          summary: event.summary || event.subject,
          description: event.description || (event.body?.content || ''),
          start: {
            dateTime: new Date(event.start.dateTime),
            timeZone: event.start.timeZone
          },
          end: {
            dateTime: new Date(event.end.dateTime),
            timeZone: event.end.timeZone
          },
          status: event.status,
          htmlLink: event.htmlLink || event.webLink,
          lastSynced: new Date(),
          calendarAccount: calendarAccountId,
          isDeleted: false
        }
      },
      upsert: true
    }
  }));

  return this.bulkWrite(operations);
};

// Static method to mark events as deleted
cachedEventSchema.statics.markDeleted = async function(userId, provider, eventIds) {
  return this.updateMany(
    {
      user: userId,
      provider,
      providerEventId: { $in: eventIds }
    },
    {
      $set: { isDeleted: true, lastSynced: new Date() }
    }
  );
};

// Static method to clean up old events
cachedEventSchema.statics.cleanupOldEvents = async function(userId, cutoffDate) {
  return this.deleteMany({
    user: userId,
    lastSynced: { $lt: cutoffDate },
    isDeleted: true
  });
};

const CachedEvent = mongoose.model('CachedEvent', cachedEventSchema);

module.exports = CachedEvent; 