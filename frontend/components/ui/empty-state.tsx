import React from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
    /** Optional icon shown in a rounded tile above the title. */
    icon?: LucideIcon;
    title: string;
    message?: string;
    /** Optional CTA (a button or link). */
    action?: React.ReactNode;
    className?: string;
}

/**
 * Design-system empty state: icon tile + title + message + optional CTA.
 * Use anywhere a list/section can be empty so the look is consistent app-wide.
 */
export function EmptyState({ icon: Icon, title, message, action, className = "" }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
            {Icon && (
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E6EDF8]">
                    <Icon className="h-6 w-6 text-[#003087]" aria-hidden="true" />
                </div>
            )}
            <p className="text-sm font-medium text-[#0A1628]">{title}</p>
            {message && <p className="mt-1 max-w-sm text-sm text-[#5B6E8C]">{message}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export default EmptyState;
