import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useMovement, useMovementHistory } from '~/api';
import { Loading, Page } from '~/components';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

import { HistoryList } from './components/HistoryList';
import { StatGrid } from './components/StatGrid';
import { getLastTrainedLabel } from './utils/stats';

export const MovementDetailsPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: movement, isLoading: movementLoading } = useMovement(id);
  const { data: history = [], isLoading: historyLoading } =
    useMovementHistory(id);

  if (movementLoading) {
    return (
      <Page>
        <div className="flex justify-center py-3">
          <Loading />
        </div>
      </Page>
    );
  }

  if (!movement) {
    return (
      <Page title="Movement not found">
        <p className="text-muted-foreground">
          This movement isn&apos;t in the catalog. It may have been removed.
        </p>
        <Button asChild variant="outline">
          <Link to="/movements">Browse movements</Link>
        </Button>
      </Page>
    );
  }

  const badges = [
    movement.movementPattern1,
    movement.primaryEquipment,
    movement.difficultyLevel,
    movement.targetMuscleGroup,
    movement.singleOrDoubleArm,
  ].filter((badge): badge is string => badge !== null);

  const lastTrainedLabel = getLastTrainedLabel(history);

  return (
    <Page>
      <div>
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="mb-1 flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-2 w-2" />
          Back
        </button>
        <div className="text-xl font-semibold">{movement.movementName}</div>
        {badges.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            {badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
          </div>
        )}
        {lastTrainedLabel && (
          <div className="mt-1 text-sm text-muted-foreground">
            Last trained {lastTrainedLabel}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Catalog details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <DetailRow label="Movement pattern" value={movement.movementPattern1} />
            <DetailRow label="Primary equipment" value={movement.primaryEquipment} />
            <DetailRow
              label="Target muscle group"
              value={movement.targetMuscleGroup}
            />
            <DetailRow label="Difficulty" value={movement.difficultyLevel} />
            <DetailRow label="Arms" value={movement.singleOrDoubleArm} />
            <DetailRow
              label="Bells"
              value={
                movement.primaryItemCount !== null
                  ? String(movement.primaryItemCount)
                  : null
              }
            />
            {movement.patternCredits.length > 0 && (
              <div className="flex items-center justify-between gap-1 py-0.5 text-sm">
                <dt className="text-muted-foreground">Pattern credits</dt>
                <dd className="flex flex-wrap justify-end gap-0.5">
                  {movement.patternCredits.map((pattern) => (
                    <Badge key={pattern} variant="outline">
                      {pattern}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {historyLoading ? (
        <div className="flex justify-center py-3">
          <Loading />
        </div>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-3 text-center">
            <div className="font-medium">You haven&apos;t trained this yet</div>
            <p className="text-sm text-muted-foreground">
              Log a workout with this movement and your history will show up
              here.
            </p>
            <Button asChild>
              <Link to="/">Start a workout</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatGrid history={history} />
          <HistoryList history={history} />
        </>
      )}
    </Page>
  );
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) => {
  if (value === null) return null;
  return (
    <div className="flex items-center justify-between gap-1 py-0.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
};
