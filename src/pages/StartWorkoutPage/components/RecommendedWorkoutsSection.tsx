import { RepeatableWorkout } from '~/api';
import { CuratedWorkout, MovementOptions, WorkoutGoalUnits } from '~/types';

import { RecommendedWorkoutCard } from './RecommendedWorkoutCard';

export interface RecommendedWorkoutsSectionProps {
  curated: CuratedWorkout[];
  recentRepeats: RepeatableWorkout[];
  /** null while the logs query is still resolving. */
  isFirstWorkout: boolean | null;
  /** Opens the workout in the builder for review/edits before starting. */
  onSelectCurated: (curated: CuratedWorkout) => void;
  onSelectRepeat: (repeat: RepeatableWorkout) => void;
}

const goalLabel = (goal: number, units: WorkoutGoalUnits) => {
  if (units === 'minutes') return `${goal} min`;
  if (units === 'rounds') return `${goal} rounds`;
  return `${goal} kg`;
};

const movementsSummary = (movements: MovementOptions[]) =>
  movements
    .map((movement) => movement.movementName)
    .filter((name) => name.length > 0)
    .join(' · ');

const SectionLabel = ({ children }: { children: string }) => (
  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </h2>
);

export const RecommendedWorkoutsSection = ({
  curated,
  recentRepeats,
  isFirstWorkout,
  onSelectCurated,
  onSelectRepeat,
}: RecommendedWorkoutsSectionProps) => {
  const curatedHeading =
    isFirstWorkout === true
      ? 'Your recommended first workout'
      : 'Recommended sessions';

  return (
    <div className="flex flex-col gap-2">
      {recentRepeats.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>Pick up where you left off</SectionLabel>
          {recentRepeats.map((repeat) => {
            const { movements, workoutGoal, workoutGoalUnits } =
              repeat.workoutOptions;
            const summary = movementsSummary(movements);
            const title =
              repeat.workoutLog.title?.trim() || summary || 'Recent workout';
            return (
              <RecommendedWorkoutCard
                key={repeat.workoutLogId}
                title={title}
                summary={summary === title ? '' : summary}
                meta={goalLabel(workoutGoal, workoutGoalUnits)}
                onSelect={() => onSelectRepeat(repeat)}
              />
            );
          })}
        </div>
      )}

      {curated.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>{curatedHeading}</SectionLabel>
          {curated.map((workout) => {
            const { movements, workoutGoal, workoutGoalUnits } =
              workout.workoutOptions;
            return (
              <RecommendedWorkoutCard
                key={workout.id}
                title={workout.title}
                subtitle={workout.subtitle}
                summary={movementsSummary(movements)}
                meta={`${goalLabel(workoutGoal, workoutGoalUnits)} · ~${workout.estimatedMinutes} min`}
                onSelect={() => onSelectCurated(workout)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
