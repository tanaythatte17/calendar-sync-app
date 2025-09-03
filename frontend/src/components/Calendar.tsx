import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
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

interface CalendarProps {
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  events: Event[];
  selectedCalendars: { [calendarId: string]: boolean };
  selectedUserTimeZone: string;
  onCreateEvent: () => void;
  onEventClick: (event: Event) => void;
  accounts: CalendarAccount[];
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

const CalendarComponent: React.FC<CalendarProps> = ({
  selectedDate,
  onDateClick,
  events,
  selectedCalendars,
  selectedUserTimeZone,
  onCreateEvent,
  onEventClick,
  accounts
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(selectedDate);

  // Function to get calendar color for an event
  const getCalendarColor = (event: Event): string => {
    // Find the account that owns this event
    const account = accounts.find(acc => 
      acc.id === event.calendarAccountId || 
      acc._id === event.calendarAccountId
    );
    
    if (!account?.calendarList) {
      return '#3B82F6'; // Default blue if no calendar found
    }

    // Find the specific calendar within the account
    const calendar = account.calendarList.find(cal => 
      cal.calendarId === event.calendarId
    );
    
    return calendar?.color || '#3B82F6'; // Default blue if no color specified
  };

  // Function to generate CSS classes based on calendar color
  const getEventColorClasses = (event: Event, isHover: boolean = false) => {
    const color = getCalendarColor(event);
    
    // Convert hex color to RGB for dynamic styling
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 59, g: 130, b: 246 }; // Default blue
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

  const getEventsForDate = (date: Date) => {
    const filteredEvents = events.filter(event => {
      if (event.calendarId && selectedCalendars && !selectedCalendars[event.calendarId]) {
        return false;
      }
      
      const ianaTZ = selectedUserTimeZone || 'UTC';
      
      // Handle all-day events
      if (event.isAllDay || event.start.isAllDay) {
        // For all-day events, just compare the date part
        const eventStartDate = new Date(event.start.dateTime);
        const eventDateString = format(eventStartDate, 'yyyy-MM-dd');
        const targetDateString = format(date, 'yyyy-MM-dd');
        return eventDateString === targetDateString;
      }
      
      // For timed events, convert to user timezone and compare dates
      const eventStartInUserTZ = formatInTimeZone(
        new Date(event.start.dateTime), 
        ianaTZ, 
        'yyyy-MM-dd'
      );
      const targetDateString = format(date, 'yyyy-MM-dd');
      
      return eventStartInUserTZ === targetDateString;
    });
    return filteredEvents;
  };

  const formatEventTimeInUserTimeZone = (dateTime: string, formatStr: string = 'HH:mm') => {
    const ianaTZ = selectedUserTimeZone || 'UTC';
    return formatInTimeZone(new Date(dateTime), ianaTZ, formatStr);
  };

  // Function to calculate event layouts with overlap handling
  const calculateEventLayouts = (events: Event[]): EventLayout[] => {
    if (events.length === 0) return [];

    const ianaTZ = selectedUserTimeZone || 'UTC';
    
    // Convert events to layout objects with time positions
    const eventData = events.map(event => {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      
      const startHour = parseInt(formatInTimeZone(eventStart, ianaTZ, 'HH'), 10);
      const startMinute = parseInt(formatInTimeZone(eventStart, ianaTZ, 'mm'), 10);
      const endHour = parseInt(formatInTimeZone(eventEnd, ianaTZ, 'HH'), 10);
      const endMinute = parseInt(formatInTimeZone(eventEnd, ianaTZ, 'mm'), 10);
      
      const startPosition = startHour * 80 + (startMinute / 60) * 80;
      const endPosition = endHour * 80 + (endMinute / 60) * 80;
      
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

    // Sort by start time
    eventData.sort((a, b) => a.startPosition - b.startPosition);

    // Group overlapping events
    const groups: EventLayout[][] = [];
    
    for (const eventLayout of eventData) {
      let placedInGroup = false;
      
      // Try to find an existing group where this event overlaps
      for (const group of groups) {
        const hasOverlap = group.some(existing => 
          eventLayout.startPosition < existing.endPosition && 
          eventLayout.endPosition > existing.startPosition
        );
        
        if (hasOverlap) {
          group.push(eventLayout);
          placedInGroup = true;
          break;
        }
      }
      
      // If no overlap found, create a new group
      if (!placedInGroup) {
        groups.push([eventLayout]);
      }
    }

    // Calculate columns for each group
    const layouts: EventLayout[] = [];
    
    for (const group of groups) {
      if (group.length === 1) {
        // Single event - takes full width
        layouts.push({
          ...group[0],
          column: 0,
          totalColumns: 1,
          width: 100,
          left: 0
        });
      } else {
        // Multiple overlapping events - need to arrange in columns
        const sortedGroup = group.sort((a, b) => a.startPosition - b.startPosition);
        const columns: EventLayout[][] = [];
        
        for (const eventLayout of sortedGroup) {
          let placedInColumn = false;
          
          // Try to place in existing column
          for (let colIndex = 0; colIndex < columns.length; colIndex++) {
            const column = columns[colIndex];
            const canPlaceInColumn = !column.some(existing => 
              eventLayout.startPosition < existing.endPosition && 
              eventLayout.endPosition > existing.startPosition
            );
            
            if (canPlaceInColumn) {
              column.push(eventLayout);
              eventLayout.column = colIndex;
              placedInColumn = true;
              break;
            }
          }
          
          // Create new column if needed
          if (!placedInColumn) {
            const newColumnIndex = columns.length;
            columns.push([eventLayout]);
            eventLayout.column = newColumnIndex;
          }
        }
        
        // Set layout properties
        const totalColumns = columns.length;
        const columnWidth = 100 / totalColumns;
        
        for (const eventLayout of group) {
          eventLayout.totalColumns = totalColumns;
          eventLayout.width = columnWidth;
          eventLayout.left = eventLayout.column * columnWidth;
          layouts.push(eventLayout);
        }
      }
    }

    return layouts;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const renderMonthView = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              Today
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
            >
              <FaChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <Calendar
          onChange={(date) => {
            // In month view, clicking a date should switch to day view
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
    const hourHeight = 60; // Height for each hour in pixels

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('month')}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
              >
                ← Month View
              </button>
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
              >
                <FaChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              >
                This Week
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
              >
                <FaChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[800px] relative">
            {/* Header with day names */}
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
            
            {/* Time grid background */}
            <div className="relative">
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-gray-100" style={{ height: `${hourHeight}px` }}>
                  <div className="p-2 text-xs text-gray-500 border-r border-gray-200 bg-gray-50">
                    {`${hour.toString().padStart(2, '0')}:00`}
                  </div>
                  {weekDays.map((_, dayIndex) => (
                    <div key={dayIndex} className="border-r border-gray-200 relative">
                      {/* 30-minute marker */}
                      <div className="absolute top-1/2 left-0 w-full border-t border-gray-100" style={{ opacity: 0.3 }}></div>
                    </div>
                  ))}
                </div>
              ))}
              
              {/* Events positioned absolutely with overlap handling */}
              {weekDays.map((day, dayIndex) => {
                const dayEvents = getEventsForDate(day).filter(event => !(event.isAllDay || event.start.isAllDay));
                const columnWidth = `calc((100% - ${100/8}%) / 7)`; // Account for time column
                const leftOffset = `calc(${100/8}% + ${dayIndex} * ${columnWidth})`;
                
                // Calculate overlapping event layouts for this day
                const ianaTZ = selectedUserTimeZone || 'UTC';
                const eventData = dayEvents.map(event => {
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
                    totalColumns: 1
                  };
                });

                // Sort by start time
                eventData.sort((a, b) => a.startPosition - b.startPosition);

                // Group overlapping events
                const groups: typeof eventData[] = [];
                
                for (const eventLayout of eventData) {
                  let placedInGroup = false;
                  
                  // Try to find an existing group where this event overlaps
                  for (const group of groups) {
                    const hasOverlap = group.some(existing => 
                      eventLayout.startPosition < existing.endPosition && 
                      eventLayout.endPosition > existing.startPosition
                    );
                    
                    if (hasOverlap) {
                      group.push(eventLayout);
                      placedInGroup = true;
                      break;
                    }
                  }
                  
                  // If no overlap found, create a new group
                  if (!placedInGroup) {
                    groups.push([eventLayout]);
                  }
                }

                // Calculate columns for each group
                for (const group of groups) {
                  if (group.length > 1) {
                    // Multiple overlapping events - arrange in columns
                    const sortedGroup = group.sort((a, b) => a.startPosition - b.startPosition);
                    const columns: typeof eventData[][] = [];
                    
                    for (const eventLayout of sortedGroup) {
                      let placedInColumn = false;
                      
                      // Try to place in existing column
                      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                        const column = columns[colIndex];
                        const canPlaceInColumn = !column.some(existing => 
                          eventLayout.startPosition < existing.endPosition && 
                          eventLayout.endPosition > existing.startPosition
                        );
                        
                        if (canPlaceInColumn) {
                          column.push(eventLayout);
                          eventLayout.column = colIndex;
                          placedInColumn = true;
                          break;
                        }
                      }
                      
                      // Create new column if needed
                      if (!placedInColumn) {
                        const newColumnIndex = columns.length;
                        columns.push([eventLayout]);
                        eventLayout.column = newColumnIndex;
                      }
                    }
                    
                    // Set layout properties
                    const totalColumns = columns.length;
                    for (const eventLayout of group) {
                      eventLayout.totalColumns = totalColumns;
                    }
                  }
                }
                
                return (
                  <div key={dayIndex} className="absolute top-0" style={{ left: leftOffset, width: columnWidth }}>
                    {eventData.map((eventLayout, eventIndex) => {
                      const { event, startPosition, endPosition, column, totalColumns } = eventLayout;
                      const height = Math.max(endPosition - startPosition, 30); // Minimum height of 30px
                      
                      // Calculate width and position based on overlapping
                      const eventWidth = totalColumns > 1 ? (100 / totalColumns) - 2 : 98; // Subtract 2% for spacing
                      const eventLeft = totalColumns > 1 ? (column * (100 / totalColumns)) + 1 : 1; // Add 1% for spacing
                      
                      const colorClasses = getEventColorClasses(event);
                      
                      // Determine if we should show text based on width
                      const showTitle = eventWidth > 25; // Show title if width is more than 25%
                      const showTime = height > 40 && eventWidth > 40; // Show time if height > 40px and width > 40%
                      
                      return (
                        <div
                          key={eventIndex}
                          className="absolute p-1 rounded text-xs cursor-pointer transition-colors shadow-sm border overflow-hidden"
                          style={{
                            top: `${startPosition}px`,
                            height: `${height}px`,
                            minHeight: '30px',
                            left: `${eventLeft}%`,
                            width: `${eventWidth}%`,
                            backgroundColor: colorClasses.backgroundColor,
                            borderColor: colorClasses.borderColor,
                            color: colorClasses.color
                          }}
                          title={`${event.title} - ${formatEventTimeInUserTimeZone(event.start.dateTime)} to ${formatEventTimeInUserTimeZone(event.end.dateTime)}`}
                          onClick={() => {
                            onEventClick(event);
                          }}
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
    
    // Calculate layouts for overlapping events
    const eventLayouts = calculateEventLayouts(timedEvents);

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('month')}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
              >
                ← Month View
              </button>
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
              >
                <FaChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              >
                Today
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
              >
                <FaChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {/* All-day events section */}
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
                        onClick={() => {
                          onEventClick(event);
                        }}
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
          
          {/* Timed events - continuous timeline */}
          <div className="relative">
            {/* Hour markers */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="flex border-b border-gray-100 relative" style={{ height: '80px' }}>
                <div className="w-20 text-sm text-gray-500 font-medium pt-2">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>
                <div className="flex-1 border-l border-gray-200 relative">
                  {/* 30-minute marker */}
                  <div className="absolute left-0 w-full border-t border-gray-100" style={{ top: '40px', opacity: 0.5 }}></div>
                  {/* 15-minute markers */}
                  <div className="absolute left-0 w-4 border-t border-gray-200" style={{ top: '20px', opacity: 0.3 }}></div>
                  <div className="absolute left-0 w-4 border-t border-gray-200" style={{ top: '60px', opacity: 0.3 }}></div>
                </div>
              </div>
            ))}
            
            {/* Events positioned absolutely with overlap handling */}
            <div className="absolute top-0 right-0" style={{ left: '80px' }}>
              {eventLayouts.map((layout, layoutIndex) => {
                const { event, startPosition, endPosition, width, left } = layout;
                const actualHeight = endPosition - startPosition;
                const displayHeight = Math.max(actualHeight, 30); // Minimum height for readability
                
                // Calculate duration in minutes for styling decisions
                const eventStart = new Date(event.start.dateTime);
                const eventEnd = new Date(event.end.dateTime);
                const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
                const isShortEvent = durationMinutes <= 30;
                
                const colorClasses = getEventColorClasses(event);
                
                return (
                  <div
                    key={layoutIndex}
                    className="absolute p-2 rounded-lg cursor-pointer transition-all duration-200 z-10 shadow-sm border"
                    style={{
                      top: `${startPosition}px`,
                      height: `${displayHeight}px`,
                      minHeight: '30px',
                      left: `${left}%`,
                      width: `${width - 1}%`, // Subtract 1% for spacing between overlapping events
                      marginRight: '1%',
                      backgroundColor: colorClasses.backgroundColor,
                      borderColor: colorClasses.borderColor,
                      color: colorClasses.color
                    }}
                    title={`${event.title} (${Math.round(durationMinutes)} min) - ${formatEventTimeInUserTimeZone(event.start.dateTime)} to ${formatEventTimeInUserTimeZone(event.end.dateTime)}`}
                    onClick={() => {
                      onEventClick(event);
                    }}
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
                    {/* Visual indicator for actual vs display height */}
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
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('month')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'month' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
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

      {/* Calendar View */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
    </div>
  );
};

export default CalendarComponent;