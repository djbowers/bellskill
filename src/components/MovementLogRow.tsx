import { Link } from 'react-router-dom';

import { MovementHistoryEntry } from '~/api';
import {
  getRepSchemeDisplayValue,
  getWeightsDisplayValue,
} from '~/pages/CompletedWorkoutPage/utils';
import { getRowDateLabel } from '~/pages/HistoryPage/utils';

/** One logged set of a movement, linking to the session it belongs to. */
export const MovementLogRow = ({ entry }: { entry: MovementHistoryEntry }) => (
  <Link
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
);
