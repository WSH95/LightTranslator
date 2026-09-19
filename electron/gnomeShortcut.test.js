/**
 * Run with: node --test electron/gnomeShortcut.test.js
 * Only the pure helpers — the gsettings calls are covered by the manual
 * checklist in .project-steward/VERIFY.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  entryPath,
  gvariantString,
  listWith,
  listWithout,
  parseGVariantStringArray,
  sessionKind,
  shellQuote,
} from './gnomeShortcut.js';

test('quotes paths for the shell', () => {
  assert.equal(shellQuote('/usr/bin/lighttranslator'), "'/usr/bin/lighttranslator'");
  assert.equal(shellQuote('/opt/My App/lt'), "'/opt/My App/lt'");
  assert.equal(shellQuote("/tmp/it's"), "'/tmp/it'\\''s'");
});

test('serializes GVariant strings', () => {
  assert.equal(gvariantString('<Shift><Control>x'), "'<Shift><Control>x'");
  assert.equal(gvariantString("it's"), "'it\\'s'");
  assert.equal(gvariantString('back\\slash'), "'back\\\\slash'");
});

test('parses what gsettings prints', () => {
  assert.deepEqual(parseGVariantStringArray('@as []'), []);
  assert.deepEqual(parseGVariantStringArray("['/org/a/', '/org/b/']"), ['/org/a/', '/org/b/']);
  assert.deepEqual(parseGVariantStringArray("'<Shift><Control>x'"), ['<Shift><Control>x']);
  assert.deepEqual(parseGVariantStringArray("['it\\'s']"), ["it's"]);
  assert.deepEqual(parseGVariantStringArray(''), []);
});

test('adds our path once, keeping the others', () => {
  const existing = ['/org/gnome/custom0/'];
  const next = listWith(existing, entryPath());
  assert.deepEqual(next, ['/org/gnome/custom0/', entryPath()]);
  assert.equal(listWith(next, entryPath()), null);
});

test('removes only our path', () => {
  const existing = ['/org/gnome/custom0/', entryPath(), '/org/gnome/custom1/'];
  assert.deepEqual(listWithout(existing, entryPath()), ['/org/gnome/custom0/', '/org/gnome/custom1/']);
  assert.equal(listWithout(['/org/gnome/custom0/'], entryPath()), null);
});

test('keeps the dev entry separate from the installed one', () => {
  assert.notEqual(entryPath(true), entryPath(false));
  assert.match(entryPath(true), /lighttranslator-dev\/$/u);
  assert.match(entryPath(false), /custom-keybindings\/lighttranslator\/$/u);
});

test('reads the session from the environment', () => {
  const session = process.env.XDG_SESSION_TYPE;
  const wayland = process.env.WAYLAND_DISPLAY;
  try {
    process.env.XDG_SESSION_TYPE = 'wayland';
    assert.equal(sessionKind(), 'wayland');
    process.env.XDG_SESSION_TYPE = 'x11';
    assert.equal(sessionKind(), 'x11');
    delete process.env.XDG_SESSION_TYPE;
    process.env.WAYLAND_DISPLAY = 'wayland-0';
    assert.equal(sessionKind(), 'wayland', 'WAYLAND_DISPLAY alone still means Wayland');
    delete process.env.WAYLAND_DISPLAY;
    assert.equal(sessionKind(), 'x11');
  } finally {
    if (session === undefined) delete process.env.XDG_SESSION_TYPE;
    else process.env.XDG_SESSION_TYPE = session;
    if (wayland === undefined) delete process.env.WAYLAND_DISPLAY;
    else process.env.WAYLAND_DISPLAY = wayland;
  }
});
