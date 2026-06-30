import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditPackModal from '../app/dashboard/components/AuditPackModal';
import CQCChecklist from '../app/dashboard/components/CQCChecklist';
import toast from 'react-hot-toast';

// Mock fetch and toast (vi.mock is statically hoisted by vitest)
global.fetch = jest.fn();
vi.mock('react-hot-toast');

describe('Audit Pack Modal (R-AP-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render audit pack modal when open', () => {
    render(
      <AuditPackModal
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Generate Audit Pack')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <AuditPackModal
        isOpen={false}
        onClose={jest.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should fetch and display workers', async () => {
    const mockWorkers = [
      { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
      { id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkers })
    });

    render(
      <AuditPackModal
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe (john@test.com)')).toBeInTheDocument();
    });
  });

  it('should generate audit pack on submit', async () => {
    const mockWorkers = [
      { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWorkers })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            packId: 'test-pack',
            fileSize: 1024,
            duration: 5000,
            docCount: 3,
            logCount: 10,
            downloadUrl: '/api/download/test-pack'
          }
        })
      });

    render(
      <AuditPackModal
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      const select = screen.getByDisplayValue('Choose a worker...');
      fireEvent.change(select, { target: { value: '1' } });
    });

    const generateBtn = screen.getByRole('button', { name: /Generate Pack/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Audit pack generated successfully!');
    });
  });

  it('should handle download of generated pack', async () => {
    const mockWorkers = [
      { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWorkers })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            packId: 'test-pack',
            fileSize: 1024,
            duration: 5000,
            downloadUrl: '/api/download/test-pack'
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['test-data'], { type: 'application/zip' })
      });

    const onClose = jest.fn();
    render(
      <AuditPackModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // Generate pack
    await waitFor(() => {
      const select = screen.getByDisplayValue('Choose a worker...');
      fireEvent.change(select, { target: { value: '1' } });
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Pack/i }));

    // Download pack
    await waitFor(() => {
      const downloadBtn = screen.getByRole('button', { name: /Download Now/i });
      fireEvent.click(downloadBtn);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Download started!');
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('CQC Checklist Component (R-AP-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and display CQC checklist', async () => {
    const mockChecklist = {
      agencyName: 'Test Agency',
      overallStatus: 'green',
      overallCompliance: 95,
      readyForCQC: true,
      metrics: {
        totalWorkers: 10,
        compliantWorkers: 10,
        nonCompliantWorkers: 0,
        expiringDocumentsCount: 0,
        expiredDocumentsCount: 0
      },
      actionItems: [],
      workerChecks: [
        {
          workerId: '1',
          name: 'John Doe',
          status: 'green',
          compliantScore: 100,
          totalDocs: 5,
          approvedDocs: 5,
          expiringDocs: 0,
          expiredDocs: 0,
          issues: []
        }
      ],
      generatedAt: new Date().toISOString()
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChecklist })
    });

    render(<CQCChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Agency Ready for CQC')).toBeInTheDocument();
    });
  });

  it('should show green status when agency is compliant', async () => {
    const mockChecklist = {
      agencyName: 'Test Agency',
      overallStatus: 'green',
      overallCompliance: 95,
      readyForCQC: true,
      metrics: {
        totalWorkers: 10,
        compliantWorkers: 10,
        nonCompliantWorkers: 0,
        expiringDocumentsCount: 0,
        expiredDocumentsCount: 0
      },
      actionItems: [],
      workerChecks: [],
      generatedAt: new Date().toISOString()
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChecklist })
    });

    render(<CQCChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Agency Ready for CQC')).toBeInTheDocument();
    });
  });

  it('should show red status with critical action items', async () => {
    const mockChecklist = {
      agencyName: 'Test Agency',
      overallStatus: 'red',
      overallCompliance: 60,
      readyForCQC: false,
      metrics: {
        totalWorkers: 10,
        compliantWorkers: 6,
        nonCompliantWorkers: 4,
        expiringDocumentsCount: 2,
        expiredDocumentsCount: 1
      },
      actionItems: [
        {
          priority: 'CRITICAL',
          action: 'Address 1 expired documents immediately',
          description: 'Cannot place workers on shift with expired documents',
          affectedWorkers: ['Jane Smith']
        }
      ],
      workerChecks: [],
      generatedAt: new Date().toISOString()
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChecklist })
    });

    render(<CQCChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Agency Requires Attention')).toBeInTheDocument();
      expect(screen.getByText(/Address 1 expired documents/)).toBeInTheDocument();
    });
  });

  it('should display metrics cards', async () => {
    const mockChecklist = {
      agencyName: 'Test Agency',
      overallStatus: 'green',
      overallCompliance: 100,
      readyForCQC: true,
      metrics: {
        totalWorkers: 10,
        compliantWorkers: 10,
        nonCompliantWorkers: 0,
        expiringDocumentsCount: 0,
        expiredDocumentsCount: 0
      },
      actionItems: [],
      workerChecks: [],
      generatedAt: new Date().toISOString()
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChecklist })
    });

    render(<CQCChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Total Workers')).toBeInTheDocument();
      expect(screen.getByText('Compliant')).toBeInTheDocument();
      expect(screen.getByText('Non-Compliant')).toBeInTheDocument();
    });
  });

  it('should allow refreshing checklist', async () => {
    const mockChecklist = {
      agencyName: 'Test Agency',
      overallStatus: 'green',
      overallCompliance: 95,
      readyForCQC: true,
      metrics: {
        totalWorkers: 10,
        compliantWorkers: 10,
        nonCompliantWorkers: 0,
        expiringDocumentsCount: 0,
        expiredDocumentsCount: 0
      },
      actionItems: [],
      workerChecks: [],
      generatedAt: new Date().toISOString()
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockChecklist })
    });

    render(<CQCChecklist />);

    await waitFor(() => {
      const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshBtn);
    });

    expect(toast.success).toHaveBeenCalledWith('Checklist refreshed');
  });

  it('should display action items with priority levels', async () => {
    const mockChecklist = {
      agencyName: 'Test Agency',
      overallStatus: 'yellow',
      overallCompliance: 70,
      readyForCQC: false,
      metrics: {
        totalWorkers: 10,
        compliantWorkers: 7,
        nonCompliantWorkers: 3,
        expiringDocumentsCount: 5,
        expiredDocumentsCount: 0
      },
      actionItems: [
        {
          priority: 'HIGH',
          action: 'Review 3 non-compliant workers',
          description: 'These workers do not meet compliance requirements',
          affectedWorkers: ['John Doe', 'Jane Smith', 'Bob Johnson']
        },
        {
          priority: 'MEDIUM',
          action: 'Renew 5 documents expiring within 30 days',
          description: 'Proactively renew to avoid compliance gaps',
          affectedWorkers: ['Alice Wonder']
        }
      ],
      workerChecks: [],
      generatedAt: new Date().toISOString()
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChecklist })
    });

    render(<CQCChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Review 3 non-compliant workers')).toBeInTheDocument();
      expect(screen.getByText('Renew 5 documents expiring within 30 days')).toBeInTheDocument();
    });
  });
});

describe('Integration: Audit Pack + CQC Checklist', () => {
  it('should provide unified compliance interface', async () => {
    const mockWorkers = [
      { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
    ];

    const mockChecklist = {
      agencyName: 'Test Agency',
      overallStatus: 'green',
      overallCompliance: 100,
      readyForCQC: true,
      metrics: {
        totalWorkers: 1,
        compliantWorkers: 1,
        nonCompliantWorkers: 0,
        expiringDocumentsCount: 0,
        expiredDocumentsCount: 0
      },
      actionItems: [],
      workerChecks: [],
      generatedAt: new Date().toISOString()
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWorkers })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockChecklist })
      });

    const { rerender } = render(
      <AuditPackModal isOpen={true} onClose={jest.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe (john@test.com)')).toBeInTheDocument();
    });

    rerender(<CQCChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Agency Ready for CQC')).toBeInTheDocument();
    });
  });
});
