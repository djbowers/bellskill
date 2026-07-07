import {
  Program,
  ProgramSession,
  UserProgram,
  UserProgramStatus,
  WorkoutOptions,
} from '~/types';

import type { Database } from '../../types/supabase';

type ProgramRow = Database['public']['Tables']['programs']['Row'];
type ProgramSessionRow =
  Database['public']['Tables']['program_sessions']['Row'];
type UserProgramRow = Database['public']['Tables']['user_programs']['Row'];

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
});
