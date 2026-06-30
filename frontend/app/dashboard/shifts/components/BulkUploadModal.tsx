'use client';

import { useState } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UploadResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row?: number; error: string }>;
}

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUploadModal({
  isOpen,
  onClose,
  onSuccess
}: BulkUploadModalProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/shifts/bulk/template');
      if (!res.ok) throw new Error('Failed to download template');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shift-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!csvText.trim()) {
      toast.error('Please select a CSV file or paste CSV data');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/shifts/bulk/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvText })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload shifts');
      }

      const data = await res.json();
      setResult(data.results);
      toast.success(`Successfully uploaded ${data.results.succeeded} shifts`);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload shifts');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Bulk Upload Shifts</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {result ? (
            // Result View
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${result.failed === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.failed === 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <p className="font-semibold text-gray-900">
                    {result.succeeded} succeeded, {result.failed} failed out of {result.total}
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="font-semibold text-red-900 mb-2">Errors:</p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx} className="text-sm text-red-800">
                        {err.row ? `Row ${err.row}: ` : ''}{err.error}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-sm text-red-800">
                        ... and {result.errors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-4 justify-end pt-4 border-t">
                <button
                  onClick={() => {
                    setCsvFile(null);
                    setCsvText('');
                    setResult(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Upload Another File
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            // Upload Form
            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Upload a CSV file with shift data. Required columns: facilityName, shiftDate, startTime, endTime, role, requiredCount.
                  Optional: notes, complianceCheckup.
                </p>
              </div>

              {/* Download Template Button */}
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
              >
                <Download className="w-4 h-4" /> Download Template
              </button>

              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csvInput"
                  />
                  <label htmlFor="csvInput" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm font-medium text-gray-700">
                      {csvFile ? csvFile.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500">CSV files up to 50MB</p>
                  </label>
                </div>
              </div>

              {/* Manual CSV Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Paste CSV Data
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="facilityName,shiftDate,startTime,endTime,role,requiredCount,notes,complianceCheckup&#10;St Mary's Hospital,2026-05-25,08:00,16:00,Nurse,3,Ward 5,false"
                  rows={6}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4 justify-end pt-4 border-t">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={loading || !csvText.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  {loading ? 'Uploading...' : 'Upload Shifts'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
