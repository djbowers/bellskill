import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setSoundEnabled } from './soundPreference';

const createMockContext = (state = 'running') => ({
  state,
  resume: vi.fn().mockResolvedValue(undefined),
  currentTime: 0,
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  })),
  destination: {},
});

// The module caches its AudioContext, so each test imports a fresh copy.
const importTimerSound = () => import('./timerSound');

describe('timerSound', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    setSoundEnabled(true);
    vi.unstubAllGlobals();
  });

  it('is a safe no-op when Web Audio is unavailable (jsdom)', async () => {
    const { playDing, playStartCue, unlockAudio } = await importTimerSound();
    expect(() => unlockAudio()).not.toThrow();
    expect(() => playDing()).not.toThrow();
    expect(() => playStartCue()).not.toThrow();
  });

  it('does not attempt playback when sound is disabled', async () => {
    const ctor = vi.fn();
    vi.stubGlobal('AudioContext', ctor);
    const { playDing, playStartCue } = await importTimerSound();

    setSoundEnabled(false);
    playDing();
    playStartCue();

    expect(ctor).not.toHaveBeenCalled();
  });

  it.each(['suspended', 'interrupted'])(
    'unlockAudio resumes a %s context',
    async (state) => {
      const ctx = createMockContext(state);
      vi.stubGlobal(
        'AudioContext',
        vi.fn(() => ctx),
      );
      const { unlockAudio } = await importTimerSound();

      unlockAudio();

      expect(ctx.resume).toHaveBeenCalled();
    },
  );

  it('unlockAudio does not resume a running context', async () => {
    const ctx = createMockContext('running');
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ctx),
    );
    const { unlockAudio } = await importTimerSound();

    unlockAudio();

    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('replaces a closed context with a fresh one on the next play', async () => {
    const closed = createMockContext('closed');
    const fresh = createMockContext('running');
    const ctor = vi
      .fn()
      .mockReturnValueOnce(closed)
      .mockReturnValueOnce(fresh);
    vi.stubGlobal('AudioContext', ctor);
    const { unlockAudio, playDing } = await importTimerSound();

    unlockAudio(); // caches the context that later ends up closed
    playDing();

    expect(ctor).toHaveBeenCalledTimes(2);
    expect(fresh.createOscillator).toHaveBeenCalled();
  });

  it('resumes an existing context when the page becomes visible again', async () => {
    const ctx = createMockContext('running');
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ctx),
    );
    const { unlockAudio } = await importTimerSound();
    unlockAudio();

    ctx.state = 'interrupted';
    document.dispatchEvent(new Event('visibilitychange'));

    expect(ctx.resume).toHaveBeenCalled();
  });

  it('does not create a context from the visibility listener', async () => {
    const ctor = vi.fn(() => createMockContext());
    vi.stubGlobal('AudioContext', ctor);
    await importTimerSound();

    document.dispatchEvent(new Event('visibilitychange'));

    expect(ctor).not.toHaveBeenCalled();
  });
});
