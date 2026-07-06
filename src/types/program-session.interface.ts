import { WorkoutOptions } from './workout-options.interface';

/**
 * One ordered session within a {@link Program}. `workoutOptions` is the runtime
 * {@link WorkoutOptions} shape minus `startedAt` (stamped when the workout
 * actually starts), so `loadIntoBuilder(session.workoutOptions)` consumes it
 * verbatim -- no mapping layer.
 *
 * camelCase mirror of the generated `program_sessions` row.
 */
export interface ProgramSession {
  id: string;
  programId: string;
  /** 0..N-1: the canonical "next session" order. */
  sequenceIndex: number;
  /** 1-based, for labels/progress. */
  weekNumber: number;
  /** 1-based within the week. */
  dayNumber: number;
  title: string;
  workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
  notes: string | null;
}
