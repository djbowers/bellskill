import { useMutation } from '@tanstack/react-query';

import { useSession } from '~/contexts';
import { downloadJson } from '~/utils';

import { supabase } from '../supabaseClient';

const EXPORT_VERSION = 1;
const PAGE_SIZE = 1000;

const EXPORT_SCHEMA = {
  description:
    'Complete training history exported from Bellskill, a kettlebell workout-tracking app. All weights carry their own unit field (kg or lb). Timestamps are ISO 8601.',
  workout_logs:
    'One row per completed workout session. `rep_scheme` is the planned ladder — rep counts per rung, e.g. [1,2,3]; a rung is one element. `movements` lists movement names done as a circuit (or as straight sets when `straight_sets` is true). `complex_set` means movements were done back-to-back without setting the bell down. `workout_goal` + `workout_goal_units` describe the target (time in minutes, rounds, or volume). `completed_volume` is total weight moved.',
  movement_logs:
    'One row per movement within a workout (`workout_log_id` links to workout_logs). `completed_rep_scheme` holds actual reps per set. `timed_rungs` means rungs were seconds of work rather than reps. Two weight slots support double-bell work: weight_one and weight_two.',
  user_movements:
    'The user\'s personal movement library; `functional_movement_id` links to a shared movement catalog when matched.',
  user_equipment: 'Kettlebells and other equipment the user owns.',
  programs:
    'Structured multi-week training programs. `enrollments` are the user\'s runs through a program with per-enrollment progress; `sessions` are the prescribed workouts per program (week_number/day_number); `completions` record which sessions were done or skipped.',
  pattern_debt:
    'Recent per-movement training aggregates used to spot under-trained movement patterns; null if unavailable.',
} as const;

const fetchAllWorkoutLogs = async (userId: string) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
};

const fetchMovementLogs = async (workoutLogIds: number[]) => {
  const rows = [];
  for (let i = 0; i < workoutLogIds.length; i += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('movement_logs')
      .select('*')
      .in('workout_log_id', workoutLogIds.slice(i, i + PAGE_SIZE))
      .order('id');

    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
};

const fetchPrograms = async (userId: string) => {
  const { data: enrollments, error } = await supabase
    .from('user_programs')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  const programIds = [...new Set((enrollments ?? []).map((e) => e.program_id))];
  const enrollmentIds = (enrollments ?? []).map((e) => e.id);

  const [programsResult, sessionsResult, completionsResult] = await Promise.all(
    [
      supabase.from('programs').select('*').in('id', programIds),
      supabase.from('program_sessions').select('*').in('program_id', programIds),
      supabase
        .from('program_session_completions')
        .select('*')
        .in('user_program_id', enrollmentIds),
    ],
  );

  if (programsResult.error) throw programsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (completionsResult.error) throw completionsResult.error;

  return {
    enrollments: enrollments ?? [],
    programs: programsResult.data ?? [],
    sessions: sessionsResult.data ?? [],
    completions: completionsResult.data ?? [],
  };
};

const fetchPatternDebt = async () => {
  // Cast at the RPC boundary only — see usePatternDebt.
  const { data, error } = await supabase.rpc(
    'pattern_debt_movements' as never,
    {} as never,
  );

  if (error) {
    console.warn('pattern_debt_movements failed; exporting null', error);
    return null;
  }
  return data ?? null;
};

export const buildTrainingExport = async (userId: string) => {
  const [profileResult, workoutLogs, programs, patternDebt, equipmentResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('username, training_goal')
        .eq('id', userId)
        .single(),
      fetchAllWorkoutLogs(userId),
      fetchPrograms(userId),
      fetchPatternDebt(),
      supabase.from('user_equipment').select('*').eq('user_id', userId),
    ]);

  const { data: userMovements, error: movementsError } = await supabase
    .from('user_movements')
    .select('*')
    .eq('user_id', userId)
    .order('canonical_name');

  if (profileResult.error) throw profileResult.error;
  if (equipmentResult.error) throw equipmentResult.error;
  if (movementsError) throw movementsError;

  const movementLogs = await fetchMovementLogs(workoutLogs.map((w) => w.id));

  return {
    meta: {
      app: 'Bellskill',
      export_version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      description:
        'User-requested export of all training data, intended as context for AI assistants providing workout analysis and coaching.',
      schema: EXPORT_SCHEMA,
    },
    profile: profileResult.data,
    workout_logs: workoutLogs,
    movement_logs: movementLogs,
    user_movements: userMovements ?? [],
    user_equipment: equipmentResult.data ?? [],
    programs,
    pattern_debt: patternDebt,
  };
};

export const useExportTrainingData = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const exportData = await buildTrainingExport(userId);
      const date = exportData.meta.exported_at.slice(0, 10);
      downloadJson(exportData, `bellskill-export-${date}.json`);
    },
  });
};
