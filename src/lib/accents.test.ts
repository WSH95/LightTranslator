import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { accentFor, accentFromGtkTheme, accentFromSystem } from './accents.ts';

test('every Yaru theme variant on disk maps to an accent', () => {
  // The nine variants in /usr/share/themes, plus plain Yaru.
  const variants = [
    'Yaru', 'Yaru-bark', 'Yaru-sage', 'Yaru-olive', 'Yaru-viridian',
    'Yaru-prussiangreen', 'Yaru-blue', 'Yaru-purple', 'Yaru-magenta', 'Yaru-red',
  ];
  const names = variants.map((theme) => accentFromGtkTheme(theme)?.name);
  assert.deepEqual(names, [
    'Orange', 'Bark', 'Sage', 'Olive', 'Viridian',
    'Prussian Green', 'Blue', 'Purple', 'Magenta', 'Red',
  ]);
  // All ten distinct, i.e. the mapping is onto.
  assert.equal(new Set(names).size, 10);
});

test('the -dark twin resolves to the same accent', () => {
  for (const theme of ['Yaru-dark', 'Yaru-viridian-dark', 'Yaru-prussiangreen-dark']) {
    const light = accentFromGtkTheme(theme.replace(/-dark$/, ''));
    assert.equal(accentFromGtkTheme(theme)?.name, light?.name);
  }
});

test('a non-Yaru theme yields no accent', () => {
  for (const theme of ['Adwaita', 'Adwaita-dark', 'Breeze', 'Yaruba', '']) {
    assert.equal(accentFromGtkTheme(theme), undefined);
  }
});

test('GNOME 47 accent-color wins over the GTK theme', () => {
  assert.equal(
    accentFromSystem({ accentColor: 'teal', gtkTheme: 'Yaru-red' })?.name,
    'Prussian Green',
  );
  // ...and an unknown name falls through to the theme rather than winning.
  assert.equal(
    accentFromSystem({ accentColor: 'chartreuse', gtkTheme: 'Yaru-red' })?.name,
    'Red',
  );
});

test('all nine GNOME 47 names resolve', () => {
  const names = ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'slate'];
  for (const name of names) {
    assert.ok(accentFromSystem({ accentColor: name, gtkTheme: null }), `${name} unmapped`);
  }
});

test('nothing readable yields no accent', () => {
  assert.equal(accentFromSystem({ accentColor: null, gtkTheme: null }), undefined);
});

test('an unknown stored hex falls back to Viridian', () => {
  assert.equal(accentFor('#003366').name, 'Viridian');
  assert.equal(accentFor('#03875b').name, 'Viridian'); // case-insensitive
  assert.equal(accentFor('#E95420').name, 'Orange');
});
