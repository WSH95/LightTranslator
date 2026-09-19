/**
 * Quick-translate hotkey registration on GNOME (Electron backend).
 *
 * PARITY: mirrors src-tauri/src/gnome_shortcut.rs — same dconf entry, same
 * rules. Under Wayland an application cannot grab a key (Electron's
 * globalShortcut is X11-only and GNOME 46 has no GlobalShortcuts portal), so
 * the key is registered as a GNOME custom keybinding that runs the app with
 * `--quick-translate`; the running instance receives it through Electron's
 * single-instance lock. X11 sessions keep the app's own grab, and the entry is
 * removed there so gnome-shell does not take the key away from us.
 *
 * Everything here shells out to `gsettings` (libglib2.0-bin), which is what the
 * Rust side does through GIO.
 */

import { execFile } from 'child_process';

const MEDIA_KEYS_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
const CUSTOM_KEYBINDING_SCHEMA = `${MEDIA_KEYS_SCHEMA}.custom-keybinding`;
const CUSTOM_KEYBINDINGS_KEY = 'custom-keybindings';
const BASE_PATH = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';

/** GTK spelling of the app's default shortcut (CommandOrControl+Shift+X). */
export const DEFAULT_BINDING = '<Shift><Control>x';
/** Argument that tells a second instance to trigger a quick translate. */
export const TRIGGER_ARG = '--quick-translate';

/**
 * Our own dconf path — never `customN`, which GNOME Settings hands out by
 * index and would collide with the user's own entries. A dev run uses its own
 * path so it cannot repoint the installed app's shortcut.
 */
export function entryPath(dev = false) {
  return `${BASE_PATH}/${dev ? 'lighttranslator-dev' : 'lighttranslator'}/`;
}

export function entryName(dev = false) {
  return dev ? 'LightTranslator (dev) — Quick Translate' : 'LightTranslator — Quick Translate';
}

export function sessionKind() {
  const session = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
  if (session === 'wayland' || (!session && process.env.WAYLAND_DISPLAY)) return 'wayland';
  return 'x11';
}

/** GNOME, or a desktop built on gnome-settings-daemon (Ubuntu, Budgie…). */
export function isGnome() {
  return (process.env.XDG_CURRENT_DESKTOP || '')
    .split(':')
    .some((desktop) => desktop.toLowerCase() === 'gnome');
}

/** Single-quote for the shell parsing gnome-settings-daemon applies. */
export function shellQuote(value) {
  return `'${String(value).replace(/'/gu, "'\\''")}'`;
}

/** Serialize as a GVariant string, which is what `gsettings set` expects. */
export function gvariantString(value) {
  return `'${String(value).replace(/\\/gu, '\\\\').replace(/'/gu, "\\'")}'`;
}

/** Parse `@as []` or `['/a/', '/b/']` as printed by `gsettings get`. */
export function parseGVariantStringArray(text) {
  const items = [];
  const source = String(text ?? '');
  let quote = null;
  let current = '';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === '\\' && i + 1 < source.length) {
        current += source[i + 1];
        i += 1;
      } else if (char === quote) {
        items.push(current);
        current = '';
        quote = null;
      } else {
        current += char;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
    }
  }
  return items;
}

/** Returns the new list, or null when `path` is already there. */
export function listWith(list, path) {
  if (list.includes(path)) return null;
  return [...list, path];
}

/** Returns the new list, or null when `path` is not there. */
export function listWithout(list, path) {
  if (!list.includes(path)) return null;
  return list.filter((entry) => entry !== path);
}

function gsettings(args) {
  return new Promise((resolve) => {
    execFile('gsettings', args, { timeout: 5000 }, (error, stdout) => {
      resolve({ ok: !error, stdout: (stdout || '').trim(), error });
    });
  });
}

async function schemaReadable(schemaWithPath) {
  const result = await gsettings(['list-keys', schemaWithPath]);
  return result.ok;
}

export async function keybindingsAvailable(dev = false) {
  if (!isGnome()) return false;
  if (!(await schemaReadable(MEDIA_KEYS_SCHEMA))) return false;
  return schemaReadable(`${CUSTOM_KEYBINDING_SCHEMA}:${entryPath(dev)}`);
}

/**
 * How the hotkey reaches the app in this session:
 * 'x11-grab' (we grab it), 'gnome' (GNOME runs our command), or 'manual'
 * (Wayland desktop with no way to register — the user binds the command).
 */
export async function mechanism(dev = false) {
  if (sessionKind() === 'x11') return 'x11-grab';
  return (await keybindingsAvailable(dev)) ? 'gnome' : 'manual';
}

async function readPaths() {
  const result = await gsettings(['get', MEDIA_KEYS_SCHEMA, CUSTOM_KEYBINDINGS_KEY]);
  return result.ok ? parseGVariantStringArray(result.stdout) : [];
}

async function writePaths(paths) {
  const value = `[${paths.map((path) => gvariantString(path)).join(', ')}]`;
  const result = await gsettings(['set', MEDIA_KEYS_SCHEMA, CUSTOM_KEYBINDINGS_KEY, value]);
  if (!result.ok) throw new Error(`Failed to update GNOME custom shortcuts: ${result.error?.message}`);
}

async function setEntryKey(dev, key, value) {
  const target = `${CUSTOM_KEYBINDING_SCHEMA}:${entryPath(dev)}`;
  const result = await gsettings(['set', target, key, gvariantString(value)]);
  if (!result.ok) throw new Error(`Failed to set the GNOME shortcut ${key}: ${result.error?.message}`);
}

async function entryKey(dev, key) {
  const target = `${CUSTOM_KEYBINDING_SCHEMA}:${entryPath(dev)}`;
  const result = await gsettings(['get', target, key]);
  if (!result.ok) return '';
  return parseGVariantStringArray(result.stdout)[0] ?? '';
}

/**
 * Create or refresh our entry. `binding` in GTK spelling (`<Shift><Control>x`);
 * null keeps whatever is there, which is how startup refreshes the command
 * path without overwriting the user's accelerator.
 */
export async function ensureEntry({ dev = false, command, binding = null }) {
  await setEntryKey(dev, 'name', entryName(dev));
  await setEntryKey(dev, 'command', command);

  if (binding) {
    await setEntryKey(dev, 'binding', binding);
  } else if (!(await entryKey(dev, 'binding'))) {
    // A brand new entry still needs an accelerator to be of any use.
    await setEntryKey(dev, 'binding', DEFAULT_BINDING);
  }

  // Add our path only once the entry is complete, so gnome-settings-daemon
  // never sees a half-written shortcut.
  const next = listWith(await readPaths(), entryPath(dev));
  if (next) await writePaths(next);
}

/** Take our entry out again. Resolves true when something was removed. */
export async function removeEntry({ dev = false } = {}) {
  if (!(await keybindingsAvailable(dev))) return false;

  const next = listWithout(await readPaths(), entryPath(dev));
  if (!next) return false;
  await writePaths(next);

  const target = `${CUSTOM_KEYBINDING_SCHEMA}:${entryPath(dev)}`;
  for (const key of ['binding', 'command', 'name']) {
    await gsettings(['reset', target, key]);
  }
  return true;
}

/** The accelerator GNOME currently has for us, if any. */
export async function currentBinding({ dev = false } = {}) {
  if (!(await keybindingsAvailable(dev))) return null;
  const paths = await readPaths();
  if (!paths.includes(entryPath(dev))) return null;
  return (await entryKey(dev, 'binding')) || null;
}
