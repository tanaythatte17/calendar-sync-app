import Event from '../models/eventModel.js';
import calendarAccount from '../models/calendarAccountModel.js';
import { refreshCalendarAccessToken } from '../utils/refreshToken.js';
import { google } from 'googleapis';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

export async function createEvent(userId, payload) {
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
    provider,
    recurrence = null,
    reminders = []
  } = payload;

  // Handle all-day dates
  let finalStartDateTime, finalEndDateTime;
  if (isAllDay) {
    if (!startDateTime) {
      const err = new Error('Missing required field: startDateTime');
      err.statusCode = 400;
      throw err;
    }
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);
    finalStartDateTime = startDate.toISOString();
    finalEndDateTime = endDate.toISOString();
  } else {
    if (!startDateTime || !endDateTime) {
      const err = new Error('Missing required fields: startDateTime and endDateTime are required for non-all-day events');
      err.statusCode = 400;
      throw err;
    }
    finalStartDateTime = startDateTime;
    finalEndDateTime = endDateTime;
  }

  if (!userId || !title || !calendarId || !provider) {
    const err = new Error('Missing required fields: title, calendarId, provider');
    err.statusCode = 400;
    throw err;
  }
  if (!['google', 'microsoft'].includes(provider)) {
    const err = new Error("Provider must be 'google' or 'microsoft'");
    err.statusCode = 400;
    throw err;
  }

  const account = await calendarAccount.findOne({ userId, provider });
  if (!account) {
    const err = new Error(`No linked ${provider} account found.`);
    err.statusCode = 400;
    throw err;
  }

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
      reminders,
    });
  } else {
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
      reminders,
    });
  }

  const savedEvent = await Event.create({
    calendarAccountId: account._id,
    calendarId,
    source: provider,
    externalId: createdEvent.id,
    title,
    description,
    location,
    start: { dateTime: new Date(finalStartDateTime), timeZone },
    end: { dateTime: new Date(finalEndDateTime), timeZone },
    isAllDay,
    organizer: { email: account.email, name: account.name || account.email },
    attendees: attendees.map(a => ({ email: a.email, name: a.name, responseStatus: 'needsAction' })),
    isRecurring: !!recurrence,
    status: 'confirmed',
    htmlLink: createdEvent.htmlLink,
    raw: createdEvent,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    message: 'Event created successfully',
    event: {
      id: savedEvent._id,
      externalId: createdEvent.id,
      title: savedEvent.title,
      startDateTime: savedEvent.start.dateTime,
      endDateTime: savedEvent.end.dateTime,
      provider,
      htmlLink: createdEvent.htmlLink,
    },
  };
}

export async function updateEvent(userId, id, updateData) {
  const event = await Event.findOne({
    _id: id,
    calendarAccountId: { $in: await calendarAccount.find({ userId }).distinct('_id') },
  });
  if (!event) {
    const err = new Error('Event not found');
    err.statusCode = 404;
    throw err;
  }

  const account = await calendarAccount.findById(event.calendarAccountId);
  if (!account) {
    const err = new Error('Calendar account not found');
    err.statusCode = 404;
    throw err;
  }

  await refreshTokenIfNeeded(account, event.source);

  let updatedEvent;
  if (event.source === 'google') {
    updatedEvent = await updateGoogleEvent(account, event, updateData);
  } else {
    updatedEvent = await updateMicrosoftEvent(account, event, updateData);
  }

  const updates = {};
  if (updateData.title) updates.title = updateData.title;
  if (updateData.description) updates.description = updateData.description;
  if (updateData.location) updates.location = updateData.location;
  if (updateData.startDateTime) updates['start.dateTime'] = new Date(updateData.startDateTime);
  if (updateData.endDateTime) updates['end.dateTime'] = new Date(updateData.endDateTime);
  updates.updatedAt = new Date();
  await Event.findByIdAndUpdate(id, { $set: updates });

  return { message: 'Event updated successfully', event: updatedEvent };
}

export async function deleteEvent(userId, id) {
  const event = await Event.findOne({
    _id: id,
    calendarAccountId: { $in: await calendarAccount.find({ userId }).distinct('_id') },
  });
  if (!event) {
    const err = new Error('Event not found');
    err.statusCode = 404;
    throw err;
  }

  const account = await calendarAccount.findById(event.calendarAccountId);
  if (!account) {
    const err = new Error('Calendar account not found');
    err.statusCode = 404;
    throw err;
  }

  await refreshTokenIfNeeded(account, event.source);

  if (event.source === 'google') {
    await deleteGoogleEvent(account, event);
  } else {
    await deleteMicrosoftEvent(account, event);
  }

  await Event.findByIdAndDelete(id);
  return { message: 'Event deleted successfully' };
}

export async function listUserCalendars(userId) {
  if (!userId) {
    const err = new Error('User ID not found');
    err.statusCode = 400;
    throw err;
  }
  const accounts = await calendarAccount.find({ userId });
  if (!accounts || accounts.length === 0) {
    const err = new Error('No calendar accounts found');
    err.statusCode = 404;
    throw err;
  }
  const calendars = [];
  for (const account of accounts) {
    await refreshTokenIfNeeded(account, account.provider);
    if (account.provider === 'google') {
      calendars.push(...(await getGoogleCalendars(account)));
    } else {
      calendars.push(...(await getMicrosoftCalendars(account)));
    }
  }
  return { calendars };
}

async function refreshTokenIfNeeded(account, provider) {
  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokenUrl = provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const clientId = provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET : process.env.MICROSOFT_CLIENT_SECRET;
    const tokens = await refreshCalendarAccessToken(account._id, account.refreshToken, tokenUrl, clientId, clientSecret);
    account.accessToken = tokens.accessToken;
  }
}

async function createGoogleEvent(account, data) {
  const { title, description, startDateTime, endDateTime, timeZone, location, attendees, isAllDay, calendarId, recurrence, reminders } = data;
  oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const googleEvent = {
    summary: title,
    description,
    location,
    start: isAllDay ? { date: new Date(startDateTime).toISOString().split('T')[0] } : { dateTime: new Date(startDateTime).toISOString(), timeZone },
    end: isAllDay ? { date: new Date(endDateTime).toISOString().split('T')[0] } : { dateTime: new Date(endDateTime).toISOString(), timeZone },
    attendees: attendees.map(a => ({ email: a.email, displayName: a.name })),
  };
  if (recurrence) googleEvent.recurrence = [formatGoogleRecurrence(recurrence)];
  if (reminders && reminders.length > 0) {
    googleEvent.reminders = { useDefault: false, overrides: reminders.map(r => ({ method: r.method || 'popup', minutes: r.minutes })) };
  }
  const response = await calendar.events.insert({ calendarId, resource: googleEvent, sendUpdates: 'all' });
  return { id: response.data.id, htmlLink: response.data.htmlLink, ...response.data };
}

async function createMicrosoftEvent(account, data) {
  const { title, description, startDateTime, endDateTime, timeZone, location, attendees, isAllDay, calendarId, recurrence, reminders } = data;
  const headers = { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' };
  const microsoftEvent = { subject: title, body: { contentType: 'HTML', content: description || '' } };
  if (isAllDay) {
    microsoftEvent.start = { dateTime: new Date(startDateTime).toISOString().split('T')[0], timeZone };
    microsoftEvent.end = { dateTime: new Date(endDateTime).toISOString().split('T')[0], timeZone };
    microsoftEvent.isAllDay = true;
  } else {
    microsoftEvent.start = { dateTime: new Date(startDateTime).toISOString(), timeZone };
    microsoftEvent.end = { dateTime: new Date(endDateTime).toISOString(), timeZone };
  }
  if (location) microsoftEvent.location = { displayName: location };
  if (attendees && attendees.length > 0) {
    microsoftEvent.attendees = attendees.map(a => ({ emailAddress: { address: a.email, name: a.name }, type: 'required' }));
  }
  if (recurrence) microsoftEvent.recurrence = formatMicrosoftRecurrence(recurrence, startDateTime);
  if (reminders && reminders.length > 0) microsoftEvent.reminderMinutesBeforeStart = reminders[0].minutes;
  const url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
  const response = await axios.post(url, microsoftEvent, { headers });
  return { id: response.data.id, htmlLink: response.data.webLink, ...response.data };
}

function formatGoogleRecurrence(recurrence) {
  const { frequency, interval = 1, count, until, byDay } = recurrence;
  let rrule = `RRULE:FREQ=${frequency.toUpperCase()}`;
  if (interval > 1) rrule += `;INTERVAL=${interval}`;
  if (count) rrule += `;COUNT=${count}`;
  if (until) rrule += `;UNTIL=${new Date(until).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  if (byDay && byDay.length > 0) rrule += `;BYDAY=${byDay.join(',')}`;
  return rrule;
}

function formatMicrosoftRecurrence(recurrence, eventStartDateTime) {
  const { frequency, interval = 1, count, until, byDay } = recurrence;
  const pattern = { type: frequency.toLowerCase(), interval };
  const dayMapping = { su: 'sunday', mo: 'monday', tu: 'tuesday', we: 'wednesday', th: 'thursday', fr: 'friday', sa: 'saturday' };
  if (byDay && byDay.length > 0) pattern.daysOfWeek = byDay.map(d => dayMapping[d.toLowerCase()] || d.toLowerCase());
  const range = {};
  const startDate = new Date(eventStartDateTime);
  const startDateStr = isNaN(startDate.getTime()) ? String(eventStartDateTime).split('T')[0] : startDate.toISOString().split('T')[0];
  if (count) { range.type = 'numbered'; range.startDate = startDateStr; range.numberOfOccurrences = count; }
  else if (until) { range.type = 'endDate'; range.startDate = startDateStr; range.endDate = new Date(until).toISOString().split('T')[0]; }
  else { range.type = 'endDate'; range.startDate = startDateStr; const d = new Date(); d.setFullYear(d.getFullYear() + 10); range.endDate = d.toISOString().split('T')[0]; }
  return { pattern, range };
}

async function updateGoogleEvent(account, event, updateData) {
  oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const updates = {};
  if (updateData.title) updates.summary = updateData.title;
  if (updateData.description) updates.description = updateData.description;
  if (updateData.location) updates.location = updateData.location;
  if (updateData.startDateTime) {
    updates.start = event.isAllDay ? { date: new Date(updateData.startDateTime).toISOString().split('T')[0] } : { dateTime: new Date(updateData.startDateTime).toISOString(), timeZone: event.start.timeZone };
  }
  if (updateData.endDateTime) {
    updates.end = event.isAllDay ? { date: new Date(updateData.endDateTime).toISOString().split('T')[0] } : { dateTime: new Date(updateData.endDateTime).toISOString(), timeZone: event.end.timeZone };
  }
  const response = await calendar.events.patch({ calendarId: event.calendarId, eventId: event.externalId, resource: updates, sendUpdates: 'all' });
  return response.data;
}

async function updateMicrosoftEvent(account, event, updateData) {
  const headers = { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' };
  const updates = {};
  if (updateData.title) updates.subject = updateData.title;
  if (updateData.description) updates.body = { contentType: 'HTML', content: updateData.description };
  if (updateData.location) updates.location = { displayName: updateData.location };
  if (updateData.startDateTime) updates.start = { dateTime: new Date(updateData.startDateTime).toISOString(), timeZone: event.start.timeZone };
  if (updateData.endDateTime) updates.end = { dateTime: new Date(updateData.endDateTime).toISOString(), timeZone: event.end.timeZone };
  const url = `https://graph.microsoft.com/v1.0/me/events/${event.externalId}`;
  const response = await axios.patch(url, updates, { headers });
  return response.data;
}

async function deleteGoogleEvent(account, event) {
  oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  await calendar.events.delete({ calendarId: event.calendarId, eventId: event.externalId, sendUpdates: 'all' });
}

async function deleteMicrosoftEvent(account, event) {
  const headers = { Authorization: `Bearer ${account.accessToken}` };
  const url = `https://graph.microsoft.com/v1.0/me/events/${event.externalId}`;
  await axios.delete(url, { headers });
}

async function getGoogleCalendars(account) {
  oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const response = await calendar.calendarList.list();
  return (response.data.items || []).map(cal => ({ id: cal.id, name: cal.summary, provider: 'google', color: cal.backgroundColor, accessRole: cal.accessRole, primary: cal.primary, canCreateEvents: ['owner', 'writer'].includes(cal.accessRole) }));
}

async function getMicrosoftCalendars(account) {
  const headers = { Authorization: `Bearer ${account.accessToken}` };
  const response = await axios.get('https://graph.microsoft.com/v1.0/me/calendars', { headers });
  return (response.data.value || []).map(cal => ({ id: cal.id, name: cal.name, provider: 'microsoft', color: cal.color, canCreateEvents: true, isDefaultCalendar: cal.isDefaultCalendar }));
}


