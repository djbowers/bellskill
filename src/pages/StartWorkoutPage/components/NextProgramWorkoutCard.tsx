import { NextProgramSession, ProgramProgress } from '~/api';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { WorkoutGoalUnits } from '~/types';

export interface NextProgramWorkoutCardProps {
  /** The active program's title. */
  programTitle: string;
  /** The next unsatisfied session, or `null` when the program is complete. */
  nextSession: NextProgramSession | null;
  progress: ProgramProgress;
  isComplete: boolean;
  /** Load the next session into the builder for review, then start. */
  onStart: () => void;
  /** Record a `skipped` completion, advancing the cursor without a workout. */
  onSkip: () => void;
  /** Whether a skip is in flight (disables both actions). */
  skipping: boolean;
}

const estimatedDuration = (
  goal: number,
  units: WorkoutGoalUnits,
): string | null => {
  if (units === 'minutes') return `~${goal} min`;
  if (units === 'rounds') return `${goal} rounds`;
  return null; // volume goals have no meaningful time estimate here
};

export const NextProgramWorkoutCard = ({
  programTitle,
  nextSession,
  progress,
  isComplete,
  onStart,
  onSkip,
  skipping,
}: NextProgramWorkoutCardProps) => {
  if (isComplete || !nextSession) {
    return (
      <Card className="flex flex-col gap-1 p-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {programTitle}
        </span>
        <span className="text-sm font-semibold">🎉 Program complete</span>
        <span className="text-sm text-muted-foreground">
          You finished all {progress.total} sessions. Pick a new program to keep
          going.
        </span>
      </Card>
    );
  }

  const { session, workoutOptions } = nextSession;
  const sessionNumber = session.sequenceIndex + 1;
  const duration = estimatedDuration(
    workoutOptions.workoutGoal,
    workoutOptions.workoutGoalUnits,
  );

  return (
    <Card className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {programTitle}
        </span>
        <span className="rounded bg-secondary px-0.5 text-xs text-secondary-foreground">
          Session {sessionNumber} of {progress.total}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold leading-none">
          Week {session.weekNumber} · Day {session.dayNumber}
        </span>
        {duration && (
          <span className="text-xs text-muted-foreground">{duration}</span>
        )}
      </div>

      <span className="text-sm text-muted-foreground">{session.title}</span>

      <div className="mt-0.5 flex gap-1">
        <Button className="flex-1" onClick={onStart} disabled={skipping}>
          Start next workout
        </Button>
        <Button variant="secondary" onClick={onSkip} disabled={skipping}>
          {skipping ? 'Skipping…' : 'Skip'}
        </Button>
      </div>
    </Card>
  );
};
