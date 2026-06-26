import { WorkoutOptions } from './workout-options.interface';

/**
 * A pre-built, one-tap startable workout. Decoupled from the UI so the same
 * templates can later feed the skill tree / weekly Tetris plan. `workoutOptions`
 * matches the runtime {@link WorkoutOptions} shape minus `startedAt`, which is
 * stamped when the workout actually starts.
 */
export interface CuratedWorkout {
  /** Stable slug, e.g. 'beginner-two-hand-swing'. */
  id: string;
  title: string;
  /** The "why" — a short reason this is a good session, shown on the card. */
  subtitle: string;
  /** Rough duration in minutes, for "how long will this take" legibility. */
  estimatedMinutes: number;
  workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
}
