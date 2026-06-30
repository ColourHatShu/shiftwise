/**
 * Compliance Dashboard Utilities
 * Helper functions for worker compliance list, filtering, and export
 */

export interface ComplianceScore {
    score: number;
    completedDocs: number;
    totalRequiredDocs: number;
    status: 'red' | 'yellow' | 'green';
}

export interface Worker {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle?: string;
    status: string;
    complianceScore: number;
    complianceStatus: 'red' | 'yellow' | 'green';
    completedDocs: number;
    totalRequiredDocs: number;
    lastUpdated: string;
    hasExpiringDocs: boolean;
}

/**
 * Determine compliance status color based on score
 */
export function getComplianceStatus(score: number): 'red' | 'yellow' | 'green' {
    if (score >= 80) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: 'red' | 'yellow' | 'green'): string {
    const labels = {
        red: 'Non-Compliant',
        yellow: 'At Risk',
        green: 'Compliant'
    };
    return labels[status];
}

/**
 * Get background color class for status badge
 */
export function getStatusBgClass(status: 'red' | 'yellow' | 'green'): string {
    const classes = {
        red: 'bg-[#FEE2E2]',
        yellow: 'bg-[#FEF3C7]',
        green: 'bg-[#DCFCE7]'
    };
    return classes[status];
}

/**
 * Get text color class for status badge
 */
export function getStatusTextClass(status: 'red' | 'yellow' | 'green'): string {
    const classes = {
        red: 'text-[#991B1B]',
        yellow: 'text-[#92400E]',
        green: 'text-[#166534]'
    };
    return classes[status];
}

/**
 * Get hex color for status (for use in progress bars, etc.)
 */
export function getStatusHexColor(status: 'red' | 'yellow' | 'green'): string {
    const colors = {
        red: '#DC2626',
        yellow: '#EA580C',
        green: '#16A34A'
    };
    return colors[status];
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(d);
}

/**
 * Calculate overall compliance rate for an agency
 */
export function calculateOverallCompliance(workers: Worker[]): number {
    if (workers.length === 0) return 0;
    const totalScore = workers.reduce((sum, w) => sum + w.complianceScore, 0);
    return Math.round(totalScore / workers.length);
}

/**
 * Group workers by compliance status
 */
export function groupByStatus(workers: Worker[]): {
    red: Worker[];
    yellow: Worker[];
    green: Worker[];
} {
    return {
        red: workers.filter(w => w.complianceStatus === 'red'),
        yellow: workers.filter(w => w.complianceStatus === 'yellow'),
        green: workers.filter(w => w.complianceStatus === 'green')
    };
}

/**
 * Filter workers by search term
 */
export function filterWorkers(
    workers: Worker[],
    searchTerm: string
): Worker[] {
    if (!searchTerm) return workers;

    const term = searchTerm.toLowerCase();
    return workers.filter(w =>
        w.firstName.toLowerCase().includes(term) ||
        w.lastName.toLowerCase().includes(term) ||
        w.email.toLowerCase().includes(term) ||
        (w.jobTitle?.toLowerCase().includes(term) ?? false)
    );
}

/**
 * Sort workers by specified field
 */
export function sortWorkers(
    workers: Worker[],
    sortBy: 'name' | 'score' | 'updated',
    order: 'asc' | 'desc' = 'asc'
): Worker[] {
    const sorted = [...workers].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'name':
                comparison = `${a.firstName} ${a.lastName}`.localeCompare(
                    `${b.firstName} ${b.lastName}`
                );
                break;
            case 'score':
                comparison = a.complianceScore - b.complianceScore;
                break;
            case 'updated':
                comparison = new Date(a.lastUpdated).getTime() -
                    new Date(b.lastUpdated).getTime();
                break;
        }

        return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
}

/**
 * Paginate workers array
 */
export function paginateWorkers(
    workers: Worker[],
    page: number,
    pageSize: number = 20
): { workers: Worker[]; totalPages: number } {
    const totalPages = Math.ceil(workers.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
        workers: workers.slice(start, end),
        totalPages
    };
}

/**
 * Export workers to CSV format
 */
export function exportWorkersToCsv(workers: Worker[], filename: string = 'workers.csv'): void {
    const headers = ['Name', 'Email', 'Job Title', 'Compliance Score', 'Status', 'Documents', 'Last Updated'];
    const rows = workers.map(w => [
        `${w.firstName} ${w.lastName}`,
        w.email,
        w.jobTitle || 'N/A',
        `${w.complianceScore}%`,
        getStatusLabel(w.complianceStatus),
        `${w.completedDocs}/${w.totalRequiredDocs}`,
        formatDate(w.lastUpdated)
    ]);

    const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

/**
 * Verify compliance score calculation matches Phase 4 worker portal logic
 * Formula: (completed_required / total_required) * 100
 */
export function verifyScoreFormula(
    completedDocs: number,
    totalRequired: number
): number {
    if (totalRequired === 0) return 100;
    return Math.round((completedDocs / totalRequired) * 100);
}

/**
 * Check if a worker has expiring documents soon (within 7 days)
 */
export function hasExpiringDocs(worker: Worker, days: number = 7): boolean {
    // This is populated server-side based on document expiryDate
    return worker.hasExpiringDocs;
}

/**
 * Build query string for filters
 */
export function buildQueryString(filters: {
    page?: number;
    search?: string;
    status?: 'red' | 'yellow' | 'green' | null;
    sortBy?: 'name' | 'score' | 'updated';
    sortOrder?: 'asc' | 'desc';
}): string {
    const params = new URLSearchParams();

    if (filters.page && filters.page > 1) params.set('page', filters.page.toString());
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.sortBy && filters.sortBy !== 'name') params.set('sortBy', filters.sortBy);
    if (filters.sortOrder && filters.sortOrder !== 'asc') params.set('sortOrder', filters.sortOrder);

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
}

/**
 * Parse query string to filters object
 */
export function parseQueryString(queryString: string): {
    page: number;
    search: string;
    status: 'red' | 'yellow' | 'green' | null;
    sortBy: 'name' | 'score' | 'updated';
    sortOrder: 'asc' | 'desc';
} {
    const params = new URLSearchParams(queryString);

    return {
        page: parseInt(params.get('page') || '1', 10),
        search: params.get('search') || '',
        status: (params.get('status') as any) || null,
        sortBy: (params.get('sortBy') as any) || 'name',
        sortOrder: (params.get('sortOrder') as any) || 'asc'
    };
}
