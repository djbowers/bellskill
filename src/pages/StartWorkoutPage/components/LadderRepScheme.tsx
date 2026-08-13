import { PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

import { Button } from '~/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { MAX_RUNG, formatRungValue, isMaxRung } from '~/utils';

import { FieldLabel } from './FieldLabel';
import { ModifyCountButtons } from './ModifyCountButtons';

// Rung magnitudes. Reps step by one; timed rungs (carries, planks) step by five
// because nudging a two-minute carry a second at a time is unusable. Both bottom
// out at MAX_RUNG, which reads as "to failure" rather than as a magnitude.
const REPS_RANGE = { min: MAX_RUNG, max: 50, step: 1 };
const TIMED_RANGE = { min: MAX_RUNG, max: 300, step: 5 };

const MAX_RUNGS = 10;

/**
 * A movement's rep scheme as a ladder: each rung is a chip you tap to focus,
 * then set its value on the caliper picker below. Replaces a stack of one picker
 * per rung — the ladder reads at a glance and stays short as rungs grow.
 *

 * Winding a rung down past its smallest value lands on Max, so a ladder can run
 * up to failure — [1, 2, 3, 4, 5, Max] or [0:15, 0:30, 0:45, Max].
 *
 * Straight sets reads the same list as plain sets rather than a ladder, so the
 * labels follow `unitNoun`.
 */
export const LadderRepScheme = ({
  repScheme,
  timedRungs = false,
  intervalActive = false,
  unitNoun = 'rung',
  onChangeRung,
  onRemoveRung,
  onAddRung,
  onToggleTimed,
}: {
  repScheme: number[];
  timedRungs?: boolean;
  /** The interval timer and timed rungs both drive the set clock — only one may be on. */
  intervalActive?: boolean;
  unitNoun?: 'rung' | 'set';
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
  const label = (rung: number) => formatRungValue(rung, timedRungs);
  const unitLabel = unitNoun === 'set' ? 'Set' : 'Rung';

  // Adding a rung focuses it (you'll want to set its value). Removing the
  // focused one hands the focus to whatever slides into its place.
  const handleAddRung = () => {
    setFocusedRung(repScheme.length);
    onAddRung();
  };
  const handleRemoveFocusedRung = () => {
    setFocusedRung(Math.min(focused, repScheme.length - 2));
    onRemoveRung(focused);
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
        aria-label={unitNoun === 'set' ? 'Sets' : 'Ladder rungs'}
      >
        {repScheme.map((rung, rungIndex) => (
          <button
            key={rungIndex}
            type="button"
            aria-pressed={rungIndex === focused}
            aria-label={
              isMaxRung(rung)
                ? `${unitLabel} ${rungIndex + 1}, max ${
                    timedRungs ? 'time' : 'reps'
                  }`
                : `${unitLabel} ${rungIndex + 1}, ${label(rung)}${
                    timedRungs ? '' : ' reps'
                  }`
            }
            onClick={() => setFocusedRung(rungIndex)}
            className={cn(
              'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border px-1 text-base font-semibold transition-colors',
              rungIndex === focused
                ? 'border-primary bg-primary text-primary-foreground shadow'
                : 'border-border bg-secondary text-secondary-foreground',
            )}
          >
            {label(rung)}
          </button>
        ))}

        {repScheme.length < MAX_RUNGS && (
          <button
            type="button"
            aria-label={unitNoun === 'set' ? 'Add set' : 'Add rung'}
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

      <p className="text-center text-sm text-muted-foreground">
        {isMaxRung(repScheme[focused])
          ? timedRungs
            ? 'Max — hold to failure, then tap Continue.'
            : 'Max — go to failure, then log the reps you hit.'
          : `0 = max ${timedRungs ? 'time' : 'reps'}`}
      </p>

      {repScheme.length > 1 && (
        <Button
          variant="secondary"
          className="self-center text-muted-foreground hover:text-destructive"
          onClick={handleRemoveFocusedRung}
        >
          Remove {unitNoun} {focused + 1}
        </Button>
      )}
    </div>
  );
};
