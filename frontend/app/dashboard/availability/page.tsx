'use client';

import { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkerAvailability {
  id: string;
  workerId: string;
  date: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_LEAVE';
}

export default function AvailabilityPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<WorkerAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  useEffect(() => {
    fetchAvailability();
  }, [currentDate]);

  async function fetchAvailability() {
    // NOTE: aggregate-agency availability endpoint does not yet exist
    // (worker-availability.js is per-worker at /api/workers/:workerId/availability).
    // Page renders as an empty-state until the worker self-service portal
    // (Phase 9+) wires this up. Avoids a noisy 404 on dashboard load.
    setLoading(false);
    setAvailability([]);
  }

  async function updateAvailability(date: string, status: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_LEAVE') {
    // Optimistic local update only — backend persistence pending Phase 9.
    setAvailability((prev) => {
      const existing = prev.find((a) => a.date === date);
      if (existing) {
        return prev.map((a) => (a.date === date ? { ...a, status } : a));
      }
      return [
        ...prev,
        {
          id: `${Date.now()}`,
          workerId: 'current-worker',
          date,
          status,
        },
      ];
    });
  }

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-700';
      case 'UNAVAILABLE':
        return 'bg-red-100 text-red-700';
      case 'ON_LEAVE':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'AVAILABLE':
        return '✓ Available';
      case 'UNAVAILABLE':
        return '✗ Unavailable';
      case 'ON_LEAVE':
        return '◌ On Leave';
      default:
        return 'Not set';
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  const days: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Your Availability</h1>
            <p className="text-gray-600 mt-1">Mark your availability for upcoming shifts</p>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
            {/* Month Navigation */}
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;

                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
                const dayAvailability = availability.find((a) => a.date === date);
                const status = dayAvailability?.status;

                return (
                  <div key={day} className="border rounded p-2 min-h-24 flex flex-col">
                    <span className="font-semibold text-gray-900 mb-2">{day}</span>
                    <div className="flex-1 flex flex-col gap-1">
                      <button
                        onClick={() => updateAvailability(date, 'AVAILABLE')}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          status === 'AVAILABLE' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-200'
                        }`}
                      >
                        ✓ Available
                      </button>
                      <button
                        onClick={() => updateAvailability(date, 'UNAVAILABLE')}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          status === 'UNAVAILABLE' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-red-200'
                        }`}
                      >
                        ✗ Unavailable
                      </button>
                      <button
                        onClick={() => updateAvailability(date, 'ON_LEAVE')}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          status === 'ON_LEAVE' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-yellow-200'
                        }`}
                      >
                        ◌ On Leave
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Status Legend</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm text-gray-700">Available for shifts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-sm text-gray-700">Not available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm text-gray-700">On leave/holiday</span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
