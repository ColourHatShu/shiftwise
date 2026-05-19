'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Loader2, Check, X } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/date-utils';
import ConfirmModal from './components/ConfirmModal';

interface ShiftAssignment {
  id: string;
  shiftId: string;
  workerConfirmation: 'pending' | 'confirmed' | 'declined';
  shift: {
    id: string;
    facilityName: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    role: string;
  };
}

export default function AssignedShiftsPage() {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/worker-assignments', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('workerToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch assignments');

      const data = await response.json();
      setAssignments(data.data);
    } catch (err) {
      toast.error('Failed to load assigned shifts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (assignmentId: string) => {
    try {
      setConfirming(assignmentId);
      const response = await fetch(`/api/worker-assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('workerToken')}`
        },
        body: JSON.stringify({ action: 'confirm' })
      });

      if (!response.ok) throw new Error('Failed to confirm shift');

      toast.success('Shift confirmed!');
      fetchAssignments();
    } catch (err) {
      toast.error('Failed to confirm shift');
      console.error(err);
    } finally {
      setConfirming(null);
    }
  };

  const handleDecline = async (assignmentId: string, reason?: string) => {
    try {
      setConfirming(assignmentId);
      const response = await fetch(`/api/worker-assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('workerToken')}`
        },
        body: JSON.stringify({
          action: 'decline',
          reason
        })
      });

      if (!response.ok) throw new Error('Failed to decline shift');

      toast.success('Shift declined');
      setShowDeclineModal(null);
      fetchAssignments();
    } catch (err) {
      toast.error('Failed to decline shift');
      console.error(err);
    } finally {
      setConfirming(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge className="bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        );
      case 'declined':
        return (
          <Badge className="bg-orange-100 text-orange-800">
            <X className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Your Assigned Shifts</h1>
      <p className="text-gray-600 mb-6">
        Shifts you've been assigned. Confirm or decline below.
      </p>

      {assignments.length === 0 ? (
        <Card className="p-8 text-center text-gray-600">
          No assigned shifts yet
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => {
            const shiftDate = new Date(assignment.shift.shiftDate);
            const isPending = assignment.workerConfirmation === 'pending';

            return (
              <Card key={assignment.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {assignment.shift.facilityName}
                    </h3>
                    <p className="text-gray-600">{assignment.shift.role}</p>
                  </div>
                  {getStatusBadge(assignment.workerConfirmation)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
                  <div>
                    <div className="text-gray-600">Date</div>
                    <div className="font-medium">{formatDate(shiftDate)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Time</div>
                    <div className="font-medium">
                      {assignment.shift.startTime} - {assignment.shift.endTime}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Duration</div>
                    <div className="font-medium">
                      {(() => {
                        const start = parseInt(assignment.shift.startTime);
                        const end = parseInt(assignment.shift.endTime);
                        const hours = end - start;
                        return `${hours} hours`;
                      })()}
                    </div>
                  </div>
                </div>

                {isPending && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleConfirm(assignment.id)}
                      disabled={confirming === assignment.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {confirming === assignment.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Confirm
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeclineModal(assignment.id)}
                      disabled={confirming === assignment.id}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                )}

                {showDeclineModal === assignment.id && (
                  <ConfirmModal
                    isOpen={true}
                    onClose={() => setShowDeclineModal(null)}
                    onConfirm={(reason) => handleDecline(assignment.id, reason)}
                    shift={assignment.shift}
                    loading={confirming === assignment.id}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
