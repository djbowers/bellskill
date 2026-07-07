import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  SessionProgress,
  SessionState,
  WeekProgress,
  useProgramProgress,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { cn } from '~/lib/utils';

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
    weeks,
    completedCount,
    totalCount,
    currentWeek,
    totalWeeks,
    isComplete,
  } = data;

  const percent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
              {isComplete
                ? '🎉 Program complete'
                : `Week ${currentWeek} of ${totalWeeks}`}
            </span>
            <span className="text-muted-foreground">
              {completedCount} of {totalCount} sessions
            </span>
          </div>
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
        </CardContent>
      </Card>

      {weeks.map((week) => (
        <WeekRow key={week.weekNumber} week={week} />
      ))}
    </Page>
  );
};

const WeekRow = ({ week }: { week: WeekProgress }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs font-medium text-muted-foreground">
      Week {week.weekNumber}
    </span>
    <div className="flex flex-wrap gap-1">
      {week.sessions.map((item) => (
        <SessionChip key={item.session.id} item={item} />
      ))}
    </div>
  </div>
);

const SessionChip = ({ item }: { item: SessionProgress }) => {
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

  // Completed sessions link to their logged workout; skipped/upcoming are static.
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

  return <div className={baseClassName}>{label}</div>;
};
