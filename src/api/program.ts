import {
  Program,
  ProgramFocusTag,
  ProgramSession,
  ProgramStage,
  ProgramSystemicDemand,
  ProgramSessionCompletion,
  ProgramSessionCompletionStatus,
  UserProgram,
  UserProgramStatus,
  WorkoutOptions,
} from '~/types';

import { fromWorkoutMode, toWorkoutMode } from '~/utils';

import type { Database, Json } from '../../types/supabase';

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
  stages: row.stages as unknown as ProgramStage[] | null,
  focusTags: row.focus_tags as ProgramFocusTag[],
  systemicDemand: row.systemic_demand as ProgramSystemicDemand | null,
});

/** The builder's options as they load into and out of a program session. */
export type SessionWorkoutOptions = Omit<WorkoutOptions, 'startedAt'>;

/**
 * `program_sessions.workout_options` as stored: the builder's shape, except the
 * arrangement is still the original `complexSet` / `straightSets` pair rather
 * than `workoutMode`. Rewriting the JSONB is deliberately deferred, so these two
 * mappers are the only translation.
 */
type StoredWorkoutOptions = Omit<SessionWorkoutOptions, 'workoutMode'> & {
  complexSet?: boolean | null;
  straightSets?: boolean | null;
};

/** Read stored session options into the builder's shape. */
export const parseSessionWorkoutOptions = (
  stored: unknown,
): SessionWorkoutOptions => {
  const { complexSet, straightSets, ...rest } = stored as StoredWorkoutOptions;
  return { ...rest, workoutMode: toWorkoutMode(complexSet, straightSets) };
};

/** Write the builder's options back out in the stored JSONB shape. */
export const serializeSessionWorkoutOptions = (
  options: SessionWorkoutOptions,
): Json => {
  const { workoutMode, ...rest } = options;
  return { ...rest, ...fromWorkoutMode(workoutMode) } as unknown as Json;
};

/**
 * camelCase mapper for a raw `program_sessions` row. `workout_options` is stored
 * as the builder's {@link WorkoutOptions} shape (minus `startedAt`), so only the
 * workout mode needs translating.
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
  workoutOptions: parseSessionWorkoutOptions(row.workout_options),
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
  currentStageIndex: row.current_stage_index,
});
