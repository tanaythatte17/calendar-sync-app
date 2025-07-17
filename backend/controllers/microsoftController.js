import express from "express";
import axios from "axios";
import qs from "querystring";
import dotenv from "dotenv";
import calendarAccount from "../models/calendarAccountModel.js";
import User from "../models/userModel.js";
import Event from "../models/eventModel.js";
import jwt from "jsonwebtoken";
import { refreshCalendarAccessToken } from "../utils/refreshToken.js";
import moment from "moment-timezone";
import { findIana } from "windows-iana";

dotenv.config();

// Mock DB
const userTokens = {}; // { userId: { google: { tokens, syncToken }, outlook: { tokens, deltaLink } } }

// ============ MICROSOFT AUTH & SYNC ============
export const connectMicrosoft = (req, res) => {
  const state = req.query.state;
  const userId = state ? null : (req.query.userId || req.user?._id || '68668b8db45ebe41d4b854b4');
  // Set a temporary secure cookie with the user ID if not using state
  if (!state) {
    res.cookie("oauth_user_id", userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000 // 10 minutes
    });
  }
  const params = qs.stringify({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite',
    state: state || undefined
  });
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
};

export const microsoftCallback = async (req, res) => {
  const { code, state } = req.query;
  let userId;
  if (state) {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      userId = decoded.userId || decoded.id;
    } catch (err) {
      return res.status(401).json({ error: "Invalid token in state" });
    }
  } else {
    userId = req.cookies.oauth_user_id;
    res.clearCookie("oauth_user_id");
  }
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized - No user ID provided" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized - No user ID cookie provided" });
  }

  try {
    const code = req.query.code;
  
    const tokenRes = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      qs.stringify({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        scope: 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite',
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const tokens = tokenRes.data;
    // fetch user profile from Microsoft Graph

    const userRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userEmail = userRes.data.mail || userRes.data.userPrincipalName;

    const existingAccount = await calendarAccount.findOne({
      userId: userId,
      email: userEmail,
      provider: 'microsoft',
    });
    if (existingAccount) {
      existingAccount.accessToken = tokens.access_token;
      existingAccount.refreshToken = tokens.refresh_token || existingAccount.refreshToken;
      existingAccount.expiresAt = new Date(Date.now() + tokens.expires_in * 1000); // if you track expiry
      existingAccount.deltaLink = null;
      await existingAccount.save();
      // Do not return here; update user's calendarAccounts below if needed
    } else {
      const provider = 'microsoft';
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;

      const newCalendarAccount = new calendarAccount({
        userId: userId,
        email: userEmail,
        provider,
        accessToken,
        refreshToken,
        deltaLink: null,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000), // initialize delta link
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
    console.error("Error in microsoftCallback:", err.message || err);
    res.status(500).send("Microsoft authentication failed");
  }
};

export const syncMicrosoft = async (req, res) => {
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
      provider: 'microsoft',
      email: userEmail,
    });

    if (!account) {
      return res.status(400).json({ error: "No linked Microsoft account found." });
    }

    if (account.expiresAt && account.expiresAt < new Date()) {
      console.log("Microsoft token expired, refreshing...");
      const tokens = await refreshCalendarAccessToken(
        account._id,
        account.refreshToken,
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        process.env.MICROSOFT_CLIENT_ID,
        process.env.MICROSOFT_CLIENT_SECRET
      );
      account.accessToken = tokens.accessToken; // keep local variable updated
    }
    const headers = { Authorization: `Bearer ${account.accessToken}` };
    let events = [];
    let newDeltaLink = account.deltaLink;
    if (!account.deltaLink) {
      // First sync: get all events with pagination
      let url = 'https://graph.microsoft.com/v1.0/me/events';
      let keepGoing = true;
      while (keepGoing && url) {
        const allEventsRes = await axios.get(url, { headers });
        if (allEventsRes.data.value && Array.isArray(allEventsRes.data.value)) {
          events = events.concat(allEventsRes.data.value);
        }
        if (allEventsRes.data['@odata.nextLink']) {
          url = allEventsRes.data['@odata.nextLink'];
        } else {
          keepGoing = false;
        }
      }
      // Then get the delta link (with pagination)
      let deltaUrl = 'https://graph.microsoft.com/v1.0/me/events/delta';
      let lastDeltaResponse = null;
      keepGoing = true;
      while (keepGoing && deltaUrl) {
        const deltaRes = await axios.get(deltaUrl, { headers });
        lastDeltaResponse = deltaRes;
        if (deltaRes.data.value && Array.isArray(deltaRes.data.value)) {
          events = events.concat(deltaRes.data.value);
        }
        if (deltaRes.data['@odata.nextLink']) {
          deltaUrl = deltaRes.data['@odata.nextLink'];
        } else {
          keepGoing = false;
        }
      }
      newDeltaLink = lastDeltaResponse?.data['@odata.deltaLink'] || null;
      account.deltaLink = newDeltaLink;
      account.lastSyncedAt = new Date();
      await account.save();
    } else {
      // Use delta link for incremental sync (with pagination)
      let deltaUrl = account.deltaLink;
      let lastDeltaResponse = null;
      let keepGoing = true;
      while (keepGoing && deltaUrl) {
        const response = await axios.get(deltaUrl, { headers });
        lastDeltaResponse = response;
        if (response.data.value && Array.isArray(response.data.value)) {
          events = events.concat(response.data.value);
        }
        if (response.data['@odata.nextLink']) {
          deltaUrl = response.data['@odata.nextLink'];
        } else {
          keepGoing = false;
        }
      }
      newDeltaLink = lastDeltaResponse?.data['@odata.deltaLink'] || account.deltaLink;
      account.deltaLink = newDeltaLink;
      account.lastSyncedAt = new Date();
      await account.save();
    }

    for (const e of events) {
      if (e["@removed"]) {
        // event was deleted
        console.log('Deleting event:', e.id);
        await Event.deleteOne({
          calendarAccountId: account._id,
          externalId: e.id,
          source: 'microsoft',
        });
        continue;
      }
      await Event.findOneAndUpdate(
        {
          calendarAccountId: account._id,
          externalId: e.id,
          source: 'microsoft',
        },
        {
          calendarAccountId: account._id,
          source: 'microsoft',
          externalId: e.id,
          title: e.subject,
          description: e.bodyPreview,
          location: e.location?.displayName,
          start: {
            dateTime: new Date(e.start?.dateTime + "Z"), // Store as received (UTC)
            timeZone: e.start?.timeZone || 'UTC',
          },
          end: {
            dateTime: new Date(e.end?.dateTime + "Z"), // Store as received (UTC)
            timeZone: e.end?.timeZone || 'UTC',
          },
          isAllDay: Boolean(e.isAllDay),
          organizer: {
            email: e.organizer?.emailAddress?.address,
            name: e.organizer?.emailAddress?.name,
          },
          attendees: e.attendees?.map(a => ({
            email: a.emailAddress?.address,
            name: a.emailAddress?.name,
            responseStatus: a.status?.response,
          })),
          isRecurring: e.type === 'seriesMaster',
          recurringEventId: e.seriesMasterId,
          status: e.isCancelled ? 'cancelled' : (e.showAs === 'tentative' ? 'tentative' : 'confirmed'),
          htmlLink: e.webLink,
          raw: e,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      message: "Microsoft calendar sync complete",
      synced: events.length
    });

  } catch (err) {
    // delta link expired
    if (err.response?.status === 410) {
      await calendarAccount.updateOne(
        { userId: userId, provider: 'microsoft' }, // Fix: use userId instead of Id
        { $unset: { deltaLink: "" } }
      );
      return res.status(410).send("Delta link expired, please reconnect.");
    }
    console.error("Microsoft sync failed:", err.message || err);
    res.status(500).send("Microsoft sync failed.");
  }
};
