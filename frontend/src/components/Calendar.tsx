import React, { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths, isAfter, isBefore } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { FaChevronLeft, FaChevronRight, FaCalendar, FaList, FaCalendarWeek } from 'react-icons/fa';

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

interface DateRange {
  start: Date;
  end: Date;
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
  onLoadEvents: (startDate: Date, endDate: Date) => Promise<Event[]>;
  loading?: boolean;
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

interface LoadedRange {
  start: Date;
  end: Date;
  events: Event[];
}

const CalendarComponent: React.FC<CalendarProps> = ({
  selectedDate,
  onDateClick,
  events: initialEvents,
  selectedCalendars,
  selectedUserTimeZone,
  onCreateEvent,
  onEventClick,
  accounts,
  onLoadEvents,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [loadedRanges, setLoadedRanges] = useState<LoadedRange[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>(initialEvents);
  const [isLoading, setIsLoading] = useState(false);
  const [navigationLoading, setNavigationLoading] = useState(false);

  // Calculate buffer ranges for different view modes
  const getBufferMonths = (mode: ViewMode): number => {
    switch (mode) {
      case 'month': return 2;
      case 'week': return 1;
      case 'day': return 1;
      default: return 2;
    }
  };

  // Get required date range for current view
  const getRequiredRange = useCallback((date: Date, mode: ViewMode): DateRange => {
    const bufferMonths = getBufferMonths(mode);
    
    switch (mode) {
      case 'month': {
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        return {
          start: startOfMonth(subMonths(monthStart, bufferMonths)),
          end: endOfMonth(addMonths(monthEnd, bufferMonths))
        };
      }
      case 'week': {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        return {
          start: startOfMonth(subMonths(weekStart, bufferMonths)),
          end: endOfMonth(addMonths(weekEnd, bufferMonths))
        };
      }
      case 'day': {
        return {
          start: startOfMonth(subMonths(date, bufferMonths)),
          end: endOfMonth(addMonths(date, bufferMonths))
        };
      }
      default:
        return {
          start: startOfMonth(subMonths(date, bufferMonths)),
          end: endOfMonth(addMonths(date, bufferMonths))
        };
    }
  }, []);

  // Check if a date range is covered by loaded ranges
  const isRangeCovered = useCallback((requiredRange: DateRange): boolean => {
    return loadedRanges.some(loaded => 
      !isAfter(requiredRange.start, loaded.start) && 
      !isBefore(requiredRange.end, loaded.end)
    );
  }, [loadedRanges]);

  // Load events for a specific date range
  const loadEventsForRange = useCallback(async (range: DateRange, showLoading = true) => {
    if (isRangeCovered(range)) {
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const newEvents = await onLoadEvents(range.start, range.end);
      
      // Merge with existing events, avoiding duplicates
      setAllEvents(prevEvents => {
        const eventMap = new Map(prevEvents.map(event => [event._id, event]));
        newEvents.forEach(event => eventMap.set(event._id, event));
        return Array.from(eventMap.values());
      });

      // Update loaded ranges - merge overlapping ranges
      setLoadedRanges(prevRanges => {
        const newRange: LoadedRange = {
          start: range.start,
          end: range.end,
          events: newEvents
        };

        // Find overlapping ranges to merge
        const overlapping = prevRanges.filter(loaded =>
          !(isAfter(range.start, loaded.end) || isBefore(range.end, loaded.start))
        );

        // Remove overlapping ranges and add merged range
        const nonOverlapping = prevRanges.filter(loaded =>
          isAfter(range.start, loaded.end) || isBefore(range.end, loaded.start)
        );

        if (overlapping.length > 0) {
          const mergedStart = new Date(Math.min(
            range.start.getTime(),
            ...overlapping.map(r => r.start.getTime())
          ));
          const mergedEnd = new Date(Math.max(
            range.end.getTime(),
            ...overlapping.map(r => r.end.getTime())
          ));

          return [...nonOverlapping, {
            start: mergedStart,
            end: mergedEnd,
            events: newEvents
          }];
        }

        return [...nonOverlapping, newRange];
      });
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [onLoadEvents, isRangeCovered]);

  // Check and load data when view or date changes
  useEffect(() => {
    const requiredRange = getRequiredRange(currentDate, viewMode);
    
    if (!isRangeCovered(requiredRange)) {
      // Show navigation loading only for user-initiated navigation
      if (currentDate.getTime() !== selectedDate.getTime()) {
        setNavigationLoading(true);
      }
      
      loadEventsForRange(requiredRange).finally(() => {
        setNavigationLoading(false);
      });
    }
  }, [currentDate, viewMode, getRequiredRange, isRangeCovered, loadEventsForRange, selectedDate]);

  // Initialize with initial events
  useEffect(() => {
    if (initialEvents.length > 0) {
      setAllEvents(initialEvents);
      
      // Create initial loaded range based on initial events
      if (initialEvents.length > 0) {
        const eventDates = initialEvents.map(event => new Date(event.start.dateTime));
        const minDate = new Date(Math.min(...eventDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...eventDates.map(d => d.getTime())));
        
        setLoadedRanges([{
          start: startOfMonth(subMonths(minDate, 1)),
          end: endOfMonth(addMonths(maxDate, 1)),
          events: initialEvents
        }]);
      }
    }
  }, [initialEvents]);

  // Function to get calendar color for an event
  const getCalendarColor = (event: Event): string => {
    const account = accounts.find(acc => 
      acc.id === event.calendarAccountId || 
      acc._id === event.calendarAccountId
    );
    
    if (!account?.calendarList) {
      return '#3B82F6';
    }

    const calendar = account.calendarList.find(cal => 
      cal.calendarId === event.calendarId
    );
    
    return calendar?.color || '#3B82F6';
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
      } : { r: 59, g: 130, b: 246 };
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
    const filteredEvents = allEvents.filter(event => {
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
  }, [allEvents, selectedCalendars, selectedUserTimeZone]);

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

  const navigateDate = async (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    
    setCurrentDate(newDate);
    
    // Check if we need to load more data
    const requiredRange = getRequiredRange(newDate, viewMode);
    if (!isRangeCovered(requiredRange)) {
      setNavigationLoading(true);
      await loadEventsForRange(requiredRange);
      setNavigationLoading(false);
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  // Loading overlay component
  const LoadingOverlay = ({ show }: { show: boolean }) => {
    if (!show) return null;
    
    return (
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-gray-600">Loading events...</span>
        </div>
      </div>
    );
  };

  const renderMonthView = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
      <LoadingOverlay show={navigationLoading || (isLoading && allEvents.length === 0)} />
      
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
              disabled={navigationLoading}
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              disabled={navigationLoading}
            >
              Today
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
              disabled={navigationLoading}
            >
              <FaChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <Calendar
          onChange={(date) => {
            if (viewMode === 'month') {
              setCurrentDate(date as Date);
              setViewMode('day');
            } else {
              onDateClick(date as Date);
            }
          }}
          value={null}
          activeStartDate={currentDate}
          tileClassName={({ date }) => {
            const eventsForDate = getEventsForDate(date);
            return [
              'min-h-[80px] flex flex-col justify-between p-2 rounded-lg transition-all cursor-pointer',
              eventsForDate.length > 0 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200' : '',
              'hover:bg-gray-50',
            ].join(' ');
          }}
          tileContent={({ date }) => {
            const eventsForDate = getEventsForDate(date);
            return eventsForDate.length > 0 ? (
              <div className="flex items-center justify-center mt-1">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: eventsForDate.length === 1 ? getCalendarColor(eventsForDate[0]) : '#3B82F6' }}
                  title={`${eventsForDate.length} event${eventsForDate.length > 1 ? 's' : ''}`}
                />
              </div>
            ) : null;
          }}
          formatShortWeekday={(_, date) => {
            return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
          }}
          prev2Label={null}
          next2Label={null}
          minDetail="month"
          maxDetail="month"
          showNeighboringMonth={false}
          className="w-full border-0 shadow-none"
        />
      </div>
    </div>
  );

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const hourHeight = 60;

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
        <LoadingOverlay show={navigationLoading} />
        
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('month')}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                ← Month View
              </button>
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                <FaChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                This Week
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                <FaChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[800px] relative">
            <div className="grid grid-cols-8 border-b border-gray-200 relative z-20 bg-white">
              <div className="p-4 border-r border-gray-200 bg-gray-50"></div>
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className="p-4 text-center border-r border-gray-200 bg-gray-50"
                >
                  <div className="text-sm font-medium text-gray-600">
                    {format(day, 'EEE')}
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="relative">
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-gray-100" style={{ height: `${hourHeight}px` }}>
                  <div className="p-2 text-xs text-gray-500 border-r border-gray-200 bg-gray-50">
                    {`${hour.toString().padStart(2, '0')}:00`}
                  </div>
                  {weekDays.map((_, dayIndex) => (
                    <div key={dayIndex} className="border-r border-gray-200 relative">
                      <div className="absolute top-1/2 left-0 w-full border-t border-gray-100" style={{ opacity: 0.3 }}></div>
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
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
        <LoadingOverlay show={navigationLoading} />
        
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('month')}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                ← Month View
              </button>
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                <FaChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                Today
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
                disabled={navigationLoading}
              >
                <FaChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {dayEvents.some(event => event.isAllDay || event.start.isAllDay) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">All Day</h3>
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
              <div key={hour} className="flex border-b border-gray-100 relative" style={{ height: '80px' }}>
                <div className="w-20 text-sm text-gray-500 font-medium pt-2">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>
                <div className="flex-1 border-l border-gray-200 relative">
                  <div className="absolute left-0 w-full border-t border-gray-100" style={{ top: '40px', opacity: 0.5 }}></div>
                  <div className="absolute left-0 w-4 border-t border-gray-200" style={{ top: '20px', opacity: 0.3 }}></div>
                  <div className="absolute left-0 w-4 border-t border-gray-200" style={{ top: '60px', opacity: 0.3 }}></div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('month')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'month' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            disabled={navigationLoading}
          >
            <FaCalendar className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'week' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            disabled={navigationLoading}
          >
            <FaCalendarWeek className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'day' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            disabled={navigationLoading}
          >
            <FaList className="w-4 h-4" />
          </button>
        </div>
        
        <button
          onClick={onCreateEvent}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold"
        >
          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
            <span className="text-blue-600 text-lg font-bold">+</span>
          </div>
          Create Event
        </button>
      </div>

      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
    </div>
  );
};

export default CalendarComponent;