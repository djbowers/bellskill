export type ProgramSessionCompletionStatus = 'completed' | 'skipped';

/**
 * Progress record: a single {@link ProgramSession} satisfied (or skipped) within
 * a user's enrollment. `workoutLogId` points at the real `workout_logs` row when
 * the session was completed, and is NULL when it was skipped. Unique per
 * `(userProgramId, programSessionId)` -- a session is satisfied at most once per
 * enrollment.
 *
 * camelCase mirror of the generated `program_session_completions` row.
 */
export interface ProgramSessionCompletion {
  id: string;
  userProgramId: string;
  programSessionId: string;
  userId: string;
  /** The completed workout_logs row; NULL when the session was skipped. */
  workoutLogId: number | null;
  status: ProgramSessionCompletionStatus;
  completedAt: string;
}
