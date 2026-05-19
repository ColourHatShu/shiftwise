'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  complianceScore: number;
  complianceStatus: 'compliant' | 'non-compliant';
  lastUpdated: string;
}

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string;
  onAssignSuccess: (result: any) => void;
}

export default function AssignModal({
  isOpen,
  onClose,
  shiftId,
  onAssignSuccess
}: AssignModalProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchWorkers(1, search);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, isOpen]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchWorkers(1, search);
    }
  }, [isOpen]);

  const fetchWorkers = async (pageNum: number, searchQuery: string) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '25',
        search: searchQuery
      });

      const response = await fetch(
        `/api/shifts/${shiftId}/assignable-workers?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('coordinatorToken')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch workers');

      const data = await response.json();
      setWorkers(data.workers);
      setTotalPages(data.pagination.pages);
      setPage(pageNum);
      setSelectedWorkers(new Set()); // Clear selection on new page
    } catch (err) {
      setError('Failed to load workers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorker = (workerId: string) => {
    const newSelected = new Set(selectedWorkers);
    if (newSelected.has(workerId)) {
      newSelected.delete(workerId);
    } else {
      newSelected.add(workerId);
    }
    setSelectedWorkers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedWorkers.size === workers.length) {
      setSelectedWorkers(new Set());
    } else {
      setSelectedWorkers(new Set(workers.map(w => w.id)));
    }
  };

  const handleAssign = async () => {
    if (selectedWorkers.size === 0) {
      toast.error('Please select at least one worker');
      return;
    }

    try {
      setAssigning(true);
      const response = await fetch(`/api/shifts/${shiftId}/assign-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('coordinatorToken')}`
        },
        body: JSON.stringify({
          workerIds: Array.from(selectedWorkers),
          assignmentType: 'manual'
        })
      });

      if (!response.ok) throw new Error('Assignment failed');

      const result = await response.json();

      if (result.assigned.length > 0) {
        toast.success(`Assigned ${result.assigned.length} workers`);
      }
      if (result.skipped.length > 0) {
        toast.error(`${result.skipped.length} workers skipped`);
      }

      onAssignSuccess(result);
      onClose();
    } catch (err) {
      toast.error('Failed to assign workers');
      console.error(err);
    } finally {
      setAssigning(false);
    }
  };

  const getComplianceBadgeColor = (score: number) => {
    if (score === 100) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Workers to Shift">
      <div className="space-y-4">
        {/* Search Input */}
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />

        {/* Worker List */}
        <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : workers.length === 0 ? (
            <div className="text-gray-500 text-sm">No workers found</div>
          ) : (
            <>
              {/* Select All */}
              <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer font-semibold">
                <Checkbox
                  checked={selectedWorkers.size === workers.length && workers.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>Select All ({workers.length})</span>
              </label>

              {/* Worker Rows */}
              {workers.map((worker) => (
                <label
                  key={worker.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                >
                  <Checkbox
                    checked={selectedWorkers.has(worker.id)}
                    onChange={() => toggleWorker(worker.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {worker.firstName} {worker.lastName}
                    </div>
                    <div className="text-sm text-gray-600">{worker.email}</div>
                  </div>
                  <Badge className={getComplianceBadgeColor(worker.complianceScore)}>
                    {worker.complianceScore}%
                  </Badge>
                  <Badge variant="outline">Compliant</Badge>
                </label>
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchWorkers(page - 1, search)}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchWorkers(page + 1, search)}
              disabled={page >= totalPages || loading}
            >
              Next
            </Button>
          </div>
        )}

        {/* Selection Summary */}
        <div className="text-sm text-gray-600">
          {selectedWorkers.size} worker(s) selected
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={assigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedWorkers.size === 0 || assigning}
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign Selected (${selectedWorkers.size})`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
