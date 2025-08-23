import React from 'react';
import { FaTimes, FaCalendar, FaClock, FaMapMarkerAlt, FaUsers, FaInfoCircle, FaExternalLinkAlt } from 'react-icons/fa';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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

interface EventDetailModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  accounts: CalendarAccount[];
  selectedUserTimeZone: string;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  accounts,
  selectedUserTimeZone
}) => {
  if (!isOpen || !event) return null;

  const getCalendarColor = (calendarId?: string) => {
    for (const acc of accounts) {
      const cal = acc.calendarList?.find(c => c.calendarId === calendarId);
      if (cal) return cal.color || '#e0e7ff';
    }
    return '#e0e7ff';
  };

  const getCalendarName = (calendarId?: string) => {
    for (const acc of accounts) {
      const cal = acc.calendarList?.find(c => c.calendarId === calendarId);
      if (cal) return cal.name;
    }
    return '';
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'tentative': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'cancelled': return 'Cancelled';
      case 'tentative': return 'Tentative';
      default: return 'Unknown';
    }
  };

  const formatDateTime = (dateTime: string, timezone: string) => {
    try {
      const zonedTime = toZonedTime(new Date(dateTime), timezone);
      return format(zonedTime, 'MMM d, yyyy h:mm a');
    } catch (error) {
      return new Date(dateTime).toLocaleString();
    }
  };

  const formatTime = (dateTime: string, timezone: string) => {
    try {
      const zonedTime = toZonedTime(new Date(dateTime), timezone);
      return format(zonedTime, 'h:mm a');
    } catch (error) {
      return new Date(dateTime).toLocaleTimeString();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getCalendarColor(event.calendarId) }}
            />
            <h2 className="text-2xl font-bold text-gray-900">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          {/* Event Status */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventStatusColor(event.status)}`}>
              {getEventStatusText(event.status)}
            </span>
            {event.isRecurring && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                Recurring
              </span>
            )}
            {event.isAllDay && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                All Day
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <FaInfoCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">Description</span>
              </div>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                {event.description}
              </p>
            </div>
          )}

          {/* Date and Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <FaCalendar className="w-4 h-4" />
              <span className="text-sm font-semibold">Date & Time</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              {event.isAllDay ? (
                <div className="text-gray-700">
                  <div className="font-medium">
                    {format(toZonedTime(new Date(event.start.dateTime), selectedUserTimeZone || 'UTC'), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-gray-600">All day event</div>
                </div>
              ) : (
                <div className="text-gray-700">
                  <div className="font-medium">
                    {format(toZonedTime(new Date(event.start.dateTime), selectedUserTimeZone || 'UTC'), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatTime(event.start.dateTime, selectedUserTimeZone || 'UTC')} - {formatTime(event.end.dateTime, selectedUserTimeZone || 'UTC')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <FaMapMarkerAlt className="w-4 h-4" />
                <span className="text-sm font-semibold">Location</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-gray-700">{event.location}</p>
              </div>
            </div>
          )}

          {/* Calendar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <FaCalendar className="w-4 h-4" />
              <span className="text-sm font-semibold">Calendar</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getCalendarColor(event.calendarId) }}
                />
                <span className="text-gray-700">{getCalendarName(event.calendarId)}</span>
              </div>
            </div>
          </div>

          {/* Organizer */}
          {event.organizer && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <FaUsers className="w-4 h-4" />
                <span className="text-sm font-semibold">Organizer</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-700">
                  <div className="font-medium">{event.organizer.name}</div>
                  <div className="text-sm text-gray-600">{event.organizer.email}</div>
                </div>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <FaUsers className="w-4 h-4" />
                <span className="text-sm font-semibold">Attendees ({event.attendees.length})</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="space-y-2">
                  {event.attendees.map((attendee, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="text-gray-700">
                        <div className="font-medium">{attendee.name || attendee.email}</div>
                        {attendee.name && attendee.email !== attendee.name && (
                          <div className="text-sm text-gray-600">{attendee.email}</div>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        attendee.responseStatus === 'accepted' ? 'bg-green-100 text-green-800' :
                        attendee.responseStatus === 'declined' ? 'bg-red-100 text-red-800' :
                        attendee.responseStatus === 'tentative' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {attendee.responseStatus || 'No response'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* External Link */}
          {event.htmlLink && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <FaExternalLinkAlt className="w-4 h-4" />
                <span className="text-sm font-semibold">External Link</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {event.htmlLink}
                </a>
              </div>
            </div>
          )}

          {/* Event Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <FaInfoCircle className="w-4 h-4" />
              <span className="text-sm font-semibold">Event Details</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Source:</span>
                <span className="text-gray-700 capitalize">{event.source}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Updated:</span>
                <span className="text-gray-700">
                  {format(new Date(event.updatedAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {event.recurringEventId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Recurring Event ID:</span>
                  <span className="text-gray-700 font-mono text-xs">{event.recurringEventId}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all duration-200 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
