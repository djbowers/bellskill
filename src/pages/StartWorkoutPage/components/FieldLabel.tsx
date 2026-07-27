import { cn } from '~/lib/utils';

export const FieldLabel = ({
  children,
  className,
}: {
  children: string;
  className?: string;
}) => (
  <div
    className={cn(
      'text-xs font-medium uppercase tracking-wide text-muted-foreground',
      className,
    )}
  >
    {children}
  </div>
);
