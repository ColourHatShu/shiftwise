import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkerScorecardsPage from './page';

const mockApiFetch = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => ({ apiFetch: mockApiFetch }) }));

const respond = (body: unknown) => ({ ok: true, json: async () => body });

describe('WorkerScorecardsPage', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
    });

    it('renders a worker row with its confirmation rate', async () => {
        mockApiFetch.mockResolvedValue(
            respond({
                data: [
                    { workerId: 'w1', firstName: 'Jane', lastName: 'Doe', totalAssignments: 10, confirmed: 8, declined: 2, pending: 0, confirmationRate: 80 },
                ],
            })
        );

        render(<WorkerScorecardsPage />);

        expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('shows an empty state when there is no reliability data', async () => {
        mockApiFetch.mockResolvedValue(respond({ data: [] }));

        render(<WorkerScorecardsPage />);

        expect(await screen.findByText(/No reliability data yet/i)).toBeInTheDocument();
    });
});
