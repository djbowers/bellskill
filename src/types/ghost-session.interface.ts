/** One completed round, timed from the start of the workout. */
export interface RoundSplit {
  /** 0-based index of the round that was completed. */
  roundIndex: number;
  elapsedMs: number;
}

/**
 * The previous run of the workout now in progress — the pace to race against.
 *
 * Resolved once at start time and carried on `WorkoutOptions`, alongside the
 * other `previous*` hints. Absent whenever there is no prior run to compare to,
 * which is the normal case for a workout built from scratch.
 */
export interface GhostSession {
  workoutLogId: number;
  completedAt: Date;
  /** Rounds the ghost finished. Doubles as the rail's scale for goals that prescribe no round count. */
  totalRounds: number;
  totalDurationMs: number;
  /**
   * Ordered by round. Empty for logs recorded before splits were captured —
   * consumers fall back to a pace derived from `totalDurationMs` / `totalRounds`.
   */
  splits: RoundSplit[];
}
