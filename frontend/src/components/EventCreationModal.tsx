import React, { useState } from 'react';
import { GoogleIcon, MicrosoftIcon } from './icons/BrandIcons';
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
  onCreateEvent?: (eventData: any) => Promise<void>; // Made optional since we're handling API call internally
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
  const [recurrence, setRecurrence] = useState<{
    frequency: string;
    interval: number;
    count: string;
    until: string;
    byDay: string[];
  }>({
    frequency: '',
    interval: 1,
    count: '',
    until: '',
    byDay: [],
  });
  const [selectedAccountsForEvent, setSelectedAccountsForEvent] = useState<string[]>([]);
  const [selectedCalendarsForEvent, setSelectedCalendarsForEvent] = useState<{ [accountId: string]: string[] }>({});
  const [calendarSelectionError, setCalendarSelectionError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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

  const toggleCalendarForAccount = (accountId: string, calendarId: string, checked: boolean) => {
    setSelectedCalendarsForEvent(prev => {
      const prevCals = prev[accountId] || [];
      const newCals = checked ? [...prevCals, calendarId] : prevCals.filter(id => id !== calendarId);
      return { ...prev, [accountId]: newCals };
    });
    setSelectedAccountsForEvent(prev => {
      const currentCals = selectedCalendarsForEvent[accountId] || [];
      const willHaveCals = checked || currentCals.filter(id => id !== calendarId).length > 0;
      if (willHaveCals && !prev.includes(accountId)) return [...prev, accountId];
      if (!willHaveCals && prev.includes(accountId)) return prev.filter(id => id !== accountId);
      return prev;
    });
  };

  const createEventInCalendar = async (eventData: any, calendarId: string, provider: string) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/calendar/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` // Adjust based on your auth setup
      },
      body: JSON.stringify({
        ...eventData,
        calendarId,
        provider
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to create event in ${provider} calendar`);
    }

    return await response.json();
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

    setIsCreating(true);
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

      const createdEvents = [];

      // Create event in all selected calendars
      for (const accountId of selectedAccountsForEvent) {
        const selectedCalendars = selectedCalendarsForEvent[accountId] || [];
        const account = accounts.find(acc =>
          (acc.id === accountId) || (acc._id === accountId) || (`${acc.provider}-${acc.email}` === accountId)
        );

        if (!account) continue;

        for (const calendarId of selectedCalendars) {
          try {
            const result = await createEventInCalendar(eventData, calendarId, account.provider);
            createdEvents.push(result);
          } catch (error) {
            console.error(`Failed to create event in ${account.email} (${calendarId}):`, error);
            // You might want to show individual calendar errors to the user
          }
        }
      }

      if (createdEvents.length > 0) {
        // Call the optional callback if provided
        if (onCreateEvent) {
          await onCreateEvent(eventData);
        }

        // Reset form
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
        setIsAllDay(false);
        setIsRecurring(false);
        setRecurrence({
          frequency: 'daily',
          interval: 1,
          count: '',
          until: '',
          byDay: []
        });

        onClose();
      } else {
        setCalendarSelectionError('Failed to create event in any selected calendar.');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setCalendarSelectionError('An error occurred while creating the event.');
    } finally {
      setIsCreating(false);
    }
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
            color: #292524 !important;
          }
          .react-datepicker {
            background-color: white !important;
            border: 1px solid #E4E1D8 !important;
            border-radius: 0.5rem !important;
            box-shadow: 0 10px 15px -3px rgba(41, 37, 36, 0.1) !important;
          }
          .react-datepicker__header {
            background-color: #F7F6F1 !important;
            border-bottom: 1px solid #E4E1D8 !important;
          }
          .react-datepicker__day {
            color: #292524 !important;
          }
          .react-datepicker__day:hover {
            background-color: #F0F2E6 !important;
          }
          .react-datepicker__day--selected {
            background-color: #5B6E3A !important;
            color: white !important;
          }
          .react-datepicker__time-container {
            background-color: white !important;
            border-left: 1px solid #E4E1D8 !important;
          }
          .react-datepicker__time-list-item {
            color: #292524 !important;
          }
          .react-datepicker__time-list-item:hover {
            background-color: #F0F2E6 !important;
          }
        `}
      </style>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={onClose}>
        <div
          className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-white rounded-xl p-7 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-[22px]">
            <h3 className="text-[19px] font-extrabold text-ucv-text m-0">Create New Event</h3>
            <button
              onClick={onClose}
              className="text-ucv-text-muted hover:opacity-60 transition-opacity p-0.5"
              disabled={isCreating}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleAddEvent(); }} className="flex flex-col gap-[18px]">
            <div>
              <label className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Event Title *</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full px-3 py-2.5 border border-ucv-border rounded-lg focus:ring-2 focus:ring-ucv-primary-light focus:border-ucv-primary transition-all duration-200 text-sm bg-white"
                placeholder="Enter event title"
                required
                disabled={isCreating}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Start {isAllDay ? 'Date' : 'Date & Time'} *</label>
                <DatePicker
                  selected={newEvent.startDateTime ? new Date(newEvent.startDateTime) : null}
                  onChange={date => setNewEvent({ ...newEvent, startDateTime: date ? date.toISOString() : '' })}
                  showTimeSelect={!isAllDay}
                  timeIntervals={15}
                  dateFormat={isAllDay ? 'yyyy-MM-dd' : 'yyyy-MM-dd h:mm aa'}
                  className="w-full px-3 py-2.5 border border-ucv-border rounded-lg focus:ring-2 focus:ring-ucv-primary-light focus:border-ucv-primary transition-all duration-200 text-sm bg-white"
                  placeholderText={isAllDay ? 'Select date' : 'Select date and time'}
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">End {isAllDay ? 'Date' : 'Date & Time'} *</label>
                <DatePicker
                  selected={newEvent.endDateTime ? new Date(newEvent.endDateTime) : null}
                  onChange={date => setNewEvent({ ...newEvent, endDateTime: date ? date.toISOString() : '' })}
                  showTimeSelect={!isAllDay}
                  timeIntervals={15}
                  dateFormat={isAllDay ? 'yyyy-MM-dd' : 'yyyy-MM-dd h:mm aa'}
                  className="w-full px-3 py-2.5 border border-ucv-border rounded-lg focus:ring-2 focus:ring-ucv-primary-light focus:border-ucv-primary transition-all duration-200 text-sm bg-white"
                  placeholderText={isAllDay ? 'Select date' : 'Select date and time'}
                  disabled={isCreating}
                />
              </div>
            </div>

            <div className="flex items-center gap-5">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-ucv-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={e => setIsAllDay(e.target.checked)}
                  className="w-4 h-4 accent-ucv-primary cursor-pointer"
                  disabled={isCreating}
                />
                All Day
              </label>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-ucv-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 accent-ucv-primary cursor-pointer"
                  disabled={isCreating}
                />
                Recurring
              </label>
            </div>

            {isRecurring && (
              <div className="bg-ucv-surface border border-ucv-border rounded-lg p-4 flex flex-col gap-3.5">
                <div className="flex gap-3.5 flex-wrap items-end">
                  <div>
                    <label className="block text-xs font-semibold text-ucv-text-secondary mb-1">Frequency</label>
                    <select
                      value={recurrence.frequency}
                      onChange={e => setRecurrence(r => ({ ...r, frequency: e.target.value }))}
                      className="px-2.5 py-2 border border-ucv-border rounded-md text-sm bg-white text-ucv-text"
                      disabled={isCreating}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ucv-text-secondary mb-1">Interval</label>
                    <input
                      type="number"
                      min={1}
                      value={recurrence.interval}
                      onChange={e => setRecurrence(r => ({ ...r, interval: Number(e.target.value) }))}
                      className="w-[70px] px-2.5 py-2 border border-ucv-border rounded-md text-sm text-ucv-text"
                      disabled={isCreating}
                    />
                  </div>
                </div>
                {recurrence.frequency === 'weekly' && (
                  <div className="flex gap-2 items-center flex-wrap">
                    <label className="text-xs font-semibold text-ucv-text-secondary">Days:</label>
                    {["MO","TU","WE","TH","FR","SA","SU"].map(day => (
                      <label key={day} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={recurrence.byDay.includes(day)}
                          onChange={e => setRecurrence(r => ({ ...r, byDay: e.target.checked ? [...r.byDay, day] : r.byDay.filter(d => d !== day) }))}
                          disabled={isCreating}
                        />
                        <span className="text-xs text-ucv-text-secondary">{day}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-ucv-text-secondary mb-2">End</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-ucv-text-secondary cursor-pointer">
                      <input
                        type="radio"
                        checked={recurrence.count !== ''}
                        onChange={() => setRecurrence(r => ({ ...r, count: '1', until: '' }))}
                        disabled={isCreating}
                      />
                      After
                      <input
                        type="number"
                        min={1}
                        value={recurrence.count}
                        onChange={e => setRecurrence(r => ({ ...r, count: e.target.value, until: '' }))}
                        className="w-14 px-2 py-1 border border-ucv-border rounded-md text-sm"
                        disabled={recurrence.count === '' || isCreating}
                      />
                      occurrences
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ucv-text-secondary cursor-pointer">
                      <input
                        type="radio"
                        checked={recurrence.until !== ''}
                        onChange={() => setRecurrence(r => ({ ...r, until: new Date().toISOString().slice(0,10), count: '' }))}
                        disabled={isCreating}
                      />
                      Until
                      <input
                        type="date"
                        value={recurrence.until}
                        onChange={e => setRecurrence(r => ({ ...r, until: e.target.value, count: '' }))}
                        className="px-2 py-1 border border-ucv-border rounded-md text-sm"
                        disabled={recurrence.until === '' || isCreating}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ucv-text-secondary cursor-pointer">
                      <input
                        type="radio"
                        checked={recurrence.count === '' && recurrence.until === ''}
                        onChange={() => setRecurrence(r => ({ ...r, count: '', until: '' }))}
                        disabled={isCreating}
                      />
                      No end
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Location</label>
              <input
                type="text"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                className="w-full px-3 py-2.5 border border-ucv-border rounded-lg focus:ring-2 focus:ring-ucv-primary-light focus:border-ucv-primary transition-all duration-200 text-sm bg-white"
                placeholder="Enter event location"
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Description</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full px-3 py-2.5 border border-ucv-border rounded-lg focus:ring-2 focus:ring-ucv-primary-light focus:border-ucv-primary transition-all duration-200 text-sm bg-white resize-vertical"
                rows={3}
                placeholder="Enter event description"
                disabled={isCreating}
              />
            </div>

            {/* Calendar Account & Calendar Selection */}
            <div>
              <label className="block text-sm font-semibold text-ucv-text-secondary mb-2">Calendar *</label>

              {accounts.length === 0 ? (
                <div className="bg-ucv-danger-light border border-ucv-danger-border rounded-lg p-4">
                  <span className="text-ucv-danger text-sm"><strong>No accounts found!</strong></span>
                </div>
              ) : (
                <div className="border border-ucv-border rounded-lg p-3 bg-ucv-surface flex flex-col gap-3 max-h-72 overflow-y-auto">
                  {accounts
                    .filter(acc => acc.calendarList && acc.calendarList.length > 0)
                    .map((account) => {
                      const accountId = account.id || account._id || `${account.provider}-${account.email}`;

                      return (
                        <div key={accountId}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {account.provider === 'google' ? <GoogleIcon size={16} /> : <MicrosoftIcon size={14} />}
                            </div>
                            <span className="text-xs font-semibold text-ucv-text-secondary truncate" title={account.email}>
                              {account.email}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 pl-1">
                            {(account.calendarList || []).map(cal => (
                              <label
                                key={cal.calendarId}
                                className="flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-white transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedCalendarsForEvent[accountId]?.includes(cal.calendarId) || false}
                                  onChange={e => toggleCalendarForAccount(accountId, cal.calendarId, e.target.checked)}
                                  className="accent-ucv-primary cursor-pointer"
                                  disabled={isCreating}
                                />
                                <div
                                  className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0"
                                  style={{ backgroundColor: cal.color || '#F0F2E6' }}
                                />
                                <span className="text-sm text-ucv-text-secondary truncate">{cal.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                  {accounts.filter(acc => acc.calendarList && acc.calendarList.length > 0).length === 0 && (
                    <div className="text-ucv-warning text-sm bg-ucv-warning-light border border-ucv-warning/30 rounded-lg p-3">
                      No calendar data found. Try syncing your accounts first.
                    </div>
                  )}
                </div>
              )}

              {calendarSelectionError && (
                <div className="mt-2 text-ucv-danger text-sm">{calendarSelectionError}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Attendees</label>
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={attendeeEmail}
                    onChange={(e) => setAttendeeEmail(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-ucv-border rounded-lg focus:ring-2 focus:ring-ucv-primary-light focus:border-ucv-primary transition-all duration-200 text-sm bg-white"
                    placeholder="Enter attendee email"
                    disabled={isCreating}
                  />
                  <button
                    type="button"
                    onClick={addAttendee}
                    className="px-4 py-2.5 bg-ucv-primary text-white rounded-lg hover:bg-ucv-primary-hover transition-all duration-200 font-semibold text-sm disabled:opacity-50"
                    disabled={isCreating}
                  >
                    Add
                  </button>
                </div>

                {newEvent.attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {newEvent.attendees.map((email) => (
                      <span key={email} className="flex items-center gap-1.5 bg-ucv-primary-light text-ucv-primary px-2.5 py-1 rounded-full text-xs font-medium">
                        {email}
                        <button
                          type="button"
                          onClick={() => removeAttendee(email)}
                          className="text-ucv-primary hover:text-ucv-primary-hover disabled:opacity-50"
                          disabled={isCreating}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-ucv-border rounded-lg text-sm font-semibold text-ucv-text-secondary hover:bg-ucv-surface transition-all duration-200 disabled:opacity-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-ucv-primary text-white rounded-lg hover:bg-ucv-primary-hover transition-all duration-200 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={!selectedAccountsForEvent.some(accountId => (selectedCalendarsForEvent[accountId] || []).length > 0) || isCreating}
              >
                {isCreating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Event...
                  </>
                ) : (
                  'Create Event'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default EventCreationModal;
