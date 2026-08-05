import { features, getFeatures, isDeployPreview } from './features';

const ALL_ON = {
  explore: true,
  premium: true,
  programs: true,
  spotify: true,
  weeklyBalance: true,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isDeployPreview', () => {
  test('true only when VITE_DEPLOY_PREVIEW is exactly "true"', () => {
    vi.stubEnv('VITE_DEPLOY_PREVIEW', 'true');
    expect(isDeployPreview()).toBe(true);
  });

  test('false when the flag is unset or anything other than "true"', () => {
    vi.stubEnv('VITE_DEPLOY_PREVIEW', '');
    expect(isDeployPreview()).toBe(false);
    vi.stubEnv('VITE_DEPLOY_PREVIEW', 'false');
    expect(isDeployPreview()).toBe(false);
  });
});

describe('getFeatures', () => {
  test('forces every feature on for a deploy preview, even with no session', () => {
    vi.stubEnv('VITE_DEPLOY_PREVIEW', 'true');
    expect(getFeatures()).toEqual(ALL_ON);
  });

  test('returns the base build-time flags outside a deploy preview', () => {
    vi.stubEnv('VITE_DEPLOY_PREVIEW', 'false');
    expect(getFeatures()).toEqual(features);
  });
});
