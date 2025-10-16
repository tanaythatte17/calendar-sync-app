import { connect, callback, sync, createMicrosoftNotifications } from "../services/microsoftService.js";

export const connectMicrosoft = (req, res) => {
  try{
    connect(req.query.userId || req.user?._id || '68668b8db45ebe41d4b854b4', req.query.state, res.cookie.bind(res), res.redirect.bind(res));
  } catch(err){
    res.status(400).json({ error: 'Failed to start Microsoft connect' });
  }
};

export const microsoftCallback = async (req, res) => {
  console.log('Inside microsft');
  try{
    await callback(req.query, req.cookies, res.clearCookie.bind(res), res.redirect.bind(res));
  } catch(err){
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?message=${encodeURIComponent('Microsoft authentication failed')}`);
  }
};

export const syncMicrosoft = async (req, res) => {
  try{
    const result = await sync(req.user?._id, req.query.email || req.user?.email);
    res.json(result);
  } catch(err){
    res.status(err.statusCode || 500).json({ error: 'Microsoft sync failed', details: err.message });
  }
};

export { createMicrosoftNotifications };

export async function renewMicrosoftNotification(accountId, subscriptionType, calendarId, oldSubscriptionId) {
  const account = await calendarAccount.findById(accountId);
  if (!account) {
    console.error(`Account ${accountId} not found`);
    return;
  }

  // Refresh token if needed
  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(
      account._id,
      account.refreshToken,
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      process.env.MICROSOFT_CLIENT_ID,
      process.env.MICROSOFT_CLIENT_SECRET
    );
    account.accessToken = tokens.accessToken;
  }

  const headers = { 
    Authorization: `Bearer ${account.accessToken}`,
    'Content-Type': 'application/json'
  };

  // 1️⃣ Delete existing subscription
  try {
    await axios.delete(`https://graph.microsoft.com/v1.0/subscriptions/${oldSubscriptionId}`, { headers });
    console.log(`🛑 Stopped old ${subscriptionType} subscription: ${oldSubscriptionId}`);
  } catch (err) {
    console.warn(`Failed to delete old subscription ${oldSubscriptionId}:`, err.message);
  }

  // 2️⃣ Create new subscription
  const expirationDateTime = new Date();
  expirationDateTime.setDate(expirationDateTime.getDate() + 3);
  const expirationTime = expirationDateTime.getTime();

  try {
    if (subscriptionType === "calendar-list") {
      const payload = {
        changeType: 'created,updated,deleted',
        notificationUrl: `${process.env.WEBHOOK_BASE_URL}/api/webhook/microsoft/list`,
        resource: 'me/calendars',
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: JSON.stringify({ accountId })
      };

      const response = await axios.post('https://graph.microsoft.com/v1.0/subscriptions', payload, { headers });
      console.log(`✅ Created new ${subscriptionType} subscription: ${response.data.id}`);

      // Update account with new subscription info
      account.webhookSubscriptions.calendarList.subscriptionId = response.data.id;
      account.webhookSubscriptions.calendarList.expiration = new Date(expirationTime);

    } else if (subscriptionType === "events") {
      const payload = {
        changeType: 'created,updated,deleted',
        notificationUrl: `${process.env.WEBHOOK_BASE_URL}/api/webhook/microsoft/events`,
        resource: `me/calendars/${calendarId}/events`,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: JSON.stringify({ accountId, calendarId })
      };

      const response = await axios.post('https://graph.microsoft.com/v1.0/subscriptions', payload, { headers });
      console.log(`✅ Created new ${subscriptionType} subscription: ${response.data.id}`);

      // Update the specific event subscription
      const eventSub = account.webhookSubscriptions.events.find(e => e.calendarId === calendarId);
      if (eventSub) {
        eventSub.subscriptionId = response.data.id;
        eventSub.expiration = new Date(expirationTime);
      }
    }

    await account.save();

    // Schedule next renewal
    await scheduleMicrosoftRenewal(
      expirationTime,
      accountId,
      subscriptionType,
      calendarId,
      response.data.id
    );

  } catch (err) {
    console.error(`Failed to create new ${subscriptionType} subscription:`, err.message);
  }
}

// NEW: Update Microsoft calendar list (extracted from syncMicrosoft)
export async function updateMicrosoftCalendarList(account, headers) {
  // 1. Fetch all calendars
  const calendarsRes = await axios.get('https://graph.microsoft.com/v1.0/me/calendars', { headers });
  const calendars = calendarsRes.data.value || [];

  // 2. Update calendar list
  const previousCalendars = account.calendarList || [];
  const previousCalendarMap = new Map(previousCalendars.map(c => [c.calendarId, c]));

  const updatedCalendarList = calendars.map(cal => {
    const existing = previousCalendarMap.get(cal.id);
    return {
      calendarId: cal.id,
      name: cal.name,
      color: cal.color || null,
      deltaLink: existing?.deltaLink || null,
    };
  });

  // Remove deleted calendars' events
  const currentCalendarIds = new Set(calendars.map(c => c.id));
  const previousCalendarIds = new Set(previousCalendars.map(c => c.calendarId));
  const removedCalendarIds = [...previousCalendarIds].filter(id => !currentCalendarIds.has(id));
  
  if (removedCalendarIds.length > 0) {
    await Event.deleteMany({
      calendarAccountId: account._id,
      calendarId: { $in: removedCalendarIds },
      source: 'microsoft',
    });
  }

  account.calendarList = updatedCalendarList;
  await account.save();
}

// NEW: Full sync function (per calendar)
export async function performMicrosoftFullSync(calendarId, headers, accountId, startTime, endTime) {
  // FULL SYNC: Use calendarView to get expanded recurring events
  console.log(`Full sync for calendar ${calendarId}`);
  const expandedEvents = await fetchExpandedEvents(calendarId, startTime, endTime, headers);
  
  // Get existing event IDs from database for this calendar
  const existingEvents = await Event.find({
    calendarAccountId: accountId,
    calendarId: calendarId,
    source: 'microsoft'
  }).select('externalId');
  
  const existingEventIds = new Set(existingEvents.map(e => e.externalId));
  const newEventIds = new Set(expandedEvents.map(e => e.id));
  
  // Delete events that no longer exist
  const eventsToDelete = [...existingEventIds].filter(id => !newEventIds.has(id));
  if (eventsToDelete.length > 0) {
    await Event.deleteMany({
      calendarAccountId: accountId,
      calendarId: calendarId,
      source: 'microsoft',
      externalId: { $in: eventsToDelete }
    });
  }

  // Process all expanded events
  await processEvents(expandedEvents, accountId, calendarId);
  const eventsProcessed = expandedEvents.length;

  // Get delta link for future incremental syncs
  const deltaRes = await axios.get(
    `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/delta`,
    {
      headers,
      params: {
        startDateTime: startTime,
        endDateTime: endTime,
        $select: 'id,subject,bodyPreview,location,organizer,attendees,type,seriesMasterId,isAllDay,showAs,webLink,start,end'
      }
    }
  );
  const newDeltaLink = await getDeltaLink(deltaRes, headers);

  return { eventsProcessed, newDeltaLink };
}

// NEW: Incremental sync function (per calendar)
export async function performMicrosoftIncrementalSync(calendarId, deltaLink, headers, accountId, startTime, endTime) {
  console.log(`Incremental sync for calendar ${calendarId}`);
  const { events: changedEvents, newDeltaLink } = await fetchDeltaEvents(deltaLink, headers);
  
  // Track recurring series that were modified
  const modifiedSeries = new Set();
  
  // Process changed/deleted events
  for (const event of changedEvents) {
    if (event["@removed"]) {
      await handleEventDeletion(event, accountId, calendarId);
    } else {
      // For recurring events, we need to handle them specially
      if (event.type === 'seriesMaster') {
        modifiedSeries.add(event.id);
        await handleRecurringEventUpdate(event, calendarId, startTime, endTime, headers, accountId);
      } else {
        await processEvents([event], accountId, calendarId);
      }
    }
  }
  
  // Validate all recurring series for "delete this and following" scenarios
  await validateAllRecurringSeries(accountId, calendarId, startTime, endTime, headers, modifiedSeries);

  return { eventsProcessed: changedEvents.length, newDeltaLink };
}

// Helper function to fetch expanded events using calendarView
async function fetchExpandedEvents(calendarId, startTime, endTime, headers) {
  let allEvents = [];
  let url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView?startDateTime=${startTime}&endDateTime=${endTime}`;
  
  while (url) {
    const response = await axios.get(url, { headers });
    if (response.data.value && Array.isArray(response.data.value)) {
      allEvents = allEvents.concat(response.data.value);
    }
    url = response.data['@odata.nextLink'] || null;
  }
  
  return allEvents;
}

// Helper function to fetch delta events
async function fetchDeltaEvents(deltaLink, headers) {
  let allEvents = [];
  let url = deltaLink;
  let newDeltaLink = null;
  
  while (url) {
    const response = await axios.get(url, { headers });
    
    if (response.data.value && Array.isArray(response.data.value)) {
      allEvents = allEvents.concat(response.data.value);
    }
    
    if (response.data['@odata.nextLink']) {
      url = response.data['@odata.nextLink'];
    } else {
      url = null;
      newDeltaLink = response.data['@odata.deltaLink'];
    }
  }
  
  return { events: allEvents, newDeltaLink };
}

// Helper function to get delta link
async function getDeltaLink(deltaRes, headers) {
  let url = deltaRes.data['@odata.nextLink'];
  let deltaLink = deltaRes.data['@odata.deltaLink'];
  
  while (url && !deltaLink) {
    const response = await axios.get(url, { headers });
    url = response.data['@odata.nextLink'];
    deltaLink = response.data['@odata.deltaLink'];
  }
  
  return deltaLink;
}

// Enhanced function to handle recurring event updates
async function handleRecurringEventUpdate(seriesMaster, calendarId, startTime, endTime, headers, accountId) {
  try {
    console.log(`Updating recurring series: ${seriesMaster.id}`);
    
    // Get current instances from database for comparison
    const existingInstances = await Event.find({
      calendarAccountId: accountId,
      calendarId: calendarId,
      source: 'microsoft',
      $or: [
        { externalId: seriesMaster.id },
        { recurringEventId: seriesMaster.id }
      ]
    });

    // Fetch fresh instances from Microsoft Graph
    const instancesUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${seriesMaster.id}/instances?startDateTime=${startTime}&endDateTime=${endTime}`;
    let url = instancesUrl;
    let freshInstances = [];

    while (url) {
      const response = await axios.get(url, { headers });
      if (response.data.value && Array.isArray(response.data.value)) {
        freshInstances = freshInstances.concat(response.data.value);
      }
      url = response.data['@odata.nextLink'] || null;
    }

    // Compare existing vs fresh instances
    const existingIds = new Set(existingInstances.map(e => e.externalId));
    const freshIds = new Set(freshInstances.map(e => e.id));

    // Delete instances that no longer exist (handles "delete this and following")
    const instancesToDelete = [...existingIds].filter(id => !freshIds.has(id));
    if (instancesToDelete.length > 0) {
      await Event.deleteMany({
        calendarAccountId: accountId,
        calendarId: calendarId,
        source: 'microsoft',
        externalId: { $in: instancesToDelete }
      });
      console.log(`Deleted ${instancesToDelete.length} instances from series ${seriesMaster.id} (likely "delete this and following")`);
    }

    // Process all fresh instances
    await processEvents(freshInstances, accountId, calendarId);
    
  } catch (err) {
    console.error(`Failed to update recurring event ${seriesMaster.id}:`, err.message);
  }
}

// NEW: Comprehensive validation for all recurring series
async function validateAllRecurringSeries(accountId, calendarId, startTime, endTime, headers, modifiedSeries = new Set()) {
  try {
    console.log(`Validating all recurring series for calendar ${calendarId}`);
    
    // Get all recurring series from database
    const recurringSeries = await Event.find({
      calendarAccountId: accountId,
      calendarId: calendarId,
      source: 'microsoft',
      isRecurring: true
    }).distinct('externalId');

    for (const seriesId of recurringSeries) {
      // Skip if we already processed this series in the current sync
      if (modifiedSeries.has(seriesId)) {
        continue;
      }

      try {
        // Get current instances from database
        const dbInstances = await Event.find({
          calendarAccountId: accountId,
          calendarId: calendarId,
          source: 'microsoft',
          $or: [
            { externalId: seriesId },
            { recurringEventId: seriesId }
          ]
        });

        // Get fresh instances from Microsoft Graph
        const instancesUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${seriesId}/instances?startDateTime=${startTime}&endDateTime=${endTime}`;
        let url = instancesUrl;
        let freshInstances = [];

        while (url) {
          const response = await axios.get(url, { headers });
          if (response.data.value && Array.isArray(response.data.value)) {
            freshInstances = freshInstances.concat(response.data.value);
          }
          url = response.data['@odata.nextLink'] || null;
        }

        // Compare and identify discrepancies
        const dbIds = new Set(dbInstances.map(e => e.externalId));
        const freshIds = new Set(freshInstances.map(e => e.id));
        
        // Find instances that exist in DB but not in Microsoft Graph (deleted instances)
        const deletedIds = [...dbIds].filter(id => !freshIds.has(id));
        
        if (deletedIds.length > 0) {
          await Event.deleteMany({
            calendarAccountId: accountId,
            calendarId: calendarId,
            source: 'microsoft',
            externalId: { $in: deletedIds }
          });
          console.log(`Cleaned up ${deletedIds.length} deleted instances from series ${seriesId}`);
        }

        // Update/create instances that exist in Microsoft Graph
        await processEvents(freshInstances, accountId, calendarId);

      } catch (err) {
        if (err.response?.status === 404) {
          // Entire series was deleted
          await Event.deleteMany({
            calendarAccountId: accountId,
            calendarId: calendarId,
            source: 'microsoft',
            $or: [
              { externalId: seriesId },
              { recurringEventId: seriesId }
            ]
          });
          console.log(`Deleted entire series ${seriesId} - no longer exists`);
        } else {
          console.error(`Error validating series ${seriesId}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Error validating recurring series:', err.message);
  }
}

// Helper function to handle event deletion
async function handleEventDeletion(removedEvent, accountId, calendarId) {
  const eventId = removedEvent.id;
  
  // Check if this event exists in our database and what type it is
  const existingEvent = await Event.findOne({
    calendarAccountId: accountId,
    calendarId: calendarId,
    source: 'microsoft',
    externalId: eventId
  });

  // Also check if this ID appears as a recurringEventId (series master)
  const hasInstances = await Event.findOne({
    calendarAccountId: accountId,
    calendarId: calendarId,
    source: 'microsoft',
    recurringEventId: eventId
  });

  if (existingEvent?.isRecurring || hasInstances) {
    // This is a series master - delete the master AND all its instances
    console.log(`Deleting entire recurring series: ${eventId}`);
    
    const deleteResult = await Event.deleteMany({
      calendarAccountId: accountId,
      calendarId: calendarId,
      source: 'microsoft',
      $or: [
        { externalId: eventId },           // The series master itself
        { recurringEventId: eventId }      // All instances of this series
      ]
    });
    
    console.log(`Deleted ${deleteResult.deletedCount} events from series ${eventId}`);
  } else {
    // Single event or single instance of a recurring series
    const deleteResult = await Event.deleteOne({
      calendarAccountId: accountId,
      calendarId: calendarId,
      source: 'microsoft',
      externalId: eventId
    });
    
    if (deleteResult.deletedCount > 0) {
      console.log(`Deleted single event/instance: ${eventId}`);
    } else {
      console.log(`Event ${eventId} not found in database (already deleted or never synced)`);
    }
  }
}

// Helper function to process and save events
async function processEvents(events, accountId, calendarId) {
  console.log('Events are ', events);
  for (const event of events) {
    await Event.findOneAndUpdate(
      {
        calendarAccountId: accountId,
        externalId: event.id,
        calendarId: calendarId,
        source: 'microsoft',
      },
      {
        calendarAccountId: accountId,
        calendarId: calendarId,
        source: 'microsoft',
        externalId: event.id,
        title: event.subject,
        description: event.bodyPreview,
        location: event.location?.displayName,
        start: {
          dateTime: new Date(event.start?.dateTime + "Z"),
          timeZone: event.start?.timeZone || 'UTC',
        },
        end: {
          dateTime: new Date(event.end?.dateTime + "Z"),
          timeZone: event.end?.timeZone || 'UTC',
        },
        isAllDay: Boolean(event.isAllDay),
        organizer: {
          email: event.organizer?.emailAddress?.address,
          name: event.organizer?.emailAddress?.name,
        },
        attendees: event.attendees?.map(a => ({
          email: a.emailAddress?.address,
          name: a.emailAddress?.name,
          responseStatus: a.status?.response,
        })),
        isRecurring: event.type === 'seriesMaster',
        recurringEventId: event.seriesMasterId,
        status: event.isCancelled ? 'cancelled' : (event.showAs === 'tentative' ? 'tentative' : 'confirmed'),
        htmlLink: event.webLink,
        raw: event,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
  }
}