import { WorkoutAddonToggle } from './WorkoutAddonToggle';

export const AddToWorkoutSection = ({
  hasNotes,
  hasInterval,
  hasRest,
  hasSharedBell,
  hasTimedMovements = false,
  sharedBellLocked = false,
  onToggleInterval,
  onToggleNotes,
  onToggleRest,
  onToggleSharedBell,
}: {
  hasNotes: boolean;
  hasInterval: boolean;
  hasRest: boolean;
  hasSharedBell: boolean;
  hasTimedMovements?: boolean;
  /** Complex runs off one bell by definition, so the toggle is forced on. */
  sharedBellLocked?: boolean;
  onToggleInterval: () => void;
  onToggleNotes: () => void;
  onToggleRest: () => void;
  onToggleSharedBell: () => void;
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
        <WorkoutAddonToggle
          id="shared-bell"
          label="Shared Bell"
          isOn={hasSharedBell}
          disabled={sharedBellLocked}
          disabledReason="Complex always runs off one bell."
          onToggle={onToggleSharedBell}
        />
      </div>
    </section>
  );
};
