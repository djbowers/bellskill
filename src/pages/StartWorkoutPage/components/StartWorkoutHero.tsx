import { ReactNode, useState } from 'react';

import { NextProgramSession, ProgramProgress } from '~/api';
import { ConfirmDialog } from '~/components/ConfirmDialog';
import { OverflowMenu } from '~/components/OverflowMenu';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { WorkoutGoalUnits } from '~/types';

/**
 * The home page's single high-contrast surface. Every other block on the page is
 * a quiet bordered card; the hero is filled `primary` so "what am I training now"
 * is unmistakable. Two shapes share the shell: a running program's next session,
 * and a quick-start anchor for anyone without an active program.
 *
 * The program shape carries exactly one button — starting the next session.
 * Skipping advances the program past a session, so it sits in the ⋯ menu behind
 * a confirm rather than beside the CTA where a thumb can find it by accident.
 */
export type StartWorkoutHeroProps =
  | ({ variant: 'program' } & ProgramHeroProps)
  | ({ variant: 'quickStart' } & QuickStartHeroProps);

interface ProgramHeroProps {
  programTitle: string;
  nextSession: NextProgramSession | null;
  progress: ProgramProgress;
  isComplete: boolean;
  onStart: () => void;
  onSkip: () => void;
  /** Whether a skip is in flight (disables both actions). */
  skipping: boolean;
  /** Open the program's progress page. Omitted → the link is not rendered. */
  onViewProgress?: () => void;
}

interface QuickStartHeroProps {
  onBuildCustom: () => void;
  /** Repeat the most recent workout in one tap. Omitted → no repeat action. */
  onRepeatLast?: () => void;
}

const estimatedDuration = (
  goal: number,
  units: WorkoutGoalUnits,
): string | null => {
  if (units === 'minutes') return `~${goal} min`;
  if (units === 'rounds') return `${goal} rounds`;
  return null; // volume goals have no meaningful time estimate here
};

const HeroShell = ({ children }: { children: ReactNode }) => (
  <section
    aria-label="Start a workout"
    className="flex flex-col gap-1.5 rounded-md bg-primary p-3 text-primary-foreground shadow motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
  >
    {children}
  </section>
);

const Eyebrow = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-xs font-semibold uppercase tracking-wide text-primary-foreground/75',
      className,
    )}
  >
    {children}
  </span>
);

const primaryCta =
  'bg-primary-foreground text-primary shadow-none hover:bg-primary-foreground/90';

export const StartWorkoutHero = (props: StartWorkoutHeroProps) => {
  if (props.variant === 'quickStart') {
    const { onBuildCustom, onRepeatLast } = props;
    return (
      <HeroShell>
        <div className="flex flex-col gap-0.5">
          <Eyebrow>Ready to train</Eyebrow>
          <h2 className="text-2xl font-semibold leading-tight">
            Start a workout
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Pick your movements, reps, and load — built your way.
          </p>
        </div>
        <Button
          size="lg"
          className={cn('mt-0.5 w-full text-base', primaryCta)}
          onClick={onBuildCustom}
        >
          Build a workout
        </Button>
        {onRepeatLast && (
          <button
            type="button"
            onClick={onRepeatLast}
            className="self-start text-xs font-medium text-primary-foreground/80 hover:text-primary-foreground hover:underline"
          >
            Repeat last workout →
          </button>
        )}
      </HeroShell>
    );
  }

  return <ProgramHero {...props} />;
};

const ProgramHero = ({
  programTitle,
  nextSession,
  progress,
  isComplete,
  onStart,
  onSkip,
  skipping,
  onViewProgress,
}: ProgramHeroProps) => {
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  const viewProgressLink = onViewProgress && (
    <button
      type="button"
      onClick={onViewProgress}
      className="self-start text-xs font-medium text-primary-foreground/80 hover:text-primary-foreground hover:underline"
    >
      View progress →
    </button>
  );

  if (isComplete || !nextSession) {
    return (
      <HeroShell>
        <Eyebrow>{programTitle}</Eyebrow>
        <h2 className="text-2xl font-semibold leading-tight">
          🎉 Program complete
        </h2>
        <p className="text-sm text-primary-foreground/80">
          You finished all {progress.total} sessions. Pick a new program to keep
          going.
        </p>
        {viewProgressLink}
      </HeroShell>
    );
  }

  const { session, workoutOptions } = nextSession;
  const sessionNumber = session.sequenceIndex + 1;
  const duration = estimatedDuration(
    workoutOptions.workoutGoal,
    workoutOptions.workoutGoalUnits,
  );
  const title =
    session.title?.trim() ||
    `Week ${session.weekNumber} · Day ${session.dayNumber}`;
  const pct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <HeroShell>
      <div className="flex items-center gap-1">
        <Eyebrow className="min-w-0 truncate">{programTitle}</Eyebrow>
        <span className="ml-auto shrink-0 rounded-full bg-primary-foreground/15 px-1 py-px text-xs font-medium">
          Session {sessionNumber} of {progress.total}
        </span>
        <OverflowMenu
          menuLabel={programTitle}
          triggerClassName="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          actions={[
            {
              label: 'Skip this session',
              onSelect: () => setConfirmingSkip(true),
              disabled: skipping,
              destructive: true,
            },
          ]}
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
        <span className="text-sm text-primary-foreground/80">
          Week {session.weekNumber} · Day {session.dayNumber}
          {duration && ` · ${duration}`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div
          className="h-0.5 flex-1 overflow-hidden rounded-full bg-primary-foreground/20"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${programTitle} progress`}
        >
          <div
            className="h-full rounded-full bg-primary-foreground transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-primary-foreground/80">
          {pct}%
        </span>
      </div>

      {skipping ? (
        <span className="self-start text-xs font-medium text-primary-foreground/80">
          Skipping this session…
        </span>
      ) : (
        viewProgressLink
      )}

      <Button
        size="lg"
        className={cn('mt-0.5 w-full text-base', primaryCta)}
        onClick={onStart}
        disabled={skipping}
      >
        Start next workout
      </Button>

      <ConfirmDialog
        open={confirmingSkip}
        onOpenChange={setConfirmingSkip}
        title="Skip this session?"
        description={`Session ${sessionNumber} won't be logged, and ${programTitle} moves on to the next one.`}
        confirmLabel="Skip session"
        confirmVariant="destructive"
        dismissLabel="Keep this session"
        onConfirm={() => {
          setConfirmingSkip(false);
          onSkip();
        }}
        onDismiss={() => setConfirmingSkip(false)}
        isPending={skipping}
      />
    </HeroShell>
  );
};
