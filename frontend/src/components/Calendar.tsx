import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
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

interface CalendarProps {
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  events: Event[];
  selectedCalendars: { [calendarId: string]: boolean };
  selectedUserTimeZone: string;
  onCreateEvent: () => void;
  onEventClick: (event: Event) => void;
}

type ViewMode = 'month' | 'week' | 'day';

const CalendarComponent: React.FC<CalendarProps> = ({
  selectedDate,
  onDateClick,
  events,
  selectedCalendars,
  selectedUserTimeZone,
  onCreateEvent,
  onEventClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(selectedDate);

  const getEventsForDate = (date: Date) => {
    const filteredEvents = events.filter(event => {
      if (event.calendarId && selectedCalendars && !selectedCalendars[event.calendarId]) {
        return false;
      }
      const ianaTZ = selectedUserTimeZone || 'UTC';
      const eventDate = toZonedTime(new Date(event.start.dateTime), ianaTZ);
      return eventDate.toDateString() === date.toDateString();
    });
    return filteredEvents;
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

  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
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
           value={currentDate}
          tileClassName={({ date }) => {
            const eventsForDate = getEventsForDate(date);
            const isSelected = isSameDay(date, selectedDate);
            return [
              'min-h-[80px] flex flex-col justify-between p-2 rounded-lg transition-all cursor-pointer',
              eventsForDate.length > 0 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200' : '',
              isSelected ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-50',
            ].join(' ');
          }}

                     tileContent={({ date }) => {
             const eventsForDate = getEventsForDate(date);
             return eventsForDate.length > 0 ? (
               <div className="flex items-center justify-center mt-1">
                 <div 
                   className="w-2 h-2 bg-blue-500 rounded-full"
                   title={`${eventsForDate.length} event${eventsForDate.length > 1 ? 's' : ''}`}
                 />
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
          className="w-full border-0 shadow-none"
        />
      </div>
    </div>
  );

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const timeSlots = getTimeSlots();

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
          <div className="min-w-[800px]">
            {/* Header with day names */}
            <div className="grid grid-cols-8 border-b border-gray-200">
              <div className="p-4 border-r border-gray-200 bg-gray-50"></div>
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className={`p-4 text-center border-r border-gray-200 ${
                    isSameDay(day, selectedDate) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-600">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-lg font-bold ${
                    isSameDay(day, selectedDate) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Time slots */}
            {timeSlots.map((time, timeIndex) => (
              <div key={time} className="grid grid-cols-8 border-b border-gray-100">
                <div className="p-2 text-xs text-gray-500 border-r border-gray-200 bg-gray-50">
                  {time}
                </div>
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = getEventsForDate(day).filter(event => {
                    if (event.isAllDay) return false;
                    const eventHour = new Date(event.start.dateTime).getHours();
                    return eventHour === timeIndex;
                  });
                  
                  return (
                    <div key={dayIndex} className="p-1 border-r border-gray-200 min-h-[60px]">
                                             {dayEvents.map((event, eventIndex) => (
                         <div
                           key={eventIndex}
                           className="text-xs p-1 bg-blue-100 text-blue-800 rounded mb-1 truncate cursor-pointer hover:bg-blue-200 transition-colors"
                           title={event.title}
                           onClick={() => {
                             onEventClick(event);
                           }}
                         >
                           {event.title}
                         </div>
                       ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const timeSlots = getTimeSlots();
    const dayEvents = getEventsForDate(currentDate);

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
          <div className="space-y-4">
            {timeSlots.map((time, index) => {
              const hourEvents = dayEvents.filter(event => {
                if (event.isAllDay) return false;
                const eventHour = new Date(event.start.dateTime).getHours();
                return eventHour === index;
              });
              
              return (
                <div key={time} className="flex">
                  <div className="w-20 text-sm text-gray-500 font-medium pt-2">
                    {time}
                  </div>
                  <div className="flex-1 border-l border-gray-200 pl-4 pt-2 min-h-[60px]">
                                         {hourEvents.map((event, eventIndex) => (
                                               <div
                          key={eventIndex}
                          className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={() => {
                            onEventClick(event);
                          }}
                        >
                         <div className="font-medium text-blue-900">{event.title}</div>
                         <div className="text-sm text-blue-700">
                           {format(new Date(event.start.dateTime), 'HH:mm')} - {format(new Date(event.end.dateTime), 'HH:mm')}
                         </div>
                       </div>
                     ))}
                  </div>
                </div>
              );
            })}
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
