import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa';
import { toZonedTime, format } from 'date-fns-tz';
import moment from 'moment-timezone';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const API_URL = import.meta.env.VITE_API_URL;

interface CalendarListItem {
  calendarId: string;
  name: string;
  color?: string;
  // ...other fields...
}

interface CalendarAccount {
  id: string;
  provider: 'google' | 'microsoft';
  email: string;
  isConnected: boolean;
  calendarList?: CalendarListItem[]; // Add this line
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
    ianaTimeZone?: string; // Added for Microsoft
    isAllDay?: boolean; // Added for Microsoft
  };
  end: {
    dateTime: string;
    timeZone: string;
    ianaTimeZone?: string; // Added for Microsoft
    isAllDay?: boolean; // Added for Microsoft
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
  calendarId?: string; // Add this property
}

interface NewEvent {
  title: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  calendarAccountId: string;
  attendees: string[];
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
  const { user, logout, updateUserTimezone } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEvent>({
    title: '',
    description: '',
    location: '',
    startDateTime: '',
    endDateTime: '',
    calendarAccountId: '',
    attendees: []
  });
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [selectedUserTimeZone, setSelectedUserTimeZone] = useState(user?.timezone || 'UTC');
  const [tzSaveStatus, setTzSaveStatus] = useState<string | null>(null);
  const [selectedCalendars, setSelectedCalendars] = useState<{ [calendarId: string]: boolean }>({});
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  // Add state for selected calendars per account for event creation
  const [selectedAccountsForEvent, setSelectedAccountsForEvent] = useState<string[]>([]);
  const [selectedCalendarsForEvent, setSelectedCalendarsForEvent] = useState<{ [accountId: string]: string[] }>({});
  // Add state for calendar selection error
  const [calendarSelectionError, setCalendarSelectionError] = useState('');
  // Add state for allDay and recurrence
  const [isAllDay, setIsAllDay] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState({ frequency: 'daily', interval: 1, count: '', until: '', byDay: [] });

  useEffect(() => {
    // Only set if the timezone exists in the dropdown
    const found = userTimeZones.find(tz => tz.value === user?.timezone);
    setSelectedUserTimeZone(found ? found.value : 'UTC');
  }, [user?.timezone]);

  const handleTimezoneSave = async () => {
    const success = await updateUserTimezone(selectedUserTimeZone);
    setTzSaveStatus(success ? 'Saved!' : 'Failed to save');
    setTimeout(() => setTzSaveStatus(null), 2000);
  };

  // Move fetchData outside useEffect
  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsRes, eventsRes] = await Promise.all([
        api.get(`${API_URL}/user/accounts`),
        api.get(`${API_URL}/user/events`)
      ]);
      setAccounts(accountsRes.data);
      setEvents(eventsRes.data);
    } catch (err) {
      setError('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When accounts change, select all calendars by default
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
      window.location.href = `/api/google/auth?state=${encodeURIComponent(jwt)}`;
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
      window.location.href = `/api/microsoft/auth?state=${encodeURIComponent(jwt)}`;
    } catch (err) {
      setError('Failed to connect Microsoft Calendar');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError('Failed to logout');
    }
  };

  // Updated getEventsForDate function to use the current timezone
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      // Only show events from selected calendars
      if (event.calendarId && selectedCalendars && !selectedCalendars[event.calendarId]) {
        return false;
      }
      let eventDate;
      const ianaTZ = selectedUserTimeZone || user?.timezone || 'UTC';
      eventDate = toZonedTime(new Date(event.start.dateTime), ianaTZ);
      const match = eventDate.toDateString() === date.toDateString();
      return match;
    });
  };

  const handleDateClick = (value: any) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      setIsEventModalOpen(true);
    }
  };

  const handleAddEvent = async () => {
    // Check if at least one calendar is selected
    let atLeastOne = false;
    for (const accountId of selectedAccountsForEvent) {
      if ((selectedCalendarsForEvent[accountId] || []).length > 0) {
        atLeastOne = true;
        break;
      }
    }
    if (!atLeastOne) {
      setCalendarSelectionError('Please select at least one calendar.');
      return;
    }
    setCalendarSelectionError('');
    try {
      const eventData = {
        title: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        startDateTime: newEvent.startDateTime,
        endDateTime: newEvent.endDateTime,
        attendees: newEvent.attendees.map(email => ({ email, name: email })),
        isAllDay,
        recurrence: isRecurring ? {
          frequency: recurrence.frequency,
          interval: recurrence.interval,
          count: recurrence.count ? Number(recurrence.count) : undefined,
          until: recurrence.until || undefined,
          byDay: recurrence.byDay,
        } : null,
      };
      // For each selected account and calendar, create event
      let createdEvents: any[] = [];
      for (const accountId of selectedAccountsForEvent) {
        const calendarIds = selectedCalendarsForEvent[accountId] || [];
        const account = accounts.find(a => a.id === accountId);
        if (!account) continue;
        for (const calendarId of calendarIds) {
          const payload = {
            ...eventData,
            calendarId,
            provider: account.provider,
          };
          const response = await api.post(`${API_URL}/calendar/events`, payload);
          createdEvents.push(response.data.event);
        }
      }
      setEvents([...events, ...createdEvents]);
      setIsAddEventModalOpen(false);
      setNewEvent({
        title: '',
        description: '',
        location: '',
        startDateTime: '',
        endDateTime: '',
        calendarAccountId: '',
        attendees: []
      });
      setSelectedAccountsForEvent([]);
      setSelectedCalendarsForEvent({});
    } catch (err) {
      setError('Failed to create event');
    }
  };

  const addAttendee = () => {
    if (attendeeEmail && !newEvent.attendees.includes(attendeeEmail)) {
      setNewEvent({
        ...newEvent,
        attendees: [...newEvent.attendees, attendeeEmail]
      });
      setAttendeeEmail('');
    }
  };

  const removeAttendee = (email: string) => {
    setNewEvent({
      ...newEvent,
      attendees: newEvent.attendees.filter(a => a !== email)
    });
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'tentative': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper to get calendar color by calendarId
  const getCalendarColor = (calendarId: string) => {
    for (const acc of accounts) {
      const cal = acc.calendarList?.find(c => c.calendarId === calendarId);
      if (cal) return cal.color || '#e0e7ff';
    }
    return '#e0e7ff';
  };

  // Helper to get calendar name by calendarId
  const getCalendarName = (calendarId: string) => {
    for (const acc of accounts) {
      const cal = acc.calendarList?.find(c => c.calendarId === calendarId);
      if (cal) return cal.name;
    }
    return '';
  };

  // Memoized timeline events calculation with timezone dependency
  const getTimelineEvents = (date: Date) => {
    const eventsForDay = getEventsForDate(date);
    const positionedEvents: Array<{ event: Event, top: number, height: number, left: number, width: number }> = [];
    const sorted = [...eventsForDay].sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
    const lanes: Array<Array<{ event: Event, top: number, height: number }>> = [];
    
    const currentTz = selectedUserTimeZone || user?.timezone || 'UTC';
    
    // Create the day start in the selected timezone
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    sorted.forEach(ev => {
      // Handle all-day events
      if (ev.isAllDay) {
        positionedEvents.push({ 
          event: ev, 
          top: 0, 
          height: 40, 
          left: 0, 
          width: 200 
        });
        return;
      }

      // Convert event times to the selected timezone
      const eventStart = toZonedTime(new Date(ev.start.dateTime), currentTz);
      const eventEnd = toZonedTime(new Date(ev.end.dateTime), currentTz);
      
      // Create timezone-aware day boundaries
      const dayStartInTz = toZonedTime(dayStart, currentTz);
      const dayEndInTz = new Date(dayStartInTz);
      dayEndInTz.setHours(23, 59, 59, 999);
      
      // Calculate start and end times relative to the day start
      let displayStart = eventStart;
      let displayEnd = eventEnd;
      
      // Clamp events that start before or end after the current day
      if (eventStart < dayStartInTz) {
        displayStart = dayStartInTz;
      }
      if (eventEnd > dayEndInTz) {
        displayEnd = dayEndInTz;
      }
      
      // Skip events that don't overlap with this day
      if (eventEnd <= dayStartInTz || eventStart >= dayEndInTz) {
        return;
      }
      
      // Calculate minutes from day start
      const minutesFromStart = (displayStart.getTime() - dayStartInTz.getTime()) / (1000 * 60);
      const minutesToEnd = (displayEnd.getTime() - dayStartInTz.getTime()) / (1000 * 60);

      // Convert to pixels (60px per hour = 1px per minute)
      const pixelsPerMinute = 60 / 60; // 1px per minute
      const top = Math.max(0, minutesFromStart * pixelsPerMinute);
      const height = Math.max(32, (minutesToEnd - minutesFromStart) * pixelsPerMinute);
      
      // Find appropriate lane for this event
      let laneIdx = 0;
      while (lanes[laneIdx] && lanes[laneIdx].some(laneEv => {
        const laneStart = laneEv.top;
        const laneEnd = laneEv.top + laneEv.height;
        return top < laneEnd && (top + height) > laneStart;
      })) {
        laneIdx++;
      }
      
      if (!lanes[laneIdx]) lanes[laneIdx] = [];
      lanes[laneIdx].push({ event: ev, top, height });
      
      positionedEvents.push({ 
        event: ev, 
        top, 
        height, 
        left: laneIdx * 220, 
        width: 200 
      });
    });
    
    return positionedEvents;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Loading overlay spinner */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-gray-700 text-base">Loading...</p>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
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
              className="ml-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-semibold"
            >
              Save
            </button>
            {tzSaveStatus && <span className="ml-2 text-xs text-green-600">{tzSaveStatus}</span>}
          </div>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
            <p className="text-red-600 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Calendar Section */}
          <div className="xl:col-span-3">
            <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-blue-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Calendar</h1>
                <button
                  onClick={() => setIsAddEventModalOpen(true)}
                  className="px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Event
                </button>
              </div>
              
              <div className="calendar-container [&_.react-calendar]:w-full [&_.react-calendar]:border-0 [&_.react-calendar]:rounded-xl [&_.react-calendar]:shadow-lg [&_.react-calendar]:min-h-[500px]">
                <Calendar
                  onChange={handleDateClick}
                  value={selectedDate}
                  tileClassName={({ date }) => {
                    const eventsForDate = getEventsForDate(date);
                    return [
                      'min-h-[70px] sm:min-h-[90px] flex flex-col justify-between',
                      eventsForDate.length > 0 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 font-semibold border border-blue-200' : '',
                    ].join(' ');
                  }}
                  tileContent={({ date }) => {
                    const eventsForDate = getEventsForDate(date);
                    return eventsForDate.length > 0 ? (
                      <div className="flex items-center justify-center mt-2 group">
                        <span className="relative group">
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="7" />
                          </svg>
                          <span className="absolute left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {eventsForDate.length} event{eventsForDate.length > 1 ? 's' : ''}
                          </span>
                        </span>
                      </div>
                    ) : null;
                  }}
                  formatShortWeekday={(locale, date) => {
                    return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
                  }}
                  prev2Label={null}
                  next2Label={null}
                  minDetail="month"
                  maxDetail="month"
                  showNeighboringMonth={false}
                  className="[&_.react-calendar]:min-h-[500px] [&_.react-calendar__tile]:p-3 [&_.react-calendar__tile]:relative [&_.react-calendar__tile]:hover:bg-blue-50 [&_.react-calendar__tile]:transition-all [&_.react-calendar__tile]:rounded-lg [&_.react-calendar__tile]:cursor-pointer [&_.react-calendar__tile--now]:bg-gradient-to-br [&_.react-calendar__tile--now]:from-blue-200 [&_.react-calendar__tile--now]:to-indigo-200 [&_.react-calendar__tile--now]:text-blue-900 [&_.react-calendar__tile--active]:bg-gradient-to-br [&_.react-calendar__tile--active]:from-blue-600 [&_.react-calendar__tile--active]:to-indigo-600 [&_.react-calendar__tile--active]:text-white [&_.react-calendar__tile--active]:hover:from-blue-700 [&_.react-calendar__tile--active]:hover:to-indigo-700 [&_.react-calendar__navigation]:mb-6 [&_.react-calendar__navigation__label]:text-xl [&_.react-calendar__navigation__label]:font-bold [&_.react-calendar__navigation__label]:text-gray-800 [&_.react-calendar__navigation__arrow]:text-blue-600 [&_.react-calendar__navigation__arrow]:hover:text-blue-800 [&_.react-calendar__navigation__arrow]:text-2xl [&_.react-calendar__month-view__weekdays]:text-gray-600 [&_.react-calendar__month-view__weekdays]:font-semibold [&_.react-calendar__month-view__weekdays__weekday]:p-3 [&_.react-calendar__month-view__days__day--weekend]:text-red-500 [&_.react-calendar__month-view__days__day--neighboringMonth]:text-gray-400 [&_.react-calendar__month-view__days]:min-h-[400px]"
                />
              </div>
            </div>
          </div>

          {/* Calendar Accounts Section */}
          <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-blue-100">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
              Connected Accounts
            </h2>
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-2 p-4 border border-blue-100 rounded-xl hover:bg-blue-50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 w-full">
                    {account.provider === 'google' ? (
                      <FaGoogle className="text-red-500 w-5 h-5 shrink-0" />
                    ) : (
                      <FaMicrosoft className="text-blue-700 w-5 h-5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p
                        className="font-semibold text-gray-800 text-sm sm:text-base truncate max-w-[170px] sm:max-w-[220px]"
                        title={account.email}
                      >
                        {account.email}
                      </p>
                      <p className="text-xs text-gray-500 capitalize truncate max-w-[170px] sm:max-w-[220px]" title={account.provider}>
                        {account.provider}
                      </p>
                    </div>
                    <button
                      className="ml-auto px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-xs font-semibold flex items-center gap-1"
                      onClick={async () => {
                        setLoading(true);
                        setError('');
                        try {
                          const syncUrl = `${API_URL}/${account.provider}/sync/${account.provider}?email=${encodeURIComponent(account.email)}`;
                          await api.get(syncUrl);
                          setError('');
                          alert(`${account.provider.charAt(0).toUpperCase() + account.provider.slice(1)} calendar synced!`);
                          await fetchData(); // Refresh events and accounts after sync
                        } catch (err) {
                          setError(`Failed to sync ${account.provider} calendar`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      title={`Sync ${account.provider} calendar`}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582M20 20v-5h-.581M5 9A7 7 0 0119 15.197M19 15A7 7 0 015 8.803" />
                      </svg>
                      Sync
                    </button>
                  </div>
                  {/* Render calendarList if present */}
                  {account.calendarList && account.calendarList.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {account.calendarList.map((cal) => (
                        <label
                          key={cal.calendarId}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                          style={{
                            backgroundColor: cal.color || '#e0e7ff',
                            color: '#222',
                            border: '1px solid #e5e7eb',
                          }}
                          title={cal.calendarId}
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedCalendars[cal.calendarId]}
                            onChange={() => {
                              setSelectedCalendars(prev => ({
                                ...prev,
                                [cal.calendarId]: !prev[cal.calendarId]
                              }));
                            }}
                            className="accent-blue-600"
                          />
                          <span>{cal.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-4 mt-8">
                <button
                  onClick={handleConnectGoogle}
                  className="w-full flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3"
                  />
                  <span className="hidden sm:inline">Connect Google Calendar</span>
                  <span className="sm:hidden">Google</span>
                </button>
                <button
                  onClick={handleConnectMicrosoft}
                  className="w-full flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <img
                    src="https://www.microsoft.com/favicon.ico"
                    alt="Microsoft"
                    className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3"
                  />
                  <span className="hidden sm:inline">Connect Microsoft Calendar</span>
                  <span className="sm:hidden">Microsoft</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Events Modal - Timeline View */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-blue-100">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Events for {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Timeline grid */}
            <div className="relative border rounded-xl bg-gray-50 p-4 overflow-x-auto" style={{ minHeight: 1200 }}>
              {/* Time labels - positioned absolutely at exact hour positions */}
              <div className="absolute left-0 top-0 w-16 z-10" style={{ height: 24 * 60 }}>
                {[...Array(24)].map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute text-xs text-gray-400 flex items-center h-4"
                    style={{ 
                      top: i * 60 + 5, // Offset by half the text height to center on grid line
                      left: 0,
                      width: '60px'
                    }}
                  >
                    {`${i.toString().padStart(2, '0')}:00`}
                  </div>
                ))}
              </div>
              
              {/* Events container */}
              <div className="ml-20 relative" style={{ height: 24 * 60 }}>
                {/* Horizontal grid lines - one for each hour */}
                {[...Array(24)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-full border-t border-gray-200"
                    style={{ 
                      top: i * 60, 
                      left: 0, 
                      right: 0,
                      height: 1
                    }}
                  />
                ))}
                
                {/* Events with fixed positioning */}
                {getTimelineEvents(selectedDate).map(({ event, top, height, left, width }, idx) => (
                  <div
                    key={event._id || event.externalId || idx}
                    className={`absolute rounded-lg shadow-md cursor-pointer transition hover:scale-105 flex flex-col justify-start p-2
                      ${event.isAllDay ? 'all-day-event' : ''}`}
                    style={{
                      top: event.isAllDay ? 0 : top,
                      left,
                      width,
                      height: event.isAllDay ? 40 : height,
                      background: getCalendarColor(event.calendarId),
                      color: '#222',
                      border: '2px solid #fff',
                      zIndex: 20 + left,
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      minHeight: event.isAllDay ? '40px' : '32px',
                    }}
                    onClick={() => setSelectedEvent(event)}
                    title={`${event.title} - ${
                      event.isAllDay 
                        ? 'All day' 
                        : `${format(toZonedTime(new Date(event.start.dateTime), (selectedUserTimeZone ?? user?.timezone ?? 'UTC') || ''), 'HH:mm')} - ${format(toZonedTime(new Date(event.end.dateTime), (selectedUserTimeZone ?? user?.timezone ?? 'UTC') || ''), 'HH:mm')}`
                    }`}
                  >
                    <div
                      className="font-semibold w-full"
                      style={{
                        fontSize: '12px',
                        whiteSpace: 'normal',
                        lineHeight: 1.1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxHeight: '100%',
                        wordBreak: 'break-word',
                      }}
                    >
                      {event.title}
                      {event.isAllDay && <span className="ml-1 text-xs font-normal">(All day)</span>}
                    </div>
                    {!event.isAllDay && height > 50 && (
                      <div className="text-xs text-gray-600 mt-1">
                        {format(toZonedTime(new Date(event.start.dateTime), String(selectedUserTimeZone || user?.timezone || 'UTC')), 'HH:mm')} - 
                        {format(toZonedTime(new Date(event.end.dateTime), String(selectedUserTimeZone || user?.timezone || 'UTC')), 'HH:mm')}
                      </div>
                    )}
                    {!event.isAllDay && event.description && height > 70 && (
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {event.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* If no events */}
            {getEventsForDate(selectedDate).length === 0 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500 text-lg mb-4">No events scheduled for this date</p>
                <button
                  onClick={() => {
                    setIsAddEventModalOpen(true);
                    setIsEventModalOpen(false);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center mx-auto"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Event
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-blue-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold" style={{ color: getCalendarColor(selectedEvent.calendarId) }}>
                {selectedEvent.title}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-2 text-sm text-gray-700">{selectedEvent.description ?? ''}</div>
            <div className="mb-2 text-sm">
              <span className="font-semibold">Time:</span>{' '}
              {selectedEvent.isAllDay
                ? 'All day'
                : `${format(toZonedTime(new Date(selectedEvent.start.dateTime), String(selectedUserTimeZone || user?.timezone || 'UTC')), 'HH:mm')} - ${format(toZonedTime(new Date(selectedEvent.end.dateTime), String(selectedUserTimeZone || user?.timezone || 'UTC')), 'HH:mm')}`}
            </div>
            <div className="mb-2 text-sm">
              <span className="font-semibold">Calendar:</span> {getCalendarName(selectedEvent.calendarId)}
            </div>
            {selectedEvent.location && (
              <div className="mb-2 text-sm">
                <span className="font-semibold">Location:</span> {selectedEvent.location}
              </div>
            )}
            {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
              <div className="mb-2 text-sm">
                <span className="font-semibold">Attendees:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedEvent.attendees.map((a, i) => (
                    <span key={(a.email ?? a.name ?? i).toString()} className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {(a.name ?? a.email ?? '').toString()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-blue-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Create New Event</h2>
              <button
                onClick={() => {
                  setIsAddEventModalOpen(false);
                  if (getEventsForDate(selectedDate).length > 0) {
                    setIsEventModalOpen(true);
                  }
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleAddEvent(); }} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg bg-white"
                  placeholder="Enter event title"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start {isAllDay ? 'Date' : 'Date & Time'} *</label>
                  <DatePicker
                    selected={newEvent.startDateTime ? new Date(newEvent.startDateTime) : null}
                    onChange={date => setNewEvent({ ...newEvent, startDateTime: date ? date.toISOString() : '' })}
                    showTimeSelect={!isAllDay}
                    timeIntervals={15}
                    dateFormat={isAllDay ? 'yyyy-MM-dd' : 'yyyy-MM-dd h:mm aa'}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg bg-white"
                    placeholderText={isAllDay ? 'Select date' : 'Select date and time'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End {isAllDay ? 'Date' : 'Date & Time'} *</label>
                  <DatePicker
                    selected={newEvent.endDateTime ? new Date(newEvent.endDateTime) : null}
                    onChange={date => setNewEvent({ ...newEvent, endDateTime: date ? date.toISOString() : '' })}
                    showTimeSelect={!isAllDay}
                    timeIntervals={15}
                    dateFormat={isAllDay ? 'yyyy-MM-dd' : 'yyyy-MM-dd h:mm aa'}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg bg-white"
                    placeholderText={isAllDay ? 'Select date' : 'Select date and time'}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="accent-blue-600" />
                  <span className="text-sm">All Day</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="accent-blue-600" />
                  <span className="text-sm">Recurring</span>
                </label>
              </div>
              {isRecurring && (
                <div className="mt-4 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex gap-4 items-center">
                    <label className="text-sm font-semibold text-gray-700">Frequency:</label>
                    <select value={recurrence.frequency} onChange={e => setRecurrence(r => ({ ...r, frequency: e.target.value }))} className="bg-white border border-gray-300 rounded px-2 py-1">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <label className="text-sm font-semibold text-gray-700 ml-4">Interval:</label>
                    <input type="number" min={1} value={recurrence.interval} onChange={e => setRecurrence(r => ({ ...r, interval: Number(e.target.value) }))} className="w-16 bg-white border border-gray-300 rounded px-2 py-1" />
                  </div>
                  {recurrence.frequency === 'weekly' && (
                    <div className="flex gap-2 items-center">
                      <label className="text-sm font-semibold text-gray-700">Days:</label>
                      {["MO","TU","WE","TH","FR","SA","SU"].map(day => (
                        <label key={day} className="flex items-center gap-1">
                          <input type="checkbox" checked={recurrence.byDay.includes(day)} onChange={e => setRecurrence(r => ({ ...r, byDay: e.target.checked ? [...r.byDay, day] : r.byDay.filter(d => d !== day) }))} />
                          <span className="text-xs">{day}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-4 items-center">
                    <label className="text-sm font-semibold text-gray-700">End:</label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={recurrence.count !== ''} onChange={() => setRecurrence(r => ({ ...r, count: '1', until: '' }))} />
                      <span className="text-xs">After</span>
                      <input type="number" min={1} value={recurrence.count} onChange={e => setRecurrence(r => ({ ...r, count: e.target.value, until: '' }))} className="w-16 bg-white border border-gray-300 rounded px-2 py-1" disabled={recurrence.count === ''} />
                      <span className="text-xs">occurrences</span>
                    </label>
                    <label className="flex items-center gap-1 ml-4">
                      <input type="radio" checked={recurrence.until !== ''} onChange={() => setRecurrence(r => ({ ...r, until: new Date().toISOString().slice(0,10), count: '' }))} />
                      <span className="text-xs">Until</span>
                      <input type="date" value={recurrence.until} onChange={e => setRecurrence(r => ({ ...r, until: e.target.value, count: '' }))} className="bg-white border border-gray-300 rounded px-2 py-1" disabled={recurrence.until === ''} />
                    </label>
                    <label className="flex items-center gap-1 ml-4">
                      <input type="radio" checked={recurrence.count === '' && recurrence.until === ''} onChange={() => setRecurrence(r => ({ ...r, count: '', until: '' }))} />
                      <span className="text-xs">No End</span>
                    </label>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg bg-white"
                  placeholder="Enter event location"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg bg-white"
                  rows={4}
                  placeholder="Enter event description"
                />
              </div>
              
              {/* Enhanced Calendar Account & Calendar Selection with Debug Info */}
              <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Calendar(s) to Create Event *
              </label>

              {accounts.length === 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-700 text-sm">
                      <strong>No accounts found!</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-80 overflow-y-auto">
                  {accounts
                    .filter(acc => acc.calendarList && acc.calendarList.length > 0)
                    .map((account) => {
                      const accountId = account.id || `${account.provider}-${account.email}`;

                      return (
                        <div key={accountId} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              {account.provider === 'google' ? (
                                <FaGoogle className="text-red-500 w-5 h-5" />
                              ) : (
                                <FaMicrosoft className="text-blue-700 w-5 h-5" />
                              )}
                              <div>
                                <p className="font-semibold text-gray-800 text-sm" title={account.email}>
                                  {account.email}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {account.provider} Calendar
                                </p>
                              </div>
                            </div>

                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedAccountsForEvent.includes(accountId)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedAccountsForEvent(prev => [...prev, accountId]);
                                    if (!selectedCalendarsForEvent[accountId] &&
                                        Array.isArray(account.calendarList) &&
                                        account.calendarList.length > 0) {
                                      setSelectedCalendarsForEvent(prev => ({
                                        ...prev,
                                        [accountId]: [account.calendarList[0].calendarId]
                                      }));
                                    }
                                  } else {
                                    setSelectedAccountsForEvent(prev => prev.filter(id => id !== accountId));
                                    setSelectedCalendarsForEvent(prev => {
                                      const copy = { ...prev };
                                      delete copy[accountId];
                                      return copy;
                                    });
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white rounded"
                              />
                              <span className="ml-2 text-sm font-medium text-gray-700">Select Account</span>
                            </label>
                          </div>

                          {selectedAccountsForEvent.includes(accountId) && (
                            <div className="border-t border-gray-100 pt-3">
                              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">
                                Available Calendars:
                              </p>

                              {Array.isArray(account.calendarList) && account.calendarList.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {account.calendarList.map(cal => (
                                    <label
                                      key={cal.calendarId}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:scale-105 hover:shadow-md"
                                      style={{
                                        backgroundColor: cal.color || '#e0e7ff',
                                        color: '#222',
                                        border: '2px solid transparent',
                                        borderColor: selectedCalendarsForEvent[accountId]?.includes(cal.calendarId)
                                          ? '#3b82f6'
                                          : 'transparent'
                                      }}
                                      title={`Calendar ID: ${cal.calendarId}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedCalendarsForEvent[accountId]?.includes(cal.calendarId) || false}
                                        onChange={e => {
                                          setSelectedCalendarsForEvent(prev => {
                                            const prevCals = prev[accountId] || [];
                                            if (e.target.checked) {
                                              return { ...prev, [accountId]: [...prevCals, cal.calendarId] };
                                            } else {
                                              return { ...prev, [accountId]: prevCals.filter(id => id !== cal.calendarId) };
                                            }
                                          });
                                        }}
                                        className="accent-blue-600 bg-white rounded"
                                      />
                                      <span className="truncate flex-1">{cal.name}</span>
                                      <div
                                        className="w-3 h-3 rounded-full border border-gray-400"
                                        style={{ backgroundColor: cal.color || '#e0e7ff' }}
                                      />
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-3 text-gray-500 text-sm bg-gray-100 rounded-lg">
                                  <p>No calendars available</p>
                                </div>
                              )}

                              {selectedCalendarsForEvent[accountId] &&
                                selectedCalendarsForEvent[accountId].length > 0 && (
                                  <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block">
                                    {selectedCalendarsForEvent[accountId].length} calendar(s) selected
                                  </div>
                                )}
                            </div>
                          )}

                          {!selectedAccountsForEvent.includes(accountId) && (
                            <div className="border-t border-gray-100 pt-3">
                              <p className="text-xs text-gray-500 italic text-center py-2">
                                Select this account to view and choose calendars
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {accounts.filter(acc => acc.calendarList && acc.calendarList.length > 0).length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div className="text-yellow-700 text-sm">
                          <p><strong>No calendar data found!</strong></p>
                          <p>You have {accounts.length} account(s) but none have calendar data loaded.</p>
                          <p className="text-xs mt-1">Try syncing your accounts first.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAccountsForEvent.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">Selection Summary:</h4>
                      <ul className="text-xs text-blue-700 space-y-1">
                        {selectedAccountsForEvent.map(accountId => {
                          const account = accounts.find(a =>
                            (a.id === accountId) || (`${a.provider}-${a.email}` === accountId)
                          );
                          const selectedCals = selectedCalendarsForEvent[accountId] || [];
                          return (
                            <li key={accountId} className="flex items-center justify-between">
                              <span className="font-medium">{account?.email} ({account?.provider}):</span>
                              <span className="bg-blue-200 px-2 py-1 rounded text-xs">
                                {selectedCals.length} calendar(s)
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {calendarSelectionError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-700 text-sm">{calendarSelectionError}</span>
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs text-gray-500">
                <p>💡 <strong>Tip:</strong> Select the accounts and calendars where you want to create this event. The event will be created in all selected calendars.</p>
              </div>
            </div>

              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Attendees</label>
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      value={attendeeEmail}
                      onChange={(e) => setAttendeeEmail(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg bg-white"
                      placeholder="Enter attendee email"
                    />
                    <button
                      type="button"
                      onClick={addAttendee}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium"
                    >
                      Add
                    </button>
                  </div>
                  
                  {newEvent.attendees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newEvent.attendees.map((email) => (
                        <span key={email} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                          {email}
                          <button
                            type="button"
                            onClick={() => removeAttendee(email)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddEventModalOpen(false);
                    if (getEventsForDate(selectedDate).length > 0) {
                      setIsEventModalOpen(true);
                    }
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold"
                  disabled={!selectedAccountsForEvent.some(accountId => (selectedCalendarsForEvent[accountId] || []).length > 0)}
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;