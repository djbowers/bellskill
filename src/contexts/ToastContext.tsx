import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { Toast, ToastViewport } from '~/components/ui/toast';

export type ToastVariant = 'default' | 'destructive';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ShowToastOptions {
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. `0` disables auto-dismiss. */
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
}

// Default to a no-op so consumers outside the provider (Storybook, isolated
// component tests) degrade gracefully instead of throwing — mirrors the
// pattern in ProgramSessionContext.
// eslint-disable-next-line react-refresh/only-export-components -- context object is intentionally co-located with its Provider; splitting the module is out of scope for the lint pass
export const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

const DEFAULT_DURATION = 5000;

/**
 * App-wide toast host: the single, reusable error/notification mechanism.
 * Holds the active toast list, exposes `showToast` via context, and portals a
 * fixed viewport onto `document.body` so toasts overlay every route. Inert
 * until a toast fires, so mounting it app-wide is free.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ShowToastOptions) => {
      const id = nextId.current++;
      const variant = options?.variant ?? 'default';
      setToasts((current) => [...current, { id, message, variant }]);

      const duration = options?.duration ?? DEFAULT_DURATION;
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <ToastViewport>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              variant={toast.variant}
              onDismiss={() => dismiss(toast.id)}
            >
              {toast.message}
            </Toast>
          ))}
        </ToastViewport>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- consumer hook is intentionally co-located with its Provider; splitting the module is out of scope for the lint pass
export const useToast = () => useContext(ToastContext);
