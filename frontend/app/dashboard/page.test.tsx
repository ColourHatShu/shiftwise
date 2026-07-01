import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: true }) }));

const mockApiFetch = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => ({ apiFetch: mockApiFetch }) }));

const respond = (body: unknown) => ({ ok: true, json: async () => body });

const routeApi = (needingAttention: number) =>
    mockApiFetch.mockImplementation((url: string) => {
        if (url.includes('shift-coverage')) return Promise.resolve(respond({ summary: { needingAttention, totalUpcoming: 3 } }));
        if (url.includes('agencies/me')) return Promise.resolve(respond({ data: { name: 'Test Agency' } }));
        // dashboard/stats
        return Promise.resolve(respond({ totalWorkers: 5, documentsPending: 1, expiringSoon: 2, compliantWorkers: 4 }));
    });

describe('DashboardPage — shift-coverage alert', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
    });

    it('shows the coverage alert when shifts need attention', async () => {
        routeApi(2);
        render(<DashboardPage />);
        const matches = await screen.findAllByText(/Review coverage/i); // nested span + anchor
        expect(matches.length).toBeGreaterThan(0);
    });

    it('hides the coverage alert when nothing needs attention', async () => {
        routeApi(0);
        render(<DashboardPage />);
        // Wait for load to complete (Compliance Overview always renders), then assert no alert.
        expect(await screen.findByText(/Compliance Overview/i)).toBeInTheDocument();
        expect(screen.queryAllByText(/Review coverage/i)).toHaveLength(0);
    });
});
