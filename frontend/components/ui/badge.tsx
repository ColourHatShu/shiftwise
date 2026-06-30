import React from 'react';

type Variant = 'default' | 'outline' | 'secondary' | 'success' | 'warning' | 'destructive' | 'danger';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-blue-100 text-blue-800 border-blue-200',
  outline: 'border border-gray-300 text-gray-700 bg-white',
  secondary: 'bg-gray-100 text-gray-800 border-gray-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  destructive: 'bg-red-100 text-red-800 border-red-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className = '', children, ...props }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
