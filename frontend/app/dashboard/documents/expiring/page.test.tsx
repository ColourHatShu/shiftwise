import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExpiringDocumentsPage from './page';

const mockApiFetch = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => ({ apiFetch: mockApiFetch }) }));

const respond = (body: unknown) => ({ ok: true, json: async () => body });

describe('ExpiringDocumentsPage', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
    });

    it('renders an overdue document row with its urgency label', async () => {
        mockApiFetch.mockResolvedValue(
            respond({
                data: [
                    {
                        documentId: 'd1',
                        workerId: 'w1',
                        workerName: 'Jane Doe',
                        documentType: 'DBS Check',
                        expiryDate: '2026-07-01',
                        daysUntilExpiry: -3,
                        overdue: true,
                        status: 'APPROVED',
                    },
                ],
                summary: { total: 1, overdue: 1, windowDays: 30 },
            })
        );

        render(<ExpiringDocumentsPage />);

        expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('DBS Check')).toBeInTheDocument();
        expect(screen.getByText(/Expired 3d ago/i)).toBeInTheDocument();
    });

    it('shows an empty state when nothing is expiring in the window', async () => {
        mockApiFetch.mockResolvedValue(respond({ data: [], summary: { total: 0, overdue: 0, windowDays: 30 } }));

        render(<ExpiringDocumentsPage />);

        expect(await screen.findByText(/Nothing expiring in this window/i)).toBeInTheDocument();
    });
});
