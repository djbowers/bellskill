import {
  Program,
  ProgramSession,
  ProgramSessionCompletion,
  ProgramSessionCompletionStatus,
  UserProgram,
  UserProgramStatus,
  WorkoutOptions,
} from '~/types';

import type { Database } from '../../types/supabase';

type ProgramRow = Database['public']['Tables']['programs']['Row'];
type ProgramSessionRow =
  Database['public']['Tables']['program_sessions']['Row'];
type UserProgramRow = Database['public']['Tables']['user_programs']['Row'];
type ProgramSessionCompletionRow =
  Database['public']['Tables']['program_session_completions']['Row'];

/** camelCase mapper for a raw `programs` row. */
export const mapProgramRow = (row: ProgramRow): Program => ({
  id: row.id,
  ownerId: row.owner_id,
  sourceProgramId: row.source_program_id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  authorName: row.author_name,
  numWeeks: row.num_weeks,
  daysPerWeek: row.days_per_week,
  isPublic: row.is_public,
  createdAt: row.created_at,
  archivedAt: row.archived_at,
  defaultAutoRepeat: row.default_auto_repeat,
  releasedAt: row.released_at,
});

/**
 * camelCase mapper for a raw `program_sessions` row. `workout_options` is stored
 * verbatim as the builder's {@link WorkoutOptions} shape (minus `startedAt`), so
 * it round-trips with no field mapping.
 */
export const mapProgramSessionRow = (
  row: ProgramSessionRow,
): ProgramSession => ({
  id: row.id,
  programId: row.program_id,
  sequenceIndex: row.sequence_index,
  weekNumber: row.week_number,
  dayNumber: row.day_number,
  title: row.title,
  workoutOptions: row.workout_options as unknown as Omit<
    WorkoutOptions,
    'startedAt'
  >,
  notes: row.notes,
  weightLabel: row.weight_label,
});

/** camelCase mapper for a raw `program_session_completions` row. */
export const mapProgramSessionCompletionRow = (
  row: ProgramSessionCompletionRow,
): ProgramSessionCompletion => ({
  id: row.id,
  userProgramId: row.user_program_id,
  programSessionId: row.program_session_id,
  userId: row.user_id,
  workoutLogId: row.workout_log_id,
  status: row.status as ProgramSessionCompletionStatus,
  completedAt: row.completed_at,
});

/** camelCase mapper for a raw `user_programs` enrollment row. */
export const mapUserProgramRow = (row: UserProgramRow): UserProgram => ({
  id: row.id,
  userId: row.user_id,
  programId: row.program_id,
  status: row.status as UserProgramStatus,
  config: (row.config ?? {}) as Record<string, unknown>,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  activeSlot: row.active_slot,
  autoRepeat: row.auto_repeat,
  cyclesCompleted: row.cycles_completed,
  queuePosition: row.queue_position,
});
