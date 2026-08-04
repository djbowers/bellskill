// Turns the user's declared kettlebell inventory (`user_equipment`) into the set
// of weights they can actually load. Pure + deterministic so it can be unit-tested
// here and reused verbatim by the recommender edge functions.

const POUNDS_TO_KG = 0.45359237;

/** An adjustable bell with a tiny step over a wide range would otherwise expand
 * into thousands of settings; the recommender only needs a usable spread. */
const MAX_SETTINGS_PER_ROW = 100;

export type EquipmentUnit = 'kilograms' | 'pounds';

export interface EquipmentRow {
  kind: 'fixed' | 'adjustable';
  weight: number | null;
  minWeight: number | null;
  maxWeight: number | null;
  stepWeight: number | null;
  unit: EquipmentUnit;
  quantity: number;
}

export interface AvailableWeight {
  weight_kg: number;
  /** Two bells can be loaded at this weight, so doubles work here. */
  doubles: boolean;
}

export interface FixedBellWeight extends AvailableWeight {
  count: number;
}

/** One or more identical adjustable bells and the settings each can take. */
export interface AdjustableBellGroup {
  count: number;
  settings_kg: number[];
}

/**
 * Fixed and adjustable bells stay separate because they behave differently
 * *within* a session: a fixed bell can be picked up and put down freely, while
 * an adjustable bell takes minutes to re-plate, so it holds a single setting for
 * the whole session and is chosen before it starts.
 */
export interface EquipmentSummary {
  fixed_weights: FixedBellWeight[];
  adjustable_bells: AdjustableBellGroup[];
  /** Distinct adjustable settings one session may use — one per adjustable bell. */
  adjustable_bell_count: number;
  description: string;
}

const toKg = (value: number, unit: EquipmentUnit): number => {
  const kg = unit === 'pounds' ? value * POUNDS_TO_KG : value;
  return Math.round(kg * 2) / 2;
};

const unitLabel = (unit: EquipmentUnit): string =>
  unit === 'pounds' ? 'lb' : 'kg';

const settingsForRow = (row: EquipmentRow): number[] => {
  if (row.kind === 'fixed') {
    return row.weight === null ? [] : [toKg(row.weight, row.unit)];
  }

  const { minWeight, maxWeight, stepWeight } = row;
  if (minWeight === null || maxWeight === null || stepWeight === null) return [];
  if (stepWeight <= 0 || maxWeight < minWeight) return [];

  const settings: number[] = [];
  for (
    let value = minWeight;
    value <= maxWeight + 1e-9 && settings.length < MAX_SETTINGS_PER_ROW;
    value += stepWeight
  ) {
    settings.push(toKg(value, row.unit));
  }
  return settings;
};

const describeRow = (row: EquipmentRow): string | null => {
  const label = unitLabel(row.unit);

  if (row.kind === 'fixed') {
    if (row.weight === null) return null;
    const base = `${row.weight} ${label}`;
    if (row.quantity === 2) return `${base} (pair)`;
    if (row.quantity > 2) return `${base} (×${row.quantity})`;
    return base;
  }

  if (row.minWeight === null || row.maxWeight === null) return null;
  const range = `adjustable ${row.minWeight}–${row.maxWeight} ${label}`;
  const details: string[] = [];
  if (row.quantity > 1) details.push(`×${row.quantity}`);
  if (row.stepWeight !== null)
    details.push(`${row.stepWeight} ${label} steps`);
  return details.length ? `${range} (${details.join(', ')})` : range;
};

/**
 * Splits owned bells into the weights that are free to mix within a session
 * (fixed) and the bells that must be set before it starts (adjustable). Returns
 * null when nothing is recorded, so callers can omit the section entirely.
 */
export const summarizeEquipment = (
  rows: EquipmentRow[],
): EquipmentSummary | null => {
  if (rows.length === 0) return null;

  const fixedCounts = new Map<number, number>();
  const adjustable_bells: AdjustableBellGroup[] = [];
  const descriptions: string[] = [];

  for (const row of rows) {
    const count = Math.max(1, row.quantity);
    const settings = settingsForRow(row);
    if (settings.length === 0) continue;

    if (row.kind === 'fixed') {
      const weight = settings[0];
      fixedCounts.set(weight, (fixedCounts.get(weight) ?? 0) + count);
    } else {
      adjustable_bells.push({ count, settings_kg: settings });
    }

    const description = describeRow(row);
    if (description) descriptions.push(description);
  }

  if (fixedCounts.size === 0 && adjustable_bells.length === 0) return null;

  const fixed_weights = [...fixedCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weight_kg, count]) => ({ weight_kg, count, doubles: count >= 2 }));

  return {
    fixed_weights,
    adjustable_bells,
    adjustable_bell_count: adjustable_bells.reduce(
      (total, group) => total + group.count,
      0,
    ),
    description: descriptions.join(', '),
  };
};

/**
 * Can each declared setting be handed to its own adjustable bell? Small inputs
 * (a handful of bells), so exact backtracking beats a greedy guess that can fail
 * on a legal plan — e.g. one wide-range bell and one narrow one.
 */
const canAssignSettings = (
  settings: number[],
  capacity: { left: number; options: Set<number> }[],
): boolean => {
  if (settings.length === 0) return true;
  const [first, ...rest] = settings;

  for (const bell of capacity) {
    if (bell.left > 0 && bell.options.has(first)) {
      bell.left -= 1;
      const ok = canAssignSettings(rest, capacity);
      bell.left += 1;
      if (ok) return true;
    }
  }
  return false;
};

/** One prescribed block's load: the weight, and how many bells are held at once. */
export interface SessionBlockLoad {
  weight_kg: number;
  bells: number;
}

/**
 * Enforces the within-session equipment contract: every prescribed weight is
 * either a fixed bell (free to pick up at any time) or one of the settings the
 * session declared up front for its adjustable bells, and enough bells exist at
 * that weight to cover double-bell work. Returns human-readable reasons, empty
 * when the plan is loadable as written.
 */
export const validateSessionWeights = (
  summary: EquipmentSummary,
  blocks: SessionBlockLoad[],
  adjustableSettingsKg: number[],
): string[] => {
  const reasons: string[] = [];

  const capacity = summary.adjustable_bells.map((group) => ({
    left: group.count,
    options: new Set(group.settings_kg),
  }));

  if (adjustableSettingsKg.length > summary.adjustable_bell_count) {
    reasons.push(
      `the session sets ${adjustableSettingsKg.length} adjustable weights but the lifter owns only ${summary.adjustable_bell_count} adjustable bell(s) — each bell holds one setting for the whole session`,
    );
  } else if (!canAssignSettings(adjustableSettingsKg, capacity)) {
    reasons.push(
      `the adjustable settings (${adjustableSettingsKg.map((s) => `${s}kg`).join(', ')}) cannot all be set on the lifter's adjustable bells at once`,
    );
  }

  // Bells standing at a given weight for the whole session: the fixed ones plus
  // every adjustable bell declared at it. Blocks are sequential, so a bell is
  // reusable across blocks — the requirement is per block, not cumulative.
  const availableAt = new Map<number, number>();
  for (const fixed of summary.fixed_weights) {
    availableAt.set(fixed.weight_kg, fixed.count);
  }
  for (const setting of adjustableSettingsKg) {
    availableAt.set(setting, (availableAt.get(setting) ?? 0) + 1);
  }

  const neededAt = new Map<number, number>();
  for (const block of blocks) {
    const bells = Math.max(1, block.bells);
    neededAt.set(
      block.weight_kg,
      Math.max(neededAt.get(block.weight_kg) ?? 0, bells),
    );
  }

  for (const [weight, needed] of neededAt) {
    const available = availableAt.get(weight) ?? 0;
    if (available >= needed) continue;

    if (available === 0) {
      const onSomeBell = summary.adjustable_bells.some((group) =>
        group.settings_kg.includes(weight),
      );
      reasons.push(
        onSomeBell
          ? `${weight}kg is only reachable by re-plating an adjustable bell mid-session — either declare it as an adjustable setting for the whole session or use a weight already in use`
          : `${weight}kg is not a weight the lifter owns`,
      );
    } else {
      reasons.push(
        `double-bell work at ${weight}kg needs ${needed} bells at that weight but the lifter has ${available}`,
      );
    }
  }

  return reasons;
};

/**
 * Every weight the lifter can load across sessions. Useful for showing coverage,
 * but never a within-session menu — see EquipmentSummary.
 */
export const allLoadableWeights = (
  summary: EquipmentSummary,
): AvailableWeight[] => {
  const counts = new Map<number, number>();
  const add = (weight: number, count: number) =>
    counts.set(weight, (counts.get(weight) ?? 0) + count);

  for (const fixed of summary.fixed_weights) add(fixed.weight_kg, fixed.count);
  for (const group of summary.adjustable_bells) {
    for (const setting of group.settings_kg) add(setting, group.count);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weight_kg, count]) => ({ weight_kg, doubles: count >= 2 }));
};
