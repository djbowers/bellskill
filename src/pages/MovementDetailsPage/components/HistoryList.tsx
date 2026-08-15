import { Link } from 'react-router-dom';

import { MovementHistoryEntry } from '~/api';
import { MovementLogRow } from '~/components';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';

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
        <MovementLogRow key={entry.movementLogId} entry={entry} />
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
