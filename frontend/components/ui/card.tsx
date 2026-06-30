import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div
    className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={`border-b border-gray-200 px-6 py-4 ${className}`} {...props}>{children}</div>
);

export const CardContent: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>{children}</div>
);

export const CardFooter: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={`border-t border-gray-200 px-6 py-4 ${className}`} {...props}>{children}</div>
);

export const CardTitle: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`} {...props}>{children}</h3>
);

export default Card;
