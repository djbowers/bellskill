export type UserProgramStatus =
  | 'active'
  | 'completed'
  | 'abandoned'
  | 'paused'
  | 'queued';

/**
 * A user's enrollment in a {@link Program}. Up to three rows per user may be
 * `'active'` at once, each holding a distinct `activeSlot` (enforced by the
 * `one_program_per_active_slot` partial unique index). `programId` points at the
 * user's own editable clone, never the shared template.
 *
 * camelCase mirror of the generated `user_programs` row.
 */
export interface UserProgram {
  id: string;
  userId: string;
  programId: string;
  status: UserProgramStatus;
  config: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  /**
   * Parallel-program slot 1–3, unique per user among active enrollments.
   * Meaningful only while `status === 'active'`; a non-active row may carry a
   * stale value, which the partial unique index ignores.
   */
  activeSlot: number | null;
  /**
   * When `true`, finishing the program's last session loops back to the first
   * session (a fresh cycle) instead of flipping `status` to `'completed'`.
   * Initialized from {@link Program.defaultAutoRepeat} at enroll; user-toggleable.
   */
  autoRepeat: boolean;
  /** Number of times this enrollment has looped (bumped on each auto-repeat cycle). */
  cyclesCompleted: number;
  /**
   * 1-based order within the user's queue while `status === 'queued'`; the
   * lowest position is promoted when an active program finishes. Gaps are
   * fine — promotion never renumbers. `null` on non-queued rows.
   */
  queuePosition: number | null;
  /**
   * Position on {@link Program.stages} (0-based). Always 0 for programs
   * without a ladder; moved by the `set_program_stage` RPC.
   */
  currentStageIndex: number;
}
