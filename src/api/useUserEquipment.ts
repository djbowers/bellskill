import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { EquipmentRow } from '~/utils';

import { supabase } from '../supabaseClient';

export interface UserEquipment extends EquipmentRow {
  id: string;
}

export const useUserEquipment = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [QUERIES.USER_EQUIPMENT, userId],
    queryFn: () => fetchUserEquipment(userId!),
    enabled: !!userId,
  });
};

const fetchUserEquipment = async (
  userId: string,
): Promise<UserEquipment[]> => {
  const { data, error } = await supabase
    .from('user_equipment')
    .select('id, kind, weight, min_weight, max_weight, step_weight, unit, quantity')
    .eq('user_id', userId)
    .order('kind')
    .order('weight', { nullsFirst: false })
    .order('min_weight', { nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    weight: row.weight,
    minWeight: row.min_weight,
    maxWeight: row.max_weight,
    stepWeight: row.step_weight,
    unit: row.unit,
    quantity: row.quantity,
  }));
};
