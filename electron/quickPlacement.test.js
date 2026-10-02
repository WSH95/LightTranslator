import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped extension logic without requiring a running GNOME Shell.
const source = fs.readFileSync(new URL('../gnome-extension/lighttranslator@lighttranslator.app/extension.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export default class', 'class');
const Placement = vm.runInNewContext(`${source}\nQuickTranslatePlacement`, {
  Extension: class {}, Meta: {},
  global: { display: { get_current_monitor: () => 0 }, get_pointer: () => [100, 200], get_current_time: () => 0 },
});
const areas = [{ x: 0, y: 32, width: 1920, height: 1048 }, { x: 1920, y: 32, width: 1280, height: 992 }];
function fixture(frame) {
  const moves = [];
  return {
    moves, get_monitor: () => 1, get_work_area_for_monitor: index => areas[index],
    get_frame_rect: () => frame, move_frame: (_user, x, y) => moves.push({ x, y }), activate() {},
  };
}

test('resizing a moved popup keeps it on its own monitor even if the pointer moved away', () => {
  const window = fixture({ x: 2200, y: 150, width: 480, height: 300 });
  new Placement()._keepOnScreen(window);
  assert.deepEqual(window.moves, []);
});
test('growth clamps within the popup monitor', () => {
  const window = fixture({ x: 3020, y: 800, width: 480, height: 500 });
  new Placement()._keepOnScreen(window);
  assert.deepEqual(window.moves, [{ x: 2720, y: 524 }]);
});
test('a new mapping still uses the pointer monitor', () => {
  const window = fixture({ x: 2200, y: 150, width: 480, height: 300 });
  new Placement()._moveToPointer(window);
  assert.deepEqual(window.moves, [{ x: 100, y: 200 }]);
});
