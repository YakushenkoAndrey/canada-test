import { settings } from './store';

/** Colour theme: light (default), dark, or follow the phone setting. */
export function applyTheme(): void {
  const dark =
    settings.theme === 'dark' || (settings.theme === 'auto' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1b1b' : '#871619');
}

export function watchTheme(): void {
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  } catch {
    /* old browsers */
  }
}
