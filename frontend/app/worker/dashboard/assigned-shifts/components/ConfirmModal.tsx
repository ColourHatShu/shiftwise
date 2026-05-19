'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface Shift {
  facilityName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  shift: Shift;
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  shift,
  loading = false
}: ConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (reason.length > 200) {
      alert('Reason must not exceed 200 characters');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm(reason || undefined);
    } finally {
      setSubmitting(false);
      setReason('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Decline Shift"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-blue-900">
            {shift.facilityName} on {new Date(shift.shiftDate).toLocaleDateString()} {shift.startTime} - {shift.endTime}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">
            You're declining this shift. Optionally, let us know why.
          </p>
          <Textarea
            placeholder="Optional reason (max 200 characters)"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            rows={4}
            className="w-full"
          />
          <div className="text-xs text-gray-500 mt-1">
            {reason.length} / 200 characters
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting || loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitting || loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Declining...
              </>
            ) : (
              'Decline Shift'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
