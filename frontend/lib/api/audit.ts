export interface AuditLogEntry {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    userId?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    ipAddress?: string;
    user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    };
}

export interface AuditLogFilters {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface AuditLogResponse {
    data: AuditLogEntry[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export async function fetchAuditLog(
    filters: AuditLogFilters,
    token: string,
    apiUrl: string
): Promise<AuditLogResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.action) params.append("action", filters.action);
    if (filters.entity) params.append("entity", filters.entity);
    if (filters.userId) params.append("userId", filters.userId);
    if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.append("dateTo", filters.dateTo);

    const response = await fetch(`${apiUrl}/api/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch audit log");
    }

    return response.json();
}
