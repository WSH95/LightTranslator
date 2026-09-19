/**
 * Installs and enables the GNOME Shell extension that places the
 * quick-translate popup at the pointer (see gnome-extension/).
 *
 * PARITY: mirrors src-tauri/src/gnome_extension.rs. The package installs the
 * extension system-wide; this mostly enables it for the current user, once. If
 * the packaged copy is missing or stale (AppImage, dev run, upgrade) a copy is
 * written into the user's own extension directory instead.
 *
 * Auto-enabling happens exactly once, recorded by a marker file: if the user
 * switches the extension off afterwards, it stays off.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { isGnome, sessionKind } from './gnomeShortcut.js';

export const UUID = 'lighttranslator@lighttranslator.app';
const SHELL_SCHEMA = 'org.gnome.shell';
const ENABLED_KEY = 'enabled-extensions';
/** The extension uses the GNOME 45+ ESM extension API. */
const MIN_SHELL_MAJOR = 45;
const FILES = ['metadata.json', 'extension.js'];

function run(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 5000 }, (error, stdout) => {
      resolve({ ok: !error, stdout: (stdout || '').trim() });
    });
  });
}

async function shellMajor() {
  const result = await run('gnome-shell', ['--version']);
  if (!result.ok) return 0;
  const match = /(\d+)/u.exec(result.stdout.replace(/^\D+/u, ''));
  return match ? Number(match[1]) : 0;
}

async function applicable() {
  if (sessionKind() !== 'wayland' || !isGnome()) return false;
  return (await shellMajor()) >= MIN_SHELL_MAJOR;
}

function userDir() {
  return path.join(os.homedir(), '.local/share/gnome-shell/extensions', UUID);
}

/** Every directory the shell also looks in, so a packaged copy counts. */
function systemDirs() {
  const dirs = process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share';
  return dirs
    .split(':')
    .filter(Boolean)
    .map((dir) => path.join(dir, 'gnome-shell/extensions', UUID));
}

/** `version` out of an installed metadata.json (0 when unreadable). */
function installedVersion(dir) {
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
    return Number(metadata.version) || 0;
  } catch {
    return 0;
  }
}

function copyInto(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of FILES) {
    fs.copyFileSync(path.join(source, file), path.join(target, file));
  }
}

async function enabledInSettings() {
  const result = await run('gsettings', ['get', SHELL_SCHEMA, ENABLED_KEY]);
  return result.ok && result.stdout.includes(`'${UUID}'`);
}

async function enableInSettings() {
  const current = await run('gsettings', ['get', SHELL_SCHEMA, ENABLED_KEY]);
  if (!current.ok) return false;
  const uuids = current.stdout
    .split(/[[\],]/u)
    .map((part) => part.trim().replace(/^'|'$/gu, ''))
    .filter(Boolean)
    .filter((uuid) => uuid !== '@as');
  if (!uuids.includes(UUID)) uuids.push(UUID);
  const value = `[${uuids.map((uuid) => `'${uuid}'`).join(', ')}]`;
  const result = await run('gsettings', ['set', SHELL_SCHEMA, ENABLED_KEY, value]);
  return result.ok;
}

/**
 * The running shell only knows about extensions it found at startup, which is
 * what separates "working now" from "after the next login".
 */
async function shellKnowsExtension() {
  const result = await run('gnome-extensions', ['list', '--enabled']);
  return result.ok && result.stdout.split('\n').some((line) => line.trim() === UUID);
}

function anyInstalled() {
  return [...systemDirs(), userDir()].some((dir) => installedVersion(dir) > 0);
}

/** Install (if needed) and enable once. Safe to call on every start. */
export async function ensure({ shippedDir, markerPath }) {
  if (!(await applicable())) return 'not-applicable';

  const shippedVersion = shippedDir ? installedVersion(shippedDir) : 0;
  const systemVersion = Math.max(0, ...systemDirs().map(installedVersion));
  const target = userDir();

  // A packaged copy is enough; only write into the user's directory when there
  // is nothing current to load.
  if (systemVersion < shippedVersion && installedVersion(target) < shippedVersion) {
    try {
      copyInto(shippedDir, target);
    } catch (error) {
      console.error(`Failed to install the GNOME placement extension: ${error.message}`);
    }
  }

  if (!anyInstalled()) return 'missing';

  if (!(await enabledInSettings())) {
    if (markerPath && fs.existsSync(markerPath)) {
      // Enabled once before and switched off since: leave it alone.
      return 'disabled';
    }
    if (!(await enableInSettings())) return 'disabled';
    try {
      if (markerPath) {
        fs.mkdirSync(path.dirname(markerPath), { recursive: true });
        fs.writeFileSync(markerPath, `${UUID}\n`);
      }
    } catch {
      /* the marker is a nicety; a failed write only means we may re-enable */
    }
  }

  return (await shellKnowsExtension()) ? 'active' : 'pending-restart';
}

/** Read-only view for the settings UI. */
export async function status() {
  if (!(await applicable())) return 'not-applicable';
  if (!(await enabledInSettings())) return anyInstalled() ? 'disabled' : 'missing';
  return (await shellKnowsExtension()) ? 'active' : 'pending-restart';
}
