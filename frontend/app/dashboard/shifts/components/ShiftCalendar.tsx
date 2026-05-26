'use client';

import { useEffect, useState } from 'react';
import { Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, subMonths, format, isSameMonth, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import type { Shift } from '../types';

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Nurse': { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-300' },
  'Carer': { bg: 'bg-green-50', text: 'text-green-900', border: 'border-green-300' },
  'Support Worker': { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-300' },
  'Healthcare Assistant': { bg: 'bg-yellow-50', text: 'text-yellow-900', border: 'border-yellow-300' },
  'Domestic': { bg: 'bg-indigo-50', text: 'text-indigo-900', border: 'border-indigo-300' },
};

function getColorForRole(role: string) {
  return ROLE_COLORS[role] || { bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-300' };
}

type ViewType = 'month' | 'week' | 'day';

interface ShiftCalendarProps {
  shifts: Shift[];
  onSelectShift: (shift: Shift) => void;
  onCreateClick: () => void;
  loading: boolean;
}

export default function ShiftCalendar({ shifts, onSelectShift, onCreateClick, loading }: ShiftCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading calendar...</div>;
  }

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const shiftsByDate: Record<string, Shift[]> = {};
    shifts.forEach(shift => {
      const dateKey = format(new Date(shift.shiftDate), 'yyyy-MM-dd');
      if (!shiftsByDate[dateKey]) {
        shiftsByDate[dateKey] = [];
      }
      shiftsByDate[dateKey].push(shift);
    });

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-semibold text-gray-700 py-2">
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayShifts = shiftsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={idx}
                className={`border rounded p-1 min-h-24 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className={`text-sm font-semibold ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                  {format(day, 'd')}
                </div>
                <div className="mt-1 space-y-1">
                  {dayShifts.slice(0, 2).map(shift => {
                    const color = getColorForRole(shift.role);
                    const filledCount = shift.assignments?.length || 0;
                    return (
                      <button
                        key={shift.id}
                        onClick={() => onSelectShift(shift)}
                        className={`w-full text-left text-xs px-1 py-0.5 rounded border-l-2 ${color.bg} ${color.text} ${color.border} hover:opacity-75 truncate`}
                        title={`${shift.role} - ${filledCount}/${shift.requiredCount}`}
                      >
                        {shift.role.substring(0, 3)} {filledCount}/{shift.requiredCount}
                      </button>
                    );
                  })}
                  {dayShifts.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">
                      +{dayShifts.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const shiftsByDate: Record<string, Shift[]> = {};
    shifts.forEach(shift => {
      const dateKey = format(new Date(shift.shiftDate), 'yyyy-MM-dd');
      if (!shiftsByDate[dateKey]) {
        shiftsByDate[dateKey] = [];
      }
      shiftsByDate[dateKey].push(shift);
    });

    return (
      <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
        <div className="grid grid-cols-7 gap-4 min-w-max">
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayShifts = shiftsByDate[dateKey] || [];

            return (
              <div key={dateKey} className="flex-1 min-w-40">
                <div className="text-center font-semibold text-gray-900 pb-2 border-b">
                  <div>{format(day, 'EEE')}</div>
                  <div className="text-sm text-gray-500">{format(day, 'MMM d')}</div>
                </div>
                <div className="mt-4 space-y-2">
                  {dayShifts.map(shift => {
                    const color = getColorForRole(shift.role);
                    const filledCount = shift.assignments?.length || 0;
                    return (
                      <button
                        key={shift.id}
                        onClick={() => onSelectShift(shift)}
                        className={`w-full text-left text-sm p-2 rounded border ${color.bg} ${color.text} ${color.border} hover:opacity-75`}
                      >
                        <div className="font-semibold">{shift.role}</div>
                        <div className="text-xs mt-1">{shift.startTime} - {shift.endTime}</div>
                        <div className="text-xs mt-1">{filledCount}/{shift.requiredCount} filled</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => format(new Date(s.shiftDate), 'yyyy-MM-dd') === dateKey);

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-2xl font-bold text-gray-900 mb-6">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </div>
        <div className="space-y-4">
          {dayShifts.length === 0 ? (
            <p className="text-gray-500">No shifts scheduled for this day</p>
          ) : (
            dayShifts.map(shift => {
              const color = getColorForRole(shift.role);
              const filledCount = shift.assignments?.length || 0;
              return (
                <button
                  key={shift.id}
                  onClick={() => onSelectShift(shift)}
                  className={`w-full text-left p-4 rounded border-l-4 ${color.bg} ${color.text} ${color.border} hover:opacity-75`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-lg">{shift.role}</div>
                      <div className="text-sm mt-1">{shift.startTime} - {shift.endTime}</div>
                      <div className="text-sm mt-1">{shift.facilityName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{filledCount}/{shift.requiredCount}</div>
                      <div className="text-xs mt-1">Filled</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
              else if (view === 'week') setCurrentDate(addMonths(currentDate, -7));
              else setCurrentDate(addMonths(currentDate, -1));
            }}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-lg font-semibold text-gray-900 min-w-48">
            {view === 'month' && format(currentDate, 'MMMM yyyy')}
            {view === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d')}`}
            {view === 'day' && format(currentDate, 'MMMM d, yyyy')}
          </div>

          <button
            onClick={() => {
              if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
              else if (view === 'week') setCurrentDate(addMonths(currentDate, 7));
              else setCurrentDate(addMonths(currentDate, 1));
            }}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {(['month', 'week', 'day'] as ViewType[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  view === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={onCreateClick}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" /> New Shift
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'month' && renderMonthView()}
      {view === 'week' && renderWeekView()}
      {view === 'day' && renderDayView()}
    </div>
  );
}
