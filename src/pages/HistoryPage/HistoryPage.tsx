import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';

import { useWorkoutLogs } from '~/api';
import { Loading, Page } from '~/components';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { WorkoutLog } from '~/types';

import { RpeBadge } from '../CompletedWorkoutPage/components';

export const HistoryPage = () => {
  const { data: workoutLogs, isLoading } = useWorkoutLogs();

  const workoutDays = groupByDate(workoutLogs);
  const workoutWeeks = groupByWeek(workoutDays);

  return (
    <Page title="Workout History">
      <div className="flex flex-col gap-4">
        {workoutWeeks.map(({ weekNumber, workoutDays }) => (
          <WorkoutWeekGroup
            key={weekNumber}
            weekNumber={weekNumber}
            workoutDays={workoutDays}
          />
        ))}
      </div>

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

  return (
    <Link
      className="flex justify-between rounded-md px-2 py-1 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground"
      to={workoutDetailsPath}
    >
      <div>
        {workoutLog.movements.map((movement, i) => (
          <div key={i}>{movement}</div>
        ))}
        {workoutLog.workoutDetails && (
          <div className="text-muted-foreground">
            {workoutLog.workoutDetails}
          </div>
        )}
      </div>
      <div className="flex grow items-center justify-end gap-1">
        {workoutLog.complexSet === true && (
          <Badge variant="secondary">Complex</Badge>
        )}
        {workoutLog.rpe !== null && <RpeBadge rpeValue={workoutLog.rpe} />}
        <div className="text-right">{displayText}</div>
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
  weekNumber,
  workoutDays,
}: {
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
        <div>Week {weekNumber}</div>
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

interface WorkoutDay {
  date: Date;
  workoutLogs: WorkoutLog[];
}

interface WorkoutWeek {
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
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([weekKey, workoutDays]) => ({
      weekNumber: Number(weekKey.split('-W')[1]),
      workoutDays,
    }));
};
