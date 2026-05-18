'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Users, Search, Filter, Check, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface Shift {
  id: string;
  facilityName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  requiredCount: number;
  assignments?: ShiftAssignment[];
  notes?: string;
}

interface ShiftAssignment {
  id: string;
  workerId: string;
  worker: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface AppliedShift {
  id: string;
  shiftId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string;
}

export default function WorkerShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [appliedShifts, setAppliedShifts] = useState<AppliedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [applyingShiftId, setApplyingShiftId] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const workerId = localStorage.getItem('workerId') || '';

  useEffect(() => {
    fetchShifts();
    fetchAppliedShifts();
  }, []);

  async function fetchShifts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterRole) params.append('role', filterRole);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch shifts');
      const data = await res.json();
      setShifts(data.data || []);
    } catch (error) {
      toast.error('Failed to load available shifts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAppliedShifts() {
    try {
      // This would come from a /api/worker/shifts endpoint
      // For now, we'll initialize as empty
      setAppliedShifts([]);
    } catch (error) {
      console.error('Failed to fetch applied shifts:', error);
    }
  }

  async function handleApplyToShift(shiftId: string) {
    if (!workerId) {
      toast.error('You must be logged in to apply for shifts');
      return;
    }

    setApplyingShiftId(shiftId);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to apply for shift');
      }

      toast.success('Application submitted successfully');
      setShowApplyModal(false);
      setSelectedShift(null);
      await fetchAppliedShifts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply for shift');
    } finally {
      setApplyingShiftId(null);
    }
  }

  const filteredShifts = shifts.filter(shift => {
    const matchesSearch =
      shift.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.role.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = !filterRole || shift.role === filterRole;
    const shiftDate = new Date(shift.shiftDate);
    const matchesStartDate = !filterStartDate || shiftDate >= new Date(filterStartDate);
    const matchesEndDate = !filterEndDate || shiftDate <= new Date(filterEndDate);

    return matchesSearch && matchesRole && matchesStartDate && matchesEndDate;
  });

  const uniqueRoles = Array.from(new Set(shifts.map(s => s.role)));

  const hasApplied = (shiftId: string) => appliedShifts.some(a => a.shiftId === shiftId);
  const getApplicationStatus = (shiftId: string) => appliedShifts.find(a => a.shiftId === shiftId)?.status;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Available Shifts</h1>
          <p className="text-gray-600 mt-1">Browse and apply to shifts in your role and location</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Search className="w-4 h-4 inline mr-2" />
                Search
              </label>
              <input
                type="text"
                placeholder="Facility or role"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Filter className="w-4 h-4 inline mr-2" />
                Role
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={fetchShifts}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>

        {/* Shifts List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading available shifts...</p>
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No shifts match your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredShifts.map(shift => {
              const filledCount = shift.assignments?.length || 0;
              const available = shift.requiredCount - filledCount;
              const applied = hasApplied(shift.id);
              const status = getApplicationStatus(shift.id);

              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{shift.facilityName}</h3>
                        <div className="flex items-center gap-4 mt-2 text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(shift.shiftDate), 'MMM dd, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {shift.startTime} - {shift.endTime}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-900 rounded-lg font-medium">
                          {shift.role}
                        </span>
                      </div>
                    </div>

                    {shift.notes && (
                      <p className="text-gray-600 mb-4">{shift.notes}</p>
                    )}

                    <div className="grid grid-cols-3 gap-4 py-4 border-t border-b">
                      <div>
                        <p className="text-sm text-gray-600">Positions Available</p>
                        <p className="text-2xl font-bold text-gray-900">{Math.max(0, available)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Filled</p>
                        <p className="text-2xl font-bold text-gray-900">{filledCount}/{shift.requiredCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Duration</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {Math.round((parseInt(shift.endTime.split(':')[0]) - parseInt(shift.startTime.split(':')[0])) * 10) / 10}h
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <div>
                        {applied ? (
                          <div className="flex items-center gap-2">
                            {status === 'APPROVED' && (
                              <span className="flex items-center gap-1 text-green-600">
                                <Check className="w-4 h-4" /> Approved
                              </span>
                            )}
                            {status === 'PENDING' && (
                              <span className="flex items-center gap-1 text-yellow-600">
                                <AlertCircle className="w-4 h-4" /> Pending
                              </span>
                            )}
                            {status === 'REJECTED' && (
                              <span className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="w-4 h-4" /> Rejected
                              </span>
                            )}
                          </div>
                        ) : (
                          available > 0 && (
                            <span className="text-green-600 font-medium">Open for applications</span>
                          )
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedShift(shift);
                          setShowApplyModal(true);
                        }}
                        disabled={applied || available <= 0 || applyingShiftId === shift.id}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                          applied
                            ? 'bg-gray-200 text-gray-700 cursor-not-allowed'
                            : available <= 0
                              ? 'bg-gray-200 text-gray-700 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {applyingShiftId === shift.id ? 'Applying...' : applied ? 'Already Applied' : 'Apply Now'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {showApplyModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Confirm Application</h2>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to apply for the <strong>{selectedShift.role}</strong> shift at <strong>{selectedShift.facilityName}</strong>?
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  <strong>Date:</strong> {format(new Date(selectedShift.shiftDate), 'MMM dd, yyyy')}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Time:</strong> {selectedShift.startTime} - {selectedShift.endTime}
                </p>
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => {
                    setShowApplyModal(false);
                    setSelectedShift(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApplyToShift(selectedShift.id)}
                  disabled={applyingShiftId === selectedShift.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {applyingShiftId === selectedShift.id ? 'Applying...' : 'Confirm Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
