import { applySharedWeights } from './applySharedWeights';

const movement = (overrides = {}) => ({
  movementName: 'Clean',
  repScheme: [5],
  weightOneUnit: 'kilograms' as const,
  weightOneValue: 24,
  weightTwoUnit: null,
  weightTwoValue: null,
  ...overrides,
});

const options = (overrides = {}) => ({
  complexSet: true,
  movements: [movement(), movement({ movementName: 'Jerk' })],
  sharedWeightOneUnit: 'kilograms' as const,
  sharedWeightOneValue: 28,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  ...overrides,
});

describe('applySharedWeights', () => {
  test('overrides every movement weight field with the shared weight when complex', () => {
    const result = applySharedWeights(
      options({
        sharedWeightTwoUnit: 'pounds',
        sharedWeightTwoValue: 35,
      }),
    );

    result.movements.forEach((m) => {
      expect(m.weightOneUnit).toBe('kilograms');
      expect(m.weightOneValue).toBe(28);
      expect(m.weightTwoUnit).toBe('pounds');
      expect(m.weightTwoValue).toBe(35);
    });
  });

  test('leaves non-complex options untouched', () => {
    const input = options({ complexSet: false });
    expect(applySharedWeights(input)).toBe(input);
    expect(input.movements[0].weightOneValue).toBe(24);
  });

  test('null shared weights clear per-movement weights (bodyweight complex)', () => {
    const result = applySharedWeights(
      options({ sharedWeightOneUnit: null, sharedWeightOneValue: null }),
    );

    result.movements.forEach((m) => {
      expect(m.weightOneUnit).toBeNull();
      expect(m.weightOneValue).toBeNull();
    });
  });

  test('preserves non-weight movement fields and options fields', () => {
    const input = options();
    const result = applySharedWeights(input);

    expect(result.movements[0].movementName).toBe('Clean');
    expect(result.movements[0].repScheme).toEqual([5]);
    expect(result.sharedWeightOneValue).toBe(28);
  });
});
