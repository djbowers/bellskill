import { ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  SessionProgress,
  SessionState,
  WeekProgress,
  useProgramProgress,
  useQueuedPrograms,
  useSetProgramAutoRepeat,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { cn } from '~/lib/utils';
import { ProgramSession } from '~/types';

import { AdjustWeightsDialog } from './components/AdjustWeightsDialog';
import { StageCard } from './components/StageCard';

/**
 * Three session states, three different-looking chips. A done chip is filled and
 * settled, an actionable chip is raised and carries a play glyph, and an inert
 * chip (skipped, or upcoming with no active enrollment) is flat and dimmed — so
 * "what can I tap" is answerable without reading a single label.
 */
const CHIP_STYLES: Record<SessionState | 'inert', string> = {
  done: 'border-transparent bg-primary/10 text-foreground',
  upcoming:
    'border-border bg-card text-foreground shadow-sm hover:border-primary hover:bg-primary/5 active:translate-y-px',
  skipped:
    'border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground',
  inert: 'border-border/60 bg-transparent text-muted-foreground',
};

export const ProgramProgressPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProgramProgress(id);
  const setAutoRepeat = useSetProgramAutoRepeat();
  const { data: queuedPrograms = [] } = useQueuedPrograms();
  const [adjustingWeights, setAdjustingWeights] = useState(false);

  if (isLoading) {
    return (
      <Page title="Program progress">
        <p className="text-sm text-muted-foreground">Loading progress…</p>
      </Page>
    );
  }

  if (isError || !data) {
    return (
      <Page title="Program progress">
        <p className="text-sm text-muted-foreground">Program not found.</p>
        <Button variant="secondary" onClick={() => navigate('/programs')}>
          Back to programs
        </Button>
      </Page>
    );
  }

  const {
    program,
    enrollment,
    weeks,
    completedCount,
    totalCount,
    currentWeek,
    totalWeeks,
    isComplete,
  } = data;

  const percent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // A repeating enrollment never "completes" — it loops. Show its cycle count
  // and, for a single-session repeat, drop the within-cycle progress bar (it
  // would sit empty). Multi-session repeats keep the bar to show cycle progress.
  const isRepeating = enrollment?.autoRepeat ?? false;
  const showProgressBar = !isRepeating || totalCount > 1;
  const cyclesCompleted = enrollment?.cyclesCompleted ?? 0;

  // An upcoming session is startable only while the enrollment is active — any
  // session, not just the next one. Starting a later session leaves the earlier
  // ones upcoming (gaps); the home card still surfaces the lowest incomplete.
  const canStartSessions = enrollment?.status === 'active';

  // The front of the user's queue — it takes the slot this program frees when
  // it finishes, superseding auto-repeat until the queue drains.
  const nextQueued = queuedPrograms[0] ?? null;

  // Hand the chosen session off to the launchpad builder via nav state; the home
  // page loads it, tags the start `program`, and advances this enrollment on
  // completion.
  const handleStartSession = (session: ProgramSession) => {
    if (!enrollment) return;
    navigate('/', {
      state: {
        startProgramSession: {
          session,
          userProgramId: enrollment.id,
          programTitle: program.title,
        },
      },
    });
  };

  return (
    <Page title={program.title}>
      <Link
        to="/programs"
        className="self-start text-xs font-medium text-muted-foreground"
      >
        ← Programs
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-2">
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium uppercase tracking-wide',
              isComplete && !isRepeating
                ? 'text-status-success'
                : 'text-muted-foreground',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-0.5 w-0.5 rounded-full',
                isComplete && !isRepeating ? 'bg-status-success' : 'bg-primary',
              )}
            />
            {isRepeating ? 'Repeating' : isComplete ? 'Complete' : 'In progress'}
          </span>

          <div className="flex items-baseline justify-between gap-1">
            <span className="text-lg font-semibold leading-tight">
              {isRepeating
                ? 'Repeating workout'
                : isComplete
                  ? '🎉 Program complete'
                  : `Week ${currentWeek} of ${totalWeeks}`}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {isRepeating
                ? `${cyclesCompleted} ${cyclesCompleted === 1 ? 'cycle' : 'cycles'} done`
                : `${completedCount} of ${totalCount} sessions`}
            </span>
          </div>

          {showProgressBar && (
            <div
              className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          {enrollment?.status === 'active' && nextQueued && (
            <p className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground">
              Next up: {nextQueued.program.title}
              {isRepeating ? ' (queued programs start before a repeat)' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {enrollment && (
        <Card>
          <CardContent className="flex flex-col gap-1.5 pt-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Program settings
            </h2>

            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-px">
                <Label htmlFor="auto-repeat" size="small">
                  Repeat automatically when finished
                </Label>
                <span className="text-xs text-muted-foreground">
                  Starts a fresh cycle instead of ending the program.
                </span>
              </div>
              <Switch
                id="auto-repeat"
                checked={isRepeating}
                disabled={setAutoRepeat.isPending}
                onCheckedChange={(autoRepeat) =>
                  setAutoRepeat.mutate({
                    userProgramId: enrollment.id,
                    autoRepeat,
                  })
                }
              />
            </div>

            {canStartSessions && (
              <div className="flex flex-col gap-0.5 border-t border-border pt-1.5">
                <span className="text-xs text-muted-foreground">
                  Change the working weight on every session you haven&apos;t
                  done yet.
                </span>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setAdjustingWeights(true)}
                >
                  Adjust weights
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {enrollment && !!program.stages?.length && (
        <StageCard
          userProgramId={enrollment.id}
          stages={program.stages}
          currentStageIndex={enrollment.currentStageIndex}
          canAdvance={enrollment.status === 'active'}
        />
      )}

      {enrollment && adjustingWeights && (
        <AdjustWeightsDialog
          open={adjustingWeights}
          onOpenChange={setAdjustingWeights}
          userProgramId={enrollment.id}
          sessionItems={weeks.flatMap((week) =>
            week.sessions.map((item) => ({
              session: item.session,
              state: item.state,
            })),
          )}
        />
      )}

      <section className="flex flex-col gap-1.5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sessions
        </h2>
        {weeks.map((week) => (
          <WeekRow
            key={week.weekNumber}
            week={week}
            canStartSessions={canStartSessions}
            onStartSession={handleStartSession}
          />
        ))}
      </section>
    </Page>
  );
};

interface WeekRowProps {
  week: WeekProgress;
  canStartSessions: boolean;
  onStartSession: (session: ProgramSession) => void;
}

const WeekRow = ({ week, canStartSessions, onStartSession }: WeekRowProps) => (
  <div className="flex flex-col gap-0.5">
    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
      Week {week.weekNumber}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </span>
    <div className="flex flex-wrap gap-1">
      {week.sessions.map((item) => (
        <SessionChip
          key={item.session.id}
          item={item}
          canStart={canStartSessions}
          onStart={onStartSession}
        />
      ))}
    </div>
  </div>
);

interface SessionChipProps {
  item: SessionProgress;
  canStart: boolean;
  onStart: (session: ProgramSession) => void;
}

const SessionChip = ({ item, canStart, onStart }: SessionChipProps) => {
  const { session, state, workoutLogId } = item;
  const isStartable = state === 'upcoming' && canStart;
  const isDoneLink = state === 'done' && workoutLogId !== null;

  const chipLabel = (glyph: ReactNode, muted?: boolean) => (
    <>
      {glyph}
      <span className={cn('font-medium', muted && 'line-through')}>
        Day {session.dayNumber}
      </span>
      <span className="truncate opacity-80">{session.title}</span>
    </>
  );

  const baseClassName =
    'flex max-w-full items-center gap-0.5 rounded-md border px-1.5 py-1 text-xs transition-colors';

  // Completed sessions link to their logged workout.
  if (isDoneLink) {
    return (
      <Link
        to={`/history/${workoutLogId}`}
        className={cn(
          baseClassName,
          CHIP_STYLES.done,
          'hover:cursor-pointer hover:bg-primary/20',
        )}
      >
        {chipLabel(
          <span
            aria-hidden
            className="flex h-1.5 w-1.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold leading-none text-primary-foreground"
          >
            ✓
          </span>,
        )}
      </Link>
    );
  }

  // Upcoming sessions are startable while enrolled — tap any one to start it.
  if (isStartable) {
    return (
      <button
        type="button"
        aria-label={`Start Day ${session.dayNumber} ${session.title}`}
        onClick={() => onStart(session)}
        className={cn(
          baseClassName,
          CHIP_STYLES.upcoming,
          'hover:cursor-pointer',
        )}
      >
        {chipLabel(
          <span aria-hidden className="text-[9px] text-primary">
            ▶
          </span>,
        )}
      </button>
    );
  }

  // Skipped sessions (and upcoming ones with no active enrollment) are static.
  return (
    <div
      className={cn(
        baseClassName,
        state === 'done'
          ? CHIP_STYLES.done
          : state === 'skipped'
            ? CHIP_STYLES.skipped
            : CHIP_STYLES.inert,
      )}
    >
      {chipLabel(
        state === 'skipped' ? (
          <span aria-hidden className="opacity-70">
            ⊘
          </span>
        ) : state === 'done' ? (
          <span aria-hidden className="text-primary">
            ✓
          </span>
        ) : null,
        state === 'skipped',
      )}
    </div>
  );
};
