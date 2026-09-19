/**
 * Accelerator conversion, shared by both backends.
 *
 * The app records shortcuts in Electron/Tauri spelling
 * (`CommandOrControl+Shift+X`). Under Wayland the shortcut is not grabbed by
 * the app at all — it is registered as a GNOME custom keybinding, and GNOME
 * wants GTK spelling (`<Control><Shift>x`, X keysym names for named keys).
 *
 * Living here rather than in each backend keeps one source of truth: the Rust
 * and Electron backends only ever write down the string this produces.
 */

/** Modifier spellings the recorder or a hand-edited setting may contain. */
const MODIFIERS: Record<string, string> = {
  commandorcontrol: '<Control>',
  cmdorctrl: '<Control>',
  control: '<Control>',
  ctrl: '<Control>',
  alt: '<Alt>',
  option: '<Alt>',
  altgr: '<Alt>',
  shift: '<Shift>',
  super: '<Super>',
  meta: '<Super>',
  cmd: '<Super>',
  command: '<Super>',
};

/**
 * GTK's own order (gtk_accelerator_name: Shift, Control, Alt, Super), which is
 * how GNOME writes its own keybindings — e.g. '<Shift><Control><Alt>Left'.
 * Parsing is order-independent; matching it just keeps the entry looking like
 * one GNOME wrote.
 */
const MODIFIER_ORDER = ['<Shift>', '<Control>', '<Alt>', '<Super>'];

/** Named keys → X keysym names. */
const NAMED_KEYS: Record<string, string> = {
  space: 'space',
  enter: 'Return',
  return: 'Return',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  backspace: 'BackSpace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'Page_Up',
  pagedown: 'Page_Down',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
};

/** Punctuation the recorder can capture → X keysym names. */
const PUNCTUATION: Record<string, string> = {
  ',': 'comma',
  '.': 'period',
  '/': 'slash',
  ';': 'semicolon',
  "'": 'apostrophe',
  '[': 'bracketleft',
  ']': 'bracketright',
  '\\': 'backslash',
  '-': 'minus',
  '=': 'equal',
  '`': 'grave',
};

function keyToKeysym(key: string): string | null {
  const lower = key.toLowerCase();

  if (NAMED_KEYS[lower]) return NAMED_KEYS[lower];
  if (PUNCTUATION[key]) return PUNCTUATION[key];
  if (/^[a-z]$/.test(lower)) return lower;
  if (/^[0-9]$/.test(key)) return key;

  const fkey = /^f([1-9]|1[0-9]|2[0-4])$/.exec(lower);
  if (fkey) return `F${fkey[1]}`;

  // Media keys, shifted symbols ("!"), dead keys: GNOME may well accept some
  // of them, but we cannot tell which, so refuse rather than write a binding
  // that silently never fires.
  return null;
}

/**
 * `CommandOrControl+Shift+X` → `<Control><Shift>x`.
 * Returns null when the shortcut cannot be expressed as a GNOME keybinding,
 * so the caller can keep the previous one and say so.
 */
export function toGnomeAccelerator(accelerator: string): string | null {
  if (!accelerator) return null;

  const parts = accelerator.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const modifiers = new Set<string>();
  let key: string | null = null;

  for (const part of parts) {
    const modifier = MODIFIERS[part.toLowerCase()];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    if (key !== null) return null; // two non-modifier keys
    key = keyToKeysym(part);
    if (key === null) return null;
  }

  if (key === null) return null;

  // A bare character would swallow normal typing system-wide; function keys
  // are the one case where no modifier is still a sane shortcut.
  if (modifiers.size === 0 && !/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return null;

  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return `${ordered.join('')}${key}`;
}

export default toGnomeAccelerator;
