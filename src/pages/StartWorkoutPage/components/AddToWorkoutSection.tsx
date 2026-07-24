import { WorkoutAddonToggle } from './WorkoutAddonToggle';

export const AddToWorkoutSection = ({
  complexSet,
  hasTitle,
  hasNotes,
  hasInterval,
  hasRest,
  hasTimedMovements = false,
  showTitle = true,
  onToggleComplex,
  onToggleInterval,
  onToggleNotes,
  onToggleRest,
  onToggleStraightSets,
  onToggleTitle,
  showComplex,
  straightSets,
}: {
  complexSet: boolean;
  hasTitle: boolean;
  hasNotes: boolean;
  hasInterval: boolean;
  hasRest: boolean;
  hasTimedMovements?: boolean;
  showTitle?: boolean;
  onToggleComplex: () => void;
  onToggleInterval: () => void;
  onToggleNotes: () => void;
  onToggleRest: () => void;
  onToggleStraightSets: () => void;
  onToggleTitle: () => void;
  showComplex: boolean;
  straightSets: boolean;
}) => {
  return (
    <section aria-label="Add to workout">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Add to workout
      </h2>
      <div className="flex gap-1">
        {showTitle && (
          <WorkoutAddonToggle
            id="title"
            label="Title"
            isOn={hasTitle}
            onToggle={onToggleTitle}
          />
        )}
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
        <WorkoutAddonToggle
          id="straight-sets"
          label="Straight Sets"
          isOn={straightSets}
          onToggle={onToggleStraightSets}
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
