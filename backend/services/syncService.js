import { google } from 'googleapis';
import axios from 'axios';
import CalendarAccount from '../models/CalendarAccount.js';
import Event from '../models/eventModel.js';
import { getValidAccessToken } from '../utils/tokenRefresh.js';
import { handleGoogleError, handleMicrosoftError } from '../utils/errorHandler.js';

class SyncService {
  constructor() {
    this.googleCalendar = google.calendar('v3');
  }

  async syncGoogleEvents(accountId) {
    try {
      const account = await CalendarAccount.findById(accountId);
      if (!account || account.provider !== 'google') {
        throw new Error('Invalid Google calendar account');
      }

      const accessToken = await getValidAccessToken(account);
      const calendar = this.googleCalendar;

      // Set up the calendar client with the access token
      calendar.context._options = {
        auth: new google.auth.OAuth2().setCredentials({
          access_token: accessToken
        })
      };

      // Get events using sync token if available
      const params = {
        calendarId: 'primary',
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100
      };

      if (account.syncToken) {
        params.syncToken = account.syncToken;
      } else {
        // If no sync token, get events from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        params.timeMin = thirtyDaysAgo.toISOString();
      }

      const response = await calendar.events.list(params);
      const events = response.data.items;

      // Process events
      for (const event of events) {
        if (event.status === 'cancelled') {
          // Delete the event if it was cancelled
          await Event.findOneAndDelete({ externalId: event.id, calendarAccountId: accountId });
        } else {
          // Update or create the event
          await Event.findOneAndUpdate(
            { externalId: event.id, calendarAccountId: accountId },
            {
              title: event.summary,
              description: event.description,
              start: event.start.dateTime || event.start.date,
              end: event.end.dateTime || event.end.date,
              location: event.location,
              externalId: event.id,
              calendarAccountId: accountId,
              provider: 'google',
              lastSynced: new Date()
            },
            { upsert: true, new: true }
          );
        }
      }

      // Update sync token
      if (response.data.nextSyncToken) {
        account.syncToken = response.data.nextSyncToken;
        await account.save();
      }

      return { success: true, eventsProcessed: events.length };
    } catch (error) {
      if (error.code === 410) {
        // Sync token expired, clear it and retry
        await CalendarAccount.findByIdAndUpdate(accountId, { syncToken: null });
        return this.syncGoogleEvents(accountId);
      }
      throw handleGoogleError(error);
    }
  }

  async syncMicrosoftEvents(accountId) {
    try {
      const account = await CalendarAccount.findById(accountId);
      if (!account || account.provider !== 'microsoft') {
        throw new Error('Invalid Microsoft calendar account');
      }

      const accessToken = await getValidAccessToken(account);
      const baseUrl = 'https://graph.microsoft.com/v1.0';
      const deltaLink = account.deltaLink;

      let url;
      if (deltaLink) {
        // Use delta link for incremental sync
        url = deltaLink;
      } else {
        // Initial sync - get events from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        url = `${baseUrl}/me/calendarView/delta?startDateTime=${thirtyDaysAgo.toISOString()}&endDateTime=${new Date().toISOString()}`;
      }

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'outlook.timezone="UTC"'
        }
      });

      const events = response.data.value;

      // Process events
      for (const event of events) {
        if (event['@removed']) {
          // Delete the event if it was removed
          await Event.findOneAndDelete({ externalId: event.id, calendarAccountId: accountId });
        } else {
          // Update or create the event
          await Event.findOneAndUpdate(
            { externalId: event.id, calendarAccountId: accountId },
            {
              title: event.subject,
              description: event.bodyPreview,
              start: event.start.dateTime,
              end: event.end.dateTime,
              location: event.location?.displayName,
              externalId: event.id,
              calendarAccountId: accountId,
              provider: 'microsoft',
              lastSynced: new Date()
            },
            { upsert: true, new: true }
          );
        }
      }

      // Update delta link
      if (response.data['@odata.deltaLink']) {
        account.deltaLink = response.data['@odata.deltaLink'];
        await account.save();
      }

      return { success: true, eventsProcessed: events.length };
    } catch (error) {
      throw handleMicrosoftError(error);
    }
  }

  async syncAllAccounts(userId) {
    try {
      const accounts = await CalendarAccount.find({ userId });
      const results = [];

      for (const account of accounts) {
        try {
          if (account.provider === 'google') {
            const result = await this.syncGoogleEvents(account._id);
            results.push({ accountId: account._id, provider: 'google', ...result });
          } else if (account.provider === 'microsoft') {
            const result = await this.syncMicrosoftEvents(account._id);
            results.push({ accountId: account._id, provider: 'microsoft', ...result });
          }
        } catch (error) {
          results.push({
            accountId: account._id,
            provider: account.provider,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to sync accounts: ${error.message}`);
    }
  }
}

export default new SyncService(); 