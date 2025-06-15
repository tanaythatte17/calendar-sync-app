import CalendarAccount from '../models/CalendarAccount.js';
import { getValidAccessToken } from '../utils/tokenRefresh.js';
import { handleGoogleError, handleMicrosoftError } from '../utils/errorHandler.js';
import axios from 'axios';

class CrossCalendarSyncService {
  constructor() {
    this.SYNC_WINDOW_DAYS = 90; // 3 months for syncing
  }

  // Convert Google event format to Microsoft format
  convertGoogleToMicrosoft(googleEvent) {
    return {
      subject: googleEvent.summary,
      body: {
        contentType: 'text',
        content: googleEvent.description || ''
      },
      start: {
        dateTime: googleEvent.start.dateTime,
        timeZone: googleEvent.start.timeZone
      },
      end: {
        dateTime: googleEvent.end.dateTime,
        timeZone: googleEvent.end.timeZone
      },
      location: googleEvent.location ? {
        displayName: googleEvent.location
      } : undefined,
      isAllDay: googleEvent.start.date ? true : false,
      sensitivity: googleEvent.visibility === 'private' ? 'private' : 'normal',
      showAs: this.getShowAsFromGoogleStatus(googleEvent.status)
    };
  }

  // Convert Microsoft event format to Google format
  convertMicrosoftToGoogle(microsoftEvent) {
    return {
      summary: microsoftEvent.subject,
      description: microsoftEvent.body?.content || '',
      start: {
        dateTime: microsoftEvent.start.dateTime,
        timeZone: microsoftEvent.start.timeZone
      },
      end: {
        dateTime: microsoftEvent.end.dateTime,
        timeZone: microsoftEvent.end.timeZone
      },
      location: microsoftEvent.location?.displayName,
      status: this.getGoogleStatusFromShowAs(microsoftEvent.showAs),
      visibility: microsoftEvent.sensitivity === 'private' ? 'private' : 'default'
    };
  }

  // Helper to convert Google event status to Microsoft showAs
  getShowAsFromGoogleStatus(status) {
    const statusMap = {
      'confirmed': 'busy',
      'tentative': 'tentative',
      'cancelled': 'free'
    };
    return statusMap[status] || 'busy';
  }

  // Helper to convert Microsoft showAs to Google status
  getGoogleStatusFromShowAs(showAs) {
    const showAsMap = {
      'busy': 'confirmed',
      'tentative': 'tentative',
      'free': 'cancelled'
    };
    return showAsMap[showAs] || 'confirmed';
  }

  // Sync events from source calendar to target calendar
  async syncEventsBetweenCalendars(userId, sourceProvider, targetProvider) {
    try {
      // Get both calendar accounts
      const [sourceAccount, targetAccount] = await Promise.all([
        CalendarAccount.findOne({ user: userId, provider: sourceProvider, isConnected: true }),
        CalendarAccount.findOne({ user: userId, provider: targetProvider, isConnected: true })
      ]);

      if (!sourceAccount || !targetAccount) {
        throw new Error('Both calendar accounts must be connected');
      }

      // Get access tokens
      const [sourceToken, targetToken] = await Promise.all([
        getValidAccessToken(sourceAccount),
        getValidAccessToken(targetAccount)
      ]);

      if (!sourceToken || !targetToken) {
        throw new Error('Failed to get valid access tokens');
      }

      // Get events from source calendar
      const sourceEvents = await this.fetchEvents(sourceAccount, sourceToken);
      if (!sourceEvents || sourceEvents.length === 0) {
        return { synced: 0, skipped: 0 };
      }

      let synced = 0;
      let skipped = 0;

      // Process each event
      for (const sourceEvent of sourceEvents) {
        try {
          // Check if event already exists in target calendar
          const existingEvent = await this.findExistingEvent(targetAccount, targetToken, sourceEvent);
          
          if (existingEvent) {
            // Update existing event
            await this.updateEventInTargetCalendar(
              targetAccount,
              targetToken,
              existingEvent.id,
              sourceEvent
            );
          } else {
            // Create new event
            await this.createEventInTargetCalendar(
              targetAccount,
              targetToken,
              sourceEvent
            );
          }
          synced++;
        } catch (error) {
          console.error(`Error syncing event ${sourceEvent.id}:`, error);
          skipped++;
        }
      }

      return { synced, skipped };
    } catch (error) {
      console.error('Error in cross-calendar sync:', error);
      throw error;
    }
  }

  // Fetch events from a calendar
  async fetchEvents(account, accessToken) {
    const now = new Date();
    const startDate = new Date(now.getTime() - this.SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + this.SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

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
              maxResults: 2500
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
              $top: 1000
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
  }

  // Find if an event already exists in the target calendar
  async findExistingEvent(targetAccount, targetToken, sourceEvent) {
    try {
      if (targetAccount.provider === 'google') {
        const response = await axios.get(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
          {
            params: {
              q: sourceEvent.summary || sourceEvent.subject,
              timeMin: sourceEvent.start.dateTime,
              timeMax: sourceEvent.end.dateTime,
              singleEvents: true
            },
            headers: {
              Authorization: `Bearer ${targetToken}`
            }
          }
        );
        return response.data.items[0];
      } else if (targetAccount.provider === 'microsoft') {
        const response = await axios.get(
          'https://graph.microsoft.com/v1.0/me/events',
          {
            params: {
              $filter: `subject eq '${sourceEvent.subject || sourceEvent.summary}' and start/dateTime eq '${sourceEvent.start.dateTime}'`
            },
            headers: {
              Authorization: `Bearer ${targetToken}`
            }
          }
        );
        return response.data.value[0];
      }
    } catch (error) {
      console.error('Error finding existing event:', error);
      return null;
    }
  }

  // Create event in target calendar
  async createEventInTargetCalendar(targetAccount, targetToken, sourceEvent) {
    const eventData = targetAccount.provider === 'google' 
      ? this.convertMicrosoftToGoogle(sourceEvent)
      : this.convertGoogleToMicrosoft(sourceEvent);

    try {
      if (targetAccount.provider === 'google') {
        await axios.post(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          eventData,
          {
            headers: {
              Authorization: `Bearer ${targetToken}`
            }
          }
        );
      } else if (targetAccount.provider === 'microsoft') {
        await axios.post(
          'https://graph.microsoft.com/v1.0/me/events',
          eventData,
          {
            headers: {
              Authorization: `Bearer ${targetToken}`
            }
          }
        );
      }
    } catch (error) {
      if (targetAccount.provider === 'google') {
        handleGoogleError(error);
      } else {
        handleMicrosoftError(error);
      }
      throw error;
    }
  }

  // Update event in target calendar
  async updateEventInTargetCalendar(targetAccount, targetToken, eventId, sourceEvent) {
    const eventData = targetAccount.provider === 'google' 
      ? this.convertMicrosoftToGoogle(sourceEvent)
      : this.convertGoogleToMicrosoft(sourceEvent);

    try {
      if (targetAccount.provider === 'google') {
        await axios.put(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          eventData,
          {
            headers: {
              Authorization: `Bearer ${targetToken}`
            }
          }
        );
      } else if (targetAccount.provider === 'microsoft') {
        await axios.patch(
          `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
          eventData,
          {
            headers: {
              Authorization: `Bearer ${targetToken}`
            }
          }
        );
      }
    } catch (error) {
      if (targetAccount.provider === 'google') {
        handleGoogleError(error);
      } else {
        handleMicrosoftError(error);
      }
      throw error;
    }
  }
}

export default new CrossCalendarSyncService(); 