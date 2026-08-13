import clsx from 'clsx';

interface ProgressBarProps {
  color?: 'success' | 'warning';
  completedPercentage: number;
  description?: string;
  size?: 'default' | 'large';
  value?: string;
}

export const ProgressBar = ({
  color = 'success',
  completedPercentage,
  description,
  size = 'default',
  value,
}: ProgressBarProps) => {
  return (
    <div
      className={clsx(
        'relative flex w-full rounded-md bg-accent text-accent-foreground',
        {
          'h-5': size === 'default',
          'h-6': size === 'large',
        },
      )}
    >
      <div
        className={clsx('rounded-md', {
          // Color
          'bg-status-success': color === 'success',
          'bg-status-warning': color === 'warning',

          // Size
          'h-5': size === 'default',
          'h-6': size === 'large',
        })}
        style={{ width: `${completedPercentage}%` }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className={clsx(
            'font-mono font-medium leading-none text-foreground',
            {
              'text-xl': size === 'default',
              'text-3xl': size === 'large',
            },
          )}
          data-testid="progress-bar-value"
        >
          {value ?? <>&infin;</>}
        </div>
        {description && (
          <span className="text-[10px] uppercase leading-none tracking-wide text-muted-foreground">
            {description}
          </span>
        )}
      </div>
    </div>
  );
};
