import { ArrowRightIcon } from '@heroicons/react/24/outline';

import { Card } from '~/components/ui/card';

export interface RecommendedWorkoutCardProps {
  title: string;
  /** The "why" line — shown for curated workouts. */
  subtitle?: string;
  /** Movements summary, e.g. "Kettlebell Swing". */
  summary: string;
  /** Short metadata, e.g. "5 rounds · ~10 min". */
  meta?: string;
  /** Opens the workout in the builder for review/edits before starting. */
  onSelect: () => void;
}

export const RecommendedWorkoutCard = ({
  title,
  subtitle,
  summary,
  meta,
  onSelect,
}: RecommendedWorkoutCardProps) => {
  return (
    <Card>
      <button
        type="button"
        aria-label={title}
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-2 p-2 text-left"
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold leading-none">{title}</span>
            {meta && (
              <span className="text-xs text-muted-foreground">{meta}</span>
            )}
          </div>
          {summary && (
            <span className="text-sm text-muted-foreground">{summary}</span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
        <ArrowRightIcon
          className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </Card>
  );
};
