import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export default Textarea;
