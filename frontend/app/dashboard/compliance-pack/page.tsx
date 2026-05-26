'use client';

import { useState } from 'react';
import { Download, Settings, FileText, CheckSquare } from 'lucide-react';
import AuditPackModal from '../components/AuditPackModal';
import CQCChecklist from '../components/CQCChecklist';
import toast from 'react-hot-toast';

type TabType = 'checklist' | 'audit-pack' | 'report';

export default function CompliancePackPage() {
  const [activeTab, setActiveTab] = useState<TabType>('checklist');
  const [auditPackModalOpen, setAuditPackModalOpen] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setReportGenerating(true);
      const res = await fetch('/api/agency/audit-pack/report/generate', {
        method: 'POST'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      // Download the PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Compliance report generated and downloaded!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setReportGenerating(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compliance Pack</h1>
        <p className="text-gray-600 mt-2">
          View CQC readiness, generate audit packs, and export compliance reports.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setAuditPackModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
        >
          <FileText className="w-4 h-4" />
          Generate Audit Pack
        </button>
        <button
          onClick={handleGenerateReport}
          disabled={reportGenerating}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-medium"
        >
          <Download className="w-4 h-4" />
          {reportGenerating ? 'Generating...' : 'Export Report'}
        </button>
        <a
          href="/dashboard/compliance-settings"
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 font-medium"
        >
          <Settings className="w-4 h-4" />
          Thresholds
        </a>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-4 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'checklist'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <CheckSquare className="w-4 h-4 inline mr-2" />
            CQC Checklist
          </button>
          <button
            onClick={() => setActiveTab('audit-pack')}
            className={`pb-4 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'audit-pack'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Audit Packs
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'checklist' && <CQCChecklist />}
        {activeTab === 'audit-pack' && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Ready to Generate Audit Pack?</h3>
            <p className="text-gray-600 mt-2">
              Click the "Generate Audit Pack" button above to create a CQC-ready compliance pack for a specific worker.
            </p>
            <button
              onClick={() => setAuditPackModalOpen(true)}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Generate Now
            </button>
          </div>
        )}
      </div>

      {/* Audit Pack Modal */}
      <AuditPackModal
        isOpen={auditPackModalOpen}
        onClose={() => setAuditPackModalOpen(false)}
      />
    </div>
  );
}
