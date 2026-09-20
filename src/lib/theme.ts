/**
 * Theme runtime.
 *
 * Deliberately a module singleton rather than a hook or a provider: App.tsx
 * early-returns for the quick-translate window, so anything living inside the
 * React tree would have to be installed twice, and the theme has to be on
 * <html> before createRoot paints the first frame.
 *
 * `data-theme` is always a RESOLVED 'light' | 'dark' — 'system' is collapsed
 * here, never in CSS, so the dark token block stays declared once and a
 * desktop-level signal can override prefers-color-scheme without CSS churn.
 */
import { useAppStore } from '../../store/useAppStore';
import { ACCENTS, DEFAULT_ACCENT, type Accent } from '../../constants';
import type { AppearanceTheme } from '../../types';

export type ResolvedTheme = 'light' | 'dark';

const darkQuery = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const prefersDark = (): boolean => darkQuery()?.matches ?? false;

export const resolveTheme = (preference: AppearanceTheme): ResolvedTheme =>
  preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference;

/** '#03875B' -> '3 135 91', the form `rgb(... / <alpha>)` needs. */
const channels = (hex: string): string => {
  const value = parseInt(hex.replace('#', ''), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

/**
 * An unrecognised hex falls back to the default rather than propagating into
 * CSS — the same defensive shape the store's `merge()` uses for `provider`.
 */
export const accentFor = (hex: string): Accent =>
  ACCENTS.find((accent) => accent.light.toLowerCase() === hex.toLowerCase()) ?? DEFAULT_ACCENT;

// zustand notifies on every set(), including each keystroke in inputText.
// Comparing a signature keeps this to real appearance changes.
let signature = '';

function apply(): void {
  const state = useAppStore.getState();
  const next = [
    state.appearanceTheme,
    state.accentColor,
    state.translationTextSize,
    state.quickWindowOpacity,
    state.quickWindowBorderOpacity,
    prefersDark(),
  ].join('|');
  if (next === signature) return;
  signature = next;

  const root = document.documentElement;
  root.dataset.theme = resolveTheme(state.appearanceTheme);
  root.dataset.textSize = state.translationTextSize;

  const accent = accentFor(state.accentColor);
  root.style.setProperty('--accent-light', accent.light);
  root.style.setProperty('--accent-light-rgb', channels(accent.light));
  root.style.setProperty('--accent-dark', accent.dark);
  root.style.setProperty('--accent-dark-rgb', channels(accent.dark));

  root.style.setProperty('--quick-bg-a', String(state.quickWindowOpacity));
  // The stored value is the 0-0.5 slider; the window ring has always been
  // drawn at twice that, and the dark theme scales it again in CSS.
  root.style.setProperty('--quick-ring-a', String(Math.min(1, state.quickWindowBorderOpacity * 2)));
}

let started = false;

export function initTheme(): void {
  if (started) return; // idempotent under StrictMode and HMR
  started = true;

  // Window mode comes from the URL and never changes. Setting it here instead
  // of in an App.tsx effect means the first painted frame already has the
  // right window shape and text scale.
  const isQuick = new URLSearchParams(window.location.search).get('mode') === 'quick';
  document.documentElement.dataset.windowMode = isQuick ? 'quick' : 'main';

  apply();

  // Covers local edits AND persist.rehydrate() from the other window, so a
  // theme change in Settings retints the pop-up with no new IPC.
  useAppStore.subscribe(apply);

  // Only matters while appearanceTheme is 'system'; apply() no-ops otherwise.
  darkQuery()?.addEventListener('change', apply);
}
