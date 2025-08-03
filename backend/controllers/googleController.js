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
import cookieParser from "cookie-parser";

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
      'https://www.googleapis.com/auth/calendar.readonly',
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
    // Get userId from req.user (set by protectRoute middleware)
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

    // Handle calendar list sync (unchanged from your original)
    const previousCalendars = account.calendarList || [];
    const previousCalendarMap = new Map(previousCalendars.map(c => [c.calendarId, c]));

    let fetchedCalendars = [];
    let nextSyncToken = null;

    if (account.calendarListSyncToken) {
      // Incremental calendar list sync
      const calendarListRes = await calendar.calendarList.list({
        syncToken: account.calendarListSyncToken,
      });

      fetchedCalendars = calendarListRes.data.items || [];
      nextSyncToken = calendarListRes.data.nextSyncToken;

      const updatedMap = new Map();
      const removedCalendarIds = [];

      for (const c of fetchedCalendars) {
        if (c.deleted) {
          removedCalendarIds.push(c.id);
        } else {
          const existing = previousCalendarMap.get(c.id);
          updatedMap.set(c.id, {
            calendarId: c.id,
            name: c.summary,
            syncToken: existing?.syncToken || null,
            color: c.backgroundColor || null,
          });
        }
      }

      const newCalendarList = [];
      for (const [id, cal] of previousCalendarMap) {
        if (!removedCalendarIds.includes(id)) {
          newCalendarList.push(updatedMap.get(id) || cal);
        }
      }

      if (removedCalendarIds.length > 0) {
        await Event.deleteMany({
          calendarAccountId: account._id,
          calendarId: { $in: removedCalendarIds },
          source: 'google',
        });
      }

      account.calendarList = newCalendarList;
      account.calendarListSyncToken = nextSyncToken;
      await account.save();

    } else {
      // Full calendar list refresh
      const calendarListRes = await calendar.calendarList.list();
      const calendarList = calendarListRes.data.items || [];
      nextSyncToken = calendarListRes.data.nextSyncToken;

      const currentCalendarIds = new Set(calendarList.map(c => c.id));
      const previousCalendarIds = new Set(previousCalendars.map(c => c.calendarId));
      const removedCalendarIds = [...previousCalendarIds].filter(id => !currentCalendarIds.has(id));

      const updatedCalendarList = calendarList.map(c => {
        const existing = previousCalendarMap.get(c.id);
        return {
          calendarId: c.id,
          name: c.summary,
          syncToken: existing?.syncToken || null,
          color: c.backgroundColor || null,
        };
      });

      if (removedCalendarIds.length > 0) {
        await Event.deleteMany({
          calendarAccountId: account._id,
          calendarId: { $in: removedCalendarIds },
          source: 'google',
        });
      }

      account.calendarList = updatedCalendarList;
      account.calendarListSyncToken = nextSyncToken;
      await account.save();
    }

    // Enhanced event syncing with smart recurring event handling
    let totalEventsProcessed = 0;
    
    for (const calendarEntry of account.calendarList) {
      const calendarId = calendarEntry.calendarId;
      let syncToken = calendarEntry.syncToken;
      let triedFullSync = false;

      while (true) {
        try {
          if (!syncToken) {
            // FULL SYNC: Use hybrid approach for better performance
            console.log(`Full sync for Google calendar ${calendarId}`);
            const eventsProcessed = await performFullSync(calendar, calendarId, account._id);
            totalEventsProcessed += eventsProcessed;

            // Get sync token for future incremental syncs
            const syncResult = await calendar.events.list({
              calendarId,
              maxResults: 1,
              showDeleted: true,
            });
            calendarEntry.syncToken = syncResult.data.nextSyncToken;

          } else {
            // INCREMENTAL SYNC: Process changes efficiently
            console.log(`Incremental sync for Google calendar ${calendarId}`);
            const { eventsProcessed, newSyncToken } = await performIncrementalSync(
              calendar, 
              calendarId, 
              syncToken, 
              account._id
            );
            totalEventsProcessed += eventsProcessed;
            calendarEntry.syncToken = newSyncToken;
          }
          break;

        } catch (err) {
          if (err.code === 410 && !triedFullSync) {
            console.log(`Sync token expired for calendar ${calendarId}, falling back to full sync`);
            calendarEntry.syncToken = null;
            syncToken = null;
            triedFullSync = true;
            continue;
          } else {
            throw err;
          }
        }
      }
    }

    account.lastSyncedAt = new Date();
    await account.save();

    res.json({
      message: "Google calendar sync complete",
      synced: totalEventsProcessed
    });

  } catch (err) {
    if (err.code === 410) {
      console.log("Global sync token expired:", err);
      await calendarAccount.updateOne(
        { userId: req.user._id, provider: 'google' },
        { $unset: { calendarListSyncToken: "", syncToken: "" } }
      );
      return res.status(410).send("Sync token expired, please reconnect.");
    }
    console.error("Google sync failed:", err);
    res.status(500).send("Google sync failed.");
  }
};

// Optimized full sync with smart recurring event handling
async function performFullSync(calendar, calendarId, accountId) {
  const now = new Date();
  const startDate = new Date();
  startDate.setFullYear(now.getFullYear() - 2);
  const endDate = new Date();
  endDate.setFullYear(now.getFullYear() + 2);

  // Step 1: Get all events (including recurring masters) without expansion
  let allMasterEvents = [];
  let pageToken = null;
  
  do {
    const params = {
      calendarId,
      maxResults: 2500,
      singleEvents: false, // Get recurring masters, not expanded instances
      showDeleted: true,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
    };
    
    if (pageToken) params.pageToken = pageToken;
    
    const result = await calendar.events.list(params);
    const events = result.data.items || [];
    allMasterEvents = allMasterEvents.concat(events);
    pageToken = result.data.nextPageToken;
  } while (pageToken);

  // Step 2: Process masters and expand only changed recurring events
  const recurringMasters = allMasterEvents.filter(e => e.recurrence && e.recurrence.length > 0);
  const singleEvents = allMasterEvents.filter(e => !e.recurrence || e.recurrence.length === 0);
  
  // Process single events
  await processBatchEvents(singleEvents, accountId, calendarId);
  
  // Process recurring events efficiently
  for (const master of recurringMasters) {
    await processRecurringEventMaster(calendar, master, calendarId, accountId, startDate, endDate);
  }

  // Step 3: Clean up events that no longer exist
  const allEventIds = allMasterEvents.map(e => e.id);
  const existingEvents = await Event.find({
    calendarAccountId: accountId,
    calendarId: calendarId,
    source: 'google'
  }).select('externalId recurringEventId');

  const eventsToDelete = existingEvents.filter(dbEvent => {
    // Keep if the event ID exists in the fresh data
    if (allEventIds.includes(dbEvent.externalId)) return false;
    
    // Keep if it's an instance of a recurring event that still exists
    if (dbEvent.recurringEventId && allEventIds.includes(dbEvent.recurringEventId)) return false;
    
    // Otherwise, it should be deleted
    return true;
  });

  if (eventsToDelete.length > 0) {
    const idsToDelete = eventsToDelete.map(e => e.externalId);
    await Event.deleteMany({
      calendarAccountId: accountId,
      calendarId: calendarId,
      source: 'google',
      externalId: { $in: idsToDelete }
    });
    console.log(`Cleaned up ${eventsToDelete.length} obsolete events`);
  }

  return allMasterEvents.length;
}

// Optimized incremental sync
async function performIncrementalSync(calendar, calendarId, syncToken, accountId) {
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