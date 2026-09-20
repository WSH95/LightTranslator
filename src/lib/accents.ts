/**
 * Mapping between GNOME's appearance settings and the ten Yaru accents.
 *
 * Kept free of React, zustand and the platform bridge so it can be unit
 * tested directly with `node --test`.
 */
import { ACCENTS, DEFAULT_ACCENT, type Accent } from '../../constants.ts';

export interface SystemAppearanceLike {
  accentColor: string | null;
  gtkTheme: string | null;
}

/** An unrecognised hex falls back to the default rather than reaching CSS. */
export const accentFor = (hex: string): Accent =>
  ACCENTS.find((accent) => accent.light.toLowerCase() === hex.toLowerCase()) ?? DEFAULT_ACCENT;

const byName = (name: string): Accent | undefined =>
  ACCENTS.find((accent) => accent.name.toLowerCase() === name.toLowerCase());

/**
 * GNOME 47+ exposes `accent-color` as one of nine names. They do not line up
 * one-to-one with Yaru's ten, so teal/yellow/pink/slate map to their nearest
 * Yaru sibling.
 */
export const GNOME_ACCENT_NAMES: Record<string, string> = {
  blue: 'Blue',
  teal: 'Prussian Green',
  green: 'Viridian',
  yellow: 'Olive',
  orange: 'Orange',
  red: 'Red',
  pink: 'Magenta',
  purple: 'Purple',
  slate: 'Sage',
};

/**
 * Ubuntu 24.04 ships GNOME 46, which has no `accent-color` key at all — the
 * accent is the GTK theme. /usr/share/themes carries exactly `Yaru` plus nine
 * `Yaru-<name>` variants that map one-to-one onto ACCENTS, each with a `-dark`
 * twin. Plain `Yaru` is Orange.
 */
export const accentFromGtkTheme = (theme: string): Accent | undefined => {
  const base = theme.trim().replace(/-dark$/i, '');
  if (/^yaru$/i.test(base)) return byName('Orange');
  const match = /^yaru-(.+)$/i.exec(base);
  if (!match) return undefined;
  const slug = match[1].toLowerCase();
  // 'Prussian Green' -> 'prussiangreen'
  return ACCENTS.find((accent) => accent.name.toLowerCase().replace(/\s+/g, '') === slug);
};

/** The explicit GNOME 47 key wins; the Yaru theme name is the fallback. */
export const accentFromSystem = (appearance: SystemAppearanceLike): Accent | undefined => {
  if (appearance.accentColor) {
    const mapped = GNOME_ACCENT_NAMES[appearance.accentColor.trim().toLowerCase()];
    if (mapped) return byName(mapped);
  }
  return appearance.gtkTheme ? accentFromGtkTheme(appearance.gtkTheme) : undefined;
};
