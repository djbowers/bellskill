import { PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

import { Button } from '~/components/ui/button';
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

export type RungMode = 'reps' | 'time' | 'max';

/** The interval timer drives the set clock; max reps needs a press to report against. */
const INTERVAL_LOCKED_COPY: Record<'time' | 'max', string> = {
  time: 'Turn off the interval timer first — both drive the set clock.',
  max: 'Turn off the interval timer first — max reps needs a Continue press to report against.',
};

/**
 * A movement's rep scheme as a ladder: each rung is a chip you tap to focus,
 * then set its value on the caliper picker below. Replaces a stack of one picker
 * per rung — the ladder reads at a glance and stays short as rungs grow.
 *
 * Max reps has no magnitude to pick: the rungs become bare set slots and the
 * runner asks for the count once each set is done.
 */
export const LadderRepScheme = ({
  repScheme,
  timedRungs = false,
  maxReps = false,
  intervalActive = false,
  onChangeRung,
  onRemoveRung,
  onAddRung,
  onChangeRungMode,
}: {
  repScheme: number[];
  timedRungs?: boolean;
  maxReps?: boolean;
  /** The interval timer and timed rungs both drive the set clock — only one may be on. */
  intervalActive?: boolean;
  onChangeRung: (rungIndex: number, value: number) => void;
  onRemoveRung: (rungIndex: number) => void;
  onAddRung: () => void;
  onChangeRungMode: (mode: RungMode) => void;
}) => {
  const [focusedRung, setFocusedRung] = useState(
    Math.max(0, repScheme.length - 1),
  );
  // Adding/removing rungs can leave the focus past the end; clamp on render.
  const focused = Math.min(focusedRung, repScheme.length - 1);
  const mode: RungMode = maxReps ? 'max' : timedRungs ? 'time' : 'reps';
  const range = timedRungs ? TIMED_RANGE : REPS_RANGE;
  const label = (rung: number, rungIndex: number) =>
    maxReps
      ? `Set ${rungIndex + 1}`
      : timedRungs
        ? formatRungDuration(rung)
        : `${rung}`;

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
        <FieldLabel>
          {maxReps ? 'Sets to failure' : timedRungs ? 'Duration' : 'Rep scheme'}
        </FieldLabel>
        <Tabs
          value={mode}
          onValueChange={(value) => onChangeRungMode(value as RungMode)}
        >
          <TabsList>
            <TabsTrigger size="sm" value="reps">
              Reps
            </TabsTrigger>
            <TabsTrigger
              size="sm"
              value="time"
              disabled={intervalActive}
              title={intervalActive ? INTERVAL_LOCKED_COPY.time : undefined}
            >
              Time
            </TabsTrigger>
            <TabsTrigger
              size="sm"
              value="max"
              disabled={intervalActive}
              title={intervalActive ? INTERVAL_LOCKED_COPY.max : undefined}
            >
              Max
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
          <button
            key={rungIndex}
            type="button"
            aria-pressed={rungIndex === focused}
            aria-label={
              maxReps
                ? `Set ${rungIndex + 1}, max reps`
                : `Rung ${rungIndex + 1}, ${label(rung, rungIndex)}${
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
            {label(rung, rungIndex)}
          </button>
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

      {maxReps ? (
        <p className="text-center text-sm text-muted-foreground">
          Every set runs to failure. You&apos;ll enter the reps you hit as you
          finish each one.
        </p>
      ) : (
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
      )}

      {repScheme.length > 1 && (
        <Button
          variant="secondary"
          className="self-center text-muted-foreground hover:text-destructive"
          onClick={handleRemoveFocusedRung}
        >
          Remove {maxReps ? 'set' : 'rung'} {focused + 1}
        </Button>
      )}
    </div>
  );
};
