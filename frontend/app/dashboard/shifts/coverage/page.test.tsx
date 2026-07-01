import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ShiftCoveragePage from './page';

const mockApiFetch = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => ({ apiFetch: mockApiFetch }) }));

const respond = (body: unknown) => ({ ok: true, json: async () => body });

describe('ShiftCoveragePage', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
    });

    it('renders a coverage row with its facility, status and shortfall', async () => {
        mockApiFetch.mockResolvedValue(
            respond({
                data: [
                    {
                        shiftId: 's1',
                        facilityName: 'St Mary Hospital',
                        shiftDate: '2026-07-10',
                        role: 'Nurse',
                        requiredCount: 3,
                        assignedCount: 1,
                        confirmedCount: 1,
                        shortfall: 2,
                        status: 'understaffed',
                    },
                ],
                summary: { totalUpcoming: 1, needingAttention: 1 },
            })
        );

        render(<ShiftCoveragePage />);

        expect(await screen.findByText('St Mary Hospital')).toBeInTheDocument();
        expect(screen.getByText('Understaffed')).toBeInTheDocument();
        expect(screen.getByText('1 / 3')).toBeInTheDocument(); // confirmed / required
    });

    it('shows an empty state when there are no upcoming shifts', async () => {
        mockApiFetch.mockResolvedValue(respond({ data: [], summary: { totalUpcoming: 0, needingAttention: 0 } }));

        render(<ShiftCoveragePage />);

        expect(await screen.findByText(/No upcoming shifts/i)).toBeInTheDocument();
    });
});
