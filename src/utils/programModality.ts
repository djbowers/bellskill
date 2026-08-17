// A program's modality profile, derived from the movements its sessions
// prescribe rather than stored editorially.
//
// This is a different axis from `programs.focus_tags` and the two are not
// derivable from each other: focus is the adaptation a prescription buys
// (strength, endurance), modality is how a rep moves you (grind, ballistic).
// Simple & Sinister and the 10,000 Swing Challenge share a modality skew and
// sit at opposite ends of the focus axis. See docs/modality-debt-scoring-model.md.
//
// Pure + deterministic over the rows returned by the program_modality_movements
// RPC, which is a plain aggregation (SQL aggregates, TS attributes and scores).

// Extension-qualified so the Deno edge runtime can import this module directly,
// the same reason modalityDebt.ts and patternDebt.ts spell theirs out.
import { MODALITIES, Modality } from './modalityDebt.ts';

/** One aggregation row: how many of a program's prescribed movements credit a modality. */
export interface ProgramModalityRow {
  program_id: string;
  modality: string;
  movement_count: number;
}

/**
 * Share of a program's matched movement credits a modality must reach before it
 * describes the program. Below this it is incidental — one mobility drill in a
 * twenty-session strength program should not read as "this is mobility work".
 */
export const PROFILE_MIN_SHARE = 0.2;

/**
 * The modalities that describe one program, most prominent first. Empty when no
 * prescribed movement matched the catalog, which callers should render as no
 * claim at all rather than as "trains nothing".
 */
export const computeProgramModalityProfile = (
  rows: ProgramModalityRow[],
  minShare: number = PROFILE_MIN_SHARE,
): Modality[] => {
  const counts = new Map<Modality, number>();
  for (const row of rows) {
    if (!(MODALITIES as readonly string[]).includes(row.modality)) continue;
    const modality = row.modality as Modality;
    counts.set(modality, (counts.get(modality) ?? 0) + row.movement_count);
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];

  return [...counts.entries()]
    .filter(([, count]) => count / total >= minShare)
    .sort(
      ([aModality, aCount], [bModality, bCount]) =>
        bCount - aCount ||
        MODALITIES.indexOf(aModality) - MODALITIES.indexOf(bModality),
    )
    .map(([modality]) => modality);
};

/** Group flat RPC rows into a per-program profile lookup. */
export const groupProgramModalityProfiles = (
  rows: ProgramModalityRow[],
  minShare: number = PROFILE_MIN_SHARE,
): Map<string, Modality[]> => {
  const byProgram = new Map<string, ProgramModalityRow[]>();
  for (const row of rows) {
    const list = byProgram.get(row.program_id) ?? [];
    list.push(row);
    byProgram.set(row.program_id, list);
  }

  return new Map(
    [...byProgram.entries()].map(([programId, programRows]) => [
      programId,
      computeProgramModalityProfile(programRows, minShare),
    ]),
  );
};
