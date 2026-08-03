import { Program } from '~/types';

import { programCadenceLabel } from './programCadenceLabel';

const baseProgram: Program = {
  id: 'prog-1',
  ownerId: 'user-123',
  sourceProgramId: null,
  slug: 'dry-fighting-weight',
  title: 'Dry Fighting Weight',
  description: null,
  authorName: null,
  numWeeks: 2,
  daysPerWeek: 3,
  isPublic: true,
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
  defaultAutoRepeat: false,
  releasedAt: '2026-01-01T00:00:00Z',
  stages: null,
  focusTags: [],
  systemicDemand: null,
};

describe('programCadenceLabel', () => {
  it('reads "Repeating workout" for a default-auto-repeat program, regardless of week/day counts', () => {
    expect(
      programCadenceLabel({
        ...baseProgram,
        defaultAutoRepeat: true,
        numWeeks: 1,
        daysPerWeek: 1,
      }),
    ).toBe('Repeating workout');
  });

  it('pluralizes "weeks" even for a single-week program', () => {
    expect(
      programCadenceLabel({ ...baseProgram, numWeeks: 1, daysPerWeek: 3 }),
    ).toBe('1 weeks · 3/week');
  });

  it('shows the derived weeks/days-per-week cadence for a multi-week program', () => {
    expect(
      programCadenceLabel({ ...baseProgram, numWeeks: 4, daysPerWeek: 5 }),
    ).toBe('4 weeks · 5/week');
  });

  it('returns null when numWeeks is not yet derived', () => {
    expect(
      programCadenceLabel({ ...baseProgram, numWeeks: null, daysPerWeek: 3 }),
    ).toBeNull();
  });

  it('returns null when daysPerWeek is not yet derived', () => {
    expect(
      programCadenceLabel({ ...baseProgram, numWeeks: 2, daysPerWeek: null }),
    ).toBeNull();
  });

  it('returns null when neither cadence field has been derived', () => {
    expect(
      programCadenceLabel({ ...baseProgram, numWeeks: null, daysPerWeek: null }),
    ).toBeNull();
  });
});
