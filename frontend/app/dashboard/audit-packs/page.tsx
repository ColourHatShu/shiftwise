'use client';

import { useEffect, useState } from 'react';
import { Download, Calendar, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditPack {
  id: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
  auditLogCount: number;
  workerCount: number;
}

export default function AuditPacksPage() {
  const [packs, setPacks] = useState<AuditPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formData, setFormData] = useState({
    dateFrom: '',
    dateTo: ''
  });

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dateFrom || !formData.dateTo) {
      toast.error('Please select both dates');
      return;
    }

    setExporting(true);
    try {
      const res = await fetch('/api/agency/audit-pack/bulk/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Export failed');
      }

      const data = await res.json();
      toast.success('Audit pack exported! Email sent with download link.');
      setShowExportModal(false);
      setFormData({ dateFrom: '', dateTo: '' });

      // Refresh the list (in a real app, you'd add the new pack to the list)
    } catch (error: any) {
      toast.error(error.message || 'Failed to export audit pack');
    } finally {
      setExporting(false);
    }
  };

  const downloadPack = async (packId: string) => {
    try {
      const res = await fetch(`/api/audit-pack/${packId}`);
      if (!res.ok) throw new Error('Failed to download');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-pack-${packId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Failed to download audit pack');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Pack Export</h1>
          <p className="text-gray-600 mt-1">Generate and download compliance audit packs</p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Calendar className="w-5 h-5" /> Generate Export
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-sm text-blue-700">
          <strong>Audit packs</strong> contain all audit logs, worker compliance data, and document history for your selected period.
          Exports are compressed and available for download for 7 days.
        </p>
      </div>

      {/* Empty State or List */}
      {!loading && packs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No audit packs yet</p>
          <p className="text-gray-500 text-sm mt-1">Generate your first export to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contents</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {packs.map((pack) => (
                <tr key={pack.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(pack.dateFrom).toLocaleDateString()} to{' '}
                    {new Date(pack.dateTo).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(pack.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {pack.auditLogCount} logs • {pack.workerCount} workers
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => downloadPack(pack.id)}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Audit Pack</h2>

            <form onSubmit={handleExport}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={formData.dateFrom}
                  onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={formData.dateTo}
                  onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={exporting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
