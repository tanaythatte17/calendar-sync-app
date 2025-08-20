import Event from '../models/eventModel.js';
import calendarAccount from '../models/calendarAccountModel.js';
import { refreshCalendarAccessToken } from '../utils/refreshToken.js';
import { google } from 'googleapis';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Set up Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// POST /api/calendar/events - Create event in user's calendar
export const createCalendarEvent = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const userId = req.user?._id;
    console.log('Body is ', req.body);
    const {
      title,
      description,
      startDateTime,
      endDateTime,
      timeZone = 'UTC',
      location,
      attendees = [],
      isAllDay = false,
      calendarId,
      provider, // 'google' or 'microsoft'
      recurrence = null, // For recurring events
      reminders = []
    } = req.body;

    // Handle all-day events: automatically set endDateTime to day after startDateTime
    let finalStartDateTime, finalEndDateTime;
    
    if (isAllDay) {
      // For all-day events, only startDateTime is required
      if (!startDateTime) {
        return res.status(400).json({ 
          error: "Missing required field: startDateTime" 
        });
      }
      
      // Set start date and automatically calculate end date (next day)
      const startDate = new Date(startDateTime);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);
      
      finalStartDateTime = startDate.toISOString();
      finalEndDateTime = endDate.toISOString();
    } else {
      // For regular events, both start and end are required
      if (!startDateTime || !endDateTime) {
        return res.status(400).json({ 
          error: "Missing required fields: startDateTime and endDateTime are required for non-all-day events" 
        });
      }
      
      finalStartDateTime = startDateTime;
      finalEndDateTime = endDateTime;
    }

    // Basic validation for remaining required fields
    if (!userId || !title || !calendarId || !provider) {
      return res.status(400).json({ 
        error: "Missing required fields: title, calendarId, provider" 
      });
    }

    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({ error: "Provider must be 'google' or 'microsoft'" });
    }

    // Find the user's calendar account
    const account = await calendarAccount.findOne({
      userId: userId,
      provider: provider,
    });

    if (!account) {
      return res.status(400).json({ error: `No linked ${provider} account found.` });
    }

    // Refresh token if expired
    await refreshTokenIfNeeded(account, provider);

    let createdEvent;
    if (provider === 'google') {
      createdEvent = await createGoogleEvent(account, {
        title,
        description,
        startDateTime: finalStartDateTime,
        endDateTime: finalEndDateTime,
        timeZone,
        location,
        attendees,
        isAllDay,
        calendarId,
        recurrence,
        reminders
      });
    } else if (provider === 'microsoft') {
      createdEvent = await createMicrosoftEvent(account, {
        title,
        description,
        startDateTime: finalStartDateTime,
        endDateTime: finalEndDateTime,
        timeZone,
        location,
        attendees,
        isAllDay,
        calendarId,
        recurrence,
        reminders
      });
    }

    // Save the event to our database
    const savedEvent = await Event.create({
      calendarAccountId: account._id,
      calendarId: calendarId,
      source: provider,
      externalId: createdEvent.id,
      title: title,
      description: description,
      location: location,
      start: {
        dateTime: new Date(finalStartDateTime),
        timeZone: timeZone,
      },
      end: {
        dateTime: new Date(finalEndDateTime),
        timeZone: timeZone,
      },
      isAllDay: isAllDay,
      organizer: {
        email: account.email,
        name: account.name || account.email,
      },
      attendees: attendees.map(a => ({
        email: a.email,
        name: a.name,
        responseStatus: 'needsAction',
      })),
      isRecurring: !!recurrence,
      status: 'confirmed',
      htmlLink: createdEvent.htmlLink,
      raw: createdEvent,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      message: "Event created successfully",
      event: {
        id: savedEvent._id,
        externalId: createdEvent.id,
        title: savedEvent.title,
        startDateTime: savedEvent.start.dateTime,
        endDateTime: savedEvent.end.dateTime,
        provider: provider,
        htmlLink: createdEvent.htmlLink
      }
    });

  } catch (err) {
    console.error("Create event failed:", err);
    res.status(500).json({ 
      error: "Failed to create event", 
      details: err.message 
    });
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
    microsoftEvent.recurrence = formatMicrosoftRecurrence(recurrence);
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
function formatMicrosoftRecurrence(recurrence) {
  const { frequency, interval = 1, count, until, byDay } = recurrence;
  
  const pattern = {
    type: frequency.toLowerCase(), // daily, weekly, monthly, yearly
    interval: interval
  };
  
  if (byDay && byDay.length > 0) {
    pattern.daysOfWeek = byDay.map(day => day.toLowerCase());
  }
  
  const range = {
    type: count ? 'numbered' : until ? 'endDate' : 'noEnd',
  };
  
  if (count) {
    range.numberOfOccurrences = count;
  }
  
  if (until) {
    range.endDate = new Date(until).toISOString().split('T')[0];
  }
  
  return {
    pattern: pattern,
    range: range
  };
}

// PUT /api/calendar/events/:id - Update existing event
export const updateCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const updateData = req.body;

    // Find the event in our database
    const event = await Event.findOne({
      _id: id,
      calendarAccountId: { 
        $in: await calendarAccount.find({ userId }).distinct('_id') 
      }
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get the calendar account
    const account = await calendarAccount.findById(event.calendarAccountId);
    if (!account) {
      return res.status(404).json({ error: "Calendar account not found" });
    }

    // Refresh token if needed
    await refreshTokenIfNeeded(account, event.source);

    let updatedEvent;
    if (event.source === 'google') {
      updatedEvent = await updateGoogleEvent(account, event, updateData);
    } else if (event.source === 'microsoft') {
      updatedEvent = await updateMicrosoftEvent(account, event, updateData);
    }

    // Update our database
    const updates = {};
    if (updateData.title) updates.title = updateData.title;
    if (updateData.description) updates.description = updateData.description;
    if (updateData.location) updates.location = updateData.location;
    if (updateData.startDateTime) {
      updates['start.dateTime'] = new Date(updateData.startDateTime);
    }
    if (updateData.endDateTime) {
      updates['end.dateTime'] = new Date(updateData.endDateTime);
    }
    updates.updatedAt = new Date();

    await Event.findByIdAndUpdate(id, { $set: updates });

    res.json({
      message: "Event updated successfully",
      event: updatedEvent
    });

  } catch (err) {
    console.error("Update event failed:", err);
    res.status(500).json({ 
      error: "Failed to update event", 
      details: err.message 
    });
  }
};

// DELETE /api/calendar/events/:id - Delete event
export const deleteCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    // Find the event in our database
    const event = await Event.findOne({
      _id: id,
      calendarAccountId: { 
        $in: await calendarAccount.find({ userId }).distinct('_id') 
      }
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get the calendar account
    const account = await calendarAccount.findById(event.calendarAccountId);
    if (!account) {
      return res.status(404).json({ error: "Calendar account not found" });
    }

    // Refresh token if needed
    await refreshTokenIfNeeded(account, event.source);

    // Delete from external calendar
    if (event.source === 'google') {
      await deleteGoogleEvent(account, event);
    } else if (event.source === 'microsoft') {
      await deleteMicrosoftEvent(account, event);
    }

    // Delete from our database
    await Event.findByIdAndDelete(id);

    res.json({
      message: "Event deleted successfully"
    });

  } catch (err) {
    console.error("Delete event failed:", err);
    res.status(500).json({ 
      error: "Failed to delete event", 
      details: err.message 
    });
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
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID not found" });
    }

    // Get all calendar accounts for this user
    const accounts = await calendarAccount.find({ userId });
    
    if (!accounts || accounts.length === 0) {
      return res.status(404).json({ error: "No calendar accounts found" });
    }

    const calendars = [];
    
    for (const account of accounts) {
      // Refresh token if needed
      await refreshTokenIfNeeded(account, account.provider);
      
      if (account.provider === 'google') {
        const googleCalendars = await getGoogleCalendars(account);
        calendars.push(...googleCalendars);
      } else if (account.provider === 'microsoft') {
        const microsoftCalendars = await getMicrosoftCalendars(account);
        calendars.push(...microsoftCalendars);
      }
    }

    res.json({
      calendars: calendars
    });

  } catch (err) {
    console.error("Get calendars failed:", err);
    res.status(500).json({ 
      error: "Failed to get calendars", 
      details: err.message 
    });
  }
};

// Get Google calendars
async function getGoogleCalendars(account) {
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const response = await calendar.calendarList.list();
  
  return (response.data.items || []).map(cal => ({
    id: cal.id,
    name: cal.summary,
    provider: 'google',
    color: cal.backgroundColor,
    accessRole: cal.accessRole,
    primary: cal.primary,
    canCreateEvents: ['owner', 'writer'].includes(cal.accessRole)
  }));
}

// Get Microsoft calendars
async function getMicrosoftCalendars(account) {
  const headers = { Authorization: `Bearer ${account.accessToken}` };
  const response = await axios.get('https://graph.microsoft.com/v1.0/me/calendars', { headers });
  
  return (response.data.value || []).map(cal => ({
    id: cal.id,
    name: cal.name,
    provider: 'microsoft',
    color: cal.color,
    canCreateEvents: true, // Microsoft calendars typically allow creation
    isDefaultCalendar: cal.isDefaultCalendar
  }));
} 