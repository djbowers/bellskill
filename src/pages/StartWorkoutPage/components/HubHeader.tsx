export interface HubHeaderProps {
  /** Most recent workout date, or null for a user who hasn't trained yet. */
  lastWorkoutAt: Date | null;
  /** Now, injectable for deterministic tests/stories. Defaults to the real clock. */
  now?: Date;
}

const greetingForHour = (hour: number): string => {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const lastTrainedLabel = (lastWorkoutAt: Date | null, now: Date): string => {
  if (!lastWorkoutAt) return "Let's get your first workout in.";

  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(lastWorkoutAt).getTime()) /
      MS_PER_DAY,
  );

  if (days <= 0) return 'You already trained today. Nice.';
  if (days === 1) return 'Last trained yesterday.';
  return `Last trained ${days} days ago.`;
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The hub's identity strip: a time-of-day greeting over a quiet "last trained"
 * micro-stat. Purely presentational — the page computes {@link lastWorkoutAt}
 * from the workout logs it already holds.
 */
export const HubHeader = ({ lastWorkoutAt, now = new Date() }: HubHeaderProps) => {
  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="text-2xl font-semibold leading-tight">
        {greetingForHour(now.getHours())}
      </h1>
      <p className="text-sm text-muted-foreground">
        {lastTrainedLabel(lastWorkoutAt, now)}
      </p>
    </div>
  );
};
