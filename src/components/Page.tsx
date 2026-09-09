import clsx from 'clsx';
import { ReactNode } from 'react';

interface PageProps {
  actions?: ReactNode;
  children: ReactNode;
  title?: ReactNode;
  width?: 'default' | 'full';
}

export const Page = ({
  actions = null,
  children,
  title = null,
  width = 'default',
}: PageProps) => {
  return (
    <div
      className={clsx('mx-auto my-2 flex w-full flex-col gap-2 p-3', {
        'max-w-md': width === 'default',
        'max-w-4xl': width === 'full',
      })}
    >
      {title && (
        <div className="flex flex-col gap-1">
          <div className="font-display text-xl font-semibold tracking-tight">
            {title}
          </div>
          <div className="h-[2px] w-4 bg-cta" aria-hidden="true" />
        </div>
      )}
      {children}
      {actions && <div className="flex justify-center">{actions}</div>}
    </div>
  );
};
