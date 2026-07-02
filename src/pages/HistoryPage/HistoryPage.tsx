import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';

import { useInfiniteWorkoutLogs } from '~/api';
import { Loading, Page } from '~/components';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { WorkoutLog } from '~/types';

import { RpeBadge } from '../CompletedWorkoutPage/components';
import { getDuration } from '../CompletedWorkoutPage/utils';

export const HistoryPage = () => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteWorkoutLogs();

  const workoutLogs = data?.pages.flatMap((page) => page.workoutLogs) ?? [];

  const workoutDays = groupByDate(workoutLogs);
  const workoutWeeks = groupByWeek(workoutDays);

  return (
    <Page title="Workout History">
      {!isLoading && workoutLogs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-3 text-center">
            <div className="text-muted-foreground">
              Your finished workouts will show up here.
            </div>
            <Button asChild>
              <Link to="/">Start your first workout</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {workoutWeeks.map(({ weekKey, weekYear, weekNumber, workoutDays }) => (
          <WorkoutWeekGroup
            key={weekKey}
            weekYear={weekYear}
            weekNumber={weekNumber}
            workoutDays={workoutDays}
          />
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

const WorkoutLogItem = ({ workoutLog }: { workoutLog: WorkoutLog }) => {
  const workoutDetailsPath = '/history/' + workoutLog.id;
  const workoutVolume = workoutLog.completedVolume ?? 0;
  const displayText =
    workoutVolume > 0
      ? `${workoutVolume.toFixed(0)} kg`
      : `${workoutLog.completedReps} reps`;
  const duration = getDuration(workoutLog.startedAt, workoutLog.completedAt);

  // The lifter's own name for the session is the most scannable line; fall
  // back to the movement list when the workout wasn't named.
  const title = workoutLog.workoutDetails?.trim() || '';
  const movementsLine = workoutLog.movements.join(' · ');

  return (
    <Link
      className="flex justify-between gap-1 rounded-md px-2 py-1 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground"
      to={workoutDetailsPath}
    >
      <div className="min-w-0">
        <div className="font-medium">{title || movementsLine}</div>
        {title && (
          <div className="text-sm text-muted-foreground">{movementsLine}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1">
        {workoutLog.complexSet === true && (
          <Badge variant="secondary">Complex</Badge>
        )}
        {workoutLog.rpe !== null && <RpeBadge rpeValue={workoutLog.rpe} />}
        <div className="text-right">
          <div>{displayText}</div>
          <div className="text-sm text-muted-foreground">{duration}</div>
        </div>
      </div>
    </Link>
  );
};

const WorkoutDayCard = ({
  date,
  workoutLogs = [],
}: {
  date: string;
  workoutLogs: WorkoutLog[];
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{date}</CardTitle>
    </CardHeader>
    <CardContent>
      {workoutLogs.map((workoutLog) => (
        <WorkoutLogItem key={workoutLog.id} workoutLog={workoutLog} />
      ))}
    </CardContent>
  </Card>
);

const WorkoutWeekGroup = ({
  weekYear,
  weekNumber,
  workoutDays,
}: {
  weekYear: number;
  weekNumber: number;
  workoutDays: WorkoutDay[];
}) => {
  let weekVolume = 0;

  workoutDays.forEach(({ workoutLogs }) => {
    let dayVolume = 0;
    workoutLogs.forEach((workoutLog) => {
      dayVolume += workoutLog.completedVolume ?? 0;
    });
    weekVolume += dayVolume;
  });

  const displayText = weekVolume > 0 && `${weekVolume.toFixed(0)} kg total`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-1 px-1 text-sm font-medium">
        <div>{getWeekLabel(weekYear, weekNumber)}</div>
        <div>{displayText}</div>
      </div>
      {workoutDays.map(({ date, workoutLogs }) => (
        <WorkoutDayCard
          key={date.toISOString()}
          workoutLogs={workoutLogs}
          date={date.toDateString()}
        />
      ))}
    </div>
  );
};

// "Week 27" means nothing to a human — label weeks relative to today, then by
// date range once they're further back.
const getWeekLabel = (weekYear: number, weekNumber: number): string => {
  const now = DateTime.now();
  if (weekYear === now.weekYear && weekNumber === now.weekNumber) {
    return 'This week';
  }

  const lastWeek = now.minus({ weeks: 1 });
  if (weekYear === lastWeek.weekYear && weekNumber === lastWeek.weekNumber) {
    return 'Last week';
  }

  const start = DateTime.fromObject({ weekYear, weekNumber, weekday: 1 });
  const end = start.plus({ days: 6 });
  const range =
    start.month === end.month
      ? `${start.toFormat('MMM d')} – ${end.toFormat('d')}`
      : `${start.toFormat('MMM d')} – ${end.toFormat('MMM d')}`;

  return start.year === now.year ? range : `${range}, ${start.year}`;
};

interface WorkoutDay {
  date: Date;
  workoutLogs: WorkoutLog[];
}

interface WorkoutWeek {
  weekKey: string;
  weekYear: number;
  weekNumber: number;
  workoutDays: WorkoutDay[];
}

const groupByDate = (workoutLogs: WorkoutLog[] = []): WorkoutDay[] => {
  const groupedByDate: { [dateKey: string]: WorkoutLog[] } = {};

  workoutLogs.forEach((log) => {
    const dateKey = log.startedAt.toDateString();
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(log);
    groupedByDate[dateKey].sort(
      (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
    );
  });

  return Object.entries(groupedByDate)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([dateKey, workoutLogs]) => ({
      date: new Date(dateKey),
      workoutLogs,
    }));
};

const groupByWeek = (workoutDays: WorkoutDay[]): WorkoutWeek[] => {
  const groupedByWeek: { [weekKey: string]: WorkoutDay[] } = {};

  workoutDays.forEach((workoutDay) => {
    const year = DateTime.fromJSDate(workoutDay.date).weekYear;
    const weekNumber = DateTime.fromJSDate(workoutDay.date).weekNumber;
    const weekKey = `${year}-W${weekNumber}`;
    if (!groupedByWeek[weekKey]) {
      groupedByWeek[weekKey] = [];
    }
    groupedByWeek[weekKey].push(workoutDay);
    groupedByWeek[weekKey].sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  return Object.entries(groupedByWeek)
    .map(([weekKey, workoutDays]) => ({
      weekKey,
      weekYear: Number(weekKey.split('-W')[0]),
      weekNumber: Number(weekKey.split('-W')[1]),
      workoutDays,
    }))
    .sort(
      (a, b) =>
        b.workoutDays[0].date.getTime() - a.workoutDays[0].date.getTime(),
    );
};
