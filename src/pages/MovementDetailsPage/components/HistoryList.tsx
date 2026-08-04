import { Link } from 'react-router-dom';

import { MovementHistoryEntry } from '~/api';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';

import {
  getRepSchemeDisplayValue,
  getWeightsDisplayValue,
} from '../../CompletedWorkoutPage/utils';
import { getRowDateLabel } from '../../HistoryPage/utils';

const RECENT_LOG_COUNT = 10;

export const HistoryList = ({
  history,
}: {
  history: MovementHistoryEntry[];
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Recent logs</CardTitle>
    </CardHeader>
    <div className="divide-y">
      {history.slice(0, RECENT_LOG_COUNT).map((entry) => (
        <Link
          key={entry.movementLogId}
          to={`/history/${entry.workoutLogId}`}
          className="flex min-h-[44px] items-center gap-1 px-2 py-1 hover:bg-accent hover:text-accent-foreground"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {entry.workoutTitle?.trim() || getRowDateLabel(entry.startedAt)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {getRowDateLabel(entry.startedAt)} ·{' '}
              {getRepSchemeDisplayValue(
                entry.repScheme,
                [entry.weightOneValue, entry.weightTwoValue],
                entry.timedRungs,
              )}{' '}
              @{' '}
              {getWeightsDisplayValue(
                entry.weightOneValue,
                entry.weightOneUnit,
                entry.weightTwoValue,
                entry.weightTwoUnit,
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
    {history.length > RECENT_LOG_COUNT && (
      <div className="p-1 text-center">
        <Link
          to="/history"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          View all history
        </Link>
      </div>
    )}
  </Card>
);
