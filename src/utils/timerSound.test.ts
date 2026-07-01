import { afterEach, describe, expect, it, vi } from 'vitest';

import { setSoundEnabled } from './soundPreference';
import { playDing, playStartCue, unlockAudio } from './timerSound';

describe('timerSound', () => {
  afterEach(() => {
    setSoundEnabled(true);
    vi.unstubAllGlobals();
  });

  it('is a safe no-op when Web Audio is unavailable (jsdom)', () => {
    // jsdom provides no AudioContext, so these must not throw.
    expect(() => unlockAudio()).not.toThrow();
    expect(() => playDing()).not.toThrow();
    expect(() => playStartCue()).not.toThrow();
  });

  it('does not attempt playback when sound is disabled', () => {
    const ctor = vi.fn();
    vi.stubGlobal('AudioContext', ctor);

    setSoundEnabled(false);
    playDing();
    playStartCue();

    expect(ctor).not.toHaveBeenCalled();
  });
});
