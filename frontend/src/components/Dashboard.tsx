import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../contexts/AuthContext';
import CalendarComponent from './Calendar';
import CalendarAccounts from './CalendarAccounts';
import EventCreationModal from './EventCreationModal';
import EventDetailModal from './EventDetailModal';

const API_URL = import.meta.env.VITE_API_URL;

interface CalendarListItem {
  calendarId: string;
  name: string;
  color?: string;
}

interface CalendarAccount {
  id: string;
  _id?: string;
  provider: 'google' | 'microsoft';
  email: string;
  isConnected: boolean;
  calendarList?: CalendarListItem[];
}

interface Event {
  _id: string;
  calendarAccountId: string;
  source: 'google' | 'microsoft';
  externalId: string;
  title: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
    ianaTimeZone?: string;
    isAllDay?: boolean;
  };
  end: {
    dateTime: string;
    timeZone: string;
    ianaTimeZone?: string;
    isAllDay?: boolean;
  };
  organizer?: {
    email: string;
    name: string;
  };
  attendees?: Array<{
    email: string;
    name: string;
    responseStatus: string;
  }>;
  isRecurring: boolean;
  recurringEventId?: string;
  status: 'confirmed' | 'cancelled' | 'tentative';
  htmlLink?: string;
  updatedAt: string;
  isAllDay?: boolean;
  calendarId?: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

// Replace the timezone dropdown with a simple list of UTC offsets
const userTimeZones = [
  { label: 'UTC-12:00', value: 'Etc/GMT+12' },
  { label: 'UTC-11:00', value: 'Etc/GMT+11' },
  { label: 'UTC-10:00', value: 'Etc/GMT+10' },
  { label: 'UTC-09:00', value: 'Etc/GMT+9' },
  { label: 'UTC-08:00', value: 'Etc/GMT+8' },
  { label: 'UTC-07:00', value: 'Etc/GMT+7' },
  { label: 'UTC-06:00', value: 'Etc/GMT+6' },
  { label: 'UTC-05:00', value: 'Etc/GMT+5' },
  { label: 'UTC-04:00', value: 'Etc/GMT+4' },
  { label: 'UTC-03:00', value: 'Etc/GMT+3' },
  { label: 'UTC-02:00', value: 'Etc/GMT+2' },
  { label: 'UTC-01:00', value: 'Etc/GMT+1' },
  { label: 'UTC', value: 'Etc/UTC' },
  { label: 'UTC+01:00', value: 'Etc/GMT-1' },
  { label: 'UTC+02:00', value: 'Etc/GMT-2' },
  { label: 'UTC+03:00', value: 'Etc/GMT-3' },
  { label: 'UTC+03:30', value: 'Asia/Tehran' },
  { label: 'UTC+04:00', value: 'Etc/GMT-4' },
  { label: 'UTC+04:30', value: 'Asia/Kabul' },
  { label: 'UTC+05:00', value: 'Etc/GMT-5' },
  { label: 'UTC+05:30', value: 'Asia/Kolkata' },
  { label: 'UTC+05:45', value: 'Asia/Kathmandu' },
  { label: 'UTC+06:00', value: 'Etc/GMT-6' },
  { label: 'UTC+06:30', value: 'Asia/Yangon' },
  { label: 'UTC+07:00', value: 'Etc/GMT-7' },
  { label: 'UTC+08:00', value: 'Etc/GMT-8' },
  { label: 'UTC+09:00', value: 'Etc/GMT-9' },
  { label: 'UTC+09:30', value: 'Australia/Adelaide' },
  { label: 'UTC+10:00', value: 'Etc/GMT-10' },
  { label: 'UTC+11:00', value: 'Etc/GMT-11' },
  { label: 'UTC+12:00', value: 'Etc/GMT-12' },
];

const Dashboard: React.FC = () => {
  const { user, updateUserTimezone } = useAuth();
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedCalendars, setSelectedCalendars] = useState<{ [calendarId: string]: boolean }>({});
  const [selectedUserTimeZone, setSelectedUserTimeZone] = useState(user?.timezone || 'UTC');
  const [tzSaveStatus, setTzSaveStatus] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Lazy loading state
  const [loadedRanges, setLoadedRanges] = useState<DateRange[]>([]);
  const [eventLoadingCache, setEventLoadingCache] = useState<Set<string>>(new Set());

  useEffect(() => {
    const found = userTimeZones.find(tz => tz.value === user?.timezone);
    setSelectedUserTimeZone(found ? found.value : 'UTC');
  }, [user?.timezone]);

  const handleTimezoneSave = async () => {
    const success = await updateUserTimezone(selectedUserTimeZone);
    setTzSaveStatus(success ? 'Saved!' : 'Failed to save');
    setTimeout(() => setTzSaveStatus(null), 2000);
  };

  // Function to check if a date range overlaps with already loaded ranges
  const isRangeLoaded = useCallback((startDate: Date, endDate: Date): boolean => {
    return loadedRanges.some(range => 
      startDate >= range.start && endDate <= range.end
    );
  }, [loadedRanges]);

  // Function to generate a cache key for the date range
  const getRangeKey = (startDate: Date, endDate: Date): string => {
    return `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
  };

  // Enhanced function to load events for a specific date range
  const loadEventsForRange = useCallback(async (startDate: Date, endDate: Date): Promise<Event[]> => {
    const rangeKey = getRangeKey(startDate, endDate);
    
    // Check if we're already loading this range
    if (eventLoadingCache.has(rangeKey)) {
      // Return empty array, but the loading will complete eventually
      return [];
    }

    // Check if range is already fully loaded
    if (isRangeLoaded(startDate, endDate)) {
      // Return existing events in this range
      return events.filter(event => {
        const eventDate = new Date(event.start.dateTime);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    try {
      setEventLoadingCache(prev => new Set([...prev, rangeKey]));
      
      const response = await api.get(`${API_URL}/user/events`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      const newEvents = response.data;
      
      // Update events state by merging with existing events
      setEvents(prevEvents => {
        // Create a map to avoid duplicates based on event._id
        const eventMap = new Map(prevEvents.map(event => [event._id, event]));
        
        // Add new events to the map
        newEvents.forEach((event: Event) => {
          eventMap.set(event._id, event);
        });
        
        return Array.from(eventMap.values());
      });

      // Update loaded ranges
      setLoadedRanges(prev => {
        // Find overlapping ranges to merge
        const newRange = { start: startDate, end: endDate };
        const nonOverlapping = prev.filter(range =>
          endDate < range.start || startDate > range.end
        );
        
        const overlapping = prev.filter(range =>
          !(endDate < range.start || startDate > range.end)
        );
        
        if (overlapping.length > 0) {
          // Merge all overlapping ranges with the new range
          const mergedStart = new Date(Math.min(
            startDate.getTime(),
            ...overlapping.map(r => r.start.getTime())
          ));
          const mergedEnd = new Date(Math.max(
            endDate.getTime(),
            ...overlapping.map(r => r.end.getTime())
          ));
          
          return [...nonOverlapping, { start: mergedStart, end: mergedEnd }];
        }
        
        return [...nonOverlapping, newRange];
      });

      return newEvents;
    } catch (err) {
      console.error('Error loading events for range:', err);
      setError('Failed to load events for the selected period');
      return [];
    } finally {
      setEventLoadingCache(prev => {
        const updated = new Set(prev);
        updated.delete(rangeKey);
        return updated;
      });
    }
  }, [isRangeLoaded, events]);

  // Initial data fetch with lazy loading
  const fetchData = async () => {
    setLoading(true);
    try {
      // Load accounts first
      const accountsRes = await api.get(`${API_URL}/user/accounts`);
      setAccounts(accountsRes.data);

      // Load initial events range (current month ±3 months)
      const now = new Date();
      const initialStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const initialEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0); // Last day of +3 month
      
      await loadEventsForRange(initialStart, initialEnd);
      
    } catch (err) {
      setError('Failed to load calendar data');
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const newSelected: { [calendarId: string]: boolean } = {};
    accounts.forEach(account => {
      account.calendarList?.forEach(cal => {
        newSelected[cal.calendarId] = true;
      });
    });
    setSelectedCalendars(newSelected);
  }, [accounts]);

  const handleConnectGoogle = async () => {
    try {
      const jwt = localStorage.getItem('token');
      if (!jwt) {
        setError('No authentication token found. Please log in again.');
        return;
      }
      window.location.href = `${API_URL}/google/auth?state=${encodeURIComponent(jwt)}`;
    } catch (err) {
      setError('Failed to connect Google Calendar');
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      const jwt = localStorage.getItem('token');
      if (!jwt) {
        setError('No authentication token found. Please log in again.');
        return;
      }
      window.location.href = `${API_URL}/microsoft/auth?state=${encodeURIComponent(jwt)}`;
    } catch (err) {
      setError('Failed to connect Microsoft Calendar');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this calendar account? This will remove all synced events from this account.')) {
      return;
    }
    
    setLoading(true);
    try {
      await api.delete(`${API_URL}/calendarAccount/delete/${accountId}`);
      setAccounts(accounts.filter(acc => acc.id !== accountId && acc._id !== accountId));
      setEvents(events.filter(event => event.calendarAccountId !== accountId));
      setOpenMenuId(null);
      alert('Calendar account deleted successfully');
    } catch (err) {
      setError('Failed to delete calendar account');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (provider: string, email: string) => {
    setLoading(true);
    setError('');
    try {
      const syncUrl = `${API_URL}/${provider}/sync/${provider}?email=${encodeURIComponent(email)}`;
      await api.get(syncUrl);
      setError('');
      alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} calendar synced!`);
      
      // Clear loaded ranges to force a refresh of events
      setLoadedRanges([]);
      setEvents([]);
      
      await fetchData();
    } catch (err) {
      setError(`Failed to sync ${provider} calendar`);
    } finally {
      setLoading(false);
    }
  };

  const handleCalendarToggle = (calendarId: string, checked: boolean) => {
    setSelectedCalendars(prev => ({
      ...prev,
      [calendarId]: checked
    }));
  };

  const handleCreateEvent = async (eventData: any) => {
    try {
      // For each selected account and calendar, create event
      let createdEvents: any[] = [];
      for (const accountId of Object.keys(selectedCalendars)) {
        if (selectedCalendars[accountId]) {
          const account = accounts.find(a =>
            a.id === accountId ||
            a._id === accountId ||
            `${a.provider}-${a.email}` === accountId
          );
          if (!account) continue;
          
          const payload = {
            ...eventData,
            calendarId: accountId,
            provider: account.provider,
          };
          const response = await api.post(`${API_URL}/calendar/events`, payload);
          createdEvents.push(response.data.event);
        }
      }
      
      if (createdEvents.length > 0) {
        setEvents(prevEvents => [...prevEvents, ...createdEvents]);
      }
    } catch (err) {
      setError('Failed to create event');
    }
  };

  const handleMenuToggle = (accountId: string) => {
    setOpenMenuId(openMenuId === accountId ? null : accountId);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // This is now only used for week/day view date clicks
    // Month view handles its own navigation
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-gray-700 text-base">Loading your calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
            <p className="text-red-600 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
            <button 
              onClick={() => setError('')}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Calendar Section with Timezone Selector */}
          <div className="xl:col-span-3">
            {/* Header with Create Event Button and Timezone Selector */}
            <div className="flex items-center justify-between mb-4">
              {/* Timezone Selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="user-timezone-select" className="text-sm font-medium text-gray-700">Timezone:</label>
                <select
                  id="user-timezone-select"
                  value={selectedUserTimeZone}
                  onChange={e => setSelectedUserTimeZone(e.target.value)}
                  className="bg-white text-gray-900 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
                >
                  {userTimeZones.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleTimezoneSave}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-semibold"
                >
                  Save
                </button>
                {tzSaveStatus && <span className="text-xs text-green-600">{tzSaveStatus}</span>}
              </div>
            </div>

            {/* Calendar Component with Lazy Loading */}
            <CalendarComponent
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
              events={events}
              selectedCalendars={selectedCalendars}
              selectedUserTimeZone={selectedUserTimeZone}
              onCreateEvent={() => setIsEventModalOpen(true)}
              onEventClick={(event) => {
                setSelectedEvent(event);
              }}
              accounts={accounts}
              onLoadEvents={loadEventsForRange}
              loading={loading}
            />
          </div>

          {/* Sidebar */}
          <div className="xl:col-span-1">
            <CalendarAccounts
              accounts={accounts}
              selectedCalendars={selectedCalendars}
              onCalendarToggle={handleCalendarToggle}
              onConnectGoogle={handleConnectGoogle}
              onConnectMicrosoft={handleConnectMicrosoft}
              onSync={handleSync}
              onDelete={handleDeleteAccount}
              openMenuId={openMenuId}
              onMenuToggle={handleMenuToggle}
            />
          </div>
        </div>
      </div>

      {/* Event Creation Modal */}
      <EventCreationModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        accounts={accounts}
        onCreateEvent={handleCreateEvent}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        accounts={accounts}
        selectedUserTimeZone={selectedUserTimeZone}
      />
    </div>
  );
};

export default Dashboard;