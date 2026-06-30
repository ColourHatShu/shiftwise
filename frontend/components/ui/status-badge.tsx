import React from "react";

type StatusStyle = { label: string; className: string };

/**
 * Centralized status → pill-style map. Previously this color/label logic was
 * duplicated across the workers list, document tables, worker-detail modal,
 * etc. Keep all status vocabularies here so badges stay consistent app-wide.
 */
const STATUS_STYLES: Record<string, StatusStyle> = {
    // Worker statuses
    ACTIVE: { label: "Active", className: "bg-[#DCFCE7] text-[#166534]" },
    INACTIVE: { label: "Inactive", className: "bg-[#EBEEF5] text-[#5B6E8C]" },
    SUSPENDED: { label: "Suspended", className: "bg-[#FEF3C7] text-[#92400E]" },
    // Document / compliance statuses
    NOT_UPLOADED: { label: "Not Uploaded", className: "bg-[#EBEEF5] text-[#5B6E8C]" },
    PENDING: { label: "Pending Review", className: "bg-[#FEF3C7] text-[#92400E]" },
    APPROVED: { label: "Verified", className: "bg-[#DCFCE7] text-[#166534]" },
    EXPIRING_SOON: { label: "Expiring Soon", className: "bg-[#FEF3C7] text-[#92400E]" },
    EXPIRED: { label: "Expired", className: "bg-[#FEE2E2] text-[#991B1B]" },
    REJECTED: { label: "Non-Compliant", className: "bg-[#FEE2E2] text-[#991B1B]" },
};

const UNKNOWN_STYLE: StatusStyle = { label: "Unknown", className: "bg-[#FEE2E2] text-[#991B1B]" };

/** Resolve a status string to its pill style, with an optional fallback key. */
export function getStatusStyle(status: string, fallbackStatus?: string): StatusStyle {
    return (
        STATUS_STYLES[status] ||
        (fallbackStatus ? STATUS_STYLES[fallbackStatus] : undefined) ||
        UNKNOWN_STYLE
    );
}

interface StatusBadgeProps {
    /** Status key, e.g. "ACTIVE", "APPROVED", "EXPIRED". */
    status: string;
    /** Override the displayed label (defaults to the mapped label). */
    label?: string;
    /** Style to use when `status` is unknown (defaults to a red "Unknown"). */
    fallbackStatus?: string;
    className?: string;
}

/**
 * StatusBadge — the single source of truth for status pills across the app.
 *
 *   <StatusBadge status={worker.status} />
 *   <StatusBadge status={docStatus} fallbackStatus="NOT_UPLOADED" />
 */
export function StatusBadge({ status, label, fallbackStatus, className = "" }: StatusBadgeProps) {
    const style = getStatusStyle(status, fallbackStatus);
    return (
        <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${style.className} ${className}`}
        >
            {label ?? style.label}
        </span>
    );
}

export default StatusBadge;
