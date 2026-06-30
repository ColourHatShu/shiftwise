import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Skeleton — a lightweight shimmer placeholder used while content loads.
 * Compose page-specific skeletons by sizing it with Tailwind utilities, e.g.
 * <Skeleton className="h-4 w-40" /> or <Skeleton className="h-10 w-10 rounded-lg" />.
 * Decorative only: hidden from assistive tech via aria-hidden.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-md bg-[#E6EDF8] ${className}`}
    {...props}
  />
);

export default Skeleton;
