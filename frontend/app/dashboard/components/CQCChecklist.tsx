'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

interface ActionItem {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  action: string;
  description: string;
  affectedWorkers: string[];
}

interface CQCChecklistData {
  agencyName: string;
  generatedAt: string;
  overallStatus: 'red' | 'yellow' | 'green';
  overallCompliance: number;
  readyForCQC: boolean;
  metrics: {
    totalWorkers: number;
    compliantWorkers: number;
    nonCompliantWorkers: number;
    expiringDocumentsCount: number;
    expiredDocumentsCount: number;
  };
  actionItems: ActionItem[];
}

export default function CQCChecklist() {
  const [checklist, setChecklist] = useState<CQCChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchChecklist();
  }, []);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/agency/compliance/cqc-checklist');
      if (!res.ok) throw new Error('Failed to fetch checklist');
      const data = await res.json();
      setChecklist(data.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load CQC checklist');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChecklist();
    setRefreshing(false);
    toast.success('Checklist refreshed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load CQC checklist
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'green':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'yellow':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'red':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green':
        return 'bg-green-50 border-green-200';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200';
      case 'red':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Overall Status */}
      <div className={`border rounded-lg p-6 ${getStatusColor(checklist.overallStatus)}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon(checklist.overallStatus)}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {checklist.readyForCQC
                  ? 'Agency Ready for CQC'
                  : 'Agency Requires Attention'}
              </h2>
              <p className="text-gray-600 mt-1">
                {checklist.overallCompliance}% of workers are compliant
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Total Workers</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {checklist.metrics.totalWorkers}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Compliant</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {checklist.metrics.compliantWorkers}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Non-Compliant</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {checklist.metrics.nonCompliantWorkers}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Expired Docs</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {checklist.metrics.expiredDocumentsCount}
          </p>
        </div>
      </div>

      {/* Action Items */}
      {checklist.actionItems.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Action Items</h3>
          <div className="space-y-3">
            {checklist.actionItems.map((item, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-4 ${getPriorityColor(item.priority)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded">
                    {item.priority}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">{item.action}</p>
                    <p className="text-sm mt-1">{item.description}</p>
                    {item.affectedWorkers.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium mb-1">Affected workers:</p>
                        <div className="flex flex-wrap gap-2">
                          {item.affectedWorkers.map((worker, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-white bg-opacity-60 px-2 py-1 rounded"
                            >
                              {worker}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {checklist.actionItems.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <p className="font-medium text-green-900">All systems go!</p>
          <p className="text-sm text-green-700 mt-1">
            No action items required. Your agency is ready for CQC inspection.
          </p>
        </div>
      )}

      {/* Last Updated */}
      <p className="text-xs text-gray-500 text-center">
        Last updated: {new Date(checklist.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
