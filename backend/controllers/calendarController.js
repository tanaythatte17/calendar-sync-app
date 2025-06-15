import CalendarAccount from '../models/CalendarAccount.js';
import eventBufferService from '../services/eventBufferService.js';
import crossCalendarSyncService from '../services/crossCalendarSyncService.js';
import { handleGoogleError, handleMicrosoftError } from '../utils/errorHandler.js';
import { getValidAccessToken } from '../utils/tokenRefresh.js';
import axios from 'axios';
import syncService from '../services/syncService.js';

// Get events for a specific date range
const getEvents = async (req, res) => {
  try {
    const { startDate, endDate, provider } = req.query;
    const userId = req.user.id;

    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
    }

    const events = await eventBufferService.getEvents(
      userId,
      new Date(startDate),
      new Date(endDate),
      provider
    );

    res.json({
      status: 'success',
      data: events
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch events'
    });
  }
};

// Create a new event
const createEvent = async (req, res) => {
  try {
    const { provider, event } = req.body;
    const userId = req.user.id;

    const calendarAccount = await CalendarAccount.findOne({
      user: userId,
      provider,
      isConnected: true
    });

    if (!calendarAccount) {
      return res.status(404).json({
        status: 'error',
        message: 'No connected calendar account found'
      });
    }

    const accessToken = await getValidAccessToken(calendarAccount);
    if (!accessToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Failed to get valid access token'
      });
    }

    let createdEvent;
    if (provider === 'google') {
      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      createdEvent = response.data;
    } else if (provider === 'microsoft') {
      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/me/events',
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      createdEvent = response.data;
    }

    // Update cache
    await CachedEvent.bulkUpsert([createdEvent], userId, provider, calendarAccount._id);

    res.status(201).json({
      status: 'success',
      data: createdEvent
    });
  } catch (error) {
    console.error('Error creating event:', error);
    if (req.body.provider === 'google') {
      handleGoogleError(error);
    } else {
      handleMicrosoftError(error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to create event'
    });
  }
};

// Update an existing event
const updateEvent = async (req, res) => {
  try {
    const { provider, eventId } = req.params;
    const { event } = req.body;
    const userId = req.user.id;

    const calendarAccount = await CalendarAccount.findOne({
      user: userId,
      provider,
      isConnected: true
    });

    if (!calendarAccount) {
      return res.status(404).json({
        status: 'error',
        message: 'No connected calendar account found'
      });
    }

    const accessToken = await getValidAccessToken(calendarAccount);
    if (!accessToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Failed to get valid access token'
      });
    }

    let updatedEvent;
    if (provider === 'google') {
      const response = await axios.put(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      updatedEvent = response.data;
    } else if (provider === 'microsoft') {
      const response = await axios.patch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      updatedEvent = response.data;
    }

    // Update cache
    await CachedEvent.bulkUpsert([updatedEvent], userId, provider, calendarAccount._id);

    res.json({
      status: 'success',
      data: updatedEvent
    });
  } catch (error) {
    console.error('Error updating event:', error);
    if (req.params.provider === 'google') {
      handleGoogleError(error);
    } else {
      handleMicrosoftError(error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to update event'
    });
  }
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const { provider, eventId } = req.params;
    const userId = req.user.id;

    const calendarAccount = await CalendarAccount.findOne({
      user: userId,
      provider,
      isConnected: true
    });

    if (!calendarAccount) {
      return res.status(404).json({
        status: 'error',
        message: 'No connected calendar account found'
      });
    }

    const accessToken = await getValidAccessToken(calendarAccount);
    if (!accessToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Failed to get valid access token'
      });
    }

    if (provider === 'google') {
      await axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
    } else if (provider === 'microsoft') {
      await axios.delete(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
    }

    // Update cache
    await CachedEvent.markDeleted(userId, provider, [eventId]);

    res.json({
      status: 'success',
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    if (req.params.provider === 'google') {
      handleGoogleError(error);
    } else {
      handleMicrosoftError(error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete event'
    });
  }
};

// Force sync events within the sync window (3 months)
const syncEvents = async (req, res) => {
  try {
    const { provider } = req.query;
    const userId = req.user.id;

    await eventBufferService.syncEvents(userId, provider);

    res.json({
      status: 'success',
      message: 'Events synchronized successfully'
    });
  } catch (error) {
    console.error('Error syncing events:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync events'
    });
  }
};

// Manual sync for a specific date range
const manualSync = async (req, res) => {
  try {
    const { startDate, endDate, provider } = req.query;
    const userId = req.user.id;

    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
    }

    await eventBufferService.manualSync(
      userId,
      new Date(startDate),
      new Date(endDate),
      provider
    );

    res.json({
      status: 'success',
      message: 'Events synchronized successfully for the specified date range'
    });
  } catch (error) {
    console.error('Error during manual sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync events for the specified date range'
    });
  }
};

// Sync events between calendars
const syncBetweenCalendars = async (req, res) => {
  try {
    const { sourceProvider, targetProvider } = req.body;
    const userId = req.user.id;

    if (!sourceProvider || !targetProvider) {
      return res.status(400).json({
        status: 'error',
        message: 'Source and target providers are required'
      });
    }

    if (sourceProvider === targetProvider) {
      return res.status(400).json({
        status: 'error',
        message: 'Source and target providers must be different'
      });
    }

    const result = await crossCalendarSyncService.syncEventsBetweenCalendars(
      userId,
      sourceProvider,
      targetProvider
    );

    res.json({
      status: 'success',
      message: `Successfully synced ${result.synced} events (${result.skipped} skipped)`,
      data: result
    });
  } catch (error) {
    console.error('Error syncing between calendars:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync between calendars'
    });
  }
};

// Get all calendar accounts for a user
const getCalendarAccounts = async (req, res) => {
  try {
    const accounts = await CalendarAccount.find({ user: req.user.id });
    res.json({
      status: 'success',
      data: accounts
    });
  } catch (error) {
    console.error('Error getting calendar accounts:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch calendar accounts'
    });
  }
};

// Sync a specific calendar account
const syncCalendarAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await CalendarAccount.findOne({
      _id: accountId,
      user: req.user.id
    });

    if (!account) {
      return res.status(404).json({
        status: 'error',
        message: 'Calendar account not found'
      });
    }

    let result;
    if (account.provider === 'google') {
      result = await syncService.syncGoogleEvents(accountId);
    } else if (account.provider === 'microsoft') {
      result = await syncService.syncMicrosoftEvents(accountId);
    }

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Error syncing calendar account:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync calendar account'
    });
  }
};

// Sync all calendar accounts
const syncAllCalendars = async (req, res) => {
  try {
    const results = await syncService.syncAllAccounts(req.user.id);
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    console.error('Error syncing all calendars:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync calendars'
    });
  }
};

// Disconnect a calendar account
const disconnectCalendar = async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await CalendarAccount.findOne({
      _id: accountId,
      user: req.user.id
    });

    if (!account) {
      return res.status(404).json({
        status: 'error',
        message: 'Calendar account not found'
      });
    }

    account.isConnected = false;
    account.accessToken = null;
    account.refreshToken = null;
    account.tokenExpiry = null;
    account.syncToken = null;
    account.deltaLink = null;
    await account.save();

    res.json({
      status: 'success',
      message: 'Calendar disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to disconnect calendar'
    });
  }
};

// Get sync status for all accounts
const getSyncStatus = async (req, res) => {
  try {
    const accounts = await CalendarAccount.find({ user: req.user.id });
    const status = await Promise.all(
      accounts.map(async (account) => {
        const lastSync = account.lastSynced || null;
        const isConnected = account.isConnected;
        const provider = account.provider;
        return {
          accountId: account._id,
          provider,
          isConnected,
          lastSync
        };
      })
    );
    res.json({
      status: 'success',
      data: status
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sync status'
    });
  }
};

const calendarController = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
  manualSync,
  syncBetweenCalendars,
  getCalendarAccounts,
  syncCalendarAccount,
  syncAllCalendars,
  disconnectCalendar,
  getSyncStatus
};

export default calendarController; 