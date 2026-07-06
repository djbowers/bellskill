export type UserProgramStatus = 'active' | 'completed' | 'abandoned' | 'paused';

/**
 * A user's enrollment in a {@link Program}. At most one row per user may be
 * `'active'` (enforced by the `one_active_program_per_user` partial unique
 * index). `programId` points at the user's own editable clone, never the shared
 * template.
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
}
