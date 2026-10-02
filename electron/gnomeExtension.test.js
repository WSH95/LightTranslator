import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';

// Real file upgrades in temporary directories; no calls to the user's GNOME session.
const uuid = 'lighttranslator@lighttranslator.app';
const source = fs.readFileSync(new URL('./gnomeExtension.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
function fixture(t, { system = 3, user, enabled = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lighttranslator-extension-upgrade-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const shippedDir = path.join(root, 'shipped'), home = path.join(root, 'home');
  const systemDir = path.join(root, 'system/gnome-shell/extensions', uuid);
  const userDir = path.join(home, '.local/share/gnome-shell/extensions', uuid);
  function write(dir, version, script) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ uuid, version }));
    fs.writeFileSync(path.join(dir, 'extension.js'), script);
  }
  write(shippedDir, 3, 'new above helper');
  if (system) write(systemDir, system, 'packaged helper');
  if (user !== undefined) write(userDir, user, 'existing user helper');
  const markerPath = path.join(root, 'enabled-once');
  fs.writeFileSync(markerPath, uuid);
  const settingWrites = [], errors = [];
  const api = vm.runInNewContext(`${source}\n({ensure})`, {
    fs, path, os: { homedir: () => home }, process: { env: { XDG_DATA_DIRS: path.join(root, 'system') } },
    isGnome: () => true, sessionKind: () => 'wayland',
    console: { error: message => errors.push(message) },
    execFile(command, args, _options, callback) {
      if (command === 'gnome-shell') return callback(null, 'GNOME Shell 46.0');
      if (command === 'gnome-extensions') return callback(null, enabled ? uuid : '');
      if (command === 'gsettings' && args[0] === 'get') return callback(null, enabled ? `['${uuid}']` : '[]');
      if (command === 'gsettings' && args[0] === 'set') { settingWrites.push(args); return callback(null, ''); }
      throw new Error(`Unexpected command ${command}`);
    },
  });
  return { ...api, shippedDir, markerPath, userDir, settingWrites, errors,
    script: () => fs.readFileSync(path.join(userDir, 'extension.js'), 'utf8'),
    version: () => JSON.parse(fs.readFileSync(path.join(userDir, 'metadata.json'), 'utf8')).version };
}

test('a current system package still refreshes the stale user copy that shadows it', async t => {
  const f = fixture(t, { system: 3, user: 2 });
  assert.equal(await f.ensure(f), 'active');
  assert.equal(f.version(), 3);
  assert.equal(f.script(), 'new above helper');
});
test('a missing current system helper installs the shipped copy for the user', async t => {
  const f = fixture(t, { system: 2 });
  await f.ensure(f);
  assert.equal(f.version(), 3);
  assert.equal(f.script(), 'new above helper');
});
test('a fresh current system install does not create an unnecessary user copy', async t => {
  const f = fixture(t);
  await f.ensure(f);
  assert.equal(fs.existsSync(f.userDir), false);
});
test('current and newer user copies are preserved', async t => {
  for (const user of [3, 4]) {
    const f = fixture(t, { system: 2, user });
    await f.ensure(f);
    assert.equal(f.version(), user);
    assert.equal(f.script(), 'existing user helper');
  }
});
test('refreshing an old helper does not re-enable the user-disabled extension', async t => {
  const f = fixture(t, { system: 3, user: 2, enabled: false });
  assert.equal(await f.ensure(f), 'disabled');
  assert.equal(f.version(), 3);
  assert.equal(f.script(), 'new above helper');
  assert.deepEqual(f.settingWrites, []);
});
test('a failed code copy leaves old metadata eligible for a later retry', async t => {
  const f = fixture(t, { system: 2, user: 2 });
  fs.unlinkSync(path.join(f.shippedDir, 'extension.js'));
  await f.ensure(f);
  assert.equal(f.version(), 2);
  assert.equal(f.script(), 'existing user helper');
  assert.equal(f.errors.length, 1);
});
