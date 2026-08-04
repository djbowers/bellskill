import { WorkoutAddonToggle } from './WorkoutAddonToggle';

export const AddToWorkoutSection = ({
  hasNotes,
  hasInterval,
  hasRest,
  hasTimedMovements = false,
  onToggleInterval,
  onToggleNotes,
  onToggleRest,
}: {
  hasNotes: boolean;
  hasInterval: boolean;
  hasRest: boolean;
  hasTimedMovements?: boolean;
  onToggleInterval: () => void;
  onToggleNotes: () => void;
  onToggleRest: () => void;
}) => {
  return (
    <section aria-label="Add to workout">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Add to workout
      </h2>
      <div className="flex gap-1">
        <WorkoutAddonToggle
          id="notes"
          label="Notes"
          isOn={hasNotes}
          onToggle={onToggleNotes}
        />
        <WorkoutAddonToggle
          id="interval"
          label="Interval"
          isOn={hasInterval}
          disabled={hasTimedMovements}
          disabledReason="Turn off timed movements first — both drive the set clock."
          onToggle={onToggleInterval}
        />
        <WorkoutAddonToggle
          id="rest"
          label="Rest"
          isOn={hasRest}
          onToggle={onToggleRest}
        />
      </div>
    </section>
  );
};
