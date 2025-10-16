import { connect, callback, sync, createGoogleNotifications, renewNotification, performFullSync, performIncrementalSync, updateGoogleCalendarList } from "../services/googleService.js";

export const connectGoogle = async (req, res) => {
  try{
    await connect(req.query.userId || req.user?._id, req.query.state, req.cookies, res.cookie.bind(res), res.redirect.bind(res));
  } catch(err){
    res.status(400).json({ error: 'Failed to start Google connect' });
  }
};

export const googleCallback = async (req, res) => {
  try{
    await callback(req.query.code, req.query.state, req.cookies, res.clearCookie.bind(res), res.redirect.bind(res));
  } catch(err){
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?message=${encodeURIComponent('Google authentication failed')}`);
  }
};

export const syncGoogle = async (req, res) => {
  try {
    const result = await sync(req.user?._id, req.query.email || req.user?.email);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: 'Google initial sync failed', details: err.message });
  }
};

export { createGoogleNotifications };

export { renewNotification };




// Process recurring event master efficiently
async function processRecurringEventMaster(calendar, master, calendarId, accountId, startDate, endDate) {
  try {
    // Get current instances from database
    const existingInstances = await Event.find({
      calendarAccountId: accountId,
      calendarId: calendarId,
      source: 'google',
      $or: [
        { externalId: master.id },
        { recurringEventId: master.id }
      ]
    });

    // Get expanded instances from Google
    let expandedInstances = [];
    let pageToken = null;
    
    do {
      const params = {
        calendarId,
        eventId: master.id,
        maxResults: 2500,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
      };
      
      if (pageToken) params.pageToken = pageToken;
      
      const result = await calendar.events.instances(params);
      const instances = result.data.items || [];
      expandedInstances = expandedInstances.concat(instances);
      pageToken = result.data.nextPageToken;
    } while (pageToken);

    // Compare and sync
    const existingIds = new Set(existingInstances.map(e => e.externalId));
    const freshIds = new Set(expandedInstances.map(e => e.id));

    // Delete instances that no longer exist
    const instancesToDelete = [...existingIds].filter(id => !freshIds.has(id));
    if (instancesToDelete.length > 0) {
      await Event.deleteMany({
        calendarAccountId: accountId,
        calendarId: calendarId,
        source: 'google',
        externalId: { $in: instancesToDelete }
      });
      console.log(`Deleted ${instancesToDelete.length} instances from series ${master.id}`);
    }

    // Process all fresh instances
    await processBatchEvents(expandedInstances, accountId, calendarId);

  } catch (err) {
    console.error(`Failed to process recurring series ${master.id}:`, err.message);
  }
}

// Batch process events for better performance
async function processBatchEvents(events, accountId, calendarId) {
  const bulkOps = [];
  
  for (const event of events) {
    if (event.status === 'cancelled') {
      bulkOps.push({
        deleteOne: {
          filter: {
            calendarAccountId: accountId,
            externalId: event.id,
            calendarId: calendarId,
            source: 'google',
          }
        }
      });
    } else {
      bulkOps.push({
        updateOne: {
          filter: {
            calendarAccountId: accountId,
            externalId: event.id,
            calendarId: calendarId,
            source: 'google',
          },
          update: {
            $set: {
              calendarAccountId: accountId,
              calendarId: calendarId,
              source: 'google',
              externalId: event.id,
              title: event.summary,
              description: event.description,
              location: event.location,
              start: {
                dateTime: new Date(event.start?.dateTime || event.start?.date),
                timeZone: event.start?.timeZone || 'UTC',
              },
              end: {
                dateTime: new Date(event.end?.dateTime || event.end?.date),
                timeZone: event.end?.timeZone || 'UTC',
              },
              isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
              organizer: {
                email: event.organizer?.email,
                name: event.organizer?.displayName,
              },
              attendees: event.attendees?.map((a) => ({
                email: a.email,
                name: a.displayName,
                responseStatus: a.responseStatus,
              })),
              isRecurring: !!event.recurringEventId,
              recurringEventId: event.recurringEventId,
              status: event.status,
              htmlLink: event.htmlLink,
              raw: event,
              updatedAt: new Date(),
            }
          },
          upsert: true
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await Event.bulkWrite(bulkOps, { ordered: false });
  }
}