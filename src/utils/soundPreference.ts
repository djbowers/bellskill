const SOUND_STORAGE_KEY = 'bellskill:sound-enabled';

/**
 * Whether timer sound effects are enabled. Defaults to ON when the key is
 * absent — the preference is only "off" when explicitly disabled by the user.
 */
export const isSoundEnabled = (): boolean => {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const setSoundEnabled = (enabled: boolean): void => {
  try {
    if (enabled) localStorage.removeItem(SOUND_STORAGE_KEY);
    else localStorage.setItem(SOUND_STORAGE_KEY, 'false');
  } catch {
    // ignore — storage unavailable (private mode, etc.)
  }
};
