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

  const lines = ['AVAILABLE EQUIPMENT', `Owns: ${summary.description}`];

  if (summary.fixed_weights.length > 0) {
    const fixed = summary.fixed_weights
      .map((w) => `${w.weight_kg}kg${w.doubles ? ' (pair — doubles OK)' : ''}`)
      .join(', ');
    lines.push(
      `Fixed bells, usable at any point in the session: ${fixed}`,
      'Fixed bells can be swapped freely between blocks.',
    );
  } else {
    lines.push('Fixed bells: none.');
  }

  if (summary.adjustable_bells.length > 0) {
    const count = summary.adjustable_bell_count;
    lines.push(
      `Adjustable bells: ${count}. Each can be set to any of ${summary.adjustable_bells
        .map((g) => g.settings_kg.map((s) => `${s}kg`).join(', '))
        .join(' / ')}.`,
      // The whole point of the split: re-plating takes minutes, so an adjustable
      // bell's weight is a per-session decision, not a per-block one.
      'An adjustable bell holds ONE setting for the entire session — changing it takes several minutes, so it is never done mid-workout.',
      `Choose each adjustable bell's weight up front and reuse it for every block that needs it. Use at most ${count} distinct adjustable ${count === 1 ? 'weight' : 'weights'} in a session, and never prescribe two different weights from the same adjustable bell.`,
    );
    if (count >= 2) {
      lines.push(
        'Double-bell work on adjustable bells requires both bells at the same setting, which uses up both.',
      );
    } else {
      lines.push(
        'With one adjustable bell, double-bell work is only possible using fixed pairs.',
      );
    }
  }

  lines.push('Never prescribe a weight outside the lists above.');

  return lines.join('\n');
}
