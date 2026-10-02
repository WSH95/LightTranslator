import test from 'node:test';
import assert from 'node:assert/strict';
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
