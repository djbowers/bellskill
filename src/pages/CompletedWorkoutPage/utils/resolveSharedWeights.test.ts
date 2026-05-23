import { resolveSharedWeights } from './resolveSharedWeights';

describe('resolveSharedWeights', () => {
  const movementLogs = [
    {
      id: 1,
      movementName: 'Clean and Press',
      repScheme: [3],
      userMovementId: null,
      functionalMovementId: null,
      weightOneUnit: 'kilograms' as const,
      weightOneValue: 20,
      weightTwoUnit: 'kilograms' as const,
      weightTwoValue: 16,
    },
  ];

  test('returns shared weight fields when present on workout log', () => {
    expect(
      resolveSharedWeights(24, 'kilograms', null, null, movementLogs),
    ).toEqual({
      weightOneValue: 24,
      weightOneUnit: 'kilograms',
      weightTwoValue: null,
      weightTwoUnit: null,
    });
  });

  test('falls back to first movement log when shared weight fields are null', () => {
    expect(
      resolveSharedWeights(null, null, null, null, movementLogs),
    ).toEqual({
      weightOneValue: 20,
      weightOneUnit: 'kilograms',
      weightTwoValue: 16,
      weightTwoUnit: 'kilograms',
    });
  });
});
