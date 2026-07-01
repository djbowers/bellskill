import { isSoundEnabled } from './soundPreference';

/**
 * Web Audio synthesis for timer cues. No binary asset — the tones are generated
 * with an oscillator + gain envelope, so they work offline and add no bundle
 * weight. Every entry point is feature-detected so the module is a safe no-op in
 * environments without Web Audio (e.g. jsdom during tests).
 */

type AudioContextConstructor = typeof AudioContext;

const getAudioContextCtor = (): AudioContextConstructor | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext
  );
};

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (audioContext) return audioContext;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
  } catch {
    audioContext = null;
  }
  return audioContext;
};

/**
 * Create (if needed) and resume the AudioContext. Must be called from within a
 * user gesture (e.g. the Start button) so mobile Safari unlocks audio playback.
 */
export const unlockAudio = (): void => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
};

/** Play a single note with a quick attack + exponential decay envelope. */
const playTone = (
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
): void => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.3, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
};

const vibrate = (pattern: number | number[]): void => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore — vibration unsupported
  }
};

/**
 * Two-note "ding" played when a rest or interval timer reaches zero. No-ops when
 * sound is disabled or Web Audio is unavailable.
 */
export const playDing = (): void => {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume?.().catch(() => {});

  const now = ctx.currentTime;
  playTone(ctx, 880, now, 0.28); // A5
  playTone(ctx, 1318.51, now + 0.13, 0.32); // E6

  vibrate(200);
};

/**
 * Distinct higher "go" cue played when the 3-2-1 pre-start countdown finishes,
 * so it's audibly different from the end-of-timer ding.
 */
export const playStartCue = (): void => {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume?.().catch(() => {});

  const now = ctx.currentTime;
  playTone(ctx, 1046.5, now, 0.3); // C6

  vibrate([120, 60, 120]);
};
