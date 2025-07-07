import express from "express";
import axios from "axios";
import qs from "querystring";
import dotenv from "dotenv";
import calendarAccount from "../models/calendarAccountModel.js";
import User from "../models/userModel.js";
import Event from "../models/eventModel.js";

dotenv.config();

// Mock DB
const userTokens = {}; // { userId: { google: { tokens, syncToken }, outlook: { tokens, deltaLink } } }

// ============ MICROSOFT AUTH & SYNC ============
export const connectMicrosoft = (req, res) => {
  // Assume user is authenticated and user ID is available in req.query or session
  // For demo, use a hardcoded user ID or get from req.user if using auth
  const userId = req.query.userId || req.user?._id || '68668b8db45ebe41d4b854b4';
  // Set a temporary secure cookie with the user ID
  res.cookie("oauth_user_id", userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000 // 10 minutes
  });

  const params = qs.stringify({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite',
  });
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
};

export const microsoftCallback = async (req, res) => {
  // Read and clear the temporary user ID cookie
  const userId = req.cookies.oauth_user_id;
  res.clearCookie("oauth_user_id");

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
    console.log(userRes);
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
      await existingAccount.save();
      return res.redirect('http://localhost:5173/dashboard');
    }

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

  } catch (err) {
    console.error("Error in microsoftCallback:", err.message || err);
    res.status(500).send("Microsoft authentication failed");
  }
};

export const syncMicrosoft = async (req, res) => {
  try {
    const userId = '68668b8db45ebe41d4b854b4'; // ideally from req.user._id
    const userEmail = 'tanaythatte17@gmail.com'; // adjust this as needed

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

      const tokens = await refreshCalendarAccessToken({
        accountId: account._id,
        provider: 'microsoft',
        refreshToken: account.refreshToken,
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      });

      account.accessToken = tokens.accessToken; // keep local variable updated
    }

    const headers = { Authorization: `Bearer ${account.accessToken}` };
    const deltaUrl = account.deltaLink || 'https://graph.microsoft.com/v1.0/me/events';

    const response = await axios.get(deltaUrl, { headers });
    const events = response.data.value;

    // store the new delta link
    const newDeltaLink = response.data['@odata.deltaLink'] || account.deltaLink;
    account.deltaLink = newDeltaLink;
    account.lastSyncedAt = new Date();
    await account.save();

    for (const e of events) {
      if (e["@removed"]) {
        // event was deleted
        await Event.deleteOne({
          calendarAccountId: account._id,
          externalId: e.id,
          source: 'microsoft',
        });
        continue;
      }

      // otherwise create or update
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
            dateTime: e.start?.dateTime,
            timeZone: e.start?.timeZone,
          },
          end: {
            dateTime: e.end?.dateTime,
            timeZone: e.end?.timeZone,
          },
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
          status: e.showAs || 'busy',
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
        { userId: Id, provider: 'microsoft' },
        { $unset: { deltaLink: "" } }
      );
      return res.status(410).send("Delta link expired, please reconnect.");
    }
    console.error("Microsoft sync failed:", err.message || err);
    res.status(500).send("Microsoft sync failed.");
  }
};
