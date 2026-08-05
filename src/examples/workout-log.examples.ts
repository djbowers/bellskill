import { RpeOptions, WorkoutGoalUnits } from '~/types';

import { Database } from '../../types/supabase';

type WorkoutLog = Database['public']['Tables']['workout_logs']['Row'];

let id = 1;

export class ExampleWorkoutLog implements WorkoutLog {
  completed_at: string;
  completed_reps: number;
  completed_rounds: number;
  completed_rungs: number;
  completed_sides: number | null;
  completed_volume: number | null;
  complex_set: boolean;
  workout_mode: string | null;
  shared_bell: boolean | null;
  id: number;
  interval_timer: number;
  movements: string[];
  rest_timer: number;
  rpe: RpeOptions | null;
  shared_weight_one_unit: 'kilograms' | 'pounds' | null;
  shared_weight_one_value: number | null;
  shared_weight_two_unit: 'kilograms' | 'pounds' | null;
  shared_weight_two_value: number | null;
  started_at: string;
  straight_sets: boolean;
  user_id: string;
  title: string | null;
  pre_workout_notes: string | null;
  workout_goal: number;
  workout_goal_units: WorkoutGoalUnits;
  post_workout_notes: string | null;

  bells: number[];
  is_one_handed: boolean | null;
  rep_scheme: number[];
  unit: string | null;

  constructor({
    bells = [],
    is_one_handed = null,
    rep_scheme = [],
    unit = null,

    completed_at = new Date().toISOString(),
    completed_reps = 0,
    completed_rounds = 0,
    completed_rungs = 0,
    completed_sides = null,
    completed_volume = 0,
    complex_set = false,
    workout_mode,
    shared_bell,
    interval_timer = 0,
    movements = [],
    rest_timer = 0,
    rpe = 'ideal',
    shared_weight_one_unit = null,
    shared_weight_one_value = null,
    shared_weight_two_unit = null,
    shared_weight_two_value = null,
    started_at = new Date().toISOString(),
    straight_sets = false,
    user_id = '1',
    title = '',
    pre_workout_notes = null,
    workout_goal = 20,
    workout_goal_units = 'minutes',
    post_workout_notes = null,
  }: Partial<WorkoutLog>) {
    this.bells = bells;
    this.is_one_handed = is_one_handed;
    this.rep_scheme = rep_scheme;
    this.unit = unit;

    this.completed_at = completed_at;
    this.completed_reps = completed_reps;
    this.completed_rounds = completed_rounds;
    this.completed_rungs = completed_rungs;
    this.completed_sides = completed_sides;
    this.completed_volume = completed_volume;
    this.complex_set = complex_set;
    // Mirrors the sync_workout_log_mode trigger, so a fixture that sets only the
    // legacy pair still reads as the mode and weight model it means.
    this.workout_mode =
      workout_mode ??
      (complex_set ? 'complex' : straight_sets ? 'straightSets' : 'circuit');
    this.shared_bell = shared_bell ?? complex_set;
    this.id = id;
    this.interval_timer = interval_timer;
    this.movements = movements;
    this.rest_timer = rest_timer;
    this.rpe = rpe;
    this.shared_weight_one_unit = shared_weight_one_unit;
    this.shared_weight_one_value = shared_weight_one_value;
    this.shared_weight_two_unit = shared_weight_two_unit;
    this.shared_weight_two_value = shared_weight_two_value;
    this.started_at = started_at;
    this.straight_sets = straight_sets;
    this.user_id = user_id;
    this.title = title;
    this.pre_workout_notes = pre_workout_notes;
    this.workout_goal = workout_goal;
    this.workout_goal_units = workout_goal_units;
    this.post_workout_notes = post_workout_notes;
    id++;
  }
}
