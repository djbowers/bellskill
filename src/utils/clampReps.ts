export function clampReps(reps: number, min: number, max: number): number {
  if (reps < min) return max;
  if (reps > max) return min;
  return reps;
}
