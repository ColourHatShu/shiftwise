import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, onChange, className = '', ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        onCheckedChange?.(e.target.checked);
        onChange?.(e);
      }}
      className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer ${className}`}
      {...props}
    />
  )
);
Checkbox.displayName = 'Checkbox';

export default Checkbox;
