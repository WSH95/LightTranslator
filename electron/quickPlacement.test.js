import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the shipped extension; only the compositor boundary is simulated.
const source = fs.readFileSync(new URL('../gnome-extension/lighttranslator@lighttranslator.app/extension.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export default class', 'class');
const areas = [{ x: 0, y: 32, width: 1920, height: 1048 }, { x: 1920, y: 32, width: 1280, height: 992 }];
function shell(actors = [], wayland = true) {
  const signals = new Map();
  const Placement = vm.runInNewContext(`${source}\nQuickTranslatePlacement`, {
    Extension: class {}, Meta: { is_wayland_compositor: () => wayland },
    global: {
      display: { get_current_monitor: () => 0 }, get_pointer: () => [100, 200], get_current_time: () => 0,
      get_window_actors: () => actors,
      window_manager: {
        connect(name, callback) { signals.set(1, { name, callback }); return 1; },
        disconnect(id) { signals.delete(id); },
      },
    },
  });
  return { extension: new Placement(), signals };
}
function fixture(frame, title = 'Quick Translate', wmClass = 'lighttranslator') {
  const moves = [], signals = new Map();
  let nextId = 0;
  return {
    moves, signals, above: false, activations: 0, aboveCalls: 0,
    get_title: () => title, get_wm_class: () => wmClass,
    get_monitor: () => 1, get_work_area_for_monitor: index => areas[index],
    get_frame_rect: () => frame, move_frame: (_user, x, y) => moves.push({ x, y }),
    activate() { this.activations++; },
    make_above() { this.above = true; this.aboveCalls++; },
    connect(name, callback) { const id = ++nextId; signals.set(id, { name, callback }); return id; },
    disconnect(id) { signals.delete(id); },
  };
}
const frame = { x: 2200, y: 150, width: 480, height: 300 };

test('resizing a moved popup keeps it on its own monitor even if the pointer moved away', () => {
  const window = fixture(frame);
  shell().extension._keepOnScreen(window);
  assert.deepEqual(window.moves, []);
});
test('growth clamps within the popup monitor', () => {
  const window = fixture({ x: 3020, y: 800, width: 480, height: 500 });
  shell().extension._keepOnScreen(window);
  assert.deepEqual(window.moves, [{ x: 2720, y: 524 }]);
});
test('a new mapping still uses the pointer monitor', () => {
  const window = fixture(frame);
  shell().extension._moveToPointer(window);
  assert.deepEqual(window.moves, [{ x: 100, y: 200 }]);
});
test('mapping a recognized popup requests the above layer before pointer placement', () => {
  const window = fixture(frame);
  const { extension } = shell();
  extension.enable();
  const move = window.move_frame;
  window.move_frame = (...args) => { assert.equal(window.above, true); move(...args); };
  extension._onMap({ meta_window: window });
  assert.equal(window.above, true);
  assert.equal(window.aboveCalls, 1);
  assert.equal(window.activations, 1);
  assert.deepEqual(window.moves, [{ x: 100, y: 200 }]);
  extension.disable();
});
test('enabling the helper pins an existing popup without moving or taking focus', () => {
  const window = fixture(frame);
  const { extension } = shell([{ meta_window: window }]);
  extension.enable();
  assert.equal(window.above, true);
  assert.deepEqual(window.moves, []);
  assert.equal(window.activations, 0);
  assert.equal([...window.signals.values()].filter(s => s.name === 'size-changed').length, 1);
  extension.disable();
});
test('unrelated windows are untouched at startup and on mapping', () => {
  const windows = [fixture(frame, 'Main', 'lighttranslator'), fixture(frame, 'Quick Translate', 'other-app')];
  const { extension } = shell(windows.map(meta_window => ({ meta_window })));
  extension.enable();
  for (const window of windows) {
    extension._onMap({ meta_window: window });
    assert.equal(window.above, false);
    assert.equal(window.activations, 0);
    assert.deepEqual(window.moves, []);
    assert.equal(window.signals.size, 0);
  }
  extension._onMap(null);
  extension.disable();
});
test('repeated maps attach once and disabling disconnects every owned window handler', () => {
  const window = fixture(frame);
  const { extension, signals } = shell();
  extension.enable();
  extension._onMap({ meta_window: window });
  extension._onMap({ meta_window: window });
  assert.equal(window.signals.size, 2);
  extension.disable();
  assert.equal(window.signals.size, 0);
  assert.equal(signals.size, 0);
});
test('unmanaged popups release their tracked handlers', () => {
  const window = fixture(frame);
  const { extension } = shell();
  extension.enable();
  extension._onMap({ meta_window: window });
  [...window.signals.values()].find(s => s.name === 'unmanaging').callback();
  assert.equal(window.signals.size, 0);
  extension.disable();
});
test('the Wayland helper does not alter X11 windows', () => {
  const window = fixture(frame);
  const { extension, signals } = shell([{ meta_window: window }], false);
  extension.enable();
  assert.equal(window.above, false);
  assert.equal(window.signals.size, 0);
  assert.equal(signals.size, 0);
  extension.disable();
});
