'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { ShiftFormData } from '../types';

// Local alias for clarity within this file; the shared canonical type lives in ../types.ts.
type Shift = ShiftFormData;

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Shift) => Promise<void>;
  initialData?: Shift;
  isEditing?: boolean;
}

const COMMON_ROLES = ['Nurse', 'Carer', 'Support Worker', 'Healthcare Assistant', 'Domestic', 'Manager'];

export default function ShiftModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false
}: ShiftModalProps) {
  const [formData, setFormData] = useState<Shift>(
    initialData || {
      facilityName: '',
      shiftDate: '',
      startTime: '08:00',
      endTime: '16:00',
      role: '',
      requiredCount: 1,
      complianceCheckup: false,
      notes: ''
    }
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.facilityName.trim()) {
      newErrors.facilityName = 'Facility name is required';
    }

    if (!formData.shiftDate) {
      newErrors.shiftDate = 'Shift date is required';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    if (formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    if (formData.requiredCount < 1) {
      newErrors.requiredCount = 'At least 1 worker required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      toast.success(isEditing ? 'Shift updated successfully' : 'Shift created successfully');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save shift');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Shift' : 'Create New Shift'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Facility Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facility Name *
            </label>
            <input
              type="text"
              value={formData.facilityName}
              onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.facilityName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., St Mary's Hospital"
            />
            {errors.facilityName && (
              <p className="text-red-500 text-sm mt-1">{errors.facilityName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Shift Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shift Date *
              </label>
              <input
                type="date"
                value={formData.shiftDate}
                onChange={(e) => setFormData({ ...formData, shiftDate: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.shiftDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.shiftDate && (
                <p className="text-red-500 text-sm mt-1">{errors.shiftDate}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.role ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select role</option>
                {COMMON_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              {errors.role && (
                <p className="text-red-500 text-sm mt-1">{errors.role}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.startTime ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.startTime && (
                <p className="text-red-500 text-sm mt-1">{errors.startTime}</p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.endTime ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.endTime && (
                <p className="text-red-500 text-sm mt-1">{errors.endTime}</p>
              )}
            </div>

            {/* Required Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workers Needed *
              </label>
              <input
                type="number"
                min="1"
                value={formData.requiredCount}
                onChange={(e) => setFormData({ ...formData, requiredCount: parseInt(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.requiredCount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.requiredCount && (
                <p className="text-red-500 text-sm mt-1">{errors.requiredCount}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional information about the shift"
              rows={3}
            />
          </div>

          {/* Compliance Checkup */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="complianceCheckup"
              checked={formData.complianceCheckup || false}
              onChange={(e) => setFormData({ ...formData, complianceCheckup: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="complianceCheckup" className="text-sm text-gray-700">
              Require compliance review before assignment
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Shift' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
