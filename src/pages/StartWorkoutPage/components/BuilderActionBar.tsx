import { ReactNode } from 'react';

import { useBottomNavVisible } from '~/components/BottomNav/useBottomNavVisible';
import { cn } from '~/lib/utils';
import { WorkoutGoalUnits } from '~/types';

import { SummaryLoad, WorkoutSummaryBar } from './WorkoutSummaryBar';

/**
 * The builder's pinned action bar: the workout recap stacked directly above the
 * commit button, so both stay on screen while the movement list scrolls under.
 *
 * The offset is a `bottom` value rather than padding because a sticky bar pins
 * to the viewport, where `Root`'s `pb-bottomnav` can't reach it. `lg:bottom-safe`
 * mirrors `Root`'s `lg:pb-0` — the nav is hidden by a breakpoint, which the
 * visibility hook can't see.
 *
 * The -40px bleed is `Page`'s bottom padding (`p-3`) plus its bottom margin
 * (`my-2`). Without it a sticky element stops at its parent's content edge, so
 * the bar would lift off the screen bottom on the last few pixels of scroll.
 */
export const BuilderActionBar = ({
  children,
  loads,
  movementCount,
  workoutGoal,
  workoutGoalUnits,
  countsSets = false,
}: {
  children: ReactNode;
  loads: SummaryLoad[];
  movementCount: number;
  workoutGoal: number;
  workoutGoalUnits: WorkoutGoalUnits;
  countsSets?: boolean;
}) => {
  const bottomNavVisible = useBottomNavVisible();

  return (
    <div
      className={cn(
        'sticky z-20 -mx-3 -mb-[40px] mt-1 bg-card',
        bottomNavVisible ? 'bottom-bottomnav lg:bottom-safe' : 'bottom-safe',
      )}
    >
      <div className="flex flex-col gap-0.5 border-t border-border px-3 pb-3 pt-1.5">
        {movementCount > 0 && (
          <WorkoutSummaryBar
            workoutGoal={workoutGoal}
            workoutGoalUnits={workoutGoalUnits}
            movementCount={movementCount}
            loads={loads}
            countsSets={countsSets}
          />
        )}
        {children}
      </div>
    </div>
  );
};
