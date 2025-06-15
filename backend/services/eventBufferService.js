import Event from '../models/eventModel.js';
import CalendarAccount from '../models/CalendarAccount.js';
import { getValidAccessToken } from '../utils/tokenRefresh.js';
import { handleGoogleError, handleMicrosoftError } from '../utils/errorHandler.js';
import axios from 'axios';

const eventBufferService = {
  constructor() {
    // View buffer - how far back/forward we store events for viewing
    this.VIEW_BUFFER_DAYS = 365; // 1 year for viewing
    
    // Sync window - how far back/forward we sync events
    this.SYNC_WINDOW_DAYS = 90; // 3 months for syncing
    
    this.SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
    this.lastSync = new Map(); // Track last sync time per user
  },

  async getEvents(userId, startDate, endDate, provider = null) {
    // First, try to get events from cache
    const cachedEvents = await Event.getEventsInRange(userId, startDate, endDate, provider);
    
    // Check if we need to sync
    const now = Date.now();
    const lastSyncTime = this.lastSync.get(userId) || 0;
    
    if (now - lastSyncTime > this.SYNC_INTERVAL) {
      // Trigger background sync
      this.syncEvents(userId, provider).catch(console.error);
    }
    
    return cachedEvents;
  },

  async syncEvents(userId, provider = null) {
    try {
      const calendarAccounts = await CalendarAccount.find({
        user: userId,
        isConnected: true,
        ...(provider ? { provider } : {})
      });

      for (const account of calendarAccounts) {
        const accessToken = await getValidAccessToken(account);
        if (!accessToken) continue;

        // Sync events within the sync window
        const events = await this.fetchEventsFromProvider(account, accessToken, true);
        if (events) {
          await Event.bulkUpsert(events, userId, account.provider, account._id);
        }
      }

      this.lastSync.set(userId, Date.now());
    } catch (error) {
      console.error('Error syncing events:', error);
      throw error;
    }
  },

  async fetchEventsFromProvider(account, accessToken, isSyncWindow = false) {
    const now = new Date();
    let startDate, endDate;

    if (isSyncWindow) {
      // Use sync window for regular syncing
      startDate = new Date(now.getTime() - this.SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      endDate = new Date(now.getTime() + this.SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    } else {
      // Use view buffer for initial load or manual sync
      startDate = new Date(now.getTime() - this.VIEW_BUFFER_DAYS * 24 * 60 * 60 * 1000);
      endDate = new Date(now.getTime() + this.VIEW_BUFFER_DAYS * 24 * 60 * 60 * 1000);
    }

    try {
      if (account.provider === 'google') {
        const response = await axios.get(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
          {
            params: {
              timeMin: startDate.toISOString(),
              timeMax: endDate.toISOString(),
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 2500 // Google's maximum
            },
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
        return response.data.items;
      } else if (account.provider === 'microsoft') {
        const response = await axios.get(
          'https://graph.microsoft.com/v1.0/me/calendarView',
          {
            params: {
              startDateTime: startDate.toISOString(),
              endDateTime: endDate.toISOString(),
              $top: 1000 // Microsoft's recommended batch size
            },
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
        return response.data.value;
      }
    } catch (error) {
      if (account.provider === 'google') {
        handleGoogleError(error);
      } else {
        handleMicrosoftError(error);
      }
      throw error;
    }
  },

  // Initial sync when connecting a new calendar
  async initialSync(account, accessToken) {
    try {
      const events = await this.fetchEventsFromProvider(account, accessToken, false);
      if (events) {
        await Event.bulkUpsert(events, account.user, account.provider, account._id);
      }
    } catch (error) {
      console.error('Error during initial sync:', error);
      throw error;
    }
  },

  // Manual sync for a specific date range
  async manualSync(userId, startDate, endDate, provider = null) {
    try {
      const calendarAccounts = await CalendarAccount.find({
        user: userId,
        isConnected: true,
        ...(provider ? { provider } : {})
      });

      for (const account of calendarAccounts) {
        const accessToken = await getValidAccessToken(account);
        if (!accessToken) continue;

        let events;
        if (account.provider === 'google') {
          const response = await axios.get(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
            {
              params: {
                timeMin: startDate.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 2500
              },
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
          events = response.data.items;
        } else if (account.provider === 'microsoft') {
          const response = await axios.get(
            'https://graph.microsoft.com/v1.0/me/calendarView',
            {
              params: {
                startDateTime: startDate.toISOString(),
                endDateTime: endDate.toISOString(),
                $top: 1000
              },
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
          events = response.data.value;
        }

        if (events) {
          await Event.bulkUpsert(events, userId, account.provider, account._id);
        }
      }
    } catch (error) {
      console.error('Error during manual sync:', error);
      throw error;
    }
  },

  async cleanupOldEvents(userId) {
    const cutoffDate = new Date(Date.now() - (this.VIEW_BUFFER_DAYS * 2 * 24 * 60 * 60 * 1000));
    await Event.cleanupOldEvents(userId, cutoffDate);
  }
};

export default eventBufferService; 