import React from 'react';

type Variant = 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-blue-600 text-white hover:bg-blue-700',
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
  ghost: 'bg-transparent text-gray-900 hover:bg-gray-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', className = '', children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500';
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export default Button;
