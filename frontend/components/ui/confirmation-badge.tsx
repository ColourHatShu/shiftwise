import React from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * ConfirmationBadge — shared pill for a worker's shift-confirmation state
 * (pending / confirmed / declined). Previously this exact switch was duplicated
 * in the coordinator AssignmentList and the worker assigned-shifts page.
 *
 * Uses the same Tailwind palette as before (named colors) so adoption is a
 * pixel-for-pixel swap. Pass `withIcon` to show the check/x icons (used in the
 * worker portal).
 */
interface ConfirmationBadgeProps {
    status: "pending" | "confirmed" | "declined" | string;
    withIcon?: boolean;
}

export function ConfirmationBadge({ status, withIcon = false }: ConfirmationBadgeProps) {
    switch (status) {
        case "confirmed":
            return (
                <Badge className="bg-green-100 text-green-800">
                    {withIcon && <Check className="h-3 w-3 mr-1" />}
                    Confirmed
                </Badge>
            );
        case "declined":
            return (
                <Badge className="bg-orange-100 text-orange-800">
                    {withIcon && <X className="h-3 w-3 mr-1" />}
                    Declined
                </Badge>
            );
        default:
            return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
}

export default ConfirmationBadge;
