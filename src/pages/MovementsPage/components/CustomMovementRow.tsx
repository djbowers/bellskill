import { OverflowMenu } from '~/components';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

export interface CustomMovementRowProps {
  canonicalName: string;
  logCount: number;
  onClickLink: () => void;
  onViewLogs: () => void;
  onDelete: () => void;
}

export const CustomMovementRow = ({
  canonicalName,
  logCount,
  onClickLink,
  onViewLogs,
  onDelete,
}: CustomMovementRowProps) => {
  const hasLogs = logCount > 0;
  const logCountLabel = `${logCount} ${logCount === 1 ? 'log' : 'logs'}`;

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-2">
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="flex min-w-0 max-w-full items-center gap-1">
          <span className="truncate text-sm">{canonicalName}</span>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Custom
          </Badge>
        </span>
        {hasLogs ? (
          <button
            type="button"
            onClick={onViewLogs}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {logCountLabel}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">{logCountLabel}</span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-0.5">
        <Button size="sm" onClick={onClickLink}>
          Link
        </Button>
        <OverflowMenu
          menuLabel={canonicalName}
          actions={[
            { label: 'View logs', onSelect: onViewLogs, disabled: !hasLogs },
            {
              label: 'Delete movement',
              onSelect: onDelete,
              destructive: true,
              disabled: hasLogs,
            },
          ]}
        />
      </span>
    </div>
  );
};
