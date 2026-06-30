'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmationBadge } from '@/components/ui/confirmation-badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface ShiftAssignment {
  id: string;
  workerId: string;
  worker: {
    firstName: string;
    lastName: string;
    email: string;
  };
  workerConfirmation: 'pending' | 'confirmed' | 'declined';
  complianceSnapshot?: {
    complianceScore: number;
    status: string;
  };
  assignedAt: string;
}

interface AssignmentListProps {
  shiftId: string;
  assignments: ShiftAssignment[];
  onRefresh: () => void;
}

export default function AssignmentList({
  shiftId,
  assignments,
  onRefresh
}: AssignmentListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const getComplianceBadge = (score?: number) => {
    if (score === undefined) return null;
    if (score === 100) {
      return <Badge className="bg-green-100 text-green-800">{score}%</Badge>;
    }
    if (score >= 80) {
      return <Badge className="bg-yellow-100 text-yellow-800">{score}%</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">{score}%</Badge>;
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('Remove this worker from the shift?')) return;

    try {
      setDeleting(assignmentId);
      const response = await fetch(
        `/api/shifts/${shiftId}/assignments/${assignmentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('coordinatorToken')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to remove assignment');

      toast.success('Worker unassigned');
      onRefresh();
    } catch (err) {
      toast.error('Failed to unassign worker');
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  if (assignments.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 text-center text-gray-600">
        No workers assigned yet
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold">Worker</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Assigned</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Compliance</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {assignments.map((assignment) => (
            <tr key={assignment.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium">
                  {assignment.worker.firstName} {assignment.worker.lastName}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {assignment.worker.email}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {formatDistanceToNow(new Date(assignment.assignedAt), {
                  addSuffix: true
                })}
              </td>
              <td className="px-4 py-3">
                {getComplianceBadge(assignment.complianceSnapshot?.complianceScore)}
              </td>
              <td className="px-4 py-3">
                <ConfirmationBadge status={assignment.workerConfirmation} />
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnassign(assignment.id)}
                  disabled={deleting === assignment.id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
