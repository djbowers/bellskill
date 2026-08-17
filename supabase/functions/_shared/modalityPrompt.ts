// Shared modality-balance line formatting for the recommend-session, chalk-chat
// and recommend-program prompts. Mirrors patternDebtPrompt.ts and stays
// provider-agnostic for the same reason: each function keeps its own serialized
// entry type.
//
// `conditioning` and `mobility` are values in BOTH the modality vocabulary and
// the programs' focus_tags vocabulary, meaning different things — a movement
// that is cardio-effort work versus a program that buys work capacity. Every
// modality value is rendered through MODALITY_WORDS so the two never collide in
// a prompt; "cardio" also matches the UI label for that modality.

const MODALITY_WORDS: Record<string, string> = {
  conditioning: 'cardio',
};

export const modalityWord = (modality: string): string =>
  MODALITY_WORDS[modality] ?? modality;

/** The subset of a serialized modality-debt entry needed to render one prompt line. */
export interface ModalityDebtLineEntry {
  modality: string;
  days_since_last_trained: number | null;
  recent_volume_kg: number;
  baseline_volume_kg: number | null;
  debt_score: number;
  band: string;
  /** Never trained in the baseline window — treat as neutral, not overdue. */
  is_new: boolean;
}

export function formatModalityLine(m: ModalityDebtLineEntry): string {
  const name = modalityWord(m.modality);
  if (m.is_new) {
    return `- ${name}: new — no training history yet, not overdue`;
  }
  const lastTrained =
    m.days_since_last_trained == null
      ? 'not trained recently'
      : `last trained ${m.days_since_last_trained}d ago`;
  const volume =
    m.baseline_volume_kg && m.baseline_volume_kg > 0
      ? `volume ${Math.round((m.recent_volume_kg / m.baseline_volume_kg) * 100)}% of baseline`
      : `recent volume ${m.recent_volume_kg}kg (no baseline)`;
  return `- ${name}: score ${m.debt_score} (${m.band}) · ${lastTrained} · ${volume}`;
}

/** Renders `grind-heavy` as `grind-heavy`, `conditioning-heavy` as `cardio-heavy`. */
export const formatOverallModalityBalance = (overall: string): string => {
  const suffix = '-heavy';
  if (!overall.endsWith(suffix)) return overall;
  return `${modalityWord(overall.slice(0, -suffix.length))}${suffix}`;
};
