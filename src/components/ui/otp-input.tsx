import * as React from 'react';

import { cn } from '~/lib/utils';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  className?: string;
  disabled?: boolean;
}

const OtpInput = React.forwardRef<HTMLDivElement, OtpInputProps>(
  (
    { value, onChange, onComplete, length = 6, className, disabled = false },
    ref,
  ) => {
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (index: number, inputValue: string) => {
      const digit = inputValue.replace(/\D/g, '').slice(-1);

      const newValue = value.split('');
      newValue[index] = digit;
      const updatedValue = newValue.join('');

      onChange(updatedValue);

      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (updatedValue.length === length && onComplete) {
        onComplete(updatedValue);
      }
    };

    const handleKeyDown = (
      index: number,
      e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
      const newValue = pastedData.slice(0, length);
      onChange(newValue);

      const focusIndex = Math.min(newValue.length, length - 1);
      setTimeout(() => {
        inputRefs.current[focusIndex]?.focus();
      }, 0);

      if (newValue.length === length && onComplete) {
        onComplete(newValue);
      }
    };

    return (
      <div
        ref={ref}
        className={cn('flex justify-center gap-2', className)}
        onPaste={handlePaste}
      >
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={disabled}
            className={cn(
              'h-5 w-5 rounded-md border border-input bg-transparent text-center text-base font-semibold shadow-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              value[index] ? 'border-primary' : 'border-input',
            )}
          />
        ))}
      </div>
    );
  },
);

OtpInput.displayName = 'OtpInput';

export { OtpInput };
