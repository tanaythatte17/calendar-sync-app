import React, { useState, useEffect, useCallback} from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

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

interface TimeZoneOption {
  label: string;
  value: string;
}

interface CalendarProps {
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  events: Event[];
  selectedCalendars: { [calendarId: string]: boolean };
  selectedUserTimeZone: string;
  onCreateEvent: () => void;
  onEventClick: (event: Event) => void;
  accounts: CalendarAccount[];
  loading?: boolean;
  onViewDateChange?: (date: Date) => void;
  userTimeZones: TimeZoneOption[];
  onTimezoneChange: (tz: string) => void;
  onTimezoneSave: () => void;
  tzSaveStatus: string | null;
}

type ViewMode = 'month' | 'week' | 'day';

interface EventLayout {
  event: Event;
  startPosition: number;
  endPosition: number;
  column: number;
  totalColumns: number;
  width: number;
  left: number;
}

const MAX_EVENTS_PER_DAY = 3;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CalendarComponent: React.FC<CalendarProps> = ({
  selectedDate,
  events,
  selectedCalendars,
  selectedUserTimeZone,
  onCreateEvent,
  onEventClick,
  accounts,
  onViewDateChange,
  userTimeZones,
  onTimezoneChange,
  onTimezoneSave,
  tzSaveStatus
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [navigationLoading, setNavigationLoading] = useState(false);

  useEffect(() => {
    onViewDateChange?.(currentDate);
  }, [currentDate, onViewDateChange]);

  // Handle navigation with proper loading - throttled to prevent rapid clicks
  const navigateDate = useCallback(async (direction: 'prev' | 'next') => {
    if (navigationLoading) return;

    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }

    setCurrentDate(newDate);

    setTimeout(() => setNavigationLoading(false), 500);
  }, [currentDate, viewMode, navigationLoading]);

  // Function to get calendar color for an event
  const getCalendarColor = (event: Event): string => {
    const account = accounts.find(acc =>
      acc.id === event.calendarAccountId ||
      acc._id === event.calendarAccountId
    );

    if (!account?.calendarList) {
      return '#5B6E3A';
    }

    const calendar = account.calendarList.find(cal =>
      cal.calendarId === event.calendarId
    );

    return calendar?.color || '#5B6E3A';
  };

  // Function to generate CSS classes based on calendar color
  const getEventColorClasses = (event: Event, isHover: boolean = false) => {
    const color = getCalendarColor(event);

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 91, g: 110, b: 58 };
    };

    const rgb = hexToRgb(color);

    return {
      backgroundColor: isHover
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`
        : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
      borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
      color: `rgb(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)})`,
      hoverBackgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
    };
  };

  const getEventsForDate = useCallback((date: Date) => {
    const filteredEvents = events.filter(event => {
      if (event.calendarId && selectedCalendars && !selectedCalendars[event.calendarId]) {
        return false;
      }

      const ianaTZ = selectedUserTimeZone || 'UTC';

      if (event.isAllDay || event.start.isAllDay) {
        const eventStartDate = new Date(event.start.dateTime);
        const eventDateString = format(eventStartDate, 'yyyy-MM-dd');
        const targetDateString = format(date, 'yyyy-MM-dd');
        return eventDateString === targetDateString;
      }

      const eventStartInUserTZ = formatInTimeZone(
        new Date(event.start.dateTime),
        ianaTZ,
        'yyyy-MM-dd'
      );
      const targetDateString = format(date, 'yyyy-MM-dd');

      return eventStartInUserTZ === targetDateString;
    });
    return filteredEvents;
  }, [events, selectedCalendars, selectedUserTimeZone]);

  const formatEventTimeInUserTimeZone = (dateTime: string, formatStr: string = 'HH:mm') => {
    const ianaTZ = selectedUserTimeZone || 'UTC';
    return formatInTimeZone(new Date(dateTime), ianaTZ, formatStr);
  };

  // Calculate event layouts with proper overlap handling
  const calculateEventLayouts = (events: Event[], hourHeight: number = 80): EventLayout[] => {
    if (events.length === 0) return [];

    const ianaTZ = selectedUserTimeZone || 'UTC';

    const eventData = events.map(event => {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

      const startHour = parseInt(formatInTimeZone(eventStart, ianaTZ, 'HH'), 10);
      const startMinute = parseInt(formatInTimeZone(eventStart, ianaTZ, 'mm'), 10);
      const endHour = parseInt(formatInTimeZone(eventEnd, ianaTZ, 'HH'), 10);
      const endMinute = parseInt(formatInTimeZone(eventEnd, ianaTZ, 'mm'), 10);

      const startPosition = startHour * hourHeight + (startMinute / 60) * hourHeight;
      const endPosition = endHour * hourHeight + (endMinute / 60) * hourHeight;

      return {
        event,
        startPosition,
        endPosition,
        column: 0,
        totalColumns: 1,
        width: 100,
        left: 0
      };
    });

    eventData.sort((a, b) => {
      if (a.startPosition === b.startPosition) {
        return (b.endPosition - b.startPosition) - (a.endPosition - a.startPosition);
      }
      return a.startPosition - b.startPosition;
    });

    const columns: EventLayout[][] = [];

    for (const eventLayout of eventData) {
      let placed = false;

      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        const hasOverlap = column.some(existing =>
          eventLayout.startPosition < existing.endPosition &&
          eventLayout.endPosition > existing.startPosition
        );

        if (!hasOverlap) {
          column.push(eventLayout);
          eventLayout.column = i;
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([eventLayout]);
        eventLayout.column = columns.length - 1;
      }
    }

    const layouts: EventLayout[] = [];

    for (const eventLayout of eventData) {
      const overlappingEvents = eventData.filter(other =>
        other !== eventLayout &&
        eventLayout.startPosition < other.endPosition &&
        eventLayout.endPosition > other.startPosition
      );

      const maxOverlapColumn = overlappingEvents.reduce((max, other) =>
        Math.max(max, other.column), eventLayout.column
      );

      const actualColumns = maxOverlapColumn + 1;
      const columnWidth = 100 / actualColumns;

      eventLayout.totalColumns = actualColumns;
      eventLayout.width = columnWidth - 1;
      eventLayout.left = eventLayout.column * columnWidth;

      layouts.push(eventLayout);
    }

    return layouts;
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const getMonthWeeks = useCallback(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [currentDate]);

  // Loading overlay component
  const LoadingOverlay = ({ show }: { show: boolean }) => {
    if (!show) return null;

    return (
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-ucv-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-ucv-text-secondary">Loading events...</span>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const weeks = getMonthWeeks();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    return (
      <div className="bg-white rounded-xl border border-ucv-border overflow-hidden relative">
        <LoadingOverlay show={navigationLoading} />

        <div className="grid grid-cols-7 bg-ucv-surface border-b border-ucv-border">
          {WEEKDAY_LABELS.map(wd => (
            <div key={wd} className="py-2.5 px-2 text-center text-xs font-bold text-ucv-text-faint uppercase tracking-wide">
              {wd}
            </div>
          ))}
        </div>

        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-ucv-border-light last:border-b-0">
            {week.map((day, dayIndex) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const muted = day.getMonth() !== currentDate.getMonth();
              const isToday = dayStr === todayStr;
              const dayEvents = getEventsForDate(day);
              const visibleEvents = dayEvents.slice(0, MAX_EVENTS_PER_DAY);
              const overflowCount = dayEvents.length - visibleEvents.length;

              return (
                <div
                  key={dayIndex}
                  onClick={() => {
                    if (navigationLoading) return;
                    setCurrentDate(day);
                    setViewMode('day');
                  }}
                  className={`min-h-[112px] p-2 border-r border-ucv-border-light last:border-r-0 cursor-pointer hover:bg-ucv-surface transition-colors ${muted ? 'bg-[#F7F6F2]' : 'bg-white'}`}
                >
                  <div className="flex justify-end mb-1.5">
                    <span
                      className={`w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs ${
                        isToday
                          ? 'bg-ucv-primary text-white font-bold'
                          : muted
                          ? 'text-ucv-text-disabled font-medium'
                          : 'text-ucv-text-secondary font-medium'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    {visibleEvents.map(ev => (
                      <div
                        key={ev._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        className="text-white text-[11px] font-semibold px-1.5 py-[3px] rounded truncate cursor-pointer"
                        style={{ backgroundColor: getCalendarColor(ev) }}
                      >
                        {!(ev.isAllDay || ev.start.isAllDay) && `${formatEventTimeInUserTimeZone(ev.start.dateTime)} `}
                        {ev.title}
                      </div>
                    ))}
                    {overflowCount > 0 && (
                      <div className="text-ucv-text-muted text-[11px] font-semibold px-1.5">
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const hourHeight = 60;

    return (
      <div className="bg-white rounded-xl border border-ucv-border overflow-hidden relative">
        <LoadingOverlay show={navigationLoading} />

        <div className="overflow-x-auto">
          <div className="min-w-[800px] relative">
            <div className="grid grid-cols-8 border-b border-ucv-border relative z-20 bg-white">
              <div className="p-4 border-r border-ucv-border bg-ucv-surface"></div>
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className="p-4 text-center border-r border-ucv-border bg-ucv-surface"
                >
                  <div className="text-sm font-medium text-ucv-text-secondary">
                    {format(day, 'EEE')}
                  </div>
                  <div className="text-lg font-bold text-ucv-text">
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative">
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-ucv-border-light" style={{ height: `${hourHeight}px` }}>
                  <div className="p-2 text-xs text-ucv-text-muted border-r border-ucv-border bg-ucv-surface">
                    {`${hour.toString().padStart(2, '0')}:00`}
                  </div>
                  {weekDays.map((_, dayIndex) => (
                    <div key={dayIndex} className="border-r border-ucv-border relative">
                      <div className="absolute top-1/2 left-0 w-full border-t border-ucv-border-light" style={{ opacity: 0.3 }}></div>
                    </div>
                  ))}
                </div>
              ))}

              {weekDays.map((day, dayIndex) => {
                const dayEvents = getEventsForDate(day).filter(event => !(event.isAllDay || event.start.isAllDay));
                const eventLayouts = calculateEventLayouts(dayEvents, hourHeight);

                const columnWidth = `calc((100% - ${100/8}%) / 7)`;
                const leftOffset = `calc(${100/8}% + ${dayIndex} * ${columnWidth})`;

                return (
                  <div key={dayIndex} className="absolute top-0" style={{ left: leftOffset, width: columnWidth }}>
                    {eventLayouts.map((layout, layoutIndex) => {
                      const { event, startPosition, endPosition, width, left } = layout;
                      const height = Math.max(endPosition - startPosition, 30);

                      const colorClasses = getEventColorClasses(event);

                      const showTitle = width > 25;
                      const showTime = height > 40 && width > 30;

                      return (
                        <div
                          key={`${event._id}-${layoutIndex}`}
                          className="absolute p-1 rounded text-xs cursor-pointer transition-colors shadow-sm border overflow-hidden"
                          style={{
                            top: `${startPosition}px`,
                            height: `${height}px`,
                            minHeight: '30px',
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: colorClasses.backgroundColor,
                            borderColor: colorClasses.borderColor,
                            color: colorClasses.color
                          }}
                          title={`${event.title} - ${formatEventTimeInUserTimeZone(event.start.dateTime)} to ${formatEventTimeInUserTimeZone(event.end.dateTime)}`}
                          onClick={() => onEventClick(event)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colorClasses.hoverBackgroundColor;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = colorClasses.backgroundColor;
                          }}
                        >
                          {showTitle && (
                            <div className="font-medium truncate text-xs leading-tight">
                              {event.title}
                            </div>
                          )}
                          {showTime && (
                            <div className="text-xs opacity-80 truncate">
                              {formatEventTimeInUserTimeZone(event.start.dateTime)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const timedEvents = dayEvents.filter(event => !(event.isAllDay || event.start.isAllDay));

    const eventLayouts = calculateEventLayouts(timedEvents, 80);

    return (
      <div className="bg-white rounded-xl border border-ucv-border overflow-hidden relative">
        <LoadingOverlay show={navigationLoading} />

        <div className="p-6">
          {dayEvents.some(event => event.isAllDay || event.start.isAllDay) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-ucv-text-muted mb-3">All Day</h3>
              <div className="space-y-2">
                {dayEvents
                  .filter(event => event.isAllDay || event.start.isAllDay)
                  .map((event, eventIndex) => {
                    const colorClasses = getEventColorClasses(event);
                    return (
                      <div
                        key={eventIndex}
                        className="p-3 border rounded-lg cursor-pointer transition-colors"
                        style={{
                          backgroundColor: colorClasses.backgroundColor,
                          borderColor: colorClasses.borderColor,
                          color: colorClasses.color
                        }}
                        onClick={() => onEventClick(event)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colorClasses.hoverBackgroundColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colorClasses.backgroundColor;
                        }}
                      >
                        <div className="font-medium">{event.title}</div>
                        {event.location && (
                          <div className="text-sm opacity-70">{event.location}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="flex border-b border-ucv-border-light relative" style={{ height: '80px' }}>
                <div className="w-20 text-sm text-ucv-text-muted font-medium pt-2">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>
                <div className="flex-1 border-l border-ucv-border relative">
                  <div className="absolute left-0 w-full border-t border-ucv-border-light" style={{ top: '40px', opacity: 0.5 }}></div>
                  <div className="absolute left-0 w-4 border-t border-ucv-border" style={{ top: '20px', opacity: 0.3 }}></div>
                  <div className="absolute left-0 w-4 border-t border-ucv-border" style={{ top: '60px', opacity: 0.3 }}></div>
                </div>
              </div>
            ))}

            <div className="absolute top-0 right-0" style={{ left: '80px' }}>
              {eventLayouts.map((layout, layoutIndex) => {
                const { event, startPosition, endPosition, width, left } = layout;
                const actualHeight = endPosition - startPosition;
                const displayHeight = Math.max(actualHeight, 30);

                const eventStart = new Date(event.start.dateTime);
                const eventEnd = new Date(event.end.dateTime);
                const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
                const isShortEvent = durationMinutes <= 30;

                const colorClasses = getEventColorClasses(event);

                return (
                  <div
                    key={`${event._id}-${layoutIndex}`}
                    className="absolute p-2 rounded-lg cursor-pointer transition-all duration-200 z-10 shadow-sm border"
                    style={{
                      top: `${startPosition}px`,
                      height: `${displayHeight}px`,
                      minHeight: '30px',
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: colorClasses.backgroundColor,
                      borderColor: colorClasses.borderColor,
                      color: colorClasses.color
                    }}
                    title={`${event.title} (${Math.round(durationMinutes)} min) - ${formatEventTimeInUserTimeZone(event.start.dateTime)} to ${formatEventTimeInUserTimeZone(event.end.dateTime)}`}
                    onClick={() => onEventClick(event)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colorClasses.hoverBackgroundColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = colorClasses.backgroundColor;
                    }}
                  >
                    <div className="font-medium text-sm truncate">
                      {event.title}
                    </div>
                    <div className="text-xs opacity-80">
                      {formatEventTimeInUserTimeZone(event.start.dateTime)} - {formatEventTimeInUserTimeZone(event.end.dateTime)}
                      {isShortEvent && ` (${Math.round(durationMinutes)}m)`}
                    </div>
                    {event.location && displayHeight > 50 && (
                      <div className="text-xs mt-1 truncate opacity-60">
                        {event.location}
                      </div>
                    )}
                    {actualHeight < displayHeight && (
                      <div
                        className="absolute left-0 right-0 opacity-20"
                        style={{
                          bottom: '0',
                          height: `${actualHeight}px`,
                          backgroundColor: colorClasses.borderColor
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const headerLabel = viewMode === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : viewMode === 'week'
    ? `${format(getWeekDays()[0], 'MMM d')} - ${format(getWeekDays()[6], 'MMM d, yyyy')}`
    : format(currentDate, 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-ucv-text flex-shrink-0">{headerLabel}</h2>

        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => navigateDate('prev')}
            disabled={navigationLoading}
            className="w-[30px] h-[30px] border border-ucv-border bg-white rounded-lg flex items-center justify-center hover:border-ucv-text-disabled transition-colors disabled:opacity-50"
          >
            <FaChevronLeft className="w-3.5 h-3.5 text-ucv-text-secondary" />
          </button>
          <button
            onClick={() => navigateDate('next')}
            disabled={navigationLoading}
            className="w-[30px] h-[30px] border border-ucv-border bg-white rounded-lg flex items-center justify-center hover:border-ucv-text-disabled transition-colors disabled:opacity-50"
          >
            <FaChevronRight className="w-3.5 h-3.5 text-ucv-text-secondary" />
          </button>
        </div>

        <button
          onClick={() => setCurrentDate(new Date())}
          disabled={navigationLoading}
          className="px-3.5 py-1.5 border border-ucv-border bg-white rounded-lg text-sm font-semibold text-ucv-text-secondary hover:border-ucv-text-disabled transition-colors flex-shrink-0 disabled:opacity-50"
        >
          Today
        </button>

        <div className="flex gap-0.5 bg-ucv-border-light rounded-lg p-[3px] flex-shrink-0">
          <button
            onClick={() => { if (!navigationLoading) setViewMode('month'); }}
            disabled={navigationLoading}
            className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              viewMode === 'month' ? 'bg-white text-ucv-text shadow-sm' : 'text-ucv-text-muted'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => { if (!navigationLoading) setViewMode('week'); }}
            disabled={navigationLoading}
            className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              viewMode === 'week' ? 'bg-white text-ucv-text shadow-sm' : 'text-ucv-text-muted'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => { if (!navigationLoading) setViewMode('day'); }}
            disabled={navigationLoading}
            className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              viewMode === 'day' ? 'bg-white text-ucv-text shadow-sm' : 'text-ucv-text-muted'
            }`}
          >
            Day
          </button>
        </div>

        <button
          onClick={onCreateEvent}
          className="flex items-center gap-1.5 bg-ucv-primary text-white px-3.5 py-2 rounded-lg text-sm font-semibold hover:bg-ucv-primary-hover transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create Event
        </button>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <label htmlFor="user-timezone-select" className="sr-only">Timezone</label>
          <select
            id="user-timezone-select"
            value={selectedUserTimeZone}
            onChange={e => onTimezoneChange(e.target.value)}
            className="bg-white text-ucv-text rounded-lg border border-ucv-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ucv-primary-light focus:border-ucv-primary transition-all duration-200"
          >
            {userTimeZones.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          <button
            onClick={onTimezoneSave}
            className="px-3 py-2 bg-ucv-primary text-white rounded-lg hover:bg-ucv-primary-hover transition-all text-xs font-semibold"
          >
            Save
          </button>
          {tzSaveStatus && <span className="text-xs text-ucv-green">{tzSaveStatus}</span>}
        </div>
      </div>

      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
    </div>
  );
};

export default CalendarComponent;
