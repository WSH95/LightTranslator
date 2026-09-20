import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS } from '../constants.ts';
import type { AppSettings } from '../types.ts';
import {
  createSettingsPersistenceHooks,
  mergePersistedSettings,
  persistedSettingsFromState,
  sanitizeQuickWindowMaxWidth,
} from './settingsPersistence.ts';

test('a valid new maximum wins and is normalized to a whole pixel', () => {
  const merged = mergePersistedSettings(
    { quickWindowMaxWidth: 512.6, quickWindowWidth: 420 },
    { ...DEFAULT_SETTINGS },
  );
  assert.equal(merged.quickWindowMaxWidth, 513);
  assert.equal('quickWindowWidth' in merged, false);
});

test('an invalid new maximum falls back to a valid legacy width', () => {
  for (const invalid of [299, 601, Number.NaN, Number.POSITIVE_INFINITY, '480', null]) {
    const merged = mergePersistedSettings(
      { quickWindowMaxWidth: invalid, quickWindowWidth: 455.4 },
      { ...DEFAULT_SETTINGS },
    );
    assert.equal(merged.quickWindowMaxWidth, 455, String(invalid));
    assert.equal('quickWindowWidth' in merged, false);
  }
});

test('invalid or missing stored widths use the 480px default', () => {
  for (const persisted of [
    {},
    { quickWindowWidth: null },
    { quickWindowWidth: 250 },
    { quickWindowMaxWidth: 900, quickWindowWidth: '420' },
  ]) {
    const merged = mergePersistedSettings(persisted, { ...DEFAULT_SETTINGS });
    assert.equal(merged.quickWindowMaxWidth, 480);
  }
});

test('sanitization accepts only finite in-range numbers and rounds them', () => {
  assert.equal(sanitizeQuickWindowMaxWidth(300), 300);
  assert.equal(sanitizeQuickWindowMaxWidth(600), 600);
  assert.equal(sanitizeQuickWindowMaxWidth(480.5), 481);
  assert.equal(sanitizeQuickWindowMaxWidth(299), 480);
  assert.equal(sanitizeQuickWindowMaxWidth(601), 480);
  assert.equal(sanitizeQuickWindowMaxWidth('480'), 480);
});

test('provider migration still runs while width migration handles unversioned blobs', () => {
  const merged = mergePersistedSettings(
    {
      provider: 'gemini',
      quickWindowWidth: 430,
      geminiApiKey: 'retired',
      customSystemInstruction: 'Keep this',
    },
    { ...DEFAULT_SETTINGS },
  );
  assert.equal(merged.provider, 'google');
  assert.equal(merged.quickWindowMaxWidth, 430);
  assert.equal(merged.customSystemInstruction, 'Keep this');
  assert.equal('geminiApiKey' in merged, false);
});

test('persisted snapshots contain the new setting and never the retired field', () => {
  const snapshot = persistedSettingsFromState({
    ...DEFAULT_SETTINGS,
    quickWindowMaxWidth: 525,
    quickWindowWidth: 410,
  } as typeof DEFAULT_SETTINGS & { quickWindowWidth: number });

  assert.equal(snapshot.quickWindowMaxWidth, 525);
  assert.equal('quickWindowWidth' in snapshot, false);
});

test('actual Zustand hydration rewrites a legacy blob once and restart stays canonical', async () => {
  const storageKey = 'light-translator-storage';
  const values = new Map<string, string>();
  let writes = 0;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes += 1;
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } satisfies Storage;
  const legacy = JSON.stringify({
    state: {
      provider: 'openai',
      openaiBaseUrl: 'https://example.test/v1',
      customSystemInstruction: 'Preserve this setting',
      quickWindowWidth: 455,
    },
  });
  values.set(storageKey, legacy);

  interface TestState extends AppSettings {
    persistCanonicalSettings: () => void;
  }
  let canonicalizationCalls = 0;
  const createPersistedStore = () => {
    const hooks = createSettingsPersistenceHooks<TestState>();
    return createStore<TestState>()(persist(
      (set) => ({
        ...DEFAULT_SETTINGS,
        persistCanonicalSettings: () => {
          canonicalizationCalls += 1;
          set((state) => state, true);
        },
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => storage),
        version: 1,
        merge: hooks.merge,
        onRehydrateStorage: hooks.onRehydrateStorage,
        partialize: (state) => persistedSettingsFromState(state),
      },
    ));
  };

  const firstStore = createPersistedStore();

  assert.equal(firstStore.getState().quickWindowMaxWidth, 455);
  assert.equal(firstStore.getState().provider, 'openai');
  assert.equal(firstStore.getState().openaiBaseUrl, 'https://example.test/v1');
  assert.equal(firstStore.getState().customSystemInstruction, 'Preserve this setting');
  assert.equal(writes, 1, 'successful legacy hydration writes one canonical snapshot');
  assert.equal(canonicalizationCalls, 1);

  const canonical = JSON.parse(values.get(storageKey) ?? 'null');
  assert.equal(canonical.version, 1);
  assert.equal(canonical.state.quickWindowMaxWidth, 455);
  assert.equal('quickWindowWidth' in canonical.state, false);
  assert.equal(canonical.state.provider, 'openai');
  assert.equal(canonical.state.openaiBaseUrl, 'https://example.test/v1');
  assert.equal(canonical.state.customSystemInstruction, 'Preserve this setting');

  // Rehydrate the legacy form while subscribed: hydration itself notifies
  // once, but the same-state canonical write must not cause a second state
  // notification (and production keeps it outside broadcastSettingsChanged).
  values.set(storageKey, legacy);
  writes = 0;
  canonicalizationCalls = 0;
  let notifications = 0;
  const unsubscribe = firstStore.subscribe(() => { notifications += 1; });
  await firstStore.persist.rehydrate();
  unsubscribe();
  assert.equal(writes, 1);
  assert.equal(canonicalizationCalls, 1);
  assert.equal(notifications, 1);

  // A new store instance is a real restart over the canonical storage blob.
  // It must preserve the migrated value without another cleanup write.
  writes = 0;
  canonicalizationCalls = 0;
  const secondStore = createPersistedStore();
  assert.equal(secondStore.getState().quickWindowMaxWidth, 455);
  assert.equal(secondStore.getState().customSystemInstruction, 'Preserve this setting');
  assert.equal(writes, 0, 'canonical restart performs no redundant write');
  assert.equal(canonicalizationCalls, 0);
});
