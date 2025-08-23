import React, { useState } from 'react';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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

interface NewEvent {
  title: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  calendarAccountId: string;
  attendees: string[];
}

interface EventCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: CalendarAccount[];
  onCreateEvent: (eventData: any) => Promise<void>;
}

const EventCreationModal: React.FC<EventCreationModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onCreateEvent
}) => {
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
  const [isAllDay, setIsAllDay] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState({
    frequency: 'daily',
    interval: 1,
    count: '',
    until: '',
    byDay: []
  });
  const [selectedAccountsForEvent, setSelectedAccountsForEvent] = useState<string[]>([]);
  const [selectedCalendarsForEvent, setSelectedCalendarsForEvent] = useState<{ [accountId: string]: string[] }>({});
  const [calendarSelectionError, setCalendarSelectionError] = useState('');

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

    await onCreateEvent(eventData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <style>
        {`
          .react-datepicker-wrapper {
            width: 100%;
          }
          .react-datepicker__input-container input {
            background-color: white !important;
            color: #111827 !important;
          }
          .react-datepicker {
            background-color: white !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 0.5rem !important;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
          }
          .react-datepicker__header {
            background-color: #f9fafb !important;
            border-bottom: 1px solid #e5e7eb !important;
          }
          .react-datepicker__day {
            color: #111827 !important;
          }
          .react-datepicker__day:hover {
            background-color: #dbeafe !important;
          }
          .react-datepicker__day--selected {
            background-color: #2563eb !important;
            color: white !important;
          }
          .react-datepicker__time-container {
            background-color: white !important;
            border-left: 1px solid #e5e7eb !important;
          }
          .react-datepicker__time-list-item {
            color: #111827 !important;
          }
          .react-datepicker__time-list-item:hover {
            background-color: #dbeafe !important;
          }
        `}
      </style>
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-blue-100 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Create New Event</h2>
            <button
              onClick={onClose}
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
                    const accountId = account.id || account._id || `${account.provider}-${account.email}`;

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
                          (a.id === accountId) || (a._id === accountId) || (`${a.provider}-${a.email}` === accountId)
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
                onClick={onClose}
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
    </>
  );
};

export default EventCreationModal;
