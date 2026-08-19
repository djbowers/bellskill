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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { ModalityBalance, PatternBalance } from '~/utils';

import {
  BAND_BAR_CLASS,
  BAND_LABEL,
  BalanceRowModel,
  MIN_WORKOUTS_FOR_BALANCE,
  RPE_DOT_CLASS,
  RPE_DOT_LABEL,
  formatBaselineWork,
  formatRecentWork,
  lastTrainedLabel,
  modalityRows,
  nextFocusLabel,
  patternRows,
  recencyShort,
} from './balanceDisplay';

export interface TrainingBalanceProps {
  patternBalance?: PatternBalance;
  modalityBalance?: ModalityBalance;
  /** Which axes this build surfaces; both on renders the tabbed card. */
  showPatterns?: boolean;
  showModalities?: boolean;
  /** Number of workouts the user has logged — gates the cold-start state. */
  workoutCount: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Shown when any pattern is Due/Overdue — jumps into the balance-focused recommender. */
  onBalanceMe?: () => void;
}

/**
 * The History page's balance read: movement patterns and training modalities
 * in one card, tabbed when both axes are enabled. Presentational — data is
 * supplied by TrainingBalanceContainer.
 */
export const TrainingBalance = ({
  patternBalance,
  modalityBalance,
  showPatterns = true,
  showModalities = true,
  workoutCount,
  isLoading = false,
  isError = false,
  onRetry,
  onBalanceMe,
}: TrainingBalanceProps) => {
  const [activeTab, setActiveTab] = useState<'patterns' | 'mix'>(
    showPatterns ? 'patterns' : 'mix',
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
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
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-x-2">
          <p className="text-sm text-muted-foreground">
            Balance couldn&apos;t load
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

  const patterns =
    showPatterns && patternBalance ? patternRows(patternBalance) : null;
  const modalities =
    showModalities && modalityBalance ? modalityRows(modalityBalance) : null;

  if ((!patterns && !modalities) || workoutCount < MIN_WORKOUTS_FOR_BALANCE) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
          <CardDescription>
            Log {MIN_WORKOUTS_FOR_BALANCE} workouts to see which movement
            patterns and training styles you&apos;re neglecting.
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

  const balanceMeButton = onBalanceMe &&
    patterns?.some((row) => !row.isNew && row.band !== 'green') && (
      <Button className="mt-1 w-full" variant="secondary" onClick={onBalanceMe}>
        Balance me out
      </Button>
    );

  if (!patterns || !modalities) {
    const rows = (patterns ?? modalities)!;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
          <CardDescription>{nextFocusLabel(rows)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-0.5">
          <RowList rows={rows} />
          {patterns && balanceMeButton}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Tabs
        value={activeTab}
        onValueChange={(tab) => setActiveTab(tab as 'patterns' | 'mix')}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-x-2">
            <CardTitle>Balance</CardTitle>
            <TabsList>
              <TabsTrigger size="sm" value="patterns">
                Patterns
              </TabsTrigger>
              <TabsTrigger size="sm" value="mix">
                Training Mix
              </TabsTrigger>
            </TabsList>
          </div>
          <CardDescription>
            {nextFocusLabel(activeTab === 'patterns' ? patterns : modalities)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TabsContent value="patterns" className="mt-0 flex flex-col gap-y-0.5">
            <RowList rows={patterns} />
            {balanceMeButton}
          </TabsContent>
          <TabsContent value="mix" className="mt-0 flex flex-col gap-y-0.5">
            <RowList rows={modalities} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
};

const RowList = ({ rows }: { rows: BalanceRowModel[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Gauges start empty and fill to their charge on mount — the panel's one
  // signature moment. Reduced-motion users land on the final state (below).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {rows.map((row, index) => (
        <BalanceRow
          key={row.id}
          row={row}
          index={index}
          mounted={mounted}
          isExpanded={expanded === row.id}
          onToggle={() =>
            setExpanded((current) => (current === row.id ? null : row.id))
          }
        />
      ))}
    </>
  );
};

interface BalanceRowProps {
  row: BalanceRowModel;
  index: number;
  mounted: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const BalanceRow = ({
  row,
  index,
  mounted,
  isExpanded,
  onToggle,
}: BalanceRowProps) => {
  // A full bar is an axis you've kept charged; it drains toward empty as it
  // goes stale. Inverse of the debt score the model reasons over.
  const balanceValue = 100 - row.debtScore;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={
          row.isNew
            ? `${row.label}: new, not trained yet`
            : `${row.label}: ${BAND_LABEL[row.band]}, ${lastTrainedLabel(row.lastTrained)}${
                row.hardestRpe
                  ? `, felt ${RPE_DOT_LABEL[row.hardestRpe].toLowerCase()}`
                  : ''
              }`
        }
        className="flex min-h-[40px] w-full items-center gap-x-1.5 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-7 shrink-0 text-sm font-medium">{row.label}</span>
        <span
          className={cn(
            'h-1.5 flex-1 overflow-hidden rounded-full',
            row.isNew
              ? 'border border-dashed border-muted-foreground/40 bg-transparent'
              : 'bg-muted',
          )}
        >
          {!row.isNew && (
            <span
              className={cn(
                'block h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none',
                BAND_BAR_CLASS[row.band],
              )}
              style={{
                width: `${mounted ? balanceValue : 0}%`,
                transitionDelay: `${index * 40}ms`,
              }}
            />
          )}
        </span>
        {row.isNew ? (
          <Badge variant="secondary" className="shrink-0">
            New
          </Badge>
        ) : (
          <span
            aria-hidden
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              row.hardestRpe ? RPE_DOT_CLASS[row.hardestRpe] : 'bg-transparent',
            )}
          />
        )}
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {row.isNew ? '—' : recencyShort(row)}
        </span>
      </button>

      {isExpanded && (
        <>
          {row.isNew ? (
            <p className="mt-0.5 rounded-sm bg-muted/50 p-1 text-xs text-muted-foreground">
              Not trained yet — log any {row.label.toLowerCase()} movement to
              start tracking.
            </p>
          ) : (
            <dl className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 rounded-sm bg-muted/50 p-1 text-xs text-muted-foreground">
              <Detail
                term="Last trained"
                value={lastTrainedLabel(row.lastTrained)}
              />
              <Detail
                term="Effort"
                value={row.hardestRpe ? RPE_DOT_LABEL[row.hardestRpe] : '—'}
              />
              <Detail term="Balance" value={`${balanceValue}/100`} />
              <Detail
                term="Recent work"
                value={formatRecentWork(row)}
              />
              <Detail
                term="Baseline"
                value={formatBaselineWork(row) ?? 'No baseline yet'}
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
