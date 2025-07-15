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
    });
    if (existingAccount) {
      existingAccount.accessToken = tokens.access_token;
      existingAccount.refreshToken = tokens.refresh_token || existingAccount.refreshToken;
      existingAccount.expiresAt = new Date(tokens.expiry_date);
      await existingAccount.save();
      // Do not return here; update user's calendarAccounts below if needed
    } else {
      const provider = 'google'; // or 'microsoft'
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
    // Get email from query or req.user (if needed)
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

      account.accessToken = tokens.accessToken; // keep local variable updated
    }

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const params = {
      calendarId: 'primary',
      maxResults: 2500,
      showDeleted: true,
    };

    if (account.syncToken) {
      params.syncToken = account.syncToken;
    } else {
      // first-time sync within 2-year window
      const now = new Date();
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(now.getFullYear() - 2);
      const twoYearsAhead = new Date();
      twoYearsAhead.setFullYear(now.getFullYear() + 2);
      params.timeMin = twoYearsAgo.toISOString();
      params.timeMax = twoYearsAhead.toISOString();
    }

    const result = await calendar.events.list(params);
    const events = result.data.items;

    for (const e of events) {
      // handle deleted/cancelled events
      if (e.status === 'cancelled') {
        await Event.deleteOne({
          calendarAccountId: account._id,
          externalId: e.id,
          source: 'google'
        });
        continue;
      }

      // otherwise add or update
      await Event.findOneAndUpdate(
        {
          calendarAccountId: account._id,
          externalId: e.id,
          source: 'google'
        },
        {
          calendarAccountId: account._id,
          source: 'google',
          externalId: e.id,
          title: e.summary,
          description: e.description,
          location: e.location,
          start: {
            dateTime: new Date(e.start?.dateTime || e.start?.date),
            timeZone: e.start?.timeZone || 'UTC'
          },
          end: {
            dateTime: new Date(e.end?.dateTime || e.end?.date),
            timeZone: e.end?.timeZone || 'UTC'
          },
          organizer: {
            email: e.organizer?.email,
            name: e.organizer?.displayName
          },
          attendees: e.attendees?.map(a => ({
            email: a.email,
            name: a.displayName,
            responseStatus: a.responseStatus
          })),
          isRecurring: !!e.recurringEventId,
          recurringEventId: e.recurringEventId,
          status: e.status,
          htmlLink: e.htmlLink,
          raw: e,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    // save sync token
    account.syncToken = result.data.nextSyncToken;
    account.lastSyncedAt = new Date();
    await account.save();

    res.json({
      message: "Google calendar sync complete",
      synced: events.length
    });

  } catch (err) {
    if (err.code === 410) {
      // token invalid
      await calendarAccount.updateOne(
        { userId: req.user._id, provider: 'google' },
        { $unset: { syncToken: "" } }
      );
      return res.status(410).send("Sync token expired, please reconnect.");
    }
    console.error("Google sync failed:", err);
    res.status(500).send("Google sync failed.");
  }
};