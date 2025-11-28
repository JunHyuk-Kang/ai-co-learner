import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-[#121212] border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all ${className}`}
        {...props}
      />
    </div>
  );
};