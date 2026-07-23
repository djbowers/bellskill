import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { MovementLog } from '~/types';

import { supabase } from '../supabaseClient';

export const useMovementLogs = (workoutLogId: string) => {
  return useQuery({
    queryKey: [QUERIES.MOVEMENT_LOGS],
    queryFn: () => fetchMovementLogs(workoutLogId),
  });
};

const fetchMovementLogs = async (
  workoutLogId: string,
): Promise<MovementLog[]> => {
  const { data: movementLogs, error } = await supabase
    .from('movement_logs')
    .select(`*, user_movements(id, canonical_name, functional_movement_id)`)
    .eq('workout_log_id', parseInt(workoutLogId))
    .order('id');

  if (error) {
    console.error(error);
    throw error;
  }

  return movementLogs.map((movementLog) => {
    const userMovement = Array.isArray(movementLog.user_movements)
      ? movementLog.user_movements[0]
      : movementLog.user_movements;

    return {
      id: movementLog.id,
      movementName: movementLog.movement_name,
      repScheme: movementLog.rep_scheme,
      timedRungs: movementLog.timed_rungs,
      userMovementId: movementLog.user_movement_id,
      functionalMovementId: userMovement?.functional_movement_id ?? null,
      weightOneUnit: movementLog.weight_one_unit,
      weightOneValue: movementLog.weight_one_value,
      weightTwoUnit: movementLog.weight_two_unit,
      weightTwoValue: movementLog.weight_two_value,
    };
  });
};
