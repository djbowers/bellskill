import { DateTime, Duration } from 'luxon';

export const getDisplayDate = (date: Date) => {
  const dateTime = DateTime.fromJSDate(date);
  const isCurrentYear = dateTime.year === DateTime.now().year;
  return dateTime.toFormat(isCurrentYear ? 'cccc, LLL d' : 'cccc, LLL d y');
};

export const getDuration = (startedAt: Date, completedAt: Date) => {
  const duration = Duration.fromMillis(
    completedAt.getTime() - startedAt.getTime(),
  );
  const hours = Math.floor(duration.as('hours'));
  const minutes = Math.floor(duration.as('minutes') % 60);

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

export const getTimeRange = (startedAt: Date, completedAt: Date) => {
  const startedAtTime = DateTime.fromJSDate(startedAt);
  const completedAtTime = DateTime.fromJSDate(completedAt);
  return `${startedAtTime.toFormat('h:mm a')} - ${completedAtTime.toFormat(
    'h:mm a',
  )}`;
};
