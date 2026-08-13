import { Link } from 'react-router-dom';

import { OverflowMenu, OverflowMenuAction, ProgramTags } from '~/components';
import { Button, ButtonProps } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { Program } from '~/types';
import { programCadenceLabel } from '~/utils';

import {
  MyProgramCardState,
  myProgramCardState,
  programSpanLabel,
} from '../utils';

export interface MyProgramCardProps {
  program: Program;
  isActive: boolean;
  isQueued: boolean;
  /** This card's "Start" is routing (reading prior progress) — hold the CTA. */
  isStarting: boolean;
  pending: {
    enroll: boolean;
    resume: boolean;
    cancel: boolean;
    archive: boolean;
    delete: boolean;
  };
  onStart: () => void;
  onAddSessions: () => void;
  onViewProgress: () => void;
  onQueueForLater: () => void;
  onRename: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const STATE_LABEL: Record<MyProgramCardState, string> = {
  active: 'Active',
  queued: 'Queued',
  ready: 'Ready',
  draft: 'Draft',
};

/**
 * Three visual tiers, so a running program never reads like an unfinished one:
 * an active card is lit (primary ring, solid rail, coloured eyebrow), ready and
 * queued sit at the neutral baseline, and a draft is visibly provisional —
 * dashed border, muted field, quieter CTA.
 */
const STATE_STYLES: Record<
  MyProgramCardState,
  {
    card: string;
    rail: string;
    eyebrow: string;
    dot: string;
    title: string;
    cta: ButtonProps['variant'];
  }
> = {
  active: {
    card: 'border-primary/50 shadow-md ring-1 ring-primary/15',
    rail: 'bg-primary text-primary-foreground',
    eyebrow: 'text-primary',
    dot: 'bg-primary',
    title: 'text-foreground',
    cta: 'default',
  },
  ready: {
    card: '',
    rail: 'bg-primary/10 text-primary',
    eyebrow: 'text-muted-foreground',
    dot: 'bg-muted-foreground/50',
    title: 'text-foreground',
    cta: 'default',
  },
  queued: {
    card: '',
    rail: 'bg-secondary text-muted-foreground',
    eyebrow: 'text-muted-foreground',
    dot: 'bg-muted-foreground/50',
    title: 'text-foreground',
    cta: 'secondary',
  },
  draft: {
    card: 'border-dashed bg-muted/30 shadow-none',
    rail: 'bg-secondary text-muted-foreground',
    eyebrow: 'text-muted-foreground',
    dot: 'bg-muted-foreground/50',
    title: 'text-muted-foreground',
    cta: 'secondary',
  },
};

export const MyProgramCard = ({
  program,
  isActive,
  isQueued,
  isStarting,
  pending,
  onStart,
  onAddSessions,
  onViewProgress,
  onQueueForLater,
  onRename,
  onCancel,
  onArchive,
  onDelete,
}: MyProgramCardProps) => {
  const cadence = programCadenceLabel(program);
  const state = myProgramCardState(program, { isActive, isQueued });
  const styles = STATE_STYLES[state];

  // One CTA per state: pick up an active program, give a draft the sessions it
  // is missing, start anything that's ready. A queued program starts from "Up
  // next" when its turn comes, never as a second enrollment from here.
  const primary =
    state === 'draft'
      ? { label: 'Add sessions', onClick: onAddSessions, disabled: false }
      : state === 'ready'
        ? {
            label: 'Start program',
            onClick: onStart,
            disabled: pending.enroll || pending.resume || isStarting,
          }
        : { label: 'View progress', onClick: onViewProgress, disabled: false };

  const menuActions: OverflowMenuAction[] = [
    { label: 'Rename program', onSelect: onRename },
    ...(state === 'draft'
      ? []
      : [{ label: 'Edit sessions', onSelect: onAddSessions }]),
    ...(primary.label === 'View progress'
      ? []
      : [{ label: 'View progress', onSelect: onViewProgress }]),
    ...(!isActive && !isQueued
      ? [
          {
            label: 'Queue for later',
            onSelect: onQueueForLater,
            disabled: pending.enroll,
          },
        ]
      : []),
    ...(isActive
      ? [
          {
            label: 'Cancel program',
            onSelect: onCancel,
            disabled: pending.cancel,
          },
        ]
      : [
          {
            label: 'Archive program',
            onSelect: onArchive,
            disabled: pending.archive,
          },
        ]),
    {
      label: 'Delete program',
      onSelect: onDelete,
      disabled: pending.delete,
      destructive: true,
    },
  ];

  return (
    <Card
      data-testid="my-program-card"
      className={cn('flex flex-col gap-2 p-2', styles.card)}
    >
      <div className="flex items-start gap-1.5">
        <span
          aria-hidden
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums',
            styles.rail,
          )}
        >
          {programSpanLabel(program)}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium uppercase tracking-wide',
              styles.eyebrow,
            )}
          >
            <span
              aria-hidden
              className={cn('h-0.5 w-0.5 rounded-full', styles.dot)}
            />
            {STATE_LABEL[state]}
          </span>
          <Link
            to={`/programs/${program.id}`}
            className={cn(
              'truncate text-sm font-semibold leading-tight hover:underline',
              styles.title,
            )}
          >
            {program.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {cadence ?? 'No sessions yet'}
          </p>
          <ProgramTags tags={program.focusTags} className="mt-0.5" />
        </div>

        <OverflowMenu actions={menuActions} menuLabel={program.title} />
      </div>

      <Button
        className="w-full"
        variant={styles.cta}
        onClick={primary.onClick}
        disabled={primary.disabled}
      >
        {primary.label}
      </Button>
    </Card>
  );
};
