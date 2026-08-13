import { OverflowMenu } from '~/components';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Program } from '~/types';
import { programCadenceLabel } from '~/utils';

import { programSpanLabel } from '../utils';

export interface ArchivedProgramCardProps {
  program: Program;
  pending: { archive: boolean; delete: boolean };
  onRestore: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * An archived program: restorable in one tap, deletable only from the overflow.
 * The cadence line goes through {@link programCadenceLabel} like every other
 * surface, so a program with no sessions reads "No sessions yet" rather than
 * the raw "null weeks · null/week" this card used to print.
 */
export const ArchivedProgramCard = ({
  program,
  pending,
  onRestore,
  onRename,
  onDelete,
}: ArchivedProgramCardProps) => (
  <Card className="flex flex-col gap-2 p-2 opacity-90">
    <div className="flex items-start gap-1.5">
      <span
        aria-hidden
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-semibold tabular-nums text-muted-foreground"
      >
        {programSpanLabel(program)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span
            aria-hidden
            className="h-0.5 w-0.5 rounded-full bg-muted-foreground/50"
          />
          Archived
        </span>
        <p className="truncate text-sm font-semibold leading-tight text-muted-foreground">
          {program.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {programCadenceLabel(program) ?? 'No sessions yet'}
        </p>
      </div>
      <OverflowMenu
        menuLabel={program.title}
        actions={[
          { label: 'Rename program', onSelect: onRename },
          {
            label: 'Delete program',
            onSelect: onDelete,
            disabled: pending.delete,
            destructive: true,
          },
        ]}
      />
    </div>
    <Button
      variant="secondary"
      className="w-full"
      onClick={onRestore}
      disabled={pending.archive}
    >
      Restore
    </Button>
  </Card>
);
