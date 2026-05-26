import { WorkoutAddonToggle } from './WorkoutAddonToggle';

export const AddToWorkoutSection = ({
  complexSet,
  hasNotes,
  hasInterval,
  hasRest,
  onToggleComplex,
  onToggleInterval,
  onToggleNotes,
  onToggleRest,
  showComplex,
}: {
  complexSet: boolean;
  hasNotes: boolean;
  hasInterval: boolean;
  hasRest: boolean;
  onToggleComplex: () => void;
  onToggleInterval: () => void;
  onToggleNotes: () => void;
  onToggleRest: () => void;
  showComplex: boolean;
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
          onToggle={onToggleInterval}
        />
        <WorkoutAddonToggle
          id="rest"
          label="Rest"
          isOn={hasRest}
          onToggle={onToggleRest}
        />
        {showComplex && (
          <WorkoutAddonToggle
            id="complex"
            label="Complex"
            isOn={complexSet}
            onToggle={onToggleComplex}
          />
        )}
      </div>
    </section>
  );
};
