'use client';

import { useEffect, useState } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface DocumentType {
  id: string;
  name: string;
  expiryWarningDays: number;
}

interface Threshold {
  documentTypeId: string;
  documentTypeName: string;
  warningDays: number;
}

export default function ComplianceSettingsPage() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch document types
      const docsRes = await fetch('/api/agencies/document-types');
      if (!docsRes.ok) throw new Error('Failed to fetch document types');
      const docsData = await docsRes.json();
      const docs = docsData.data || [];
      setDocumentTypes(docs);

      // Initialize thresholds from document types
      const initialThresholds = docs.map((doc: DocumentType) => ({
        documentTypeId: doc.id,
        documentTypeName: doc.name,
        warningDays: doc.expiryWarningDays || 30
      }));
      setThresholds(initialThresholds);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = (documentTypeId: string, warningDays: number) => {
    setThresholds(
      thresholds.map(t =>
        t.documentTypeId === documentTypeId
          ? { ...t, warningDays }
          : t
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save thresholds via API
      const res = await fetch('/api/agencies/compliance-thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      toast.success('Compliance thresholds updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Compliance Thresholds
        </h1>
        <p className="text-gray-600 mt-2">
          Configure custom warning periods for each document type to override default 30-day thresholds.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900">Custom Thresholds</p>
          <p className="text-sm text-blue-800 mt-1">
            Set the number of days before expiry to trigger a compliance alert. For example, set 90 days
            for documents that must always be current (DBS checks), or 7 days for quick-turnaround items.
          </p>
        </div>
      </div>

      {/* Thresholds List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Document Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Warning Period (Days)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {thresholds.map((threshold) => {
              const isDefault = threshold.warningDays === 30;
              return (
                <tr key={threshold.documentTypeId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{threshold.documentTypeName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={threshold.warningDays}
                        onChange={(e) =>
                          handleThresholdChange(
                            threshold.documentTypeId,
                            parseInt(e.target.value)
                          )
                        }
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-600">days</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {isDefault ? (
                      <span className="text-gray-500 italic">Default threshold</span>
                    ) : (
                      <span className="text-blue-600 font-medium">Custom</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={fetchData}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Footer */}
      <div className="mt-12 p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">Recommended Thresholds</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li><strong>DBS Check:</strong> 90 days (must renew every 3 years, plan ahead)</li>
          <li><strong>Right to Work:</strong> 60 days (essential for placement)</li>
          <li><strong>Training Certificates:</strong> 30 days (varies by requirement)</li>
          <li><strong>Immunisation:</strong> 365 days (annual requirement)</li>
          <li><strong>References:</strong> 180 days (good practice for updates)</li>
        </ul>
      </div>
    </div>
  );
}
