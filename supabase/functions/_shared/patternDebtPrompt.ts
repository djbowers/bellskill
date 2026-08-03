// Shared pattern-debt line formatting for the recommend-session and
// recommend-program prompts. Kept provider-agnostic (no cross-import of
// either function's PatternDebtEntry) since the two functions' scoring types
// live in separate modules.

/** The subset of a serialized pattern-debt entry needed to render one prompt line. */
export interface PatternDebtLineEntry {
  pattern: string;
  days_since_last_trained: number | null;
  debt_score: number;
  band: string;
  /** Never trained in the baseline window — treat as neutral, not overdue. */
  is_new: boolean;
  hardest_rpe?: unknown;
  /** Only recommend-session's entries carry recent/baseline volume. */
  recent_volume_kg?: number;
  baseline_volume_kg?: number | null;
}

export function formatPatternLine(p: PatternDebtLineEntry): string {
  if (p.is_new) {
    return `- ${p.pattern}: new — no training history yet, not overdue`;
  }
  if (p.recent_volume_kg !== undefined) {
    const lastTrained =
      p.days_since_last_trained == null
        ? 'not trained recently'
        : `last trained ${p.days_since_last_trained}d ago`;
    const volume =
      p.baseline_volume_kg && p.baseline_volume_kg > 0
        ? `volume ${Math.round((p.recent_volume_kg / p.baseline_volume_kg) * 100)}% of baseline`
        : `recent volume ${p.recent_volume_kg}kg (no baseline)`;
    return `- ${p.pattern}: debt ${p.debt_score} (${p.band}) · ${lastTrained} · ${volume}`;
  }
  const lastTrained =
    p.days_since_last_trained !== null
      ? `, last trained ${p.days_since_last_trained}d ago`
      : ', not trained recently';
  return `- ${p.pattern}: debt ${p.debt_score} (${p.band})${lastTrained}`;
}
