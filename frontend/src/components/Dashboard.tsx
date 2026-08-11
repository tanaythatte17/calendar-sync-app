import React, { useEffect, useState, useCallback, useRef} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../contexts/AuthContext';
import CalendarComponent from './Calendar';
import CalendarAccounts from './CalendarAccounts';
import EventCreationModal from './EventCreationModal';
import EventDetailModal from './EventDetailModal';
import { useSSE, SyncStatusPayload } from '../hooks/useSSE';

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
  syncStatus?: 'idle' | 'queued' | 'syncing' | 'error';
  calendarList?: CalendarListItem[];
}

interface SyncingAccountInfo {
  provider: string;
  email: string;
  status: 'queued' | 'syncing';
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
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);
  const [syncingAccounts, setSyncingAccounts] = useState<{ [accountId: string]: SyncingAccountInfo }>({});

  // Simplified lazy loading state - track loaded ranges with strings for easier comparison
  const loadedMinDateRef = useRef<Date | null>(null);
  const loadedMaxDateRef = useRef<Date | null>(null);
  const loadingRangesRef = useRef<Set<string>>(new Set());
  const loadedRangesRef = useRef<Set<string>>(new Set());
  const eventsRef = useRef<Event[]>([]);
  const isInitialLoadRef = useRef(false);
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const currentViewDateRef = useRef<Date>(currentViewDate);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    currentViewDateRef.current = currentViewDate;
  }, [currentViewDate]);

  // SSE hook for real-time updates
  useSSE({
    onEvent: (event) => {
      if (event.action === 'added' || event.action === 'updated') {
        setEvents(prevEvents => {
          const existingIndex = prevEvents.findIndex(e => e._id === event.data._id);
          if (existingIndex >= 0) {
            const updated = [...prevEvents];
            updated[existingIndex] = event.data;
            eventsRef.current = updated; // ✅ Update ref
            return updated;
          } else {
            const newEvents = [...prevEvents, event.data];
            eventsRef.current = newEvents; // ✅ Update ref
            return newEvents;
          }
        });
      } else if (event.action === 'deleted') {
        setEvents(prevEvents => {
          const filtered = prevEvents.filter(e => e._id !== event.data._id);
          eventsRef.current = filtered; // ✅ Update ref
          return filtered;
        });
      }
    },
    onCalendarListUpdate: (calendarData) => {
      setAccounts(prevAccounts =>
        prevAccounts.map(account => {
          if (account.provider === calendarData.provider && account.email === calendarData.email) {
            return { ...account, calendarList: calendarData.calendarList };
          }
          return account;
        })
      );
    },
    onSyncStatus: (payload: SyncStatusPayload) => {
      const accountId = payload.details?.accountId;

      if (payload.status === 'started') {
        if (accountId) {
          setSyncingAccounts(prev => ({
            ...prev,
            [accountId]: {
              provider: payload.details?.provider ?? '',
              email: payload.details?.email ?? '',
              status: 'syncing',
            },
          }));
        }
      } else if (payload.status === 'completed') {
        if (accountId) {
          activeSyncPollsRef.current.delete(accountId); // the polling fallback can stop, SSE beat it to it
          setSyncingAccounts(prev => {
            if (!(accountId in prev)) return prev;
            const next = { ...prev };
            delete next[accountId];
            return next;
          });
        }
        // `events` itself isn't cleared (only range-cache bookkeeping), so
        // other accounts' already-loaded events stay visible while this
        // reload runs.
        forceReloadEvents();
      } else if (payload.status === 'error') {
        if (accountId) {
          activeSyncPollsRef.current.delete(accountId);
          setSyncingAccounts(prev => {
            if (!(accountId in prev)) return prev;
            const next = { ...prev };
            delete next[accountId];
            return next;
          });
        }
        setError(payload.details?.error ? `Sync failed: ${payload.details.error}` : 'Calendar sync failed');
      }
    },
  });

  useEffect(() => {
    const found = userTimeZones.find(tz => tz.value === user?.timezone);
    setSelectedUserTimeZone(found ? found.value : 'UTC');
  }, [user?.timezone]);

  // Check for connection status in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const provider = urlParams.get('provider');
    const status = urlParams.get('status');
    
    if (provider && status === 'connected') {
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
      setConnectionSuccess(`${providerName} account connected successfully! Click "Sync" to import your events.`);
      
      // Clean up URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
      
      // Auto-dismiss after 10 seconds
      setTimeout(() => setConnectionSuccess(null), 10000);
    }
  }, []);

  const handleTimezoneSave = async () => {
    const success = await updateUserTimezone(selectedUserTimeZone);
    setTzSaveStatus(success ? 'Saved!' : 'Failed to save');
    setTimeout(() => setTzSaveStatus(null), 2000);
  };

  const createRangeKey = (startDate: Date, endDate: Date): string => {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    return `${start.getFullYear()}-${start.getMonth()}_${end.getFullYear()}-${end.getMonth()}`;
  };

  // Simplified loadEventsForRange
  const loadEventsForRange = useCallback(async (startDate: Date, endDate: Date): Promise<Event[]> => {
    const rangeKey = createRangeKey(startDate, endDate);
    
    if (loadingRangesRef.current.has(rangeKey) || loadedRangesRef.current.has(rangeKey)) {
      return eventsRef.current.filter(event => {
        const eventDate = new Date(event.start.dateTime);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    try {
      loadingRangesRef.current.add(rangeKey);
      
      const response = await api.get(`${API_URL}/user/events`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      const newEvents = response.data;
      
      setEvents(prevEvents => {
        const eventMap = new Map(prevEvents.map(event => [event._id, event]));
        newEvents.forEach((event: Event) => {
          eventMap.set(event._id, event);
        });
        const updatedEvents = Array.from(eventMap.values());
        eventsRef.current = updatedEvents; // ✅ Update ref
        return updatedEvents;
      });

      if (!loadedMinDateRef.current || startDate < loadedMinDateRef.current) {
        loadedMinDateRef.current = startDate;
      }
      if (!loadedMaxDateRef.current || endDate > loadedMaxDateRef.current) {
        loadedMaxDateRef.current = endDate;
      }

      loadedRangesRef.current.add(rangeKey);

      return newEvents;
    } catch (err) {
      console.error('Error loading events for range:', err);
      return [];
    } finally {
      loadingRangesRef.current.delete(rangeKey);
    }
  }, []);

  // Check if we need to load more data based on current view
  const checkAndLoadIfNeeded = useCallback(async (viewDate: Date) => {
    // Skip if initial load hasn't completed yet
    if (!isInitialLoadRef.current) {
      return;
    }

    // If no data loaded yet, this shouldn't happen after initial load
    if (!loadedMinDateRef.current || !loadedMaxDateRef.current) {
      return;
    }

    const viewMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const minLoaded = new Date(loadedMinDateRef.current.getFullYear(), loadedMinDateRef.current.getMonth(), 1);
    const maxLoaded = new Date(loadedMaxDateRef.current.getFullYear(), loadedMaxDateRef.current.getMonth(), 1);

    // Calculate month difference
    const monthsFromMin = (viewMonth.getFullYear() - minLoaded.getFullYear()) * 12 +
                           (viewMonth.getMonth() - minLoaded.getMonth());
    const monthsFromMax = (maxLoaded.getFullYear() - viewMonth.getFullYear()) * 12 +
                           (maxLoaded.getMonth() - viewMonth.getMonth());

    // If within 2 months of the minimum boundary, load 3 more months before
    if (monthsFromMin <= 2) {
      const newStart = new Date(minLoaded.getFullYear(), minLoaded.getMonth() - 3, 1);
      const newEnd = new Date(minLoaded.getFullYear(), minLoaded.getMonth() - 1, 1);
      await loadEventsForRange(newStart, newEnd);
    }

    // If within 2 months of the maximum boundary, load 3 more months after
    if (monthsFromMax <= 2) {
      const newStart = new Date(maxLoaded.getFullYear(), maxLoaded.getMonth() + 1, 1);
      const newEnd = new Date(maxLoaded.getFullYear(), maxLoaded.getMonth() + 3, 1);
      await loadEventsForRange(newStart, newEnd);
    }
  }, [loadEventsForRange]);

  useEffect(() => {
    checkAndLoadIfNeeded(currentViewDate);
  }, [currentViewDate, checkAndLoadIfNeeded]);

  // Force a fresh events fetch around whatever month the user is currently
  // viewing, bypassing the range-cache dedupe. Used once a sync completes
  // (via SSE, and as a fallback via polling below) so newly-synced events
  // show up without the user needing to manually refresh the page.
  const forceReloadEvents = useCallback(() => {
    loadingRangesRef.current.clear();
    loadedRangesRef.current.clear();
    loadedMinDateRef.current = null;
    loadedMaxDateRef.current = null;
    isInitialLoadRef.current = true;

    const viewDate = currentViewDateRef.current;
    const viewStart = new Date(viewDate.getFullYear(), viewDate.getMonth() - 3, 1);
    const viewEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 3, 1);
    loadEventsForRange(viewStart, viewEnd).then(() => checkAndLoadIfNeeded(viewDate));
  }, [loadEventsForRange, checkAndLoadIfNeeded]);

  // Fallback for when the SSE 'completed' message is missed (e.g. the SSE
  // connection was still (re)establishing when the job finished). Polls the
  // persisted per-account syncStatus until it leaves 'queued'/'syncing',
  // then force-reloads events — guaranteeing the dashboard updates even
  // without relying on the live SSE message ever arriving.
  const activeSyncPollsRef = useRef<Set<string>>(new Set());
  const pollAccountSyncStatus = useCallback((accountId: string) => {
    if (activeSyncPollsRef.current.has(accountId)) return;
    activeSyncPollsRef.current.add(accountId);

    const maxAttempts = 60; // ~3 minutes at 3s intervals
    let attempt = 0;

    const stopPolling = () => {
      activeSyncPollsRef.current.delete(accountId);
      setSyncingAccounts(prev => {
        if (!(accountId in prev)) return prev;
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
    };

    const tick = async () => {
      attempt += 1;
      try {
        const res = await api.get(`${API_URL}/user/accounts`);
        const accountsData: CalendarAccount[] = res.data;
        setAccounts(accountsData);

        const account = accountsData.find(a => (a._id || a.id) === accountId);
        if (!account || account.syncStatus === 'idle') {
          stopPolling();
          forceReloadEvents();
          return;
        }
        if (account.syncStatus === 'error') {
          stopPolling();
          setError('Calendar sync failed');
          return;
        }
      } catch (err) {
        console.error('Error polling sync status:', err);
      }

      if (attempt < maxAttempts) {
        setTimeout(tick, 3000);
      } else {
        stopPolling();
      }
    };

    setTimeout(tick, 3000);
  }, [api, forceReloadEvents]);

  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const accountsRes = await api.get(`${API_URL}/user/accounts`);
      setAccounts(accountsRes.data);

      // Seed syncing indicators from persisted account status, so a reload
      // mid-sync still shows "syncing" instead of relying solely on a live
      // SSE message that may have been missed while the tab was closed.
      const stillSyncing: { [accountId: string]: SyncingAccountInfo } = {};
      (accountsRes.data as CalendarAccount[]).forEach(account => {
        const id = account._id || account.id;
        if (id && (account.syncStatus === 'queued' || account.syncStatus === 'syncing')) {
          stillSyncing[id] = { provider: account.provider, email: account.email, status: account.syncStatus };
        }
      });
      setSyncingAccounts(stillSyncing);
      Object.keys(stillSyncing).forEach(id => pollAccountSyncStatus(id));

      // Load initial events range (current month ±3 months)
      const now = new Date();
      const initialStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const initialEnd = new Date(now.getFullYear(), now.getMonth() + 3, 1); // ✅ Changed from +4 to +3
      
      await loadEventsForRange(initialStart, initialEnd);
      
      // ✅ Mark initial load as complete
      isInitialLoadRef.current = true;
      
    } catch (err) {
      setError('Failed to load calendar data');
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [api, loadEventsForRange, pollAccountSyncStatus]); // ✅ Now safe since these are stable

  // Load initial data on mount
  useEffect(() => {
    fetchInitialData();
  }, []); // Only run once on mount

  // Update selected calendars when accounts change
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

      const response = await fetch(`${API_URL}/google/auth`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.url) {
        // Redirect user from frontend
        window.location.href = data.url;
      } else {
        setError('Failed to get authorization URL');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect Google Calendar');
    }
  };

  const handleConnectMicrosoft = async () => {
    try {

      const response = await fetch(`${API_URL}/microsoft/auth`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.url) {
        // Redirect user from frontend
        window.location.href = data.url;
      } else {
        setError('Failed to get authorization URL');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect Google Calendar');
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
      alert('Calendar account deleted successfully');
    } catch (err) {
      setError('Failed to delete calendar account');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (provider: string, email: string) => {
    setError('');
    try {
      const syncUrl = `${API_URL}/${provider}/sync/${provider}?email=${encodeURIComponent(email)}`;
      const res = await api.get(syncUrl);
      const accountId: string | undefined = res.data?.accountId;
      if (accountId) {
        setSyncingAccounts(prev => ({
          ...prev,
          [accountId]: { provider, email, status: 'queued' },
        }));
        // Sync now runs in the background. The SSE onSyncStatus handler
        // above clears the "syncing" indicator and reloads events as soon
        // as it completes; this poll is a fallback in case that message
        // is ever missed (e.g. a dropped/reconnecting SSE connection).
        pollAccountSyncStatus(accountId);
      }
    } catch (err) {
      setError(`Failed to queue ${provider} calendar sync`);
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

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ucv-surface flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-ucv-primary border-t-transparent mb-4"></div>
          <p className="text-ucv-text-secondary text-base">Loading your calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ucv-surface">
      {/* Success Message for Account Connection */}
      {connectionSuccess && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-4 bg-ucv-green-light border border-ucv-green/30 rounded-xl shadow-sm">
            <p className="text-ucv-green flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {connectionSuccess}
            </p>
            <button
              onClick={() => setConnectionSuccess(null)}
              className="mt-2 text-sm text-ucv-green hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Non-blocking Sync Progress Banner */}
      {Object.keys(syncingAccounts).length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-4 bg-ucv-surface-alt border border-ucv-border rounded-xl shadow-sm">
            {Object.values(syncingAccounts).map((info, idx) => (
              <p key={idx} className="text-ucv-text-secondary flex items-center text-sm">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-ucv-primary border-t-transparent mr-2 flex-shrink-0"></span>
                Syncing your {info.provider.charAt(0).toUpperCase() + info.provider.slice(1)} calendar ({info.email})…
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="p-4 bg-ucv-danger-light border border-ucv-danger-border rounded-xl shadow-sm">
            <p className="text-ucv-danger flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
            <button
              onClick={() => setError('')}
              className="mt-2 text-sm text-ucv-danger hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Calendar Section */}
          <div className="xl:col-span-3">
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
              loading={loading}
              onViewDateChange={setCurrentViewDate}
              userTimeZones={userTimeZones}
              onTimezoneChange={setSelectedUserTimeZone}
              onTimezoneSave={handleTimezoneSave}
              tzSaveStatus={tzSaveStatus}
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
              syncingAccountIds={Object.fromEntries(Object.keys(syncingAccounts).map(id => [id, true]))}
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