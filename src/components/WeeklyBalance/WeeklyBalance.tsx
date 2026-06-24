import { useState } from 'react';

import { Loading } from '~/components/Loading';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { Pattern, PatternBalance, PatternDebt } from '~/utils';

import {
  BAND_BAR_CLASS,
  BAND_LABEL,
  BAND_TEXT_CLASS,
  MIN_WORKOUTS_FOR_BALANCE,
  PATTERN_LABELS,
  PATTERN_ORDER,
  formatVolume,
  lastTrainedLabel,
  overallBalanceLabel,
} from './patternDisplay';

export interface WeeklyBalanceProps {
  balance?: PatternBalance;
  /** Number of workouts the user has logged — gates the cold-start state. */
  workoutCount: number;
  isLoading?: boolean;
}

/**
 * Free-tier "Weekly Balance": a per-pattern read on how overdue each movement
 * pattern is. Presentational — data is supplied by WeeklyBalanceContainer.
 */
export const WeeklyBalance = ({
  balance,
  workoutCount,
  isLoading = false,
}: WeeklyBalanceProps) => {
  const [expanded, setExpanded] = useState<Pattern | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Balance</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-3">
          <Loading />
        </CardContent>
      </Card>
    );
  }

  if (!balance || workoutCount < MIN_WORKOUTS_FOR_BALANCE) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Balance</CardTitle>
          <CardDescription>
            Log {MIN_WORKOUTS_FOR_BALANCE} workouts to see which movement
            patterns you&apos;re neglecting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {workoutCount === 0
              ? 'No workouts logged yet.'
              : `${workoutCount} of ${MIN_WORKOUTS_FOR_BALANCE} logged so far.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Balance</CardTitle>
        <CardDescription>{overallBalanceLabel(balance.overallBalance)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-1">
        {PATTERN_ORDER.map((pattern) => (
          <PatternRow
            key={pattern}
            debt={balance.patterns[pattern]}
            isExpanded={expanded === pattern}
            onToggle={() =>
              setExpanded((current) => (current === pattern ? null : pattern))
            }
          />
        ))}
      </CardContent>
    </Card>
  );
};

interface PatternRowProps {
  debt: PatternDebt;
  isExpanded: boolean;
  onToggle: () => void;
}

const PatternRow = ({ debt, isExpanded, onToggle }: PatternRowProps) => {
  const label = PATTERN_LABELS[debt.pattern];

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${label}: ${BAND_LABEL[debt.band]}`}
        className="flex w-full items-center gap-x-1.5 rounded-sm py-0.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-7 shrink-0 text-sm font-medium">{label}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className={cn('block h-full rounded-full', BAND_BAR_CLASS[debt.band])}
            style={{ width: `${Math.max(debt.debtScore, 4)}%` }}
          />
        </span>
        <span
          className={cn(
            'w-6 shrink-0 text-right text-xs font-semibold',
            BAND_TEXT_CLASS[debt.band],
          )}
        >
          {BAND_LABEL[debt.band]}
        </span>
      </button>

      {isExpanded && (
        <dl className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 rounded-sm bg-muted/50 p-1 text-xs text-muted-foreground">
          <Detail term="Last trained" value={lastTrainedLabel(debt.lastTrained)} />
          <Detail term="Debt score" value={`${debt.debtScore}/100`} />
          <Detail
            term="Recent volume"
            value={formatVolume(debt.recentVolume)}
          />
          <Detail
            term="Baseline"
            value={
              debt.baselineVolume == null
                ? 'No baseline yet'
                : formatVolume(debt.baselineVolume)
            }
          />
        </dl>
      )}
    </div>
  );
};

const Detail = ({ term, value }: { term: string; value: string }) => (
  <div className="flex justify-between gap-x-1">
    <dt>{term}</dt>
    <dd className="font-medium text-foreground">{value}</dd>
  </div>
);
