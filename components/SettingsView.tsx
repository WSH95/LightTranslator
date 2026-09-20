import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Check, Copy, Languages, MonitorCog, MousePointer2, Palette,
  RefreshCw, SlidersHorizontal,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  ACCENTS,
  PROVIDERS,
  LLM_PRESETS,
  DEFAULT_SYSTEM_PROMPT,
  LANGUAGES,
  QUICK_WINDOW_MAX_WIDTH_DEFAULT,
  QUICK_WINDOW_MAX_WIDTH_MAX,
  QUICK_WINDOW_MAX_WIDTH_MIN,
} from '../constants';
import type {
  AppearanceTheme, LlmPreset, SurfaceStyle, TranslationProviderId, TranslationTextSize,
} from '../types';
import { platform, type ShortcutStatus } from '../src/lib/platform';
import { accentFor, getSystemAccent, refreshSystemAppearance } from '../src/lib/theme';
import { LanguagePill, List, Radio, Row, SettingsGroup, Switch, WindowControls } from './ui';

interface SettingsViewProps {
  onBack: () => void;
}

type SettingsTab = 'translation' | 'selection' | 'general' | 'appearance';

const TABS: { id: SettingsTab; label: string; icon: typeof Languages }[] = [
  { id: 'translation', label: 'Translation', icon: Languages },
  { id: 'selection', label: 'Pop-up', icon: MousePointer2 },
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

const THEME_OPTIONS: { value: AppearanceTheme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const TEXT_SIZES: { value: TranslationTextSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

/** Group caption under the provider list; existing copy, per provider. */
const PROVIDER_NOTES: Record<TranslationProviderId, string> = {
  google: 'Uses two no-key Google web endpoints with automatic fallback. No key configuration is needed, but availability is not guaranteed.',
  openai: 'Any endpoint serving /chat/completions. Leave the API key empty for local servers that need no key.',
  deepl: 'Supports both Free and Pro API keys.',
  microsoft: 'Azure Cognitive Services. Needs a subscription key and the resource region.',
};

const SURFACES: { value: SurfaceStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'glass', label: 'Frosted glass' },
];

/**
 * Surface preview. Glass only reads as glass against something, so both tiles
 * sit on the same stand-in wallpaper and only the window layer differs.
 */
const SurfacePreview: React.FC<{ glass: boolean }> = ({ glass }) => (
  <div className="w-full h-[92px] relative overflow-hidden rounded-[8px]">
    <div
      className="absolute inset-0"
      style={{ background: 'linear-gradient(135deg, #5b7cfa 0%, #a855b8 55%, #e9724c 100%)' }}
    />
    <div
      className="absolute inset-3 rounded-[6px]"
      style={{
        background: glass ? 'rgb(var(--bg-rgb) / .55)' : 'rgb(var(--bg-rgb))',
        backdropFilter: glass ? 'blur(6px)' : undefined,
        WebkitBackdropFilter: glass ? 'blur(6px)' : undefined,
        border: '1px solid var(--card-border)',
      }}
    />
  </div>
);

/** One half of an Appearance style preview: a 14px header over an inset card. */
const PreviewPane: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="flex-1 flex flex-col" style={{ background: dark ? '#242424' : '#fafafa' }}>
    <div className="h-3.5 shrink-0" />
    <div
      className="flex-1 mx-2 mb-2 rounded-[5px]"
      style={dark ? { background: '#303030' } : { background: '#ffffff', border: '1px solid rgba(0,0,0,.1)' }}
    />
  </div>
);

// Presets differ from a hand-typed URL only by a trailing slash, so compare
// loosely when deciding which preset button to highlight.
const normalizeUrl = (url: string) => (url || '').trim().replace(/\/+$/, '');

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const {
    provider,
    debounceMs,
    customSystemInstruction,
    systemPromptEnabled,
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    deeplApiKey,
    microsoftSubscriptionKey,
    microsoftRegion,
    proxyEnabled,
    proxyProtocol,
    proxyHost,
    proxyPort,
    proxyUsername,
    proxyPassword,
    selectionShortcut,
    launchAtStartup,
    quickWindowOpacity,
    quickWindowBorderOpacity,
    quickSourceLang,
    quickTargetLang,
    quickWindowMaxWidth,
    appearanceTheme,
    surfaceStyle,
    glassOpacity,
    accentColor,
    followSystemAccent,
    translationTextSize,
    updateSettings
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('translation');
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [tempShortcut, setTempShortcut] = useState('');
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [shortcutStatus, setShortcutStatus] = useState<ShortcutStatus | null>(null);
  const [isReregistering, setIsReregistering] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [systemAccent, setSystemAccent] = useState(getSystemAccent);

  // There is no gsettings change signal without a monitor, so re-read whenever
  // the tab that shows it is opened or the follow switch is turned on.
  const syncSystemAccent = useCallback(() => {
    void refreshSystemAppearance().then(() => setSystemAccent(getSystemAccent()));
  }, []);

  useEffect(() => {
    if (activeTab === 'appearance') syncSystemAccent();
  }, [activeTab, syncSystemAccent]);

  // Where the shortcut is registered depends on the session: the app grabs the
  // key under X11, GNOME owns it under Wayland.
  const refreshShortcutStatus = useCallback(() => {
    if (!platform.isAvailable()) return;
    platform.getShortcutStatus()
      .then(setShortcutStatus)
      .catch((e) => console.warn('Failed to read the shortcut status:', e));
  }, []);

  useEffect(() => {
    refreshShortcutStatus();
  }, [refreshShortcutStatus]);

  const reregisterShortcut = async () => {
    setIsReregistering(true);
    setShortcutError(null);
    try {
      await platform.reregisterShortcut();
      refreshShortcutStatus();
    } catch (e: any) {
      setShortcutError(String(e?.message ?? e) || 'Failed to register the shortcut');
    } finally {
      setIsReregistering(false);
    }
  };

  const copyShortcutCommand = async () => {
    if (!shortcutStatus) return;
    try {
      await navigator.clipboard.writeText(shortcutStatus.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    } catch {
      /* leave the command selectable for manual copy */
    }
  };

  const isLlmProvider = provider === 'openai';

  // Handle system prompt change with auto-revert logic
  const handleSystemPromptChange = (value: string) => {
    // If user clears the field, revert to empty (which will show default)
    // The actual default prompt will be used in translation if customSystemInstruction is empty
    updateSettings({ customSystemInstruction: value });
  };

  // Handle system prompt blur - restore default if empty
  const handleSystemPromptBlur = () => {
    if (!customSystemInstruction || customSystemInstruction.trim() === '') {
      // Keep it empty - the translation service will use the default
      updateSettings({ customSystemInstruction: '' });
    }
  };

  // Fill the endpoint and a sample model, but never touch the key: presets are
  // a shortcut for the two fields the user cannot guess, not a reset.
  const applyPreset = (preset: LlmPreset) => {
    updateSettings({
      openaiBaseUrl: preset.baseUrl,
      openaiModel: preset.model,
      provider: 'openai'
    });
  };

  // Handle keyboard shortcut recording
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecordingShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];

    // Build the accelerator string
    if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // Get the key (ignore modifier keys alone)
    const key = e.key;
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      // Convert to proper format
      let keyName = key.toUpperCase();
      if (key.length === 1) {
        keyName = key.toUpperCase();
      } else if (key === 'ArrowUp') keyName = 'Up';
      else if (key === 'ArrowDown') keyName = 'Down';
      else if (key === 'ArrowLeft') keyName = 'Left';
      else if (key === 'ArrowRight') keyName = 'Right';
      else if (key === ' ') keyName = 'Space';

      if (parts.length > 0) {
        parts.push(keyName);
        const shortcut = parts.join('+');
        setTempShortcut(shortcut);
      }
    }
  };

  const saveShortcut = async () => {
    if (tempShortcut) {
      setShortcutError(null);
      if (platform.isAvailable()) {
        try {
          // Register first; the backend keeps the old shortcut on failure,
          // so a broken accelerator is never saved to settings
          await platform.updateShortcut(tempShortcut);
          updateSettings({ selectionShortcut: tempShortcut });
          refreshShortcutStatus();
        } catch (e: any) {
          setShortcutError(String(e?.message ?? e) || 'Failed to register shortcut');
          setIsRecordingShortcut(false);
          setTempShortcut('');
          return;
        }
      } else {
        updateSettings({ selectionShortcut: tempShortcut });
      }
    }
    setIsRecordingShortcut(false);
    setTempShortcut('');
  };

  const formatShortcut = (shortcut: string) => {
    return shortcut
      .replace('CommandOrControl', navigator.userAgent.includes('Mac') ? 'Cmd' : 'Ctrl')
      .replace(/\+/g, ' + ');
  };


  const currentAccent = followSystemAccent && systemAccent ? systemAccent : accentFor(accentColor);

  // Picking a swatch by hand means you are no longer following the desktop;
  // otherwise the click would appear to do nothing.
  const pickAccent = (hex: string) => updateSettings({ accentColor: hex, followSystemAccent: false });

  const entryInput = 'field w-[240px] shrink-0';

  const promptHelp = !isLlmProvider
    ? 'Only the OpenAI Compatible provider uses a system prompt.'
    : !systemPromptEnabled
      ? 'Enable the toggle to use a custom system prompt.'
      : 'Clear the field to restore the default prompt.';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* ---------------- header ---------------- */}
      <div
        className="h-[47px] shrink-0 box-border flex items-center pl-[14px] pr-[10px] relative select-none -webkit-app-region-drag"
        data-tauri-drag-region
      >
        <button type="button" onClick={onBack} className="icon-btn -webkit-app-region-no-drag" title="Back" aria-label="Back">
          <ArrowLeft size={16} />
        </button>

        {/* Centred on the window rather than on a flex slot: the mock's flex:1
            middle slot lands 33px left of centre, and libadwaita centres the
            switcher on the window. */}
        <div className="absolute left-1/2 -translate-x-1/2 w-max flex gap-[2px] -webkit-app-region-no-drag" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`h-[34px] px-3.5 rounded-lg inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-text transition-colors duration-150 ${
                activeTab === id ? 'bg-switcher font-medium' : 'hover:bg-hover'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 self-stretch" data-tauri-drag-region />
        <WindowControls />
      </div>

      {/* ---------------- content ---------------- */}
      <div className="flex-1 min-h-0 overflow-y-auto py-5 flex justify-center">
        <div className="w-[560px] shrink-0 flex flex-col gap-7">

          {activeTab === 'translation' && (
            <>
              <SettingsGroup title="Provider" description={PROVIDER_NOTES[provider]}>
                <List>
                  {PROVIDERS.map((entry) => (
                    <div
                      key={entry.id}
                      className="list-row cursor-pointer"
                      onClick={() => updateSettings({ provider: entry.id })}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Radio
                          checked={provider === entry.id}
                          onChange={() => updateSettings({ provider: entry.id })}
                          aria-label={entry.name}
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-text">{entry.name}</div>
                          {entry.description && (
                            <div className="text-xs text-muted mt-0.5">{entry.description}</div>
                          )}
                        </div>
                      </div>
                      {entry.id === 'google' && provider === 'google' && (
                        <span
                          className="shrink-0 text-xs font-medium px-2 py-[3px] rounded-[10px]"
                          style={{ color: 'var(--accent)', background: 'var(--accent-tint)' }}
                        >
                          No key needed
                        </span>
                      )}
                    </div>
                  ))}
                </List>
              </SettingsGroup>

              {provider === 'openai' && (
                <SettingsGroup
                  title="OpenAI Compatible"
                  description="Presets fill the base URL and a sample model. Your API key is left alone."
                >
                  <List>
                    <div className="list-row">
                      <div className="text-sm text-text shrink-0">Presets</div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {LLM_PRESETS.map((preset: LlmPreset) => {
                          const active = normalizeUrl(openaiBaseUrl) === normalizeUrl(preset.baseUrl);
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => applyPreset(preset)}
                              className="pill"
                              style={active ? { background: 'var(--accent-tint)', color: 'var(--accent)' } : undefined}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Row label="Base URL" description="Any endpoint serving /chat/completions.">
                      <input
                        className={entryInput}
                        value={openaiBaseUrl}
                        onChange={(e) => updateSettings({ openaiBaseUrl: e.target.value })}
                        placeholder="https://api.openai.com/v1"
                        spellCheck="false"
                      />
                    </Row>
                    <Row
                      label="API Key"
                      description="Leave empty for local servers that need no key (Ollama, llama.cpp, LM Studio)."
                    >
                      <input
                        type="password"
                        className={entryInput}
                        value={openaiApiKey}
                        onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                        placeholder="sk-..."
                      />
                    </Row>
                    <Row
                      label="Model Name"
                      description="Translating a pasted image needs a vision-capable model (gpt-4o-mini, gemini-3-flash-preview, qwen2.5vl)."
                    >
                      <input
                        className={entryInput}
                        value={openaiModel}
                        onChange={(e) => updateSettings({ openaiModel: e.target.value })}
                        placeholder="gpt-4o-mini"
                        spellCheck="false"
                      />
                    </Row>
                  </List>
                </SettingsGroup>
              )}

              {provider === 'deepl' && (
                <SettingsGroup title="DeepL">
                  <List>
                    <Row label="API Key">
                      <input
                        type="password"
                        className={entryInput}
                        value={deeplApiKey || ''}
                        onChange={(e) => updateSettings({ deeplApiKey: e.target.value })}
                        placeholder="DeepL API Key"
                      />
                    </Row>
                  </List>
                </SettingsGroup>
              )}

              {provider === 'microsoft' && (
                <SettingsGroup title="Microsoft Translator">
                  <List>
                    <Row label="Subscription Key">
                      <input
                        type="password"
                        className={entryInput}
                        value={microsoftSubscriptionKey || ''}
                        onChange={(e) => updateSettings({ microsoftSubscriptionKey: e.target.value })}
                        placeholder="Azure Subscription Key"
                      />
                    </Row>
                    <Row label="Region" description="Azure resource region (e.g., eastus, westeurope, eastasia)">
                      <input
                        className={entryInput}
                        value={microsoftRegion || ''}
                        onChange={(e) => updateSettings({ microsoftRegion: e.target.value })}
                        placeholder="eastus"
                        spellCheck="false"
                      />
                    </Row>
                  </List>
                </SettingsGroup>
              )}

              <SettingsGroup title="System Prompt" description={promptHelp} dimmed={!isLlmProvider}>
                <List>
                  <Row label="Use custom prompt" description="Only the OpenAI Compatible provider uses a system prompt.">
                    <Switch
                      checked={systemPromptEnabled}
                      onChange={(next) => updateSettings({ systemPromptEnabled: next })}
                      disabled={!isLlmProvider}
                      aria-label="Use custom prompt"
                    />
                  </Row>
                  <div className="p-4">
                    <textarea
                      rows={3}
                      className="w-full bg-transparent text-sm leading-normal text-text placeholder:text-placeholder resize-none focus:outline-none disabled:cursor-not-allowed"
                      value={customSystemInstruction}
                      onChange={(e) => handleSystemPromptChange(e.target.value)}
                      onBlur={handleSystemPromptBlur}
                      placeholder={DEFAULT_SYSTEM_PROMPT}
                      disabled={!isLlmProvider || !systemPromptEnabled}
                    />
                  </div>
                  {isLlmProvider && systemPromptEnabled && customSystemInstruction && (
                    <div className="list-row justify-end">
                      <button type="button" className="btn" onClick={() => updateSettings({ customSystemInstruction: '' })}>
                        Reset to Default
                      </button>
                    </div>
                  )}
                </List>
              </SettingsGroup>
            </>
          )}

          {activeTab === 'selection' && (
            <>
              <SettingsGroup
                title="Activation Shortcut"
                description={
                  isRecordingShortcut
                    ? 'Press modifier keys (Ctrl/Cmd, Alt, Shift) + a letter/key'
                    : 'Click to record a new shortcut. This triggers the pop-up window.'
                }
              >
                <List>
                  <Row label="Shortcut">
                    <div className="flex items-center gap-2">
                      <div
                        tabIndex={0}
                        onFocus={() => { setIsRecordingShortcut(true); setTempShortcut(''); }}
                        onKeyDown={handleKeyDown}
                        onBlur={() => { if (!tempShortcut) setIsRecordingShortcut(false); }}
                        className={`field font-mono text-center min-w-[190px] cursor-pointer ${
                          isRecordingShortcut ? 'ring-2 ring-accent/40' : ''
                        }`}
                      >
                        {isRecordingShortcut
                          ? (tempShortcut ? formatShortcut(tempShortcut) : 'Press keys...')
                          : formatShortcut(selectionShortcut)}
                      </div>
                      {isRecordingShortcut && tempShortcut && (
                        <button type="button" className="btn btn-suggested" onClick={saveShortcut}>Save</button>
                      )}
                      {isRecordingShortcut && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => { setIsRecordingShortcut(false); setTempShortcut(''); }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </Row>

                  {shortcutError && (
                    <div className="px-4 py-3 text-xs text-danger">
                      {shortcutError} — the previous shortcut is still active.
                    </div>
                  )}

                  {/* Where this session's shortcut actually lives. Under
                      Wayland the app cannot grab a key, so GNOME holds it. */}
                  {shortcutStatus && (
                    <div className="px-4 py-3 flex items-start gap-2">
                      <MonitorCog size={14} className="text-muted mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0 text-[13px] text-muted space-y-1.5">
                        {shortcutStatus.mechanism === 'x11-grab' && (
                          <p>Registered directly with the X server by the app.</p>
                        )}
                        {shortcutStatus.mechanism === 'gnome' && (
                          <p>
                            Wayland session: registered as a GNOME shortcut, listed under
                            Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts.
                          </p>
                        )}
                        {shortcutStatus.mechanism === 'manual' && (
                          <>
                            <p>
                              This Wayland desktop does not let applications register a global
                              shortcut. Add one in your system keyboard settings that runs:
                            </p>
                            <div className="flex items-stretch gap-1.5">
                              <code className="flex-1 text-xs bg-pill text-text rounded px-2 py-1.5 overflow-x-auto whitespace-pre font-mono select-text">
                                {shortcutStatus.command}
                              </code>
                              <button
                                type="button"
                                onClick={copyShortcutCommand}
                                className="icon-btn icon-btn-xs"
                                title="Copy command"
                              >
                                {commandCopied ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </>
                        )}

                        {shortcutStatus.extension === 'active' && (
                          <p>The popup opens at the mouse pointer (GNOME placement extension active).</p>
                        )}
                        {shortcutStatus.extension === 'pending-restart' && (
                          <p>
                            Popup placement extension installed and enabled — log out and back in to
                            activate it. Until then GNOME decides where the popup opens.
                          </p>
                        )}
                        {shortcutStatus.extension === 'disabled' && (
                          <p>
                            Popup placement is left to GNOME. Switch “LightTranslator Quick Translate”
                            on in the Extensions app to have the popup follow the pointer.
                          </p>
                        )}
                      </div>
                      {shortcutStatus.mechanism !== 'manual' && (
                        <button
                          type="button"
                          onClick={reregisterShortcut}
                          disabled={isReregistering}
                          className="btn shrink-0"
                          title="Register the shortcut for this session again"
                        >
                          <RefreshCw size={12} className={isReregistering ? 'animate-spin' : ''} />
                          Re-register
                        </button>
                      )}
                    </div>
                  )}
                </List>
              </SettingsGroup>

              <SettingsGroup
                title="Translation Language"
                description="These language settings are independent from the main panel. You can also change them directly in the pop-up window."
              >
                <List>
                  <Row label="Source Language">
                    <LanguagePill
                      value={quickSourceLang}
                      options={LANGUAGES}
                      onChange={(code) => updateSettings({ quickSourceLang: code })}
                      align="right"
                      title="Pop-up source language"
                    />
                  </Row>
                  <Row label="Target Language">
                    <LanguagePill
                      value={quickTargetLang}
                      options={LANGUAGES.filter((language) => language.code !== 'auto')}
                      onChange={(code) => updateSettings({ quickTargetLang: code })}
                      align="right"
                      title="Pop-up target language"
                    />
                  </Row>
                </List>
              </SettingsGroup>

              <SettingsGroup title="Window">
                <List>
                  <Row label="Opacity" description="Adjust the transparency of the popup window background.">
                    <div className="flex items-center gap-3 w-[220px] shrink-0">
                      <input
                        type="range"
                        min={50}
                        max={100}
                        step={5}
                        value={quickWindowOpacity * 100}
                        onChange={(e) => updateSettings({ quickWindowOpacity: parseInt(e.target.value, 10) / 100 })}
                      />
                      <span className="text-xs font-mono text-muted w-10 text-right shrink-0">
                        {Math.round(quickWindowOpacity * 100)}%
                      </span>
                    </div>
                  </Row>
                  <Row label="Border Depth" description="Adjust the color depth of the popup window border.">
                    <div className="flex items-center gap-3 w-[220px] shrink-0">
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={5}
                        value={quickWindowBorderOpacity * 100}
                        onChange={(e) => updateSettings({ quickWindowBorderOpacity: parseInt(e.target.value, 10) / 100 })}
                      />
                      <span className="text-xs font-mono text-muted w-10 text-right shrink-0">
                        {Math.round(quickWindowBorderOpacity * 100)}%
                      </span>
                    </div>
                  </Row>
                  <Row
                    label="Maximum width"
                    description="The pop-up stays narrower when the translation needs less space."
                  >
                    <div className="flex items-center gap-3 w-[300px] shrink-0">
                      <input
                        type="range"
                        min={QUICK_WINDOW_MAX_WIDTH_MIN}
                        max={QUICK_WINDOW_MAX_WIDTH_MAX}
                        step={1}
                        value={quickWindowMaxWidth}
                        onChange={(event) => updateSettings({
                          quickWindowMaxWidth: parseInt(event.target.value, 10),
                        })}
                        aria-label="Maximum pop-up width"
                      />
                      <span className="text-xs font-mono text-muted w-12 text-right shrink-0">
                        {quickWindowMaxWidth}px
                      </span>
                      <button
                        type="button"
                        className="btn shrink-0"
                        disabled={quickWindowMaxWidth === QUICK_WINDOW_MAX_WIDTH_DEFAULT}
                        onClick={() => updateSettings({
                          quickWindowMaxWidth: QUICK_WINDOW_MAX_WIDTH_DEFAULT,
                        })}
                      >
                        Reset
                      </button>
                    </div>
                  </Row>
                </List>
              </SettingsGroup>
            </>
          )}

          {activeTab === 'general' && (
            <>
              <SettingsGroup
                title="Translation"
                description="Controls how long the app waits after you stop typing to trigger translation."
              >
                <List>
                  <Row label="Debounce Delay">
                    <div className="flex items-center gap-3 w-[220px] shrink-0">
                      <input
                        type="range"
                        min={300}
                        max={2000}
                        step={100}
                        value={debounceMs}
                        onChange={(e) => updateSettings({ debounceMs: parseInt(e.target.value, 10) })}
                      />
                      <span className="text-xs font-mono text-muted w-12 text-right shrink-0">{debounceMs}ms</span>
                    </div>
                  </Row>
                </List>
              </SettingsGroup>

              <SettingsGroup
                title="Proxy"
                description="Configure a proxy server for all translation API requests."
              >
                <List>
                  <Row label="Use a proxy">
                    <Switch
                      checked={proxyEnabled}
                      onChange={(next) => {
                        updateSettings({ proxyEnabled: next });
                        if (platform.isAvailable()) {
                          platform.setProxy({
                            enabled: next,
                            protocol: proxyProtocol,
                            host: proxyHost,
                            port: proxyPort,
                            username: proxyUsername,
                            password: proxyPassword,
                          }).catch((e) => console.error('Failed to apply proxy:', e));
                        }
                      }}
                      aria-label="Use a proxy"
                    />
                  </Row>

                  {proxyEnabled && (
                    <>
                      <Row label="Protocol">
                        <select
                          className={entryInput}
                          value={proxyProtocol}
                          onChange={(e) => updateSettings({ proxyProtocol: e.target.value as 'http' | 'https' | 'socks5' })}
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </Row>
                      <Row label="Host">
                        <input
                          className={entryInput}
                          value={proxyHost}
                          onChange={(e) => updateSettings({ proxyHost: e.target.value })}
                          placeholder="127.0.0.1 or proxy.example.com"
                          spellCheck="false"
                        />
                      </Row>
                      <Row label="Port">
                        <input
                          type="number"
                          className={entryInput}
                          value={proxyPort}
                          onChange={(e) => updateSettings({ proxyPort: parseInt(e.target.value, 10) || 8080 })}
                          placeholder="8080"
                        />
                      </Row>
                      <Row label="Username (optional)">
                        <input
                          className={entryInput}
                          value={proxyUsername}
                          onChange={(e) => updateSettings({ proxyUsername: e.target.value })}
                          placeholder="Optional"
                          spellCheck="false"
                        />
                      </Row>
                      <Row label="Password (optional)">
                        <input
                          type="password"
                          className={entryInput}
                          value={proxyPassword}
                          onChange={(e) => updateSettings({ proxyPassword: e.target.value })}
                          placeholder="Optional"
                        />
                      </Row>
                      <div className="list-row justify-end">
                        <button
                          type="button"
                          className="btn btn-suggested"
                          onClick={() => {
                            if (!platform.isAvailable()) return;
                            platform.setProxy({
                              enabled: proxyEnabled,
                              protocol: proxyProtocol,
                              host: proxyHost,
                              port: proxyPort,
                              username: proxyUsername,
                              password: proxyPassword,
                            }).catch((e) => console.error('Failed to apply proxy:', e));
                          }}
                        >
                          Apply Proxy Settings
                        </button>
                      </div>
                    </>
                  )}
                </List>
              </SettingsGroup>

              <SettingsGroup title="System">
                <List>
                  <Row label="Launch at Startup" description="Automatically start when you log in">
                    <Switch
                      checked={launchAtStartup}
                      onChange={async (next) => {
                        if (platform.isAvailable()) {
                          try {
                            await platform.setAutoLaunch(next);
                            updateSettings({ launchAtStartup: next });
                          } catch (e) {
                            console.error('Failed to set auto-launch:', e);
                          }
                        } else {
                          updateSettings({ launchAtStartup: next });
                        }
                      }}
                      aria-label="Launch at startup"
                    />
                  </Row>
                  <Row label="About">
                    <span className="text-sm text-muted shrink-0">
                      LightTranslator v{process.env.APP_VERSION}
                    </span>
                  </Row>
                </List>
              </SettingsGroup>
            </>
          )}

          {activeTab === 'appearance' && (
            <>
              <SettingsGroup title="Style">
                <div className="grid grid-cols-3 gap-4">
                  {THEME_OPTIONS.map(({ value, label }) => {
                    const selected = appearanceTheme === value;
                    return (
                      <div key={value} className="flex flex-col items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => updateSettings({ appearanceTheme: value })}
                          className="w-full h-[92px] rounded-[10px] overflow-hidden flex box-border"
                          style={{ border: selected ? '2px solid var(--accent)' : '1px solid var(--preview-border)' }}
                          aria-label={label}
                        >
                          {value === 'system' ? (
                            <><PreviewPane dark={false} /><PreviewPane dark /></>
                          ) : (
                            <PreviewPane dark={value === 'dark'} />
                          )}
                        </button>
                        <div className="flex items-center gap-2 text-[13px] text-text">
                          <Radio
                            checked={selected}
                            onChange={() => updateSettings({ appearanceTheme: value })}
                            size={18}
                            aria-label={label}
                          />
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Theme"
                description={
                  surfaceStyle === 'glass'
                    ? 'The window blurs whatever is behind it. Combines with Light, Dark or System.'
                    : 'An opaque window. Combines with Light, Dark or System.'
                }
              >
                <div className="grid grid-cols-2 gap-4">
                  {SURFACES.map(({ value, label }) => {
                    const selected = surfaceStyle === value;
                    return (
                      <div key={value} className="flex flex-col items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => updateSettings({ surfaceStyle: value })}
                          className="w-full rounded-[10px] overflow-hidden box-border"
                          style={{ border: selected ? '2px solid var(--accent)' : '1px solid var(--preview-border)' }}
                          aria-label={label}
                        >
                          <SurfacePreview glass={value === 'glass'} />
                        </button>
                        <div className="flex items-center gap-2 text-[13px] text-text">
                          <Radio
                            checked={selected}
                            onChange={() => updateSettings({ surfaceStyle: value })}
                            size={18}
                            aria-label={label}
                          />
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {surfaceStyle === 'glass' && (
                  <List>
                    <Row label="Transparency">
                      <div className="flex items-center gap-3 w-[220px] shrink-0">
                        <input
                          type="range"
                          min={5}
                          max={60}
                          step={5}
                          value={Math.round((1 - glassOpacity) * 100)}
                          onChange={(e) =>
                            updateSettings({ glassOpacity: 1 - parseInt(e.target.value, 10) / 100 })
                          }
                        />
                        <span className="text-xs font-mono text-muted w-10 text-right shrink-0">
                          {Math.round((1 - glassOpacity) * 100)}%
                        </span>
                      </div>
                    </Row>
                  </List>
                )}
              </SettingsGroup>

              <SettingsGroup title="Accent Color">
                <List>
                  <Row label={currentAccent.name} tall>
                    <div className="flex gap-2.5 shrink-0">
                      {ACCENTS.map((accent) => (
                        <button
                          key={accent.name}
                          type="button"
                          onClick={() => pickAccent(accent.light)}
                          className="w-[22px] h-[22px] rounded-full shrink-0"
                          style={{
                            background: accent.light,
                            boxShadow: currentAccent.name === accent.name
                              ? '0 0 0 2px var(--card), 0 0 0 4px var(--accent)'
                              : undefined,
                          }}
                          title={accent.name}
                          aria-label={accent.name}
                          aria-pressed={currentAccent.name === accent.name}
                        />
                      ))}
                    </div>
                  </Row>
                  <Row
                    label="Follow system accent"
                    description="Use the accent chosen in Ubuntu Settings → Appearance"
                  >
                    <Switch
                      checked={followSystemAccent}
                      onChange={(next) => {
                        updateSettings({ followSystemAccent: next });
                        if (next) syncSystemAccent();
                      }}
                      aria-label="Follow system accent"
                    />
                  </Row>
                </List>
              </SettingsGroup>

              <SettingsGroup title="Text">
                <List>
                  <Row label="Translation text size">
                    <div
                      className="flex rounded-lg overflow-hidden shrink-0"
                      style={{ border: '1px solid var(--seg-border)' }}
                      role="group"
                    >
                      {TEXT_SIZES.map(({ value, label }, index) => {
                        const active = translationTextSize === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateSettings({ translationTextSize: value })}
                            className="px-3 h-[30px] flex items-center text-[13px] text-text transition-colors duration-150"
                            style={{
                              background: active ? 'var(--seg-active)' : 'transparent',
                              fontWeight: active ? 500 : 400,
                              borderLeft: index > 0 ? '1px solid var(--seg-border)' : undefined,
                            }}
                            aria-pressed={active}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </Row>
                </List>
              </SettingsGroup>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
