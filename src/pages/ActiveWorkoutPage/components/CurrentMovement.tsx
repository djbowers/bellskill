import clsx from 'clsx';
import { useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { MovementOptions, WeightUnit } from '~/types';
import { formatRungValue, getWeightUnitLabel } from '~/utils';

interface CurrentMovementProps {
  currentMovement: MovementOptions;
  currentRound: number;
  currentSide: number;
  isOneHanded: boolean | null;
  isTimedRung?: boolean;
  /** Hold to failure: no prescribed duration, so the elapsed clock stands in. */
  isMaxTimedRung?: boolean;
  formattedElapsed?: string;
  leftWeightUnit: WeightUnit | null;
  leftWeightValue: number | null;
  repScheme: number[];
  restRemaining: boolean;
  rightWeightUnit: WeightUnit | null;
  rightWeightValue: number | null;
  rungIndex: number;
  /** Rungs in the current movement's ladder; shown only in straight-sets mode. */
  totalRungs?: number;
  totalSides: number;
  title: string | null;
  preWorkoutNotes: string | null;
  /** True once lifting has begun; before then the notes are shown in full. */
  hasStarted: boolean;
}

export const CurrentMovement = ({
  currentMovement,
  currentRound,
  currentSide,
  isOneHanded,
  isTimedRung = false,
  isMaxTimedRung = false,
  formattedElapsed = '0:00',
  leftWeightUnit,
  leftWeightValue,
  repScheme,
  restRemaining,
  rightWeightUnit,
  rightWeightValue,
  rungIndex,
  totalRungs,
  totalSides,
  title,
  preWorkoutNotes,
  hasStarted,
}: CurrentMovementProps) => {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const showNotesExpanded = !hasStarted || notesExpanded;
  const isThreeColumn = isOneHanded || rightWeightValue;

  // One-handed work uses a single bell that alternates hands: the page passes
  // the weight on the active side only. Show it on both sides (dimmed on the
  // waiting hand) so the empty column doesn't read as a rendering bug.
  const activeSide = isOneHanded ? (leftWeightValue ? 'left' : 'right') : null;
  const oneHandedWeightValue = leftWeightValue ?? rightWeightValue;
  const oneHandedWeightUnit = leftWeightUnit ?? rightWeightUnit;

  // Plain render helper (not a nested component) so React reconciles the
  // cells in place across renders instead of remounting them.
  const renderWeightCell = (side: 'left' | 'right') => {
    const value = isOneHanded
      ? oneHandedWeightValue
      : side === 'left'
        ? leftWeightValue
        : rightWeightValue;
    const unit = isOneHanded
      ? oneHandedWeightUnit
      : side === 'left'
        ? leftWeightUnit
        : rightWeightUnit;
    const isActive = activeSide === null || activeSide === side;

    if (!value || restRemaining) {
      return <div data-testid={`${side}-weight`} />;
    }

    return (
      <div
        className={clsx(
          'flex items-end justify-center gap-1',
          !isActive && 'opacity-30',
        )}
        data-testid={`${side}-weight`}
        data-active={isActive}
      >
        <div className="text-3xl">{Math.round(value)}</div>
        <div className="text-lg text-muted-foreground">
          {getWeightUnitLabel(unit)}
        </div>
      </div>
    );
  };

  return (
    <Card data-testid="current-movement-card">
      <CardHeader>
        <div className="flex gap-2">
          <CardTitle>
            <div className="flex h-full flex-col items-center justify-center gap-0.5">
              Round
              <div className="relative h-4 w-4 rounded-md bg-accent text-accent-foreground">
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold"
                  data-testid="current-round"
                >
                  {currentRound}
                </div>
              </div>
            </div>
          </CardTitle>

          <div className="flex grow flex-col justify-center gap-1">
            <div className="text-2xl font-medium">
              {currentMovement.movementName}
            </div>
            {title && (
              <div className="font-medium text-muted-foreground">{title}</div>
            )}
            {preWorkoutNotes &&
              (hasStarted ? (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    aria-expanded={notesExpanded}
                    onClick={() => setNotesExpanded((open) => !open)}
                    className="flex items-center gap-0.5 self-start text-xs font-medium text-muted-foreground"
                  >
                    <span aria-hidden>{notesExpanded ? '▾' : '▸'}</span>
                    Session notes
                  </button>
                  {showNotesExpanded && (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {preWorkoutNotes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {preWorkoutNotes}
                </p>
              ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-1">
          {totalRungs !== undefined && (
            <CardDescription className="text-center" data-testid="current-set">
              Set {rungIndex + 1} of {totalRungs}
            </CardDescription>
          )}

          {totalSides > 1 && (
            <CardDescription className="text-center" data-testid="current-side">
              {activeSide
                ? `${activeSide === 'left' ? 'Left' : 'Right'} hand · side ${currentSide} of ${totalSides}`
                : `Side ${currentSide} of ${totalSides}`}
            </CardDescription>
          )}

          <div
            className={clsx(
              'grid items-center gap-3 text-center',
              isThreeColumn ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            <CardDescription
              className={clsx(
                activeSide === 'left' && 'font-semibold text-foreground',
              )}
            >
              {isThreeColumn ? 'Left' : 'Weight'}
            </CardDescription>
            <CardDescription>
              {isTimedRung || isMaxTimedRung ? 'Time' : 'Reps'}
            </CardDescription>
            {isThreeColumn && (
              <CardDescription
                className={clsx(
                  activeSide === 'right' && 'font-semibold text-foreground',
                )}
              >
                Right
              </CardDescription>
            )}
          </div>

          <div
            className={clsx(
              'grid items-center gap-3 text-center font-medium',
              isThreeColumn ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            {renderWeightCell('left')}

            <div
              className="flex items-end justify-center text-3xl"
              data-testid="current-reps"
            >
              {restRemaining ? (
                <span className="h-5" />
              ) : isMaxTimedRung ? (
                // The hold's running clock: on a set with no prescribed
                // duration, this is the number being recorded.
                <span className="font-mono tabular-nums" data-testid="hold-elapsed">
                  {formattedElapsed}
                </span>
              ) : (
                formatRungValue(repScheme[rungIndex], currentMovement.timedRungs)
              )}
            </div>

            {isThreeColumn ? (
              renderWeightCell('right')
            ) : (
              <div data-testid="right-weight" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
