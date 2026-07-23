/**
 * Format a timed rung's prescribed duration for display, e.g. 90 -> "1:30".
 * Durations run to minutes at most, so hours are intentionally unhandled.
 */
export const formatRungDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};
