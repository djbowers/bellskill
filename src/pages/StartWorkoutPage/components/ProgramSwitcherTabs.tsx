import { ActiveProgram } from '~/api';
import { cn } from '~/lib/utils';

export interface ProgramSwitcherTabsProps {
  /** The user's active programs, least-recently-worked first. */
  programs: ActiveProgram[];
  /** Enrollment id of the program currently shown in the card below. */
  selectedEnrollmentId: string;
  onSelect: (enrollmentId: string) => void;
}

/**
 * Pill row for choosing which parallel program Home offers. Renders nothing for
 * a single program, so the one-program surface is unchanged.
 */
export const ProgramSwitcherTabs = ({
  programs,
  selectedEnrollmentId,
  onSelect,
}: ProgramSwitcherTabsProps) => {
  if (programs.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Active programs"
      className="flex gap-1"
    >
      {programs.map(({ enrollment, program, progress }) => {
        const selected = enrollment.id === selectedEnrollmentId;
        return (
          <button
            key={enrollment.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(enrollment.id)}
            className={cn(
              // Titles truncate rather than scroll: at the 3-program cap, three
              // full titles overflow a phone viewport and the last pill lands
              // off-screen.
              'flex min-w-0 flex-1 items-baseline gap-0.5 rounded border px-1 py-0.5 text-xs',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            <span className="truncate font-medium">{program.title}</span>
            <span className="shrink-0 opacity-75">
              {progress.completed}/{progress.total}
            </span>
          </button>
        );
      })}
    </div>
  );
};
