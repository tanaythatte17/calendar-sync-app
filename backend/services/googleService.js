import axios from "axios";
import qs from "querystring";
import { google } from "googleapis";
import dotenv from "dotenv";
import calendarAccount from "../models/calendarAccountModel.js";
import User from "../models/userModel.js";
import Event from "../models/eventModel.js";
import { refreshCalendarAccessToken } from "../utils/refreshToken.js";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import { scheduleRenewal } from "../utils/agendaUtils.js";
import sseService from "./sseService.js";
import logger from "../utils/logger.js";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Generate Google OAuth 2.0 authorization URL.
 * User's browser navigates to this URL to authenticate with Google.
 *
 * @param {string} userIdFromQuery - User ID to store temporarily if no state
 * @param {string} state - OAuth state parameter (JWT with userId)
 * @param {Object} cookies - Request cookies
 * @param {Function} setCookie - Response.cookie binding
 * @param {Function} redirect - Response.redirect binding
 * @returns {string} Google OAuth authorization URL
 */
export async function connect(userIdFromQuery, state, cookies, setCookie, redirect) {
  const userId = state ? null : userIdFromQuery;
  if (!state) {
    setCookie("oauth_user_id", userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000,
      path: "/"
    });
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    state: state || undefined
  });
  return url;
}

/**
 * Handle Google OAuth callback.
 * Exchanges authorization code for access/refresh tokens.
 * Creates or updates CalendarAccount and adds to user's account list.
 *
 * @param {string} code - OAuth authorization code from Google
 * @param {string} state - OAuth state parameter (JWT with userId)
 * @param {Object} cookies - Request cookies
 * @param {Function} clearCookie - Response.clearCookie binding
 * @param {Function} redirect - Response.redirect binding
 * @throws {Error} If userId cannot be determined or token exchange fails
 */
export async function callback(code, state, cookies, clearCookie, redirect) {
  let userId;
  if (state) {
    const decodedState = decodeURIComponent(state);
    const decoded = jwt.verify(decodedState, process.env.JWT_SECRET);
    userId = decoded.userId || decoded.id;
  } else {
    userId = cookies.oauth_user_id;
    clearCookie("oauth_user_id");
  }
  if (!userId) {
    const err = new Error("Unauthorized - No user ID provided");
    err.statusCode = 401;
    throw err;
  }

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const userEmail = userInfo.data.email;

  const existingAccount = await calendarAccount.findOne({ userId, email: userEmail, provider: 'google' });
  if (existingAccount) {
    existingAccount.accessToken = tokens.access_token;
    existingAccount.refreshToken = tokens.refresh_token || existingAccount.refreshToken;
    existingAccount.expiresAt = new Date(tokens.expiry_date);
    existingAccount.syncToken = null;
    await existingAccount.save();
    await User.findByIdAndUpdate(userId, { $addToSet: { calendarAccounts: existingAccount._id } }, { new: true });
  } else {
    const newCalendarAccount = new calendarAccount({
      userId,
      email: userEmail,
      provider: 'google',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date),
    });
    await newCalendarAccount.save();
    await User.findByIdAndUpdate(userId, { $push: { calendarAccounts: newCalendarAccount._id } }, { new: true });
  }

  redirect(`${process.env.FRONTEND_URL}/dashboard?provider=google&status=connected`);
}

/**
 * Perform initial full synchronization of all Google calendars for a user.
 * Fetches all calendars and events, sets up webhooks for future updates.
 * Deletes existing events and replaces with fresh data.
 *
 * @param {string} userId - User ID
 * @param {string} userEmail - Google account email
 * @returns {Object} Sync result with calendar count, event count, and webhook setup status
 * @throws {Error} If account not found or API call fails
 */
export async function sync(userId, userEmail) {
  if (!userId || !userEmail) {
    const err = new Error("Missing userId or email in request.");
    err.statusCode = 400;
    throw err;
  }

  const account = await calendarAccount.findOne({ userId, provider: 'google', email: userEmail });
  if (!account) {
    const err = new Error("No linked Google account found.");
    err.statusCode = 400;
    throw err;
  }

  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(
      account._id,
      account.refreshToken,
      'https://oauth2.googleapis.com/token',
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    account.accessToken = tokens.accessToken;
  }

  oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Clear existing events for fresh sync
  await Event.deleteMany({ calendarAccountId: account._id, source: 'google' });

  const calendarListRes = await calendar.calendarList.list();
  const calendarList = calendarListRes.data.items || [];
  const calendarListSyncToken = calendarListRes.data.nextSyncToken;

  account.calendarList = [];
  for (const c of calendarList) {
    account.calendarList.push({ calendarId: c.id, name: c.summary, syncToken: null, color: c.backgroundColor || null });
  }
  account.calendarListSyncToken = calendarListSyncToken;

  let totalEventsProcessed = 0;
  for (let i = 0; i < account.calendarList.length; i++) {
    const calendarEntry = account.calendarList[i];
    const calendarId = calendarEntry.calendarId;
    const { eventsProcessed, nextSyncToken } = await performFullSync(calendar, calendarId, account._id);
    totalEventsProcessed += eventsProcessed;
    account.calendarList[i].syncToken = nextSyncToken;
  }

  account.markModified('calendarList');
  account.lastSyncedAt = new Date();
  await account.save();

  const notificationResult = await createGoogleNotifications(userId, userEmail);
  return {
    message: "Google calendar initial sync and notifications setup complete",
    calendars: account.calendarList.length,
    totalEventsProcessed,
    notifications: {
      calendarListChannel: notificationResult.calendarListChannel,
      eventChannels: notificationResult.eventChannels
    }
  };
}

/**
 * Create Google push notification subscriptions for calendar changes.
 * Sets up webhooks for calendar list and individual calendar events.
 * Schedules webhook renewal jobs via Agenda.
 *
 * @param {string} userId - User ID
 * @param {string} userEmail - Google account email
 * @returns {Object} Channel setup result with channel ID and event channel count
 * @throws {Error} If account not found or webhook creation fails
 */
export async function createGoogleNotifications(userId, userEmail) {
  const account = await calendarAccount.findOne({ userId, provider: 'google', email: userEmail });
  if (!account) {
    const err = new Error("No linked Google account found");
    err.statusCode = 400;
    throw err;
  }

  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(
      account._id,
      account.refreshToken,
      'https://oauth2.googleapis.com/token',
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    account.accessToken = tokens.accessToken;
  }

  oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const ttlDays = 3;
  const expirationTime = Date.now() + (ttlDays * 24 * 60 * 60 * 1000);

  const calendarListChannelId = uuidv4();
  logger.info('Webhook Url is : ',process.env.WEBHOOK_BASE_URL);
  const calendarListChannel = await calendar.calendarList.watch({
    requestBody: {
      id: calendarListChannelId,
      type: 'web_hook',
      address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/list`,
      token: JSON.stringify({ userId: userId.toString(), email: userEmail, type: 'calendar-list', accountId: account._id.toString() }),
      expiration: expirationTime
    }
  });

  await scheduleRenewal(
    expirationTime,
    account._id.toString(),
    "calendar-list",
    null,
    calendarListChannelId,
    calendarListChannel.data.resourceId
  );

  const eventChannels = [];
  for (const calendarEntry of account.calendarList || []) {
    const eventChannelId = uuidv4();
    try {
      const payload = { userId: userId.toString(), calendarId: calendarEntry.calendarId, accountId: account._id.toString() };
      const eventChannel = await calendar.events.watch({
        calendarId: calendarEntry.calendarId,
        requestBody: {
          id: eventChannelId,
          type: 'web_hook',
          address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/events`,
          token: Buffer.from(JSON.stringify(payload)).toString('base64'),
          expiration: expirationTime
        }
      });
      eventChannels.push({
        channelId: eventChannelId,
        calendarId: calendarEntry.calendarId,
        calendarName: calendarEntry.name,
        resourceId: eventChannel.data.resourceId,
        expiration: new Date(expirationTime)
      });
      await scheduleRenewal(expirationTime, account._id.toString(), "events", calendarEntry.calendarId, eventChannelId, eventChannel.data.resourceId);
    } catch (err) {
      // continue
    }
  }

  account.webhookChannels = {
    calendarList: { channelId: calendarListChannelId, resourceId: calendarListChannel.data.resourceId, expiration: new Date(expirationTime) },
    events: eventChannels
  };
  account.webhookSetupAt = new Date();
  await account.save();

  return { calendarListChannel: calendarListChannelId, eventChannels: eventChannels.length };
}

/**
 * Renew an expiring Google push notification subscription.
 * Stops the old channel and creates a new one with fresh 3-day TTL.
 * Re-schedules the next renewal job.
 *
 * @param {string} accountId - CalendarAccount ID
 * @param {string} channelType - 'calendar-list' or 'events'
 * @param {string} calendarId - Calendar ID (null for calendar-list)
 * @param {string} oldChannelId - Channel ID to stop
 * @param {string} resourceId - Google resource ID for the channel
 */
export async function renewNotification(
  accountId,
  channelType,
  calendarId,
  oldChannelId,
  resourceId
) {
  const account = await calendarAccount.findById(accountId);
  if (!account) return;

  // Refresh token if expired
  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(
      account._id,
      account.refreshToken,
      'https://oauth2.googleapis.com/token',
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    account.accessToken = tokens.accessToken;
    account.expiresAt = tokens.expiresAt;
    await account.save();
  }

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Stop old channel (best-effort)
  try {
    await calendar.channels.stop({
      requestBody: { id: oldChannelId, resourceId },
    });
  } catch (err) {
    logger.warn('Google channel stop failed (likely expired)');
  }

  // Create new channel with 3-day TTL
  const newChannelId = uuidv4();
  const expirationTime = Date.now() + 3 * 24 * 60 * 60 * 1000;

  let response;

  if (channelType === 'calendar-list') {
    response = await calendar.calendarList.watch({
      requestBody: {
        id: newChannelId,
        type: 'web_hook',
        address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/list`,
        token: JSON.stringify({
          accountId: account._id.toString(),
          type: 'calendar-list',
        }),
        expiration: expirationTime,
      },
    });

    account.webhookChannels.calendarList = {
      channelId: newChannelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expirationTime),
    };
  }

  if (channelType === 'events') {
    response = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: newChannelId,
        type: 'web_hook',
        address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/events`,
        token: Buffer.from(
          JSON.stringify({ accountId: account._id.toString(), calendarId })
        ).toString('base64'),
        expiration: expirationTime,
      },
    });

    const idx = account.webhookChannels.events.findIndex(
      e => e.calendarId === calendarId
    );

    const updated = {
      calendarId,
      calendarName:
        account.calendarList.find(c => c.calendarId === calendarId)?.name,
      channelId: newChannelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expirationTime),
    };

    if (idx >= 0) account.webhookChannels.events[idx] = updated;
    else account.webhookChannels.events.push(updated);
  }

  await account.save();

  // Schedule next renewal (2 hours before expiration)
  await scheduleRenewal(
    expirationTime,
    accountId,
    channelType,
    calendarId,
    newChannelId,
    response.data.resourceId
  );

  logger.info(`✅ Google ${channelType} renewed for account ${accountId}`);
}

/**
 * Perform full synchronization of a single calendar.
 * Fetches all events in ±2 year range, handles recurring event expansion.
 * Persists sync token for incremental updates.
 *
 * @param {Object} calendar - Google Calendar API client
 * @param {string} calendarId - Calendar ID to sync
 * @param {string} accountId - CalendarAccount ID
 * @returns {Object} { eventsProcessed, nextSyncToken }
 */
export async function performFullSync(calendar, calendarId, accountId) {
  const now = new Date();
  const startDate = new Date(); startDate.setFullYear(now.getFullYear() - 2);
  const endDate = new Date(); endDate.setFullYear(now.getFullYear() + 2);

  let allMasterEvents = [];
  let pageToken = null;
  let nextSyncToken = null;
  do {
    const params = { calendarId, maxResults: 2500, singleEvents: false, showDeleted: true, timeMin: startDate.toISOString(), timeMax: endDate.toISOString() };
    if (pageToken) params.pageToken = pageToken;
    const result = await calendar.events.list(params);
    const events = result.data.items || [];
    allMasterEvents = allMasterEvents.concat(events);
    pageToken = result.data.nextPageToken;
    if (!pageToken && result.data.nextSyncToken) nextSyncToken = result.data.nextSyncToken;
  } while (pageToken);

  const recurringMasters = allMasterEvents.filter(e => e.recurrence && e.recurrence.length > 0);
  const singleEvents = allMasterEvents.filter(e => !e.recurrence || e.recurrence.length === 0);
  await processBatchEvents(singleEvents, accountId, calendarId);
  for (const master of recurringMasters) {
    await processRecurringEventMaster(calendar, master, calendarId, accountId, startDate, endDate);
  }

  const allEventIds = allMasterEvents.map(e => e.id);
  const existingEvents = await Event.find({ calendarAccountId: accountId, calendarId, source: 'google' }).select('externalId recurringEventId');
  const eventsToDelete = existingEvents.filter(dbEvent => {
    if (allEventIds.includes(dbEvent.externalId)) return false;
    if (dbEvent.recurringEventId && allEventIds.includes(dbEvent.recurringEventId)) return false;
    return true;
  });
  if (eventsToDelete.length > 0) {
    const idsToDelete = eventsToDelete.map(e => e.externalId);
    await Event.deleteMany({ calendarAccountId: accountId, calendarId, source: 'google', externalId: { $in: idsToDelete } });
  }
  return { eventsProcessed: allMasterEvents.length, nextSyncToken };
}

/**
 * Perform incremental synchronization of a calendar using sync token.
 * Fetches only changed/deleted events since last sync.
 * Sends real-time SSE updates to connected clients.
 *
 * @param {Object} calendar - Google Calendar API client
 * @param {string} calendarId - Calendar ID to sync
 * @param {string} syncToken - Sync token from last sync
 * @param {string} accountId - CalendarAccount ID
 * @param {string} userId - User ID (for SSE broadcasts)
 * @returns {Object} { events, eventsProcessed, newSyncToken }
 */
export async function performIncrementalSync(calendar, calendarId, syncToken, accountId, userId = null) {
  let allChangedEvents = [];
  let pageToken = null;
  let newSyncToken = null;

  // Send sync started status via SSE
  if (userId) {
    sseService.sendSyncStatus(
      userId,
      'started',
      'Starting calendar sync...',
      { calendarId, provider: 'google' }
    );
  }
  
  do {
    const params = { 
      calendarId, 
      maxResults: 2500, 
      syncToken, 
      showDeleted: true, 
      singleEvents: false 
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await calendar.events.list(params);
    const events = result.data.items || [];
    allChangedEvents = allChangedEvents.concat(events);
    pageToken = result.data.nextPageToken;
    if (!pageToken) newSyncToken = result.data.nextSyncToken;
  } while (pageToken);

  const recurringMasters = allChangedEvents.filter(e => e.recurrence && e.recurrence.length > 0);
  const singleEvents = allChangedEvents.filter(e => !e.recurrence || e.recurrence.length === 0);
  
  await processBatchEvents(singleEvents, accountId, calendarId, userId);
  
  const now = new Date();
  const startDate = new Date(); 
  startDate.setFullYear(now.getFullYear() - 2);
  const endDate = new Date(); 
  endDate.setFullYear(now.getFullYear() + 2);
  
  for (const master of recurringMasters) {
    if (master.status === 'cancelled') {
      if (userId) {
        const deletedEvents = await Event.find({ 
          calendarAccountId: accountId, 
          calendarId, 
          source: 'google', 
          $or: [
            { externalId: master.id }, 
            { recurringEventId: master.id }
          ] 
        });
        
        // Send delete notifications
        for (const deletedEvent of deletedEvents) {
          sseService.sendEventUpdate(userId, deletedEvent.toObject(), 'deleted');
        }
      }
      
      await Event.deleteMany({ 
        calendarAccountId: accountId, 
        calendarId, 
        source: 'google', 
        $or: [
          { externalId: master.id }, 
          { recurringEventId: master.id }
        ] 
      });
    } else {
      await processRecurringEventMaster(
        calendar, 
        master, 
        calendarId, 
        accountId, 
        startDate, 
        endDate,
        userId
      );
    }
  }
  
  return { 
    events: allChangedEvents, 
    eventsProcessed: allChangedEvents.length, 
    newSyncToken 
  };
}

/**
 * Process a recurring event master rule.
 * Expands instances within date range and upserts to database.
 * Sends SSE updates for deleted instances.
 *
 * @param {Object} calendar - Google Calendar API client
 * @param {Object} master - Recurring event master object
 * @param {string} calendarId - Calendar ID
 * @param {string} accountId - CalendarAccount ID
 * @param {Date} startDate - Start of expansion range
 * @param {Date} endDate - End of expansion range
 * @param {string} userId - User ID (for SSE broadcasts)
 */
async function processRecurringEventMaster(
  calendar,
  master,
  calendarId,
  accountId,
  startDate,
  endDate,
  userId = null
) {
  try {
    const existingInstances = await Event.find({
      calendarAccountId: accountId,
      calendarId,
      source: 'google',
      $or: [
        { externalId: master.id },
        { recurringEventId: master.id }
      ]
    });
    
    let expandedInstances = [];
    let pageToken = null;
    do {
      const params = { 
        calendarId, 
        eventId: master.id, 
        maxResults: 2500, 
        timeMin: startDate.toISOString(), 
        timeMax: endDate.toISOString() 
      };
      if (pageToken) params.pageToken = pageToken;
      const result = await calendar.events.instances(params);
      const instances = result.data.items || [];
      expandedInstances = expandedInstances.concat(instances);
      pageToken = result.data.nextPageToken;
    } while (pageToken);

    const existingIds = new Set(existingInstances.map(e => e.externalId));
    const freshIds = new Set(expandedInstances.map(e => e.id));
    const instancesToDelete = [...existingIds].filter(id => !freshIds.has(id));

    if (instancesToDelete.length > 0) {
      // Send delete notifications before deleting
      if (userId) {
        const eventsToDelete = existingInstances.filter(e =>
          instancesToDelete.includes(e.externalId)
        );

        for (const deletedEvent of eventsToDelete) {
          sseService.sendEventUpdate(userId, deletedEvent.toObject(), 'deleted');
        }
      }

      await Event.deleteMany({
        calendarAccountId: accountId,
        calendarId,
        source: 'google',
        externalId: { $in: instancesToDelete }
      });
    }

    // Process expanded instances with SSE updates
    await processBatchEvents(expandedInstances, accountId, calendarId, userId);
  } catch (err) {
    logger.error('Error processing recurring event master:', err);
  }
}

/**
 * Batch upsert events to database.
 * Sends SSE updates for added/updated/deleted events.
 * Handles cancelled events as deletes.
 *
 * @param {Array} events - Events from Google Calendar API
 * @param {string} accountId - CalendarAccount ID
 * @param {string} calendarId - Calendar ID
 * @param {string} userId - User ID (for SSE broadcasts)
 */
async function processBatchEvents(events, accountId, calendarId, userId = null) {
  const bulkOps = [];
  const deletedEventIds = [];
  const upsertedEventIds = [];

  for (const event of events) {
    if (event.status === 'cancelled') {
      bulkOps.push({
        deleteOne: {
          filter: {
            calendarAccountId: accountId,
            externalId: event.id,
            calendarId,
            source: 'google'
          }
        }
      });
      deletedEventIds.push(event.id);
    } else {
      bulkOps.push({
        updateOne: {
          filter: {
            calendarAccountId: accountId,
            externalId: event.id,
            calendarId,
            source: 'google'
          },
          update: {
            $set: {
              calendarAccountId: accountId,
              calendarId,
              source: 'google',
              externalId: event.id,
              title: event.summary,
              description: event.description,
              location: event.location,
              start: {
                dateTime: new Date(event.start?.dateTime || event.start?.date),
                timeZone: event.start?.timeZone || 'UTC'
              },
              end: {
                dateTime: new Date(event.end?.dateTime || event.end?.date),
                timeZone: event.end?.timeZone || 'UTC'
              },
              isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
              organizer: {
                email: event.organizer?.email,
                name: event.organizer?.displayName
              },
              attendees: event.attendees?.map(a => ({
                email: a.email,
                name: a.displayName,
                responseStatus: a.responseStatus
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
      upsertedEventIds.push(event.id);
    }
  }

  // Fetch events to delete BEFORE bulk write (for SSE notifications)
  let eventsToDelete = [];
  if (userId && deletedEventIds.length > 0) {
    eventsToDelete = await Event.find({
      calendarAccountId: accountId,
      calendarId,
      source: 'google',
      externalId: { $in: deletedEventIds }
    });
  }

  // Execute bulk operations
  if (bulkOps.length > 0) {
    await Event.bulkWrite(bulkOps, { ordered: false });
  }

  // Send SSE notifications after bulk write
  if (userId) {
    // Send delete notifications
    for (const deletedEvent of eventsToDelete) {
      sseService.sendEventUpdate(userId, deletedEvent.toObject(), 'deleted');
    }

    // Fetch and send notifications for upserted events
    if (upsertedEventIds.length > 0) {
      const upsertedEvents = await Event.find({
        calendarAccountId: accountId,
        calendarId,
        source: 'google',
        externalId: { $in: upsertedEventIds }
      });

      for (const upsertedEvent of upsertedEvents) {
        sseService.sendEventUpdate(userId, upsertedEvent.toObject(), 'updated');
      }
    }
  }
}

/**
 * Perform incremental or full sync of user's Google calendar list.
 * Detects added/removed calendars and syncs calendar metadata.
 * Removes events for deleted calendars.
 * Uses sync token for efficiency, falls back to full list if token expired.
 *
 * @param {Object} account - CalendarAccount object
 * @throws {Error} If API call fails
 */
export async function updateGoogleCalendarList(account) {
  const authClient = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(account._id, account.refreshToken, 'https://oauth2.googleapis.com/token', process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    account.accessToken = tokens.accessToken;
  }
  authClient.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const calendar = google.calendar({ version: "v3", auth: authClient });

  const previousCalendars = account.calendarList || [];
  const previousMap = new Map(previousCalendars.map((c) => [c.calendarId, c]));

  let fetchedCalendars = [];
  let nextSyncToken = null;
  try {
    if (account.calendarListSyncToken) {
      const res = await calendar.calendarList.list({ syncToken: account.calendarListSyncToken });
      fetchedCalendars = res.data.items || [];
      nextSyncToken = res.data.nextSyncToken;
      const updatedMap = new Map();
      const removedCalendarIds = [];
      for (const c of fetchedCalendars) {
        if (c.deleted) {
          removedCalendarIds.push(c.id);
        } else {
          const existing = previousMap.get(c.id);
          updatedMap.set(c.id, { calendarId: c.id, name: c.summary, syncToken: existing?.syncToken || null, deltaLink: existing?.deltaLink || null, color: c.backgroundColor || null });
        }
      }
      const newCalendarList = [];
      for (const [id, cal] of previousMap) {
        if (!removedCalendarIds.includes(id)) newCalendarList.push(updatedMap.get(id) || cal);
      }
      if (removedCalendarIds.length > 0) {
        await Event.deleteMany({ calendarAccountId: account._id, calendarId: { $in: removedCalendarIds } });
      }
      account.calendarList = newCalendarList;
      account.calendarListSyncToken = nextSyncToken;
      await account.save();
    } else {
      const res = await calendar.calendarList.list();
      const calendarList = res.data.items || [];
      nextSyncToken = res.data.nextSyncToken;
      const currentIds = new Set(calendarList.map((c) => c.id));
      const previousIds = new Set(previousCalendars.map((c) => c.calendarId));
      const removedCalendarIds = [...previousIds].filter((id) => !currentIds.has(id));
      const updatedList = calendarList.map((c) => {
        const existing = previousMap.get(c.id);
        return { calendarId: c.id, name: c.summary, syncToken: existing?.syncToken || null, deltaLink: existing?.deltaLink || null, color: c.backgroundColor || null };
      });
      if (removedCalendarIds.length > 0) {
        await Event.deleteMany({ calendarAccountId: account._id, calendarId: { $in: removedCalendarIds } });
      }
      account.calendarList = updatedList;
      account.calendarListSyncToken = nextSyncToken;
      await account.save();
    }
  } catch (err) {
    if (err.errors?.[0]?.reason === "fullSyncRequired") {
      account.calendarListSyncToken = null;
      await updateGoogleCalendarList(account);
    } else {
      throw err;
    }
  }
}


