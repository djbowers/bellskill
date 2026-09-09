import { supabase } from '~/supabaseClient';

export const handleSignOut = () => supabase.auth.signOut();

const isDarkStored = () => localStorage.theme === 'dark';

export function applyStoredTheme() {
  document.documentElement.classList.toggle('dark', isDarkStored());
}

export function handleClickLightDarkMode() {
  localStorage.theme = isDarkStored() ? 'light' : 'dark';
  applyStoredTheme();
}
