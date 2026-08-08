import React from 'react';
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
      if (cal) return cal.color || '#5B6E3A';
    }
    return '#5B6E3A';
  };

  const getCalendarName = (calendarId?: string) => {
    for (const acc of accounts) {
      const cal = acc.calendarList?.find(c => c.calendarId === calendarId);
      if (cal) return cal.name;
    }
    return '';
  };

  const formatTime = (dateTime: string, timezone: string) => {
    try {
      const zonedTime = toZonedTime(new Date(dateTime), timezone);
      return format(zonedTime, 'h:mm a');
    } catch (error) {
      return new Date(dateTime).toLocaleTimeString();
    }
  };

  const timezone = selectedUserTimeZone || 'UTC';
  const isAllDay = !!(event.isAllDay || event.start.isAllDay);
  const dateLabel = format(toZonedTime(new Date(event.start.dateTime), timezone), 'EEE, MMM d');
  const timing = isAllDay
    ? `${dateLabel} · All day`
    : `${dateLabel} · ${formatTime(event.start.dateTime, timezone)} – ${formatTime(event.end.dateTime, timezone)}`;

  return (
    <div
      className="fixed inset-0 bg-black/25 flex items-center justify-center p-6 z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-white rounded-xl shadow-lg p-[22px] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-3 h-3 rounded-[3px] flex-shrink-0"
              style={{ backgroundColor: getCalendarColor(event.calendarId) }}
            />
            <h3 className="text-[17px] font-bold text-ucv-text m-0">{event.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 text-ucv-text-muted hover:opacity-60 transition-opacity flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Time + calendar */}
          <div className="flex gap-2.5 items-start">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="9"></circle>
              <polyline points="12 7 12 12 15 15"></polyline>
            </svg>
            <div>
              <div className="text-sm font-semibold text-ucv-text">{timing}</div>
              <div className="text-xs text-ucv-text-faint mt-0.5">{getCalendarName(event.calendarId)}</div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex gap-2.5 items-start min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <div className="text-sm text-ucv-text-secondary break-words min-w-0">{event.location}</div>
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div className="flex gap-2.5 items-start">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path>
              </svg>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-ucv-text-faint uppercase tracking-wide mb-0.5">Organizer</div>
                <div className="text-sm text-ucv-text break-words">{event.organizer.name || event.organizer.email}</div>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex gap-2.5 items-start">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <div className="flex-1">
                <div className="text-[11px] font-bold text-ucv-text-faint uppercase tracking-wide mb-1.5">Attendees</div>
                <div className="flex flex-col gap-1">
                  {event.attendees.map((attendee, index) => (
                    <div key={index} className="text-sm text-ucv-text-secondary break-words">
                      {attendee.name || attendee.email}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="border-t border-ucv-border-light pt-3.5 min-w-0">
              <div className="text-[11px] font-bold text-ucv-text-faint uppercase tracking-wide mb-1.5">Description</div>
              <div className="text-sm text-ucv-text-secondary leading-relaxed break-words">{event.description}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
