import { supabase } from '~/supabaseClient';

export const handleSignOut = () => supabase.auth.signOut();

export function handleClickLightDarkMode() {
  if (localStorage.theme === 'dark' || !('theme' in localStorage)) {
    //add class=dark in html element
    document.documentElement.classList.add('dark');
  } else {
    //remove class=dark in html element
    document.documentElement.classList.remove('dark');
  }

  if (localStorage.theme === 'dark') {
    localStorage.theme = 'light';
  } else {
    localStorage.theme = 'dark';
  }
}
