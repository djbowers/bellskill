import { EquipmentRow } from '~/utils';

import { supabase } from '../supabaseClient';

export type UserEquipmentInput = EquipmentRow;

export const toEquipmentColumns = (input: UserEquipmentInput) => ({
  kind: input.kind,
  weight: input.kind === 'fixed' ? input.weight : null,
  min_weight: input.kind === 'adjustable' ? input.minWeight : null,
  max_weight: input.kind === 'adjustable' ? input.maxWeight : null,
  step_weight: input.kind === 'adjustable' ? input.stepWeight : null,
  unit: input.unit,
  quantity: input.quantity,
});

export const insertUserEquipment = async (
  userId: string,
  input: UserEquipmentInput,
) => {
  const { error } = await supabase
    .from('user_equipment')
    .insert({ user_id: userId, ...toEquipmentColumns(input) });

  if (error) throw error;
};

export const updateUserEquipment = async (
  id: string,
  input: UserEquipmentInput,
) => {
  const { error } = await supabase
    .from('user_equipment')
    .update(toEquipmentColumns(input))
    .eq('id', id);

  if (error) throw error;
};

export const deleteUserEquipment = async (id: string) => {
  const { error } = await supabase.from('user_equipment').delete().eq('id', id);

  if (error) throw error;
};
