export type UserProgramStatus = 'active' | 'completed' | 'abandoned' | 'paused';

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
}
