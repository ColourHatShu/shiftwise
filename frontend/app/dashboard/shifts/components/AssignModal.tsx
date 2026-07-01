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
  confirmationRate: number | null;
  suggested?: boolean;
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
  const [suggestions, setSuggestions] = useState<Array<{ id: string; firstName: string; lastName: string; complianceScore: number; confirmationRate: number | null; rank: number }>>([]);

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
      fetchSuggestions();
    }
  }, [isOpen]);

  // Rule-based "top picks" for this shift (best compliant + reliable candidates).
  const fetchSuggestions = async () => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/suggested-workers?limit=5`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('coordinatorToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.data || []);
      }
    } catch {
      // Non-critical: the full list below still works if suggestions fail.
    }
  };

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
      // Preserve selection across pages so coordinators can multi-page select.
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

  // Reliability = how often this worker confirms shifts they're assigned.
  const getReliabilityBadgeColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800';
    if (rate >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Workers to Shift">
      <div className="space-y-4">
        {/* Top picks — rule-based shift-matcher suggestions (click to select) */}
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="mb-2 text-xs font-semibold text-blue-900">⭐ Top picks for this shift</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const selected = selectedWorkers.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleWorker(s.id)}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Deselect' : 'Select'} ${s.firstName} ${s.lastName} — compliance ${s.complianceScore}%, reliability ${s.confirmationRate === null ? 'no history' : s.confirmationRate + '%'}`}
                    title={`Compliance ${s.complianceScore}% · Reliability ${s.confirmationRate === null ? 'no history' : s.confirmationRate + '%'}`}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                      selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-300 bg-white text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    {selected && <span aria-hidden>✓</span>}
                    {s.firstName} {s.lastName}
                    {s.confirmationRate !== null && (
                      <span className={`text-xs ${selected ? 'opacity-80' : 'opacity-60'}`}>· {s.confirmationRate}%</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {worker.firstName} {worker.lastName}
                      </span>
                      {worker.suggested && (
                        <Badge className="bg-blue-100 text-blue-800" title="Compliant and reliably confirms shifts">
                          ⭐ Suggested
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{worker.email}</div>
                  </div>
                  <Badge className={getComplianceBadgeColor(worker.complianceScore)}>
                    {worker.complianceScore}%
                  </Badge>
                  <Badge variant={worker.complianceStatus === 'compliant' ? 'success' : 'destructive'}>
                    {worker.complianceStatus === 'compliant' ? 'Compliant' : 'Non-compliant'}
                  </Badge>
                  {worker.confirmationRate === null || worker.confirmationRate === undefined ? (
                    <Badge className="bg-gray-100 text-gray-600" title="No shift-confirmation history yet">
                      New
                    </Badge>
                  ) : (
                    <Badge className={getReliabilityBadgeColor(worker.confirmationRate)} title="Shift confirmation rate (reliability)">
                      {worker.confirmationRate}% conf
                    </Badge>
                  )}
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
