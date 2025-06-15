import axios from 'axios';
import qs from 'qs';
import CalendarAccount from '../models/CalendarAccount.js';
import { getValidAccessToken } from '../utils/tokenRefresh.js';
import { handleMicrosoftError, handleTokenRefreshError } from '../utils/errorHandler.js';

const SCOPES = ['Calendars.ReadWrite', 'offline_access'];

const microsoftController = {
  redirectToMicrosoft: (req, res) => {
    const params = {
      client_id: process.env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
      response_mode: 'query',
      scope: SCOPES.join(' '),
      state: req.user._id
    };
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${qs.stringify(params)}`;
    res.redirect(authUrl);
  },

  handleMicrosoftCallback: async (req, res) => {
    const code = req.query.code;

    try {
      // Exchange code for tokens
      const tokenRes = await axios.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        qs.stringify({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          scope: SCOPES.join(' '),
          code,
          redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
          grant_type: 'authorization_code',
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const tokens = tokenRes.data;

      // Get user info
      const userRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      // Find or create calendar account
      const calendarAccount = await CalendarAccount.findOneAndUpdate(
        {
          user: req.user._id,
          provider: 'microsoft',
          email: userRes.data.mail || userRes.data.userPrincipalName
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
      const eventsRes = await axios.get('https://graph.microsoft.com/v1.0/me/events/delta', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      // Store delta link for future syncs
      if (eventsRes.data['@odata.deltaLink']) {
        calendarAccount.syncToken = eventsRes.data['@odata.deltaLink'];
        await calendarAccount.save();
      }

      res.json({
        message: 'Microsoft calendar connected successfully',
        calendarAccount,
        events: eventsRes.data.value
      });
    } catch (error) {
      const { status, message } = handleMicrosoftError(error);
      res.status(status).json({ error: message });
    }
  },

  syncMicrosoftEvents: async (req, res) => {
    try {
      const calendarAccount = await CalendarAccount.findOne({
        user: req.user._id,
        provider: 'microsoft',
        isConnected: true
      });

      if (!calendarAccount) {
        return res.status(404).json({ message: 'No connected Microsoft calendar found' });
      }

      // Get valid access token (refreshes if needed)
      const accessToken = await getValidAccessToken(calendarAccount);

      // Use delta link if available, otherwise get all events
      const url = calendarAccount.syncToken || 'https://graph.microsoft.com/v1.0/me/events/delta';
      
      const eventsRes = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Update delta link for future syncs
      if (eventsRes.data['@odata.deltaLink']) {
        calendarAccount.syncToken = eventsRes.data['@odata.deltaLink'];
        await calendarAccount.save();
      }

      res.json({
        message: 'Events synced successfully',
        events: eventsRes.data.value
      });
    } catch (error) {
      if (error.message === 'Failed to refresh Microsoft token') {
        const { status, message } = handleTokenRefreshError(error, 'Microsoft');
        return res.status(status).json({ error: message });
      }
      const { status, message } = handleMicrosoftError(error);
      res.status(status).json({ error: message });
    }
  },

  createMicrosoftEvent: async (req, res) => {
    try {
      const { summary, description, startDateTime, endDateTime } = req.body;

      if (!summary || !startDateTime || !endDateTime) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const calendarAccount = await CalendarAccount.findOne({
        user: req.user._id,
        provider: 'microsoft',
        isConnected: true
      });

      if (!calendarAccount) {
        return res.status(404).json({ message: 'No connected Microsoft calendar found' });
      }

      // Get valid access token (refreshes if needed)
      const accessToken = await getValidAccessToken(calendarAccount);

      const event = {
        subject: summary,
        body: {
          contentType: 'text',
          content: description
        },
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
        'https://graph.microsoft.com/v1.0/me/events',
        event,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      res.status(200).json({
        message: 'Event created successfully',
        eventId: response.data.id,
        webLink: response.data.webLink
      });
    } catch (error) {
      if (error.message === 'Failed to refresh Microsoft token') {
        const { status, message } = handleTokenRefreshError(error, 'Microsoft');
        return res.status(status).json({ error: message });
      }
      const { status, message } = handleMicrosoftError(error);
      res.status(status).json({ error: message });
    }
  },

  disconnectMicrosoft: async (req, res) => {
    try {
      const calendarAccount = await CalendarAccount.findOne({
        user: req.user._id,
        provider: 'microsoft'
      });

      if (!calendarAccount) {
        return res.status(404).json({ message: 'No connected Microsoft calendar found' });
      }

      calendarAccount.isConnected = false;
      calendarAccount.accessToken = null;
      calendarAccount.refreshToken = null;
      calendarAccount.tokenExpiry = null;
      calendarAccount.syncToken = null;
      await calendarAccount.save();

      res.json({ message: 'Microsoft calendar disconnected successfully' });
    } catch (error) {
      const { status, message } = handleMicrosoftError(error);
      res.status(status).json({ error: message });
    }
  },
};

export default microsoftController;
