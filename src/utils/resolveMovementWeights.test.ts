import { resolveMovementWeights } from './resolveMovementWeights';

const movement = (overrides = {}) => ({
  movementName: 'Clean',
  repScheme: [5],
  weightOneUnit: 'kilograms' as const,
  weightOneValue: 24,
  weightTwoUnit: null,
  weightTwoValue: null,
  ...overrides,
});

const shared = (overrides = {}) => ({
  complexSet: true,
  sharedWeightOneUnit: 'kilograms' as const,
  sharedWeightOneValue: 28,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  ...overrides,
});

describe('resolveMovementWeights', () => {
  test('returns the shared weight when the movement is part of a complex set', () => {
    const result = resolveMovementWeights(
      movement(),
      shared({ sharedWeightTwoUnit: 'pounds', sharedWeightTwoValue: 35 }),
    );

    expect(result.weightOneUnit).toBe('kilograms');
    expect(result.weightOneValue).toBe(28);
    expect(result.weightTwoUnit).toBe('pounds');
    expect(result.weightTwoValue).toBe(35);
  });

  test('leaves the movement untouched when not complex', () => {
    const input = movement();
    expect(resolveMovementWeights(input, shared({ complexSet: false }))).toBe(
      input,
    );
  });

  test('null shared weights read as bodyweight', () => {
    const result = resolveMovementWeights(
      movement(),
      shared({ sharedWeightOneUnit: null, sharedWeightOneValue: null }),
    );

    expect(result.weightOneUnit).toBeNull();
    expect(result.weightOneValue).toBeNull();
  });

  test('preserves non-weight movement fields', () => {
    const result = resolveMovementWeights(movement(), shared());

    expect(result.movementName).toBe('Clean');
    expect(result.repScheme).toEqual([5]);
  });
});
