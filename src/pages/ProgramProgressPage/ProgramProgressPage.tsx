import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  SessionProgress,
  SessionState,
  WeekProgress,
  useProgramProgress,
  useSetProgramAutoRepeat,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { cn } from '~/lib/utils';
import { ProgramSession } from '~/types';

/** Glyph + label + chip styling for each session state. */
const STATE_META: Record<SessionState, { icon: string; className: string }> = {
  done: {
    icon: '✓',
    className:
      'border-primary bg-primary/10 text-foreground hover:bg-primary/20',
  },
  skipped: {
    icon: '⊘',
    className: 'border-dashed border-muted-foreground/40 text-muted-foreground',
  },
  upcoming: {
    icon: '',
    className: 'border-border text-muted-foreground',
  },
};

export const ProgramProgressPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProgramProgress(id);
  const setAutoRepeat = useSetProgramAutoRepeat();

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
          <div className="flex items-baseline justify-between text-sm font-medium">
            <span>
              {isRepeating
                ? 'Repeating workout'
                : isComplete
                  ? '🎉 Program complete'
                  : `Week ${currentWeek} of ${totalWeeks}`}
            </span>
            <span className="text-muted-foreground">
              {isRepeating
                ? `${cyclesCompleted} ${cyclesCompleted === 1 ? 'cycle' : 'cycles'} done`
                : `${completedCount} of ${totalCount} sessions`}
            </span>
          </div>
          {showProgressBar && (
            <div
              className="h-0.5 w-full overflow-hidden rounded-full bg-secondary"
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
          {enrollment && (
            <div className="mt-1 flex items-center justify-between gap-2">
              <Label
                htmlFor="auto-repeat"
                size="small"
                className="text-muted-foreground"
              >
                Repeat automatically when finished
              </Label>
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
          )}
        </CardContent>
      </Card>

      {weeks.map((week) => (
        <WeekRow
          key={week.weekNumber}
          week={week}
          canStartSessions={canStartSessions}
          onStartSession={handleStartSession}
        />
      ))}
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
    <span className="text-xs font-medium text-muted-foreground">
      Week {week.weekNumber}
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
  const meta = STATE_META[state];

  const label = (
    <>
      {meta.icon && <span aria-hidden>{meta.icon}</span>}
      <span className="font-medium">Day {session.dayNumber}</span>
      <span className="truncate opacity-80">{session.title}</span>
    </>
  );

  const baseClassName = cn(
    'flex max-w-full items-center gap-0.5 rounded-md border px-1 py-0.5 text-xs',
    meta.className,
  );

  // Completed sessions link to their logged workout.
  if (state === 'done' && workoutLogId !== null) {
    return (
      <Link
        to={`/history/${workoutLogId}`}
        className={cn(baseClassName, 'hover:cursor-pointer')}
      >
        {label}
      </Link>
    );
  }

  // Upcoming sessions are startable while enrolled — tap any one to start it.
  if (state === 'upcoming' && canStart) {
    return (
      <button
        type="button"
        aria-label={`Start Day ${session.dayNumber} ${session.title}`}
        onClick={() => onStart(session)}
        className={cn(baseClassName, 'hover:cursor-pointer hover:bg-secondary')}
      >
        {label}
      </button>
    );
  }

  // Skipped sessions (and upcoming ones with no active enrollment) are static.
  return <div className={baseClassName}>{label}</div>;
};
