import express from "express";
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
import cookieParser from "cookie-parser";
import { scheduleRenewal } from "../utils/agendaUtils.js";

const router = express.Router();

// Setup Google OAuth2 client
dotenv.config();
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
// Mock DB
const userTokens = {}; // { userId: { google: { tokens, syncToken }, outlook: { tokens, deltaLink } } }

// ============ GOOGLE AUTH & SYNC ============
export const connectGoogle = async (req, res) => {
  const state = req.query.state;
  const userId = state ? null : (req.query.userId || req.user?._id ); // fallback for non-state flows
  // Set a temporary secure cookie with the user ID if not using state
  if (!state) {
    res.cookie("oauth_user_id", userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000 // 10 minutes
    });
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI, // Explicitly required
    state: state || undefined
  });
  res.redirect(url);
};

export const googleCallback = async (req, res) => {
  const { code, state } = req.query;
  let userId;
  if (state) {
    // JWT in state param
    try {
      const decodedState = decodeURIComponent(state);
      const decoded = jwt.verify(decodedState, process.env.JWT_SECRET);
      userId = decoded.userId || decoded.id;
    } catch (err) {
      return res.status(401).json({ error: "Invalid token in state" });
    }
  } else {
    // fallback to cookie
    userId = req.cookies.oauth_user_id;
    res.clearCookie("oauth_user_id");
  }
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized - No user ID provided" });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    oauth2Client.setCredentials(tokens);

    // Initialize OAuth2 API client
    const oauth2 = google.oauth2({
      version: 'v2',
      auth: oauth2Client,
    });

    // Get user profile info
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    const existingAccount = await calendarAccount.findOne({
      userId: userId,
      email: userEmail,
      provider: 'google',
    });
    if (existingAccount) {
      existingAccount.accessToken = tokens.access_token;
      existingAccount.refreshToken = tokens.refresh_token || existingAccount.refreshToken;
      existingAccount.expiresAt = new Date(tokens.expiry_date);
      existingAccount.syncToken = null;
      await existingAccount.save();
      // Do not return here; update user's calendarAccounts below if needed
    } else {
      const provider = 'google';
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;
      const newCalendarAccount = new calendarAccount({
        userId: userId,
        email: userEmail,
        provider,
        accessToken,
        refreshToken,
        expiresAt: new Date(tokens.expiry_date),
      });
      await newCalendarAccount.save();
      await User.findByIdAndUpdate(
        userId,
        { $push: { calendarAccounts: newCalendarAccount._id } },
        { new: true }
      );
      return res.redirect('http://localhost:5173/dashboard');
    }
    // Always ensure the account is in the user's calendarAccounts array
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { calendarAccounts: existingAccount._id } },
      { new: true }
    );
    return res.redirect('http://localhost:5173/dashboard');

  } catch (err) {
    console.error('Error in googleCallback:', err.message || err);
    res.status(500).send('Google authentication failed');
  }
};

export const syncGoogle = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userEmail = req.query.email || req.user?.email;

    if (!userId || !userEmail) {
      return res.status(400).json({ error: "Missing userId or email in request." });
    }

    const account = await calendarAccount.findOne({
      userId: userId,
      provider: 'google',
      email: userEmail,
    });

    if (!account) {
      return res.status(400).json({ error: "No linked Google account found." });
    }

    // Refresh token if needed
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

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    console.log(`Starting initial sync for user ${userId}`);

    // STEP 1: Delete all existing events for this calendar account
    const deletedCount = await Event.deleteMany({
      calendarAccountId: account._id,
      source: 'google',
    });
    console.log(`Deleted ${deletedCount.deletedCount} existing events for account ${account._id}`);

    // STEP 2: Full calendar list sync and get sync token
    const calendarListRes = await calendar.calendarList.list();
    const calendarList = calendarListRes.data.items || [];
    const calendarListSyncToken = calendarListRes.data.nextSyncToken;

    account.calendarList = []; // Reset any previous list
    for (const c of calendarList) {
      account.calendarList.push({
        calendarId: c.id,
        name: c.summary,
        syncToken: null, // Will be updated after event sync
        color: c.backgroundColor || null,
      });
    }
    account.calendarListSyncToken = calendarListSyncToken;
    console.log(`Fetched ${calendarList.length} calendars and calendar list sync token`);

    // STEP 3: Full sync events for each calendar and store sync tokens
    let totalEventsProcessed = 0;
    
    for (let i = 0; i < account.calendarList.length; i++) {
      const calendarEntry = account.calendarList[i];
      const calendarId = calendarEntry.calendarId;

      console.log(`Full sync for Google calendar: ${calendarEntry.name} (${calendarId})`);

      const { eventsProcessed, nextSyncToken } = await performFullSync(calendar, calendarId, account._id);
      totalEventsProcessed += eventsProcessed;
      account.calendarList[i].syncToken = nextSyncToken;

      console.log(`Calendar ${calendarEntry.name}: processed ${eventsProcessed} events, got sync token`);
    }

    account.markModified('calendarList');
    account.lastSyncedAt = new Date();
    await account.save();
    console.log(`Initial sync completed: ${totalEventsProcessed} total events processed`);

    // STEP 4: Create Google notifications
    const notificationResult = await createGoogleNotifications(userId, userEmail);

    res.json({
      message: "Google calendar initial sync and notifications setup complete",
      calendars: account.calendarList.length,
      totalEventsProcessed,
      notifications: {
        calendarListChannel: notificationResult.calendarListChannel,
        eventChannels: notificationResult.eventChannels
      }
    });

  } catch (err) {
    console.error("Google initial sync failed:", err);
    res.status(500).json({ error: "Google initial sync failed", details: err.message });
  }
};

export const createGoogleNotifications = async (userId, userEmail) => {
  try {
    console.log(`Creating Google notifications for user ${userId}`);

    const account = await calendarAccount.findOne({
      userId: userId,
      provider: 'google',
      email: userEmail,
    });

    if (!account) {
      throw new Error("No linked Google account found");
    }

    // Refresh token if needed
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

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 3 days expiration (in milliseconds) - Google allows this
    const ttlDays = 3;
    const expirationTime = Date.now() + (ttlDays * 24 * 60 * 60 * 1000);

    // Create notification channel for calendar list changes (add/delete/update calendars)
    const calendarListChannelId = uuidv4();
    console.log(`Creating calendar list notification channel: ${calendarListChannelId}`);
    
    const calendarListChannel = await calendar.calendarList.watch({
      requestBody: {
        id: calendarListChannelId,
        type: 'web_hook',
        address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/list`,
        token: JSON.stringify({ 
          userId: userId.toString(), 
          email: userEmail, 
          type: 'calendar-list',
          accountId: account._id.toString()
        }),
        expiration: expirationTime
      }
    });

    console.log(`✅ Created calendar list notification channel: ${calendarListChannelId}`);

    await scheduleRenewal(
      expirationTime,
      account._id.toString(),
      "calendar-list",
      null, // no calendarId for list
      calendarListChannelId,
      calendarListChannel.data.resourceId
    );

    // Create notification channels for each calendar's events (add/delete/update events)
    const eventChannels = [];
    
    for (const calendarEntry of account.calendarList || []) {
      const eventChannelId = uuidv4();
      
      try {
        console.log(`Creating event notification channel for: ${calendarEntry.name} (${calendarEntry.calendarId})`);

        const payload = {
          userId: userId.toString(),
          calendarId: calendarEntry.calendarId,
          accountId: account._id.toString(),
        };
        
        const eventChannel = await calendar.events.watch({
          calendarId: calendarEntry.calendarId,
          requestBody: {
            id: eventChannelId,
            type: 'web_hook',
            address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/events`,
            token:Buffer.from(JSON.stringify(payload)).toString('base64'),
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

        console.log(`✅ Created event notification channel for ${calendarEntry.name}: ${eventChannelId}`);

        await scheduleRenewal(
          expirationTime,
          account._id.toString(),
          "events",
          calendarEntry.calendarId,
          eventChannelId,
          eventChannel.data.resourceId
        );
        
      } catch (err) {
        console.error(`❌ Failed to create event channel for calendar ${calendarEntry.name}:`, err.message);
      }
    }

    // Store webhook info in account
    account.webhookChannels = {
      calendarList: {
        channelId: calendarListChannelId,
        resourceId: calendarListChannel.data.resourceId,
        expiration: new Date(expirationTime)
      },
      events: eventChannels
    };
    account.webhookSetupAt = new Date();
    await account.save();

    console.log(`✅ Notifications setup complete for user ${userId}: 1 calendar list + ${eventChannels.length} event channels`);
    
    return {
      calendarListChannel: calendarListChannelId,
      eventChannels: eventChannels.length
    };

  } catch (err) {
    console.error('❌ Failed to create Google notifications:', err);
    throw err;
  }
};

export async function renewNotification(accountId, channelType, calendarId, oldChannelId, resourceId) {
  const account = await calendarAccount.findById(accountId);
  if (!account) {
    console.error(`Account ${accountId} not found`);
    return;
  }

  // 1️⃣ Stop existing channel
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  await calendar.channels.stop({
    requestBody: {
      id: oldChannelId,
      resourceId: resourceId,
    },
  });

  console.log(`🛑 Stopped old ${channelType} channel: ${oldChannelId}`);

  // 2️⃣ Create new channel (simplified — you can reuse your createGoogleNotifications logic here)
  const newChannelId = uuidv4();
  const expirationTime = Date.now() + (3 * 24 * 60 * 60 * 1000); // 3 days from now

  if (channelType === "calendar-list") {
    await calendar.calendarList.watch({
      requestBody: {
        id: newChannelId,
        type: "web_hook",
        address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/list`,
        token: JSON.stringify({ accountId }),
        expiration: expirationTime
      }
    });
  } else if (channelType === "events") {
    await calendar.events.watch({
      calendarId,
      requestBody: {
        id: newChannelId,
        type: "web_hook",
        address: `${process.env.WEBHOOK_BASE_URL}/webhook/google/events`,
        token: JSON.stringify({ accountId, calendarId }),
        expiration: expirationTime
      }
    });
  }

  console.log(`✅ Created new ${channelType} channel: ${newChannelId}`);
}

// Optimized full sync with smart recurring event handling
async function performFullSync(calendar, calendarId, accountId) {
  const now = new Date();
  const startDate = new Date();
  startDate.setFullYear(now.getFullYear() - 2);
  const endDate = new Date();
  endDate.setFullYear(now.getFullYear() + 2);

  let allMasterEvents = [];
  let pageToken = null;
  let nextSyncToken = null; // ✅ add this

  do {
    const params = {
      calendarId,
      maxResults: 2500,
      singleEvents: false,
      showDeleted: true,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
    };
    if (pageToken) params.pageToken = pageToken;

    const result = await calendar.events.list(params);
    const events = result.data.items || [];
    allMasterEvents = allMasterEvents.concat(events);
    pageToken = result.data.nextPageToken;

    if (!pageToken && result.data.nextSyncToken) {
      nextSyncToken = result.data.nextSyncToken; // ✅ capture the sync token
    }
  } while (pageToken);

  const recurringMasters = allMasterEvents.filter(e => e.recurrence && e.recurrence.length > 0);
  const singleEvents = allMasterEvents.filter(e => !e.recurrence || e.recurrence.length === 0);

  await processBatchEvents(singleEvents, accountId, calendarId);

  for (const master of recurringMasters) {
    await processRecurringEventMaster(calendar, master, calendarId, accountId, startDate, endDate);
  }

  const allEventIds = allMasterEvents.map(e => e.id);
  const existingEvents = await Event.find({
    calendarAccountId: accountId,
    calendarId,
    source: 'google'
  }).select('externalId recurringEventId');

  const eventsToDelete = existingEvents.filter(dbEvent => {
    if (allEventIds.includes(dbEvent.externalId)) return false;
    if (dbEvent.recurringEventId && allEventIds.includes(dbEvent.recurringEventId)) return false;
    return true;
  });

  if (eventsToDelete.length > 0) {
    const idsToDelete = eventsToDelete.map(e => e.externalId);
    await Event.deleteMany({
      calendarAccountId: accountId,
      calendarId,
      source: 'google',
      externalId: { $in: idsToDelete }
    });
    console.log(`Cleaned up ${eventsToDelete.length} obsolete events`);
  }

  return {
    eventsProcessed: allMasterEvents.length,
    nextSyncToken // ✅ return it
  };
}

// Optimized incremental sync
export async function performIncrementalSync(calendar, calendarId, syncToken, accountId) {
  let allChangedEvents = [];
  let pageToken = null;
  let newSyncToken = null;

  do {
    const params = {
      calendarId,
      maxResults: 2500,
      syncToken,
      showDeleted: true,
      singleEvents: false, // Don't expand recurring events initially
    };
    
    if (pageToken) params.pageToken = pageToken;
    
    const result = await calendar.events.list(params);
    const events = result.data.items || [];
    allChangedEvents = allChangedEvents.concat(events);
    pageToken = result.data.nextPageToken;
    
    if (!pageToken) {
      newSyncToken = result.data.nextSyncToken;
    }
  } while (pageToken);

  // Process changed events
  const recurringMasters = allChangedEvents.filter(e => e.recurrence && e.recurrence.length > 0);
  const singleEvents = allChangedEvents.filter(e => !e.recurrence || e.recurrence.length === 0);
  
  // Process single events (including cancelled)
  await processBatchEvents(singleEvents, accountId, calendarId);
  
  // Process recurring events
  const now = new Date();
  const startDate = new Date();
  startDate.setFullYear(now.getFullYear() - 2);
  const endDate = new Date();
  endDate.setFullYear(now.getFullYear() + 2);
  
  for (const master of recurringMasters) {
    if (master.status === 'cancelled') {
      // Entire series was deleted
      await Event.deleteMany({
        calendarAccountId: accountId,
        calendarId: calendarId,
        source: 'google',
        $or: [
          { externalId: master.id },
          { recurringEventId: master.id }
        ]
      });
      console.log(`Deleted entire recurring series: ${master.id}`);
    } else {
      await processRecurringEventMaster(calendar, master, calendarId, accountId, startDate, endDate);
    }
  }

  return {
    eventsProcessed: allChangedEvents.length,
    newSyncToken
  };
}

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

export async function updateGoogleCalendarList(account) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

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
  }

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const previousCalendars = account.calendarList || [];
  const previousMap = new Map(previousCalendars.map((c) => [c.calendarId, c]));

  let fetchedCalendars = [];
  let nextSyncToken = null;

  try {
    if (account.calendarListSyncToken) {
      // Incremental sync
      const res = await calendar.calendarList.list({
        syncToken: account.calendarListSyncToken,
      });

      fetchedCalendars = res.data.items || [];
      nextSyncToken = res.data.nextSyncToken;

      const updatedMap = new Map();
      const removedCalendarIds = [];

      for (const c of fetchedCalendars) {
        if (c.deleted) {
          removedCalendarIds.push(c.id);
        } else {
          const existing = previousMap.get(c.id);
          updatedMap.set(c.id, {
            calendarId: c.id,
            name: c.summary,
            syncToken: existing?.syncToken || null,
            deltaLink: existing?.deltaLink || null,
            color: c.backgroundColor || null,
          });
        }
      }

      const newCalendarList = [];
      for (const [id, cal] of previousMap) {
        if (!removedCalendarIds.includes(id)) {
          newCalendarList.push(updatedMap.get(id) || cal);
        }
      }

      if (removedCalendarIds.length > 0) {
        await Event.deleteMany({
          calendarAccountId: account._id,
          calendarId: { $in: removedCalendarIds },
        });
      }

      account.calendarList = newCalendarList;
      account.calendarListSyncToken = nextSyncToken;
      await account.save();
    } else {
      // Full sync
      const res = await calendar.calendarList.list();
      const calendarList = res.data.items || [];
      nextSyncToken = res.data.nextSyncToken;

      const currentIds = new Set(calendarList.map((c) => c.id));
      const previousIds = new Set(previousCalendars.map((c) => c.calendarId));
      const removedCalendarIds = [...previousIds].filter((id) => !currentIds.has(id));

      const updatedList = calendarList.map((c) => {
        const existing = previousMap.get(c.id);
        return {
          calendarId: c.id,
          name: c.summary,
          syncToken: existing?.syncToken || null,
          deltaLink: existing?.deltaLink || null,
          color: c.backgroundColor || null,
        };
      });

      if (removedCalendarIds.length > 0) {
        await Event.deleteMany({
          calendarAccountId: account._id,
          calendarId: { $in: removedCalendarIds },
        });
      }

      account.calendarList = updatedList;
      account.calendarListSyncToken = nextSyncToken;
      await account.save();
    }
  } catch (err) {
    // Sync token expired or invalid — fallback to full sync
    if (err.errors?.[0]?.reason === "fullSyncRequired") {
      console.warn("Sync token expired. Performing full sync...");
      account.calendarListSyncToken = null;
      await updateGoogleCalendarList(account); // Recursive call with full sync
    } else {
      throw err;
    }
  }
}