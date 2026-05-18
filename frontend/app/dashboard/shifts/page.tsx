'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, X, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ShiftCalendar from './components/ShiftCalendar';
import ShiftModal from './components/ShiftModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';

interface Shift {
  id: string;
  facilityName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  requiredCount: number;
  status?: 'OPEN' | 'FILLED' | 'CANCELLED';
  assignments?: ShiftAssignment[];
  complianceCheckup?: boolean;
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

  useEffect(() => {
    fetchShifts();
  }, []);

  async function fetchShifts() {
    try {
      setLoading(true);
      const res = await fetch('/api/shifts');
      if (!res.ok) throw new Error('Failed to fetch shifts');
      const data = await res.json();
      setShifts(data.data || []);
    } catch (error) {
      toast.error('Failed to load shifts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShift(data: Shift) {
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create shift');
      }

      await fetchShifts();
      setShowNewShiftModal(false);
    } catch (error) {
      throw error;
    }
  }

  async function handleUpdateShift(data: Shift) {
    if (!selectedShift) return;

    try {
      const res = await fetch(`/api/shifts/${selectedShift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update shift');
      }

      await fetchShifts();
      setShowEditModal(false);
      setSelectedShift(null);
    } catch (error) {
      throw error;
    }
  }

  async function handleDeleteShift() {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/shifts/${deleteTarget.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete shift');
      }

      await fetchShifts();
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      throw error;
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
        <p className="text-gray-600 mt-1">Create and manage shifts, view assignments and compliance gaps</p>
      </div>

      {/* Calendar View */}
      <ShiftCalendar
        shifts={shifts}
        onSelectShift={(shift) => {
          setSelectedShift(shift);
          setShowEditModal(true);
        }}
        onCreateClick={() => {
          setSelectedShift(null);
          setShowNewShiftModal(true);
        }}
        loading={loading}
      />

      {/* Details Panel */}
      {selectedShift && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedShift.facilityName}</h2>
              <p className="text-gray-600 mt-1">
                {new Date(selectedShift.shiftDate).toLocaleDateString()} • {selectedShift.startTime} - {selectedShift.endTime}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setDeleteTarget(selectedShift);
                  setShowDeleteModal(true);
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-sm text-gray-600">Role</p>
              <p className="font-semibold text-gray-900">{selectedShift.role}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Required Count</p>
              <p className="font-semibold text-gray-900">{selectedShift.requiredCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Assigned</p>
              <p className="font-semibold text-gray-900">{selectedShift.assignments?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold text-gray-900">
                {(selectedShift.assignments?.length || 0) >= selectedShift.requiredCount ? 'FILLED' : 'OPEN'}
              </p>
            </div>
          </div>

          {selectedShift.notes && (
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-1">Notes</p>
              <p className="text-gray-900">{selectedShift.notes}</p>
            </div>
          )}

          {/* Assignments */}
          <div className="mt-8">
            <h3 className="font-semibold text-gray-900 mb-4">Assigned Workers</h3>
            {!selectedShift.assignments || selectedShift.assignments.length === 0 ? (
              <p className="text-gray-500">No workers assigned yet</p>
            ) : (
              <div className="space-y-2">
                {selectedShift.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {assignment.worker.firstName} {assignment.worker.lastName}
                      </p>
                      <p className="text-sm text-gray-600">{assignment.worker.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.complianceCheckPassed ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" /> Compliant
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-yellow-600">
                          <AlertCircle className="w-4 h-4" /> Issues
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ShiftModal
        isOpen={showNewShiftModal}
        onClose={() => setShowNewShiftModal(false)}
        onSubmit={handleCreateShift}
      />

      <ShiftModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedShift(null);
        }}
        onSubmit={handleUpdateShift}
        initialData={selectedShift || undefined}
        isEditing={true}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Shift"
        message={`Are you sure you want to delete the shift at ${deleteTarget?.facilityName} on ${deleteTarget?.shiftDate}? This action cannot be undone.`}
        onConfirm={handleDeleteShift}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
