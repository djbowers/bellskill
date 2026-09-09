// The bell ladder. No imports: `src/config/skillTree.ts` and
// `skillTreeProgress.ts` both reach for it, and those run in the Deno edge
// runtime as well as the app.

/** The bells a lifter actually owns, in kilograms. */
export const BELL_LADDER_KG = [8, 12, 16, 20, 24, 28, 32, 36, 40, 48] as const;

export type BellKg = (typeof BELL_LADDER_KG)[number];

export const isBellKg = (kg: number): kg is BellKg =>
  (BELL_LADDER_KG as readonly number[]).includes(kg);

/** The heaviest rung this load covers, or null when it is lighter than the first bell. */
export const snapToBell = (kg: number): BellKg | null => {
  let snapped: BellKg | null = null;
  for (const bell of BELL_LADDER_KG) {
    if (kg + 0.01 >= bell) snapped = bell;
  }
  return snapped;
};

/** The rung above this load, or null once it is at or past the top of the ladder. */
export const nextBell = (kg: number | null): BellKg | null =>
  BELL_LADDER_KG.find((bell) => kg === null || bell > kg) ?? null;

export const formatBell = (kg: number) => `${kg}kg`;
