// Shared equipment fetch + prompt formatting for the recommend-session and
// recommend-program prompts (PROD-78). Both functions read the same
// user_equipment rows and render the same "Available equipment" section, so the
// LLM only ever prescribes weights the user can actually load.

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type EquipmentRow,
  type EquipmentSummary,
  summarizeEquipment,
} from '../../../src/utils/equipment.ts';

/**
 * Best-effort: any failure degrades to null so a recommendation is never blocked
 * on equipment, matching how pattern debt degrades.
 */
export async function gatherEquipment(
  admin: SupabaseClient,
  userId: string,
): Promise<EquipmentSummary | null> {
  try {
    const { data, error } = await admin
      .from('user_equipment')
      .select('kind, weight, min_weight, max_weight, step_weight, unit, quantity')
      .eq('user_id', userId);
    if (error) throw error;

    const rows: EquipmentRow[] = (data ?? []).map(
      (row: Record<string, unknown>) => ({
        kind: row.kind as EquipmentRow['kind'],
        weight: row.weight == null ? null : Number(row.weight),
        minWeight: row.min_weight == null ? null : Number(row.min_weight),
        maxWeight: row.max_weight == null ? null : Number(row.max_weight),
        stepWeight: row.step_weight == null ? null : Number(row.step_weight),
        unit: row.unit as EquipmentRow['unit'],
        quantity: Number(row.quantity),
      }),
    );

    return summarizeEquipment(rows);
  } catch (err) {
    console.error('equipment fetch failed:', err);
    return null;
  }
}

/** Renders the prompt section, or '' when the user has recorded no equipment. */
export function formatEquipmentSection(
  summary: EquipmentSummary | null,
): string {
  if (!summary) return '';

  const singles = summary.available_weights
    .map((w) => `${w.weight_kg}kg`)
    .join(', ');
  const doubles = summary.available_weights
    .filter((w) => w.doubles)
    .map((w) => `${w.weight_kg}kg`)
    .join(', ');

  return [
    'AVAILABLE EQUIPMENT',
    `Owns: ${summary.description}`,
    `Loadable weights: ${singles}`,
    doubles
      ? `Doubles possible at: ${doubles}`
      : 'Doubles possible at: none — only single-bell work',
    'Prescribe only weights from the loadable list. Prescribe double-bell work only at weights marked as doubles.',
  ].join('\n');
}
