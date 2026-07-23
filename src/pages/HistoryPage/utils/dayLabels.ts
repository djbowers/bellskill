import { DateTime } from 'luxon';

/**
 * Gutter label for a session row. Recent days get named relative to today the
 * way a person would say them; everything older falls back to weekday + date.
 */
export const getRowDateLabel = (date: Date): string => {
  const day = DateTime.fromJSDate(date).startOf('day');
  const today = DateTime.now().startOf('day');

  const daysAgo = today.diff(day, 'days').days;
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';

  return day.toFormat('ccc d');
};
