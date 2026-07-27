import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { formatRungDuration } from '~/utils';

import { FieldLabel } from './FieldLabel';
import { ModifyCountButtons } from './ModifyCountButtons';

// Rung magnitudes. Reps step by one; timed rungs (carries, planks) step by five
// because nudging a two-minute carry a second at a time is unusable.
const REPS_RANGE = { min: 1, max: 50, step: 1 };
const TIMED_RANGE = { min: 5, max: 300, step: 5 };

const MAX_RUNGS = 10;

/**
 * A movement's rep scheme as a ladder: each rung is a chip you tap to focus,
 * then set its value on the caliper picker below. Replaces a stack of one picker
 * per rung — the ladder reads at a glance and stays short as rungs grow.
 */
export const LadderRepScheme = ({
  repScheme,
  timedRungs = false,
  intervalActive = false,
  onChangeRung,
  onRemoveRung,
  onAddRung,
  onToggleTimed,
}: {
  repScheme: number[];
  timedRungs?: boolean;
  /** The interval timer and timed rungs both drive the set clock — only one may be on. */
  intervalActive?: boolean;
  onChangeRung: (rungIndex: number, value: number) => void;
  onRemoveRung: (rungIndex: number) => void;
  onAddRung: () => void;
  onToggleTimed: (timed: boolean) => void;
}) => {
  const [focusedRung, setFocusedRung] = useState(
    Math.max(0, repScheme.length - 1),
  );
  // Adding/removing rungs can leave the focus past the end; clamp on render.
  const focused = Math.min(focusedRung, repScheme.length - 1);
  const range = timedRungs ? TIMED_RANGE : REPS_RANGE;
  const label = (rung: number) =>
    timedRungs ? formatRungDuration(rung) : `${rung}`;

  // Adding a rung focuses it (you'll want to set its value); removing keeps the
  // focus on the same rung it was on, which shifts left when an earlier one goes.
  const handleAddRung = () => {
    setFocusedRung(repScheme.length);
    onAddRung();
  };
  const handleRemoveRung = (rungIndex: number) => {
    setFocusedRung((current) =>
      Math.min(
        rungIndex < current ? current - 1 : current,
        repScheme.length - 2,
      ),
    );
    onRemoveRung(rungIndex);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <FieldLabel>{timedRungs ? 'Duration' : 'Rep scheme'}</FieldLabel>
        <Tabs
          value={timedRungs ? 'time' : 'reps'}
          onValueChange={(value) => onToggleTimed(value === 'time')}
        >
          <TabsList>
            <TabsTrigger size="sm" value="reps">
              Reps
            </TabsTrigger>
            <TabsTrigger
              size="sm"
              value="time"
              disabled={intervalActive}
              title={
                intervalActive
                  ? 'Turn off the interval timer first — both drive the set clock.'
                  : undefined
              }
            >
              Time
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto py-0.5"
        role="group"
        aria-label="Ladder rungs"
      >
        {repScheme.map((rung, rungIndex) => (
          <div key={rungIndex} className="relative shrink-0">
            <button
              type="button"
              aria-pressed={rungIndex === focused}
              aria-label={`Rung ${rungIndex + 1}, ${label(rung)}${
                timedRungs ? '' : ' reps'
              }`}
              onClick={() => setFocusedRung(rungIndex)}
              className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-md border px-1 text-base font-semibold transition-colors',
                rungIndex === focused
                  ? 'border-primary bg-primary text-primary-foreground shadow'
                  : 'border-border bg-secondary text-secondary-foreground',
              )}
            >
              {label(rung)}
            </button>
            {repScheme.length > 1 && (
              <button
                type="button"
                aria-label={`Remove rung ${rungIndex + 1}`}
                onClick={() => handleRemoveRung(rungIndex)}
                className={cn(
                  'absolute right-0 top-0 flex h-2 w-2 items-center justify-center rounded-md transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  rungIndex === focused
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground',
                )}
              >
                <XMarkIcon className="h-1 w-1" />
              </button>
            )}
          </div>
        ))}

        {repScheme.length < MAX_RUNGS && (
          <button
            type="button"
            aria-label="Add rung"
            onClick={handleAddRung}
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border border-dashed border-border px-1 text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <PlusIcon className="h-2 w-2" />
          </button>
        )}
      </div>

      <ModifyCountButtons
        {...range}
        value={repScheme[focused]}
        unit={timedRungs ? 'sec' : 'reps'}
        onChange={(value) => onChangeRung(focused, value)}
        onClickMinus={() =>
          onChangeRung(focused, repScheme[focused] - range.step)
        }
        onClickPlus={() =>
          onChangeRung(focused, repScheme[focused] + range.step)
        }
      />
    </div>
  );
};
