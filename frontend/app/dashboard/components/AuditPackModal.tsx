'use client';

import { useState, useEffect } from 'react';
import { Download, X, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AuditPackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditPackModal({ isOpen, onClose }: AuditPackModalProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPack, setGeneratedPack] = useState<any>(null);

  // Fetch workers on mount
  useEffect(() => {
    if (isOpen) {
      fetchWorkers();
    }
  }, [isOpen]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workers');
      if (!res.ok) throw new Error('Failed to fetch workers');
      const data = await res.json();
      setWorkers(data.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch workers');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePack = async () => {
    if (!selectedWorker) {
      toast.error('Please select a worker');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/agency/audit-pack/${selectedWorker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate pack');
      }

      const data = await res.json();
      setGeneratedPack(data.data);
      toast.success('Audit pack generated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate audit pack');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedPack) return;

    try {
      const res = await fetch(generatedPack.downloadUrl);
      if (!res.ok) throw new Error('Failed to download');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-pack-${generatedPack.packId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Download started!');
      onClose();
      setSelectedWorker('');
      setGeneratedPack(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to download pack');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Generate Audit Pack</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!generatedPack ? (
          <div>
            <p className="text-gray-600 mb-4">
              Select a worker to generate a CQC-ready audit pack with all compliance documents and audit trail.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Worker</label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">
                  {loading ? 'Loading workers...' : 'Choose a worker...'}
                </option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>
                    {worker.firstName} {worker.lastName} ({worker.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">What's included:</p>
                  <ul className="text-sm text-blue-800 mt-2 list-disc list-inside space-y-1">
                    <li>All compliance documents (PDFs)</li>
                    <li>Complete audit trail (CSV)</li>
                    <li>Compliance summary (JSON)</li>
                    <li>Expires after 7 days</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePack}
                disabled={!selectedWorker || generating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {generating ? 'Generating...' : 'Generate Pack'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Audit pack ready!</p>
                <p className="text-sm text-green-800 mt-1">
                  Generated in {generatedPack.duration}ms. Contains {generatedPack.docCount} documents and {generatedPack.logCount} audit log entries.
                </p>
                <p className="text-xs text-green-700 mt-2">
                  Expires: {new Date(generatedPack.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <strong>File size:</strong> {(generatedPack.fileSize / 1024 / 1024).toFixed(2)} MB
              </p>
              <p className="text-sm text-gray-600">
                <strong>Pack ID:</strong> {generatedPack.packId}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Close
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
