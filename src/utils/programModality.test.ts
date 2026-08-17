import { describe, expect, it } from 'vitest';

import {
  PROFILE_MIN_SHARE,
  ProgramModalityRow,
  computeProgramModalityProfile,
  groupProgramModalityProfiles,
} from './programModality';

const row = (
  modality: string,
  movement_count: number,
  program_id = 'p1',
): ProgramModalityRow => ({ program_id, modality, movement_count });

describe('computeProgramModalityProfile', () => {
  it('orders modalities by share, most prominent first', () => {
    expect(
      computeProgramModalityProfile([
        row('grind', 5),
        row('ballistic', 10),
        row('conditioning', 6),
      ]),
    ).toEqual(['ballistic', 'conditioning', 'grind']);
  });

  it('drops modalities below the share threshold', () => {
    // 1 of 21 credits is incidental, not what the program trains.
    expect(
      computeProgramModalityProfile([
        row('ballistic', 20),
        row('mobility', 1),
      ]),
    ).toEqual(['ballistic']);
  });

  it('keeps a modality exactly at the threshold', () => {
    expect(
      computeProgramModalityProfile([row('grind', 8), row('mobility', 2)]),
    ).toEqual(['grind', 'mobility']);
    expect(2 / 10).toBe(PROFILE_MIN_SHARE);
  });

  it('honours an overridden threshold', () => {
    expect(
      computeProgramModalityProfile([row('grind', 9), row('mobility', 1)], 0.05),
    ).toEqual(['grind', 'mobility']);
  });

  it('returns empty when nothing matched the catalog', () => {
    expect(computeProgramModalityProfile([])).toEqual([]);
  });

  it('ignores credits outside the modality vocabulary', () => {
    expect(
      computeProgramModalityProfile([row('strength', 10), row('grind', 5)]),
    ).toEqual(['grind']);
  });

  it('sums duplicate rows for one modality', () => {
    expect(
      computeProgramModalityProfile([row('grind', 2), row('grind', 3)]),
    ).toEqual(['grind']);
  });

  it('breaks share ties in canonical modality order', () => {
    expect(
      computeProgramModalityProfile([row('conditioning', 5), row('grind', 5)]),
    ).toEqual(['grind', 'conditioning']);
  });
});

describe('groupProgramModalityProfiles', () => {
  it('scores each program against its own totals', () => {
    // 'mobility' is 1 of 11 in p1 (dropped) but 1 of 2 in p2 (kept) — the
    // threshold is per program, never global.
    const profiles = groupProgramModalityProfiles([
      row('ballistic', 10, 'p1'),
      row('mobility', 1, 'p1'),
      row('grind', 1, 'p2'),
      row('mobility', 1, 'p2'),
    ]);

    expect(profiles.get('p1')).toEqual(['ballistic']);
    expect(profiles.get('p2')).toEqual(['grind', 'mobility']);
  });

  it('omits programs with no rows rather than inventing an empty profile', () => {
    expect(groupProgramModalityProfiles([]).size).toBe(0);
  });
});
