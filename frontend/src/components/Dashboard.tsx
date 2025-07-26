import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa';
import { toZonedTime, format } from 'date-fns-tz';
import moment from 'moment-timezone';

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

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      // Only show events from selected calendars
      if (event.calendarId && selectedCalendars && !selectedCalendars[event.calendarId]) {
        return false;
      }
      let eventDate;
      const ianaTZ = user?.timezone || 'UTC';
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
    try {
      const eventData = {
        title: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        start: {
          dateTime: newEvent.startDateTime,
          timeZone: 'UTC' // Default to UTC for new events
        },
        end: {
          dateTime: newEvent.endDateTime,
          timeZone: 'UTC' // Default to UTC for new events
        },
        calendarAccountId: newEvent.calendarAccountId,
        attendees: newEvent.attendees.map(email => ({ email, name: email }))
      };
      const response = await api.post(`${API_URL}/user/events`, eventData);
      setEvents([...events, response.data]);
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
              {/* Time labels - show every hour */}
              <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between z-10">
                {[...Array(25)].map((_, i) => (
                  <div key={i} className="text-xs text-gray-400" style={{ height: 48 }}>
                    {`${i.toString().padStart(2, '0')}:00`}
                  </div>
                ))}
              </div>
              {/* Events */}
              <div className="ml-20 relative" style={{ height: 25 * 48 }}>
                {/* Calculate event positions */}
                {(() => {
                  const eventsForDay = getEventsForDate(selectedDate);
                  // Map events to timeline positions
                  const positionedEvents: Array<{ event: Event, top: number, height: number, left: number, width: number }> = [];
                  // Sort by start time
                  const sorted = [...eventsForDay].sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
                  // For overlap logic
                  const lanes: Array<Array<{ event: Event, top: number, height: number }>> = [];
                  sorted.forEach(ev => {
                    const start = new Date(ev.start.dateTime);
                    const end = new Date(ev.end.dateTime);
                    const dayStart = new Date(selectedDate);
                    dayStart.setHours(0, 0, 0, 0);
                    const minutesFromStart = ((start.getTime() - dayStart.getTime()) / 60000);
                    const minutesToEnd = ((end.getTime() - dayStart.getTime()) / 60000);
                    // 48px per hour
                    const top = Math.max(0, minutesFromStart / 60 * 48);
                    const height = Math.max(32, (minutesToEnd - minutesFromStart) / 60 * 48); // min 32px
                    // Find lane
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
                    positionedEvents.push({ event: ev, top, height, left: laneIdx * 220, width: 200 });
                  });
                  return positionedEvents.map(({ event, top, height, left, width }, idx) => (
                    <div
                      key={event._id || event.externalId || idx}
                      className="absolute rounded-lg shadow-md cursor-pointer transition hover:scale-105 flex flex-col justify-center"
                      style={{
                        top,
                        left,
                        width,
                        height,
                        background: getCalendarColor(event.calendarId),
                        color: '#222',
                        padding: '8px',
                        border: '2px solid #fff',
                        zIndex: 20 + left,
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                        minHeight: '32px',
                        maxHeight: '160px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onClick={() => setSelectedEvent(event)}
                      title={event.title}
                    >
                      <span className="font-semibold text-sm truncate w-full" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                        {event.title}
                      </span>
                      {event.description && (
                        <span className="text-xs truncate w-full" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                          {event.description}
                        </span>
                      )}
                    </div>
                  ));
                })()}
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
            <div className="mb-2 text-sm text-gray-700">{selectedEvent.description}</div>
            <div className="mb-2 text-sm">
              <span className="font-semibold">Time:</span>{' '}
              {format(new Date(selectedEvent.start.dateTime), 'HH:mm')} - {format(new Date(selectedEvent.end.dateTime), 'HH:mm')}
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
                    <span key={a.email || a.name || i} className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {a.name || a.email}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                  placeholder="Enter event title"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newEvent.startDateTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startDateTime: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newEvent.endDateTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endDateTime: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter event location"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  rows={4}
                  placeholder="Enter event description"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Calendar Account *</label>
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  {accounts.filter(acc => acc.isConnected).map((account) => (
                    <label key={account.id} className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors cursor-pointer">
                      <input
                        type="radio"
                        name="calendarAccount"
                        checked={newEvent.calendarAccountId === account.id}
                        onChange={() => setNewEvent({ ...newEvent, calendarAccountId: account.id })}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {account.email} ({account.provider})
                      </span>
                    </label>
                  ))}
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
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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