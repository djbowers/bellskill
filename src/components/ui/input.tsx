import * as React from 'react';

import { cn } from '~/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

const Input = ({ className, type, ...props }: InputProps) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-4 w-full rounded-md border border-input bg-transparent px-1 py-0.5 text-base shadow-sm transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
};
Input.displayName = 'Input';

export { Input };
