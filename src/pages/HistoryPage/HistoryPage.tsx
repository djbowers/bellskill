import { Link } from 'react-router-dom';

import { useInfiniteWorkoutLogs } from '~/api';
import {
  Loading,
  ModalityBalanceContainer,
  Page,
  WeeklyBalanceContainer,
} from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { useFeatures } from '~/hooks';
import { formatVolume } from '~/utils';

import { SessionRow, WeekStrip } from './components';
import { WorkoutWeek, getWeekLabel, groupByDate, groupByWeek } from './utils';

export const HistoryPage = () => {
  const features = useFeatures();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteWorkoutLogs();

  const workoutLogs = data?.pages.flatMap((page) => page.workoutLogs) ?? [];
  const workoutWeeks = groupByWeek(groupByDate(workoutLogs));

  return (
    <Page title="Workout History">
      {!isLoading && workoutLogs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-3 text-center">
            <div className="text-muted-foreground">
              Finished workouts show up here, newest first.
            </div>
            <Button asChild>
              <Link to="/">Start your first workout</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {features.weeklyBalance && workoutLogs.length > 0 && (
          <WeeklyBalanceContainer />
        )}

        {features.modalityBalance && workoutLogs.length > 0 && (
          <ModalityBalanceContainer />
        )}

        {workoutWeeks.map((workoutWeek) => (
          <WorkoutWeekGroup key={workoutWeek.weekKey} {...workoutWeek} />
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            loading={isFetchingNextPage}
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Load More
          </Button>
        </div>
      )}

      {isLoading && <Loading />}
    </Page>
  );
};

const WorkoutWeekGroup = ({
  weekYear,
  weekNumber,
  workoutDays,
}: Omit<WorkoutWeek, 'weekKey'>) => {
  const sessions = workoutDays.flatMap(({ workoutLogs }) => workoutLogs);
  const weekVolume = sessions.reduce(
    (total, { completedVolume }) => total + (completedVolume ?? 0),
    0,
  );

  // Volume is meaningless for a bodyweight-only week, so the session count
  // carries the summary on its own rather than leaving the line half empty.
  const summary = [
    `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`,
    weekVolume > 0 ? formatVolume(weekVolume) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1 px-1 text-sm">
        <div className="font-medium">{getWeekLabel(weekYear, weekNumber)}</div>
        <div className="tabular-nums text-muted-foreground">{summary}</div>
      </div>

      <Card>
        <CardContent className="px-1.5 pb-1.5 pt-1">
          <WeekStrip
            weekYear={weekYear}
            weekNumber={weekNumber}
            workoutDays={workoutDays}
          />
        </CardContent>

        <Separator />

        <div className="divide-y">
          {workoutDays.flatMap(({ workoutLogs }) =>
            workoutLogs.map((workoutLog) => (
              <SessionRow key={workoutLog.id} workoutLog={workoutLog} />
            )),
          )}
        </div>
      </Card>
    </div>
  );
};
