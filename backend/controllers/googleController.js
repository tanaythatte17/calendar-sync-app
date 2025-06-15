import axios from 'axios';
import qs from 'qs';
import { google } from 'googleapis';
import CalendarAccount from '../models/CalendarAccount.js';
import { getValidAccessToken } from '../utils/tokenRefresh.js';
import { handleGoogleError, handleTokenRefreshError } from '../utils/errorHandler.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const googleController = {
  redirectToGoogle: (req, res) => {
    const params = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES.join(' '),
      state: req.user._id
    };
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify(params)}`;
    res.redirect(authUrl);
  },

  handleGoogleCallback: async (req, res) => {
    const code = req.query.code;

    try {
      // Exchange code for tokens
      const tokenRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        qs.stringify({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code'
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const tokens = tokenRes.data;

      // Get user info
      const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      // Find or create calendar account
      const calendarAccount = await CalendarAccount.findOneAndUpdate(
        {
          user: req.user._id,
          provider: 'google',
          email: userRes.data.email
        },
        {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          isConnected: true,
          connectedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Get initial events
      const eventsRes = await axios.get(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          params: {
            singleEvents: true,
            orderBy: 'startTime',
            timeMin: new Date().toISOString()
          }
        }
      );

      // Store sync token for future syncs
      if (eventsRes.data.nextSyncToken) {
        calendarAccount.syncToken = eventsRes.data.nextSyncToken;
        await calendarAccount.save();
      }

      res.json({
        message: 'Google calendar connected successfully',
        calendarAccount,
        events: eventsRes.data.items
      });
    } catch (error) {
      const { status, message } = handleGoogleError(error);
      res.status(status).json({ error: message });
    }
  },

  syncGoogleEvents: async (req, res) => {
    try {
      const calendarAccount = await CalendarAccount.findOne({
        user: req.user._id,
        provider: 'google',
        isConnected: true
      });

      if (!calendarAccount) {
        return res.status(404).json({ message: 'No connected Google calendar found' });
      }

      // Get valid access token (refreshes if needed)
      const accessToken = await getValidAccessToken(calendarAccount);

      // Use sync token if available, otherwise get all events
      const params = calendarAccount.syncToken
        ? { syncToken: calendarAccount.syncToken }
        : {
            singleEvents: true,
            orderBy: 'startTime',
            timeMin: new Date().toISOString()
          };

      const eventsRes = await axios.get(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params
        }
      );

      // Update sync token for future syncs
      if (eventsRes.data.nextSyncToken) {
        calendarAccount.syncToken = eventsRes.data.nextSyncToken;
        await calendarAccount.save();
      }

      res.json({
        message: 'Events synced successfully',
        events: eventsRes.data.items
      });
    } catch (error) {
      if (error.message === 'Failed to refresh Google token') {
        const { status, message } = handleTokenRefreshError(error, 'Google');
        return res.status(status).json({ error: message });
      }
      const { status, message } = handleGoogleError(error);
      res.status(status).json({ error: message });
    }
  },

  createGoogleEvent: async (req, res) => {
    try {
      const { summary, description, startDateTime, endDateTime } = req.body;

      if (!summary || !startDateTime || !endDateTime) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const calendarAccount = await CalendarAccount.findOne({
        user: req.user._id,
        provider: 'google',
        isConnected: true
      });

      if (!calendarAccount) {
        return res.status(404).json({ message: 'No connected Google calendar found' });
      }

      // Get valid access token (refreshes if needed)
      const accessToken = await getValidAccessToken(calendarAccount);

      const event = {
        summary,
        description,
        start: {
          dateTime: startDateTime,
          timeZone: 'UTC'
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'UTC'
        }
      };

      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        event,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      res.status(200).json({
        message: 'Event created successfully',
        eventId: response.data.id,
        htmlLink: response.data.htmlLink
      });
    } catch (error) {
      if (error.message === 'Failed to refresh Google token') {
        const { status, message } = handleTokenRefreshError(error, 'Google');
        return res.status(status).json({ error: message });
      }
      const { status, message } = handleGoogleError(error);
      res.status(status).json({ error: message });
    }
  },

  disconnectGoogle: async (req, res) => {
    try {
      const calendarAccount = await CalendarAccount.findOne({
        user: req.user._id,
        provider: 'google'
      });

      if (!calendarAccount) {
        return res.status(404).json({ message: 'No connected Google calendar found' });
      }

      calendarAccount.isConnected = false;
      calendarAccount.accessToken = null;
      calendarAccount.refreshToken = null;
      calendarAccount.tokenExpiry = null;
      calendarAccount.syncToken = null;
      await calendarAccount.save();

      res.json({ message: 'Google calendar disconnected successfully' });
    } catch (error) {
      const { status, message } = handleGoogleError(error);
      res.status(status).json({ error: message });
    }
  }
};

export default googleController;