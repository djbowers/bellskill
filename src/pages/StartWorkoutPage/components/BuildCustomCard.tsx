import { ArrowRightIcon, PlusIcon } from '@heroicons/react/24/outline';

import { Card } from '~/components/ui/card';

export interface BuildCustomCardProps {
  /** Load an empty builder for a from-scratch workout. */
  onClick: () => void;
}

/**
 * The escape hatch beneath the hub's suggestions: a quiet bordered entry into the
 * full builder. Kept deliberately calm so the filled hero stays the page's focus.
 */
export const BuildCustomCard = ({ onClick }: BuildCustomCardProps) => {
  return (
    <Card>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 p-2 text-left"
      >
        <span
          aria-hidden="true"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <PlusIcon className="h-2.5 w-2.5" />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold leading-none">
            Build a workout
          </span>
          <span className="text-sm text-muted-foreground">
            Start from scratch — your movements, reps, and load.
          </span>
        </span>
        <ArrowRightIcon
          className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </Card>
  );
};
