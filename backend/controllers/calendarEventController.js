import { createEvent, updateEvent, deleteEvent, listUserCalendars } from '../services/calendarEventService.js';

// POST /api/calendar/events - Create event in user's calendar
export const createCalendarEvent = async (req, res) => {
  try {
    const result = await createEvent(req.user?._id, req.body);
    res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: "Failed to create event", details: err.message });
  }
};

// Helper function to refresh token if needed
async function refreshTokenIfNeeded(account, provider) {
  if (account.expiresAt && account.expiresAt < new Date()) {
    console.log(`${provider} token expired, refreshing...`);
    
    const tokenUrl = provider === 'google' 
      ? 'https://oauth2.googleapis.com/token'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    
    const clientId = provider === 'google'
      ? process.env.GOOGLE_CLIENT_ID
      : process.env.MICROSOFT_CLIENT_ID;
    
    const clientSecret = provider === 'google'
      ? process.env.GOOGLE_CLIENT_SECRET
      : process.env.MICROSOFT_CLIENT_SECRET;

    const tokens = await refreshCalendarAccessToken(
      account._id,
      account.refreshToken,
      tokenUrl,
      clientId,
      clientSecret
    );
    
    account.accessToken = tokens.accessToken;
  }
}

// Create event in Google Calendar
async function createGoogleEvent(account, eventData) {
  const {
    title,
    description,
    startDateTime,
    endDateTime,
    timeZone,
    location,
    attendees,
    isAllDay,
    calendarId,
    recurrence,
    reminders
  } = eventData;

  // Set up Google OAuth client
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Prepare event object for Google Calendar API
  const googleEvent = {
    summary: title,
    description: description,
    location: location,
    start: isAllDay 
      ? { date: new Date(startDateTime).toISOString().split('T')[0] }
      : { dateTime: new Date(startDateTime).toISOString(), timeZone: timeZone },
    end: isAllDay 
      ? { date: new Date(endDateTime).toISOString().split('T')[0] }
      : { dateTime: new Date(endDateTime).toISOString(), timeZone: timeZone },
    attendees: attendees.map(a => ({
      email: a.email,
      displayName: a.name,
    })),
  };

  // Add recurrence if specified
  if (recurrence) {
    googleEvent.recurrence = [formatGoogleRecurrence(recurrence)];
  }

  // Add reminders if specified
  if (reminders && reminders.length > 0) {
    googleEvent.reminders = {
      useDefault: false,
      overrides: reminders.map(r => ({
        method: r.method || 'popup', // 'popup' or 'email'
        minutes: r.minutes
      }))
    };
  }

  // Create the event
  const response = await calendar.events.insert({
    calendarId: calendarId,
    resource: googleEvent,
    sendUpdates: 'all', // Send invitations to attendees
  });

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink,
    ...response.data
  };
}

// Create event in Microsoft Calendar
async function createMicrosoftEvent(account, eventData) {
  console.log('Creating Microsoft event with data:', eventData);
  const {
    title,
    description,
    startDateTime,
    endDateTime,
    timeZone,
    location,
    attendees,
    isAllDay,
    calendarId,
    recurrence,
    reminders
  } = eventData;

  const headers = { 
    Authorization: `Bearer ${account.accessToken}`,
    'Content-Type': 'application/json'
  };

  // Prepare event object for Microsoft Graph API
  const microsoftEvent = {
    subject: title,
    body: {
      contentType: 'HTML',
      content: description || ''
    }
  };

  // Handle start/end times based on isAllDay flag
  if (isAllDay) {
    // For all-day events - Microsoft uses dateTime with date string and timeZone
    microsoftEvent.start = {
      dateTime: new Date(startDateTime).toISOString().split('T')[0],
      timeZone: timeZone
    };
    microsoftEvent.end = {
      dateTime: new Date(endDateTime).toISOString().split('T')[0],
      timeZone: timeZone
    };
    microsoftEvent.isAllDay = true;
  } else {
    // For regular events, use dateTime format with full ISO string
    microsoftEvent.start = {
      dateTime: new Date(startDateTime).toISOString(),
      timeZone: timeZone
    };
    microsoftEvent.end = {
      dateTime: new Date(endDateTime).toISOString(),
      timeZone: timeZone
    };
  }

  // Add location only if provided
  if (location) {
    microsoftEvent.location = {
      displayName: location
    };
  }

  // Add attendees only if provided
  if (attendees && attendees.length > 0) {
    microsoftEvent.attendees = attendees.map(a => ({
      emailAddress: {
        address: a.email,
        name: a.name
      },
      type: 'required'
    }));
  }

  // Add recurrence if specified
  if (recurrence) {
    microsoftEvent.recurrence = formatMicrosoftRecurrence(
      recurrence,
      startDateTime  // 👈 pass the event start time
    );
  }

  // Add reminders if specified
  if (reminders && reminders.length > 0) {
    microsoftEvent.reminderMinutesBeforeStart = reminders[0].minutes;
  }

  console.log('Prepared Microsoft event object:', JSON.stringify(microsoftEvent, null, 2));

  try {
    // Create the event - keep same endpoint as regular events work fine
    const url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
    console.log('Making request to URL:', url);

    const response = await axios.post(url, microsoftEvent, { headers });

    console.log('Microsoft event created successfully:', response.data.id);
    return {
      id: response.data.id,
      htmlLink: response.data.webLink,
      ...response.data
    };

  } catch (error) {
    console.error('Microsoft Graph API Error Details:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Request Headers:', headers);
    console.error('Request Body:', JSON.stringify(microsoftEvent, null, 2));
    
    // Re-throw with more context
    throw new Error(`Microsoft Graph API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
  }
}

// Helper function to format Google recurrence rule
function formatGoogleRecurrence(recurrence) {
  const { frequency, interval = 1, count, until, byDay } = recurrence;
  
  let rrule = `RRULE:FREQ=${frequency.toUpperCase()}`;
  
  if (interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }
  
  if (count) {
    rrule += `;COUNT=${count}`;
  }
  
  if (until) {
    rrule += `;UNTIL=${new Date(until).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  }
  
  if (byDay && byDay.length > 0) {
    rrule += `;BYDAY=${byDay.join(',')}`;
  }
  
  return rrule;
}

// Helper function to format Microsoft recurrence rule
function formatMicrosoftRecurrence(recurrence, eventStartDateTime) {
  console.log('Recurrence is ', recurrence);
  console.log('Event start date time is ', eventStartDateTime);
  const { frequency, interval = 1, count, until, byDay } = recurrence;

  const pattern = {
    type: frequency.toLowerCase(), // daily, weekly, monthly, yearly
    interval: interval
  };

  // Map abbreviated day names to full day names for Microsoft Graph
  const dayMapping = {
    'su': 'sunday',
    'mo': 'monday',
    'tu': 'tuesday',
    'we': 'wednesday',
    'th': 'thursday',
    'fr': 'friday',
    'sa': 'saturday'
  };

  if (byDay && byDay.length > 0) {
    pattern.daysOfWeek = byDay.map(day => {
      const lowerDay = day.toLowerCase();
      return dayMapping[lowerDay] || lowerDay;
    });
  }

  const range = {};
  const MAX_END_DATE = "4500-09-01";
  let startDate;
  if (eventStartDateTime) {
    const parsed = new Date(eventStartDateTime);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed.toISOString().split("T")[0];
    } else {
      // fallback: assume it's already a YYYY-MM-DD string
      startDate = eventStartDateTime.split("T")[0];
    }
  } else {
    throw new Error("eventStartDateTime is required for recurrence");
  } // ✅ required

  if (count) {
    range.type = 'numbered';
    range.startDate = startDate;
    range.numberOfOccurrences = count;
  } else if (until) {
    range.type = 'endDate';
    range.startDate = startDate;
    let endDate = new Date(until).toISOString().split("T")[0];
    if (endDate > MAX_END_DATE) endDate = MAX_END_DATE;
    range.endDate = endDate;
  } else {
    // Default: no explicit end, so set to 10 years from now but still capped
    range.type = 'endDate';
    range.startDate = startDate;
    let endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 10);
    let isoDate = endDate.toISOString().split("T")[0];
    if (isoDate > MAX_END_DATE) isoDate = MAX_END_DATE;
    range.endDate = isoDate;
  }

  return {
    pattern,
    range
  };
}

// PUT /api/calendar/events/:id - Update existing event
export const updateCalendarEvent = async (req, res) => {
  try {
    const result = await updateEvent(req.user?._id, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: "Failed to update event", details: err.message });
  }
};

// DELETE /api/calendar/events/:id - Delete event
export const deleteCalendarEvent = async (req, res) => {
  try {
    const result = await deleteEvent(req.user?._id, req.params.id);
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: "Failed to delete event", details: err.message });
  }
};

// Helper functions for updating events
async function updateGoogleEvent(account, event, updateData) {
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const updates = {};
  if (updateData.title) updates.summary = updateData.title;
  if (updateData.description) updates.description = updateData.description;
  if (updateData.location) updates.location = updateData.location;
  if (updateData.startDateTime) {
    updates.start = event.isAllDay 
      ? { date: new Date(updateData.startDateTime).toISOString().split('T')[0] }
      : { dateTime: new Date(updateData.startDateTime).toISOString(), timeZone: event.start.timeZone };
  }
  if (updateData.endDateTime) {
    updates.end = event.isAllDay 
      ? { date: new Date(updateData.endDateTime).toISOString().split('T')[0] }
      : { dateTime: new Date(updateData.endDateTime).toISOString(), timeZone: event.end.timeZone };
  }

  const response = await calendar.events.patch({
    calendarId: event.calendarId,
    eventId: event.externalId,
    resource: updates,
    sendUpdates: 'all'
  });

  return response.data;
}

async function updateMicrosoftEvent(account, event, updateData) {
  const headers = { 
    Authorization: `Bearer ${account.accessToken}`,
    'Content-Type': 'application/json'
  };

  const updates = {};
  if (updateData.title) updates.subject = updateData.title;
  if (updateData.description) {
    updates.body = {
      contentType: 'HTML',
      content: updateData.description
    };
  }
  if (updateData.location) {
    updates.location = { displayName: updateData.location };
  }
  if (updateData.startDateTime) {
    updates.start = {
      dateTime: new Date(updateData.startDateTime).toISOString(),
      timeZone: event.start.timeZone
    };
  }
  if (updateData.endDateTime) {
    updates.end = {
      dateTime: new Date(updateData.endDateTime).toISOString(),
      timeZone: event.end.timeZone
    };
  }

  const url = `https://graph.microsoft.com/v1.0/me/events/${event.externalId}`;
  const response = await axios.patch(url, updates, { headers });

  return response.data;
}

// Helper functions for deleting events
async function deleteGoogleEvent(account, event) {
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId: event.calendarId,
    eventId: event.externalId,
    sendUpdates: 'all'
  });
}

async function deleteMicrosoftEvent(account, event) {
  const headers = { 
    Authorization: `Bearer ${account.accessToken}`
  };

  const url = `https://graph.microsoft.com/v1.0/me/events/${event.externalId}`;
  await axios.delete(url, { headers });
}

// GET /api/calendar/calendars - Get user's calendars (for dropdown selection)
export const getUserCalendars = async (req, res) => {
  try {
    const result = await listUserCalendars(req.user?._id);
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: "Failed to get calendars", details: err.message });
  }
};
 