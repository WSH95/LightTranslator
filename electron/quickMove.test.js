import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { QuickMoveSession } from './quickMove.js';

test('Move suppresses every blur until toggled off, without closing on focus return', () => {
  const session = new QuickMoveSession();
  const opening = session.open();
  const enabled = session.setEnabled(opening.openingId, true);
  assert.equal(enabled.enabled, true);
  assert.equal(session.dismissOnBlur(), null);
  assert.equal(session.dismissOnBlur(), null);
  assert.equal(session.snapshot().enabled, true);
  session.setEnabled(opening.openingId, false);
  assert.equal(session.isCurrent(opening.openingId), true);
  assert.equal(session.dismissOnBlur().enabled, false);
  assert.equal(session.isCurrent(opening.openingId), false);
});

test('every opening resets Move, including an opening with no text', () => {
  const session = new QuickMoveSession();
  const first = session.open();
  session.setEnabled(first.openingId, true);
  const next = session.open();
  assert.equal(next.enabled, false);
  assert.notEqual(next.openingId, first.openingId);
  assert.deepEqual(session.setEnabled(first.openingId, true), next);
  assert.equal(session.isCurrent(first.openingId), false);
  assert.equal(session.isCurrent(next.openingId), true);
  assert.ok(session.dismissOnBlur());
});

test('explicit closure invalidates in-flight toggles and pending text', () => {
  const session = new QuickMoveSession();
  const opening = session.open();
  session.setEnabled(opening.openingId, true);
  const closed = session.close();
  assert.equal(closed.enabled, false);
  assert.equal(session.isCurrent(opening.openingId), false);
  assert.deepEqual(session.setEnabled(opening.openingId, true), closed);
  assert.deepEqual(session.setEnabled(closed.openingId, true), closed);
  assert.equal(session.dismissOnBlur(), null);
});

test('snapshots are immutable and revisions order toggles and lifecycle resets', () => {
  const session = new QuickMoveSession();
  const initial = session.snapshot();
  const opening = session.open();
  const enabled = session.setEnabled(opening.openingId, true);
  const disabled = session.setEnabled(opening.openingId, false);
  const closed = session.close();
  assert.equal(opening.enabled, false);
  assert.equal(enabled.enabled, true);
  assert.equal(disabled.enabled, false);
  const revisions = [initial, opening, enabled, disabled, closed].map(s => s.revision);
  assert.ok(revisions.every((value, index) => index === 0 || value > revisions[index - 1]));
  enabled.enabled = false;
  assert.deepEqual(session.snapshot(), closed);
});

// Execute the actual registered handler without starting Electron or touching user settings.
const mainSource = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const handlerStart = mainSource.indexOf("ipcMain.handle('set-quick-move-mode'");
const handlerSource = mainSource.slice(handlerStart, mainSource.indexOf('\n});', handlerStart) + 5);
function nativeHandler({ failAbove = false } = {}) {
  const quickMove = new QuickMoveSession(), effects = [], published = [];
  const quickWindow = {
    webContents: {},
    setAlwaysOnTop(flag, level) {
      effects.push({ method: 'above', flag, level, enabled: quickMove.snapshot().enabled });
      if (failAbove) throw new Error('topmost rejected');
    },
    setMovable(enabled) { effects.push({ method: 'movable', enabled }); },
  };
  let handle;
  vm.runInNewContext(handlerSource, {
    ipcMain: { handle(_name, fn) { handle = fn; } }, quickMove, quickWindow,
    publishQuickMoveState(state) { published.push(state); return state; },
  });
  return { quickMove, effects, published, invoke: args => handle({ sender: quickWindow.webContents }, args) };
}

test('Move enable reasserts native above before confirming its state', () => {
  const native = nativeHandler();
  const opening = native.quickMove.open();
  const state = native.invoke({ openingId: opening.openingId, enabled: true });
  assert.deepEqual(native.effects, [
    { method: 'above', flag: true, level: 'floating', enabled: false },
    { method: 'movable', enabled: true },
  ]);
  assert.equal(state.enabled, true);
  assert.equal(native.published.length, 1);
});
test('a native above failure keeps Move state and revision unchanged', () => {
  const native = nativeHandler({ failAbove: true });
  const opening = native.quickMove.open();
  assert.throws(() => native.invoke({ openingId: opening.openingId, enabled: true }), /topmost rejected/);
  assert.deepEqual(native.quickMove.snapshot(), opening);
  assert.equal(native.published.length, 0);
  assert.equal(native.effects.length, 1);
});
test('a stale Move request cannot change native state for the newer opening', () => {
  const native = nativeHandler();
  const first = native.quickMove.open();
  const next = native.quickMove.open();
  assert.deepEqual(native.invoke({ openingId: first.openingId, enabled: true }), next);
  assert.deepEqual(native.effects, []);
});
test('disabling Move preserves the native above intent and restores blur dismissal', () => {
  const native = nativeHandler();
  const opening = native.quickMove.open();
  native.invoke({ openingId: opening.openingId, enabled: true });
  native.effects.length = 0;
  const state = native.invoke({ openingId: opening.openingId, enabled: false });
  assert.equal(state.enabled, false);
  assert.deepEqual(native.effects, [{ method: 'movable', enabled: false }]);
  assert.ok(native.quickMove.dismissOnBlur());
});
