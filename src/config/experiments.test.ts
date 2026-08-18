import {
  ALL_EXPERIMENT_FEATURES_ON,
  SAFE_DEFAULT_FEATURES,
  resolveExperimentFeatures,
} from './experiments';

describe('resolveExperimentFeatures', () => {
  test('a treatment variant resolves the feature to on', () => {
    expect(
      resolveExperimentFeatures({ curated_first_workout: 'treatment' }),
    ).toEqual({ ...SAFE_DEFAULT_FEATURES, curatedFirstWorkout: true });
  });

  test('a control variant resolves the feature to off', () => {
    expect(
      resolveExperimentFeatures({ curated_first_workout: 'control' }),
    ).toEqual(SAFE_DEFAULT_FEATURES);
  });

  test('an unrecognized variant is treated as the safe default (off)', () => {
    expect(
      resolveExperimentFeatures({ curated_first_workout: 'unknown-variant' }),
    ).toEqual(SAFE_DEFAULT_FEATURES);
  });

  test('a missing key defaults to off', () => {
    expect(resolveExperimentFeatures({})).toEqual(SAFE_DEFAULT_FEATURES);
  });

  test('every flag in treatment matches ALL_EXPERIMENT_FEATURES_ON', () => {
    expect(
      resolveExperimentFeatures({
        launchpad_shell: 'treatment',
        curated_first_workout: 'treatment',
        repeat_previous: 'treatment',
        recommender: 'treatment',
        ghost_pacing: 'treatment',
      }),
    ).toEqual(ALL_EXPERIMENT_FEATURES_ON);
  });
});
