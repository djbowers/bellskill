import { Database } from '../../types/supabase';

type MovementLog = Database['public']['Tables']['movement_logs']['Row'];

let id = 1;

export class ExampleMovementLog implements MovementLog {
  created_at: string | null;
  id: number;
  movement_name: string;
  rep_scheme: number[];
  user_id: string;
  user_movement_id: string | null;
  weight_one_unit: 'kilograms' | 'pounds' | null;
  weight_one_value: number | null;
  weight_two_unit: 'kilograms' | 'pounds' | null;
  weight_two_value: number | null;
  workout_log_id: number;

  constructor({
    created_at = '2023-10-11T14:08:53.112365+00:00',
    movement_name = 'Clean and Press',
    rep_scheme = [3],
    user_id = '1',
    user_movement_id = null,
    weight_one_unit = 'kilograms',
    weight_one_value = 20,
    weight_two_unit = 'kilograms',
    weight_two_value = 16,
    workout_log_id = 1,
  }: Partial<MovementLog>) {
    this.created_at = created_at;
    this.id = id;
    this.movement_name = movement_name;
    this.rep_scheme = rep_scheme;
    this.user_id = user_id;
    this.user_movement_id = user_movement_id;
    this.weight_one_unit = weight_one_unit;
    this.weight_one_value = weight_one_value;
    this.weight_two_unit = weight_two_unit;
    this.weight_two_value = weight_two_value;
    this.workout_log_id = workout_log_id;
    id++;
  }
}
