import type { AppSettings } from '../types.ts';
import {
  DEFAULT_SETTINGS,
  PROVIDER_IDS,
  QUICK_WINDOW_MAX_WIDTH_DEFAULT,
  QUICK_WINDOW_MAX_WIDTH_MAX,
  QUICK_WINDOW_MAX_WIDTH_MIN,
} from '../constants.ts';

function normalizedStoredWidth(value: unknown): number | null {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < QUICK_WINDOW_MAX_WIDTH_MIN
    || value > QUICK_WINDOW_MAX_WIDTH_MAX
  ) {
    return null;
  }
  return Math.round(value);
}

export function sanitizeQuickWindowMaxWidth(value: unknown): number {
  return normalizedStoredWidth(value) ?? QUICK_WINDOW_MAX_WIDTH_DEFAULT;
}

export function mergePersistedSettings<T extends AppSettings>(
  persisted: unknown,
  current: T,
): T {
  if (!persisted || typeof persisted !== 'object') return current;

  const {
    geminiApiKey: _geminiApiKey,
    openrouterApiKey: _openrouterApiKey,
    openrouterModel: _openrouterModel,
    modelId: _modelId,
    quickWindowMaxWidth,
    quickWindowWidth,
    ...rest
  } = persisted as Record<string, unknown>;

  if (!PROVIDER_IDS.includes(rest.provider as never)) {
    rest.provider = DEFAULT_SETTINGS.provider;
  }

  const migratedMaximum =
    normalizedStoredWidth(quickWindowMaxWidth)
    ?? normalizedStoredWidth(quickWindowWidth)
    ?? QUICK_WINDOW_MAX_WIDTH_DEFAULT;

  return {
    ...current,
    ...rest,
    quickWindowMaxWidth: migratedMaximum,
  } as T;
}

export function persistedSettingsFromState(state: AppSettings): Partial<AppSettings> {
  return {
    autoTranslate: state.autoTranslate,
    debounceMs: state.debounceMs,
    sourceLang: state.sourceLang,
    targetLang: state.targetLang,
    provider: state.provider,
    useOcrPreProcessing: state.useOcrPreProcessing,
    openaiBaseUrl: state.openaiBaseUrl,
    openaiApiKey: state.openaiApiKey,
    openaiModel: state.openaiModel,
    customSystemInstruction: state.customSystemInstruction,
    systemPromptEnabled: state.systemPromptEnabled,
    deeplApiKey: state.deeplApiKey,
    microsoftSubscriptionKey: state.microsoftSubscriptionKey,
    microsoftRegion: state.microsoftRegion,
    proxyEnabled: state.proxyEnabled,
    proxyProtocol: state.proxyProtocol,
    proxyHost: state.proxyHost,
    proxyPort: state.proxyPort,
    proxyUsername: state.proxyUsername,
    proxyPassword: state.proxyPassword,
    selectionShortcut: state.selectionShortcut,
    launchAtStartup: state.launchAtStartup,
    quickWindowOpacity: state.quickWindowOpacity,
    quickWindowBorderOpacity: state.quickWindowBorderOpacity,
    quickWindowMaxWidth: sanitizeQuickWindowMaxWidth(state.quickWindowMaxWidth),
    quickSourceLang: state.quickSourceLang,
    quickTargetLang: state.quickTargetLang,
    appearanceTheme: state.appearanceTheme,
    accentColor: state.accentColor,
    followSystemAccent: state.followSystemAccent,
    translationTextSize: state.translationTextSize,
    surfaceStyle: state.surfaceStyle,
    glassOpacity: state.glassOpacity,
  };
}

function persistedSettingsNeedCanonicalization(
  persisted: unknown,
  hydrated: AppSettings,
): boolean {
  if (!persisted || typeof persisted !== 'object') return false;

  const stored = persisted as Record<string, unknown>;
  const canonical = persistedSettingsFromState(hydrated) as Record<string, unknown>;
  const storedKeys = Object.keys(stored);
  const canonicalKeys = Object.keys(canonical);
  if (storedKeys.length !== canonicalKeys.length) return true;

  return canonicalKeys.some((key) => (
    !Object.hasOwn(stored, key) || !Object.is(stored[key], canonical[key])
  ));
}

interface CanonicalSettingsState extends AppSettings {
  persistCanonicalSettings: () => void;
}

/**
 * Zustand v5 only writes after a versioned `migrate`, not after `merge`.
 * Track whether merge changed the stored settings and, after successful
 * hydration, ask the store to persist the already-hydrated state exactly once.
 */
export function createSettingsPersistenceHooks<T extends CanonicalSettingsState>() {
  let needsCanonicalization = false;

  return {
    merge(persisted: unknown, current: T): T {
      const hydrated = mergePersistedSettings(persisted, current);
      needsCanonicalization = persistedSettingsNeedCanonicalization(persisted, hydrated);
      return hydrated;
    },
    onRehydrateStorage() {
      // A failed read must not inherit a decision from an earlier hydration.
      needsCanonicalization = false;
      return (state: T | undefined, error: unknown) => {
        const shouldCanonicalize = needsCanonicalization;
        needsCanonicalization = false;
        if (!error && state && shouldCanonicalize) {
          state.persistCanonicalSettings();
        }
      };
    },
  };
}
