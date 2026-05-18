'use client';

import { useEffect, useState } from 'react';
import { Calendar, Plus, AlertCircle, Check, X } from 'lucide-react';

interface Shift {
  id: string;
  facilityName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  requiredCount: number;
  status: 'OPEN' | 'FILLED' | 'CANCELLED';
  assignments?: ShiftAssignment[];
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
  complianceCheckPassed: boolean;
  complianceCheckDetails?: {
    missingDocs: string[];
    expiredDocs: string[];
  };
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewShiftModal, setShowNewShiftModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, []);

  async function fetchShifts() {
    try {
      const res = await fetch('/api/shifts');
      if (!res.ok) throw new Error('Failed to fetch shifts');
      const data = await res.json();
      setShifts(data.data);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div>
      <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
              <p className="text-gray-600 mt-1">Create and manage shifts, view assignments and compliance gaps</p>
            </div>
            <button
              onClick={() => setShowNewShiftModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" /> New Shift
            </button>
          </div>

          {/* Shifts Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compliance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      No shifts yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  shifts.map((shift) => {
                    const filledCount = shift.assignments?.length || 0;
                    const complianceGaps = shift.assignments?.filter((a) => !a.complianceCheckPassed).length || 0;
                    return (
                      <tr key={shift.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {shift.facilityName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(shift.shiftDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {shift.startTime} - {shift.endTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{shift.role}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {filledCount} / {shift.requiredCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              shift.status === 'FILLED'
                                ? 'bg-green-100 text-green-700'
                                : shift.status === 'OPEN'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {complianceGaps > 0 ? (
                            <span className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="w-4 h-4" /> {complianceGaps} gaps
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600">
                              <Check className="w-4 h-4" /> All clear
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => {
                              setSelectedShift(shift);
                              setShowAssignModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
      </div>

      {/* Modals would go here */}
    </div>
  );
}
