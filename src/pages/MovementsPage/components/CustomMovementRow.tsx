import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

export interface CustomMovementRowProps {
  canonicalName: string;
  logCount: number;
  onClickLink: () => void;
}

export const CustomMovementRow = ({
  canonicalName,
  logCount,
  onClickLink,
}: CustomMovementRowProps) => (
  <div className="flex items-center justify-between gap-2 px-2 py-2">
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1">
        <span className="truncate text-sm">{canonicalName}</span>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          Custom
        </Badge>
      </span>
      <span className="text-xs text-muted-foreground">
        {logCount} {logCount === 1 ? 'log' : 'logs'}
      </span>
    </span>

    <Button size="sm" className="shrink-0" onClick={onClickLink}>
      Link
    </Button>
  </div>
);
