import { useEffect, useState } from 'react';

import { Loading } from '~/components/Loading';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { Modality, ModalityBalance as ModalityBalanceModel, ModalityDebt } from '~/utils';

import {
  BAND_BAR_CLASS,
  BAND_LABEL,
  MIN_WORKOUTS_FOR_BALANCE,
  MODALITY_LABELS,
  RPE_DOT_CLASS,
  RPE_DOT_LABEL,
  formatVolume,
  lastTrainedLabel,
  modalitiesByNeglect,
  nextFocusLabel,
  recencyShort,
} from './modalityDisplay';

export interface ModalityBalanceProps {
  balance?: ModalityBalanceModel;
  /** Number of workouts the user has logged — gates the cold-start state. */
  workoutCount: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

/**
 * "Training Mix": a per-modality read on how the user balances slow strength,
 * ballistic power, cardio, and mobility work. Presentational — data is
 * supplied by ModalityBalanceContainer.
 */
export const ModalityBalance = ({
  balance,
  workoutCount,
  isLoading = false,
  isError = false,
  onRetry,
}: ModalityBalanceProps) => {
  const [expanded, setExpanded] = useState<Modality | null>(null);
  // Gauges start empty and fill to their charge on mount, matching the Weekly
  // Balance card. Reduced-motion users land on the final state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Mix</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-3">
          <Loading />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Mix</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-x-2">
          <p className="text-sm text-muted-foreground">
            Training mix couldn&apos;t load
          </p>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!balance || workoutCount < MIN_WORKOUTS_FOR_BALANCE) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Mix</CardTitle>
          <CardDescription>
            Log {MIN_WORKOUTS_FOR_BALANCE} workouts to see how you balance
            strength, cardio, and mobility.
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
        <CardTitle>Training Mix</CardTitle>
        <CardDescription>{nextFocusLabel(balance)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-1">
        {modalitiesByNeglect(balance).map((debt, index) => (
          <ModalityRow
            key={debt.modality}
            debt={debt}
            index={index}
            mounted={mounted}
            isExpanded={expanded === debt.modality}
            onToggle={() =>
              setExpanded((current) =>
                current === debt.modality ? null : debt.modality,
              )
            }
          />
        ))}
      </CardContent>
    </Card>
  );
};

interface ModalityRowProps {
  debt: ModalityDebt;
  index: number;
  mounted: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const ModalityRow = ({
  debt,
  index,
  mounted,
  isExpanded,
  onToggle,
}: ModalityRowProps) => {
  const label = MODALITY_LABELS[debt.modality];
  // A full bar is a modality you've kept charged; it drains toward empty as it
  // goes stale. Inverse of the debt score the model reasons over.
  const balanceValue = 100 - debt.debtScore;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={
          debt.isNew
            ? `${label}: new, not trained yet`
            : `${label}: ${BAND_LABEL[debt.band]}, ${lastTrainedLabel(debt.lastTrained)}${
                debt.hardestRpe
                  ? `, felt ${RPE_DOT_LABEL[debt.hardestRpe].toLowerCase()}`
                  : ''
              }`
        }
        className="flex min-h-[44px] w-full items-center gap-x-1.5 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-8 shrink-0 text-sm font-medium">{label}</span>
        <span
          className={cn(
            'h-1.5 flex-1 overflow-hidden rounded-full',
            debt.isNew ? 'border border-dashed border-muted-foreground/40 bg-transparent' : 'bg-muted',
          )}
        >
          {!debt.isNew && (
            <span
              className={cn(
                'block h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none',
                BAND_BAR_CLASS[debt.band],
              )}
              style={{
                width: `${mounted ? balanceValue : 0}%`,
                transitionDelay: `${index * 40}ms`,
              }}
            />
          )}
        </span>
        {debt.isNew ? (
          <Badge variant="secondary" className="shrink-0">
            New
          </Badge>
        ) : (
          <span
            aria-hidden
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              debt.hardestRpe
                ? RPE_DOT_CLASS[debt.hardestRpe]
                : 'bg-transparent',
            )}
          />
        )}
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {debt.isNew ? '—' : recencyShort(debt)}
        </span>
      </button>

      {isExpanded && (
        <>
          {debt.isNew ? (
            <p className="mt-0.5 rounded-sm bg-muted/50 p-1 text-xs text-muted-foreground">
              Not trained yet — log any {label.toLowerCase()} movement to start
              tracking.
            </p>
          ) : (
            <dl className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 rounded-sm bg-muted/50 p-1 text-xs text-muted-foreground">
              <Detail
                term="Last trained"
                value={lastTrainedLabel(debt.lastTrained)}
              />
              <Detail
                term="Effort"
                value={debt.hardestRpe ? RPE_DOT_LABEL[debt.hardestRpe] : '—'}
              />
              <Detail term="Balance" value={`${balanceValue}/100`} />
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
        </>
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
