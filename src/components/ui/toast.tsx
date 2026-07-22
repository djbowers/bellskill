import * as React from 'react';

import { cn } from '~/lib/utils';

/**
 * Fixed overlay that stacks active toasts along the bottom of the screen. Inert
 * (`pointer-events-none`) so it never blocks the page when empty; individual
 * toasts re-enable pointer events for their dismiss button.
 */
const ToastViewport = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-1 p-2',
      className,
    )}
    {...props}
  />
);
ToastViewport.displayName = 'ToastViewport';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
  onDismiss?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

/** A single toast card. `destructive` uses the error color tokens. */
const Toast = ({
  className,
  variant = 'default',
  onDismiss,
  children,
  ...props
}: ToastProps) => (
  <div
    role="alert"
    className={cn(
      'pointer-events-auto flex w-full max-w-sm items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm shadow-lg',
      variant === 'destructive'
        ? 'border-destructive bg-destructive text-destructive-foreground'
        : 'border-border bg-background text-foreground',
      className,
    )}
    {...props}
  >
    <span>{children}</span>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-80 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    )}
  </div>
);
Toast.displayName = 'Toast';

export { Toast, ToastViewport };
