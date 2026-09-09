import { supabase } from '../supabaseClient';

export type SkillNodeStatus = 'active' | 'complete';

export interface SkillNodeProgressRow {
  nodeId: string;
  status: SkillNodeStatus;
  completedAt: string | null;
}

const isSkillNodeStatus = (value: string): value is SkillNodeStatus =>
  value === 'active' || value === 'complete';

export const fetchSkillNodeProgress = async (
  userId: string,
): Promise<SkillNodeProgressRow[]> => {
  const { data, error } = await supabase
    .from('skill_node_progress')
    .select('node_id, status, completed_at')
    .eq('user_id', userId);

  if (error) throw error;

  return (data ?? []).flatMap((row) =>
    isSkillNodeStatus(row.status)
      ? [{ nodeId: row.node_id, status: row.status, completedAt: row.completed_at }]
      : [],
  );
};

export const upsertSkillNodeStatus = async (
  userId: string,
  nodeId: string,
  status: SkillNodeStatus,
) => {
  const { error } = await supabase.from('skill_node_progress').upsert(
    {
      user_id: userId,
      node_id: nodeId,
      status,
      completed_at: status === 'complete' ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,node_id' },
  );

  if (error) throw error;
};

export const deleteSkillNodeProgress = async (
  userId: string,
  nodeId: string,
) => {
  const { error } = await supabase
    .from('skill_node_progress')
    .delete()
    .eq('user_id', userId)
    .eq('node_id', nodeId);

  if (error) throw error;
};
