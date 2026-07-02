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
      className={clsx('mx-auto my-2 flex w-full flex-col gap-2 bg-card p-3', {
        // width
        'max-w-md': width === 'default',
        'max-w-4xl': width === 'full',
      })}
    >
      {title && <div className="text-xl font-semibold">{title}</div>}
      {children}
      {actions && <div className="flex justify-center">{actions}</div>}
    </div>
  );
};
