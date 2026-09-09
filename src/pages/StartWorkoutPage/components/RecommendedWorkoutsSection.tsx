import { CuratedWorkout, MovementOptions, WorkoutGoalUnits } from '~/types';

import { RecommendedWorkoutCard } from './RecommendedWorkoutCard';

export interface RecommendedWorkoutsSectionProps {
  curated: CuratedWorkout[];
  /** null while the logs query is still resolving. */
  isFirstWorkout: boolean | null;
  /** Opens the workout in the builder for review/edits before starting. */
  onSelectCurated: (curated: CuratedWorkout) => void;
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
  isFirstWorkout,
  onSelectCurated,
}: RecommendedWorkoutsSectionProps) => {
  if (curated.length === 0) return null;

  const curatedHeading =
    isFirstWorkout === true
      ? 'Your recommended first workout'
      : 'Recommended sessions';

  return (
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
  );
};
