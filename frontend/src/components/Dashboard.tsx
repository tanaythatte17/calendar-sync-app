import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

interface CalendarAccount {
  id: string;
  provider: 'google' | 'microsoft';
  email: string;
  isConnected: boolean;
}

interface Event {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  calendarAccountId: string;
}

interface NewEvent {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  calendarAccountId: string;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
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
    start: '',
    end: '',
    description: '',
    location: '',
    calendarAccountId: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsRes, eventsRes] = await Promise.all([
          axios.get('/api/calendar-accounts'),
          axios.get('/api/events')
        ]);
        setAccounts(accountsRes.data);
        setEvents(eventsRes.data);
      } catch (err) {
        setError('Failed to load calendar data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const response = await axios.get('/api/auth/google/redirect');
      window.location.href = response.data.url;
    } catch (err) {
      setError('Failed to connect Google Calendar');
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      const response = await axios.get('/api/auth/microsoft/redirect');
      window.location.href = response.data.url;
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
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
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
      const response = await axios.post('/api/events', newEvent);
      setEvents([...events, response.data]);
      setIsAddEventModalOpen(false);
      setNewEvent({
        title: '',
        start: '',
        end: '',
        description: '',
        location: '',
        calendarAccountId: ''
      });
    } catch (err) {
      setError('Failed to create event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
            <p className="text-red-600 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-lg rounded-xl p-6 border border-indigo-100">
              <div className="calendar-container [&_.react-calendar]:w-full [&_.react-calendar]:border-0 [&_.react-calendar]:rounded-lg">
                <Calendar
                  onChange={handleDateClick}
                  value={selectedDate}
                  tileClassName={({ date }) => {
                    const eventsForDate = getEventsForDate(date);
                    return eventsForDate.length > 0
                      ? 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-semibold'
                      : '';
                  }}
                  tileContent={({ date }) => {
                    const eventsForDate = getEventsForDate(date);
                    return eventsForDate.length > 0 ? (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                        <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
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
                  className="[&_.react-calendar__tile]:p-2 [&_.react-calendar__tile]:relative [&_.react-calendar__tile]:hover:bg-indigo-50 [&_.react-calendar__tile]:transition-colors [&_.react-calendar__tile]:rounded-lg [&_.react-calendar__tile--now]:bg-gradient-to-br [&_.react-calendar__tile--now]:from-indigo-200 [&_.react-calendar__tile--now]:to-purple-200 [&_.react-calendar__tile--now]:text-indigo-900 [&_.react-calendar__tile--active]:bg-gradient-to-br [&_.react-calendar__tile--active]:from-indigo-600 [&_.react-calendar__tile--active]:to-purple-600 [&_.react-calendar__tile--active]:text-white [&_.react-calendar__tile--active]:hover:from-indigo-700 [&_.react-calendar__tile--active]:hover:to-purple-700 [&_.react-calendar__navigation]:mb-4 [&_.react-calendar__navigation__label]:text-lg [&_.react-calendar__navigation__label]:font-semibold [&_.react-calendar__navigation__label]:text-gray-800 [&_.react-calendar__navigation__arrow]:text-indigo-600 [&_.react-calendar__navigation__arrow]:hover:text-indigo-800 [&_.react-calendar__month-view__weekdays]:text-gray-600 [&_.react-calendar__month-view__weekdays]:font-medium [&_.react-calendar__month-view__weekdays__weekday]:p-2 [&_.react-calendar__month-view__days__day--weekend]:text-red-500 [&_.react-calendar__month-view__days__day--neighboringMonth]:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Calendar Accounts Section */}
          <div className="bg-white shadow-lg rounded-xl p-6 border border-indigo-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Connected Accounts</h2>
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-all duration-200"
                >
                  <div>
                    <p className="font-medium text-gray-800">{account.email}</p>
                    <p className="text-sm text-gray-500 capitalize">{account.provider}</p>
                  </div>
                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      account.isConnected
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {account.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              ))}

              <div className="space-y-3 mt-6">
                <button
                  onClick={handleConnectGoogle}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="w-5 h-5 mr-2"
                  />
                  Connect Google Calendar
                </button>
                <button
                  onClick={handleConnectMicrosoft}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <img
                    src="https://www.microsoft.com/favicon.ico"
                    alt="Microsoft"
                    className="w-5 h-5 mr-2"
                  />
                  Connect Microsoft Calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Events Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-indigo-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Events for {selectedDate.toLocaleDateString()}
              </h2>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {getEventsForDate(selectedDate).length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-gray-500">No events scheduled for this date</p>
                </div>
              ) : (
                getEventsForDate(selectedDate).map((event) => (
                  <div
                    key={event.id}
                    className="p-4 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-gray-800">{event.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(event.start).toLocaleTimeString()} -{' '}
                      {new Date(event.end).toLocaleTimeString()}
                    </p>
                    {event.location && (
                      <p className="text-sm text-gray-500 mt-1 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {event.location}
                      </p>
                    )}
                  </div>
                ))
              )}
              <button
                onClick={() => {
                  setIsAddEventModalOpen(true);
                  setIsEventModalOpen(false);
                }}
                className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full shadow-2xl border border-indigo-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Add New Event</h2>
              <button
                onClick={() => {
                  setIsAddEventModalOpen(false);
                  setIsEventModalOpen(true);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAddEvent(); }} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={newEvent.start}
                    onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={newEvent.end}
                    onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add to Calendar</label>
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {accounts.filter(acc => acc.isConnected).map((account) => (
                    <label key={account.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newEvent.calendarAccountId === account.id}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEvent({ ...newEvent, calendarAccountId: account.id });
                          } else {
                            setNewEvent({ ...newEvent, calendarAccountId: '' });
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">
                        {account.email} ({account.provider})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddEventModalOpen(false);
                    setIsEventModalOpen(true);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
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