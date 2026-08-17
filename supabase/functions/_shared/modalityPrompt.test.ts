import { describe, expect, it } from 'vitest';

import {
  ModalityDebtLineEntry,
  formatModalityLine,
  formatOverallModalityBalance,
  modalityWord,
} from './modalityPrompt.ts';

const entry = (
  overrides: Partial<ModalityDebtLineEntry> = {},
): ModalityDebtLineEntry => ({
  modality: 'grind',
  days_since_last_trained: 3,
  recent_volume_kg: 500,
  baseline_volume_kg: 1000,
  debt_score: 42,
  band: 'yellow',
  is_new: false,
  ...overrides,
});

describe('formatModalityLine', () => {
  it('renders score, band, recency and volume share', () => {
    expect(formatModalityLine(entry())).toBe(
      '- grind: score 42 (yellow) · last trained 3d ago · volume 50% of baseline',
    );
  });

  it('says cardio, never conditioning — that word means something else on the focus axis', () => {
    const line = formatModalityLine(entry({ modality: 'conditioning' }));
    expect(line).toContain('cardio');
    expect(line).not.toContain('conditioning');
  });

  it('treats a new modality as neutral rather than overdue', () => {
    expect(formatModalityLine(entry({ is_new: true, modality: 'mobility' }))).toBe(
      '- mobility: new — no training history yet, not overdue',
    );
  });

  it('falls back to raw volume when there is no baseline', () => {
    expect(formatModalityLine(entry({ baseline_volume_kg: null }))).toContain(
      'recent volume 500kg (no baseline)',
    );
  });

  it('reports never-in-window training without a day count', () => {
    expect(
      formatModalityLine(entry({ days_since_last_trained: null })),
    ).toContain('not trained recently');
  });

  it('never uses the word "debt"', () => {
    expect(formatModalityLine(entry())).not.toContain('debt');
  });
});

describe('formatOverallModalityBalance', () => {
  it('translates the conditioning skew to cardio', () => {
    expect(formatOverallModalityBalance('conditioning-heavy')).toBe(
      'cardio-heavy',
    );
  });

  it('passes other skews and "balanced" through', () => {
    expect(formatOverallModalityBalance('grind-heavy')).toBe('grind-heavy');
    expect(formatOverallModalityBalance('balanced')).toBe('balanced');
  });
});

describe('modalityWord', () => {
  it('leaves modalities with no collision alone', () => {
    expect(modalityWord('ballistic')).toBe('ballistic');
  });
});
