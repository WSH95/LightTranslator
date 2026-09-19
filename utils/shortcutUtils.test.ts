/**
 * Run with: node --test utils/shortcutUtils.test.ts
 * (Node >= 23 strips the types; no build step, no test framework.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { toGnomeAccelerator } from './shortcutUtils.ts';

test('converts the default shortcut', () => {
  assert.equal(toGnomeAccelerator('CommandOrControl+Shift+X'), '<Shift><Control>x');
});

test('keeps the modifier order GNOME writes', () => {
  assert.equal(toGnomeAccelerator('CommandOrControl+Alt+Shift+Q'), '<Shift><Control><Alt>q');
  assert.equal(toGnomeAccelerator('Alt+Shift+A'), '<Shift><Alt>a');
});

test('accepts the aliases the recorder and Tauri use', () => {
  assert.equal(toGnomeAccelerator('CmdOrCtrl+Shift+X'), '<Shift><Control>x');
  assert.equal(toGnomeAccelerator('Ctrl+Shift+X'), '<Shift><Control>x');
  assert.equal(toGnomeAccelerator('Control+Shift+X'), '<Shift><Control>x');
  assert.equal(toGnomeAccelerator('Super+Space'), '<Super>space');
  assert.equal(toGnomeAccelerator('Command+Shift+X'), '<Shift><Super>x');
});

test('maps named keys to X keysym names', () => {
  assert.equal(toGnomeAccelerator('CommandOrControl+Space'), '<Control>space');
  assert.equal(toGnomeAccelerator('CommandOrControl+Enter'), '<Control>Return');
  assert.equal(toGnomeAccelerator('CommandOrControl+Up'), '<Control>Up');
  assert.equal(toGnomeAccelerator('CommandOrControl+PageDown'), '<Control>Page_Down');
  assert.equal(toGnomeAccelerator('CommandOrControl+BackSpace'), '<Control>BackSpace');
  assert.equal(toGnomeAccelerator('Alt+Escape'), '<Alt>Escape');
});

test('maps digits, function keys and punctuation', () => {
  assert.equal(toGnomeAccelerator('CommandOrControl+1'), '<Control>1');
  assert.equal(toGnomeAccelerator('CommandOrControl+Alt+F5'), '<Control><Alt>F5');
  assert.equal(toGnomeAccelerator('CommandOrControl+,'), '<Control>comma');
  assert.equal(toGnomeAccelerator('CommandOrControl+/'), '<Control>slash');
  assert.equal(toGnomeAccelerator('CommandOrControl+-'), '<Control>minus');
});

test('is case-insensitive about how the recorder spells the key', () => {
  assert.equal(toGnomeAccelerator('CommandOrControl+Shift+x'), '<Shift><Control>x');
  assert.equal(toGnomeAccelerator('CommandOrControl+ENTER'), '<Control>Return');
  assert.equal(toGnomeAccelerator('CommandOrControl+PAGEUP'), '<Control>Page_Up');
  assert.equal(toGnomeAccelerator('CommandOrControl+f5'), '<Control>F5');
});

test('allows a bare function key but not a bare character', () => {
  assert.equal(toGnomeAccelerator('F9'), 'F9');
  assert.equal(toGnomeAccelerator('X'), null);
});

test('rejects what GNOME cannot express', () => {
  assert.equal(toGnomeAccelerator(''), null);
  assert.equal(toGnomeAccelerator('CommandOrControl+Shift'), null); // modifiers only
  assert.equal(toGnomeAccelerator('CommandOrControl+!'), null); // shifted symbol
  assert.equal(toGnomeAccelerator('CommandOrControl+MediaPlayPause'), null);
  assert.equal(toGnomeAccelerator('CommandOrControl+F25'), null);
});
