import React, { useState, useEffect } from 'react';
import { X, Save, Bot, Terminal, Zap, Globe, Cloud, Layout, Cpu, Image, Network, Keyboard, Power, MessageSquare, MousePointer2, Languages } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PROVIDERS, DEFAULT_SYSTEM_PROMPT, LANGUAGES } from '../constants';
import { platform } from '../src/lib/platform';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    provider,
    debounceMs,
    modelId,
    customSystemInstruction,
    systemPromptEnabled,
    geminiApiKey,
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    openrouterApiKey,
    openrouterModel,
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
    updateSettings
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'llm' | 'cloud' | 'selection' | 'general'>('llm');
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [tempShortcut, setTempShortcut] = useState('');

  const selectedProvider = PROVIDERS.find(p => p.id === provider);
  const isLlmProvider = selectedProvider?.category === 'llm';

  // Get the display value for system prompt (show default if empty, otherwise show custom)
  const systemPromptDisplayValue = customSystemInstruction || DEFAULT_SYSTEM_PROMPT;

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

  const applyDeepSeekPreset = () => {
    updateSettings({
      openaiBaseUrl: 'https://api.deepseek.com',
      openaiModel: 'deepseek-chat',
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

  const saveShortcut = () => {
    if (tempShortcut) {
      updateSettings({ selectionShortcut: tempShortcut });
      // Notify platform to update the shortcut
      if (platform.isAvailable()) {
        platform.updateShortcut(tempShortcut);
      }
    }
    setIsRecordingShortcut(false);
    setTempShortcut('');
  };

  const formatShortcut = (shortcut: string) => {
    return shortcut
      .replace('CommandOrControl', navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')
      .replace(/\+/g, ' + ');
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-1 ${activeTab === id
        ? 'bg-macos-active text-white shadow-md'
        : 'text-macos-text hover:bg-black/5'
        }`}
    >
      <Icon size={18} className={activeTab === id ? 'text-white' : 'text-macos-muted'} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container: BetterDisplay Style */}
      <div className="w-full max-w-3xl h-[550px] bg-white/80 backdrop-blur-3xl rounded-2xl shadow-macos-window border border-white/40 flex overflow-hidden animate-in zoom-in-95 duration-200 z-10 text-macos-text">

        {/* Sidebar */}
        <div className="w-56 bg-macos-sidebar border-r border-white/20 flex flex-col p-4 pt-8">
          <div className="mb-6 px-3">
            <h2 className="text-xs font-bold text-macos-muted uppercase tracking-wider">Settings</h2>
          </div>

          <nav className="space-y-1">
            <SidebarItem id="llm" label="Generative AI" icon={Bot} />
            <SidebarItem id="cloud" label="Cloud Translate" icon={Cloud} />
            <SidebarItem id="selection" label="Pop-up" icon={MousePointer2} />
            <SidebarItem id="general" label="General" icon={Layout} />
          </nav>

          <div className="mt-auto pt-4 border-t border-black/5">
            <button
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white/40 flex flex-col relative">

          {/* Header */}
          <div className="h-16 flex items-center px-8 border-b border-black/5">
            <h1 className="text-xl font-semibold text-macos-text tracking-tight">
              {activeTab === 'llm' && 'Generative AI Models'}
              {activeTab === 'cloud' && 'Cloud Translation APIs'}
              {activeTab === 'selection' && 'Pop-up Settings'}
              {activeTab === 'general' && 'General Configuration'}
            </h1>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6">

            {/* === LLM TAB === */}
            {activeTab === 'llm' && (
              <>
                {/* Provider Selection Card */}
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4 text-macos-text/80">Select Model Provider</h3>
                  <div className="space-y-3">
                    {PROVIDERS.filter(p => p.category === 'llm').map(p => (
                      <label key={p.id} className="flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === p.id ? 'bg-macos-active text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {p.id === 'gemini' ? <Bot size={16} /> : p.id === 'openrouter' ? <Globe size={16} /> : <Terminal size={16} />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-macos-text group-hover:text-black">{p.name}</div>
                            <div className="text-xs text-macos-muted">{p.description}</div>
                          </div>
                        </div>

                        {/* Native Switch */}
                        <div className="relative">
                          <input
                            type="radio"
                            name="provider-llm"
                            checked={provider === p.id}
                            onChange={() => updateSettings({ provider: p.id })}
                            className="sr-only toggle-checkbox"
                          />
                          <div className="toggle-label"></div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Dynamic Config Card */}
                {provider === 'gemini' && (
                  <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-macos-text text-sm font-semibold">
                      <Bot size={16} className="text-blue-500" />
                      Gemini Configuration
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">API Key</label>
                        <input
                          type="password"
                          value={geminiApiKey}
                          onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none transition-all shadow-sm"
                          placeholder="AIzaSy..."
                        />
                        <p className="text-xs text-macos-muted mt-2">Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a></p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Model ID</label>
                        <input
                          type="text"
                          value={modelId}
                          onChange={(e) => updateSettings({ modelId: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none transition-all shadow-sm"
                          placeholder="gemini-3-flash-preview"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {provider === 'openai' && (
                  <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-macos-text text-sm font-semibold">
                        <Terminal size={16} className="text-purple-500" />
                        Custom API Settings
                      </div>
                      <button onClick={applyDeepSeekPreset} className="text-xs font-medium text-blue-500 hover:text-blue-600 bg-blue-50 px-2 py-1 rounded-md transition-colors">
                        Load DeepSeek
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Base URL</label>
                        <input
                          type="text"
                          value={openaiBaseUrl}
                          onChange={(e) => updateSettings({ openaiBaseUrl: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">API Key</label>
                        <input
                          type="password"
                          value={openaiApiKey}
                          onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                          placeholder="sk-..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Model Name</label>
                        <input
                          type="text"
                          value={openaiModel}
                          onChange={(e) => updateSettings({ openaiModel: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {provider === 'openrouter' && (
                  <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-macos-text text-sm font-semibold">
                      <Globe size={16} className="text-orange-500" />
                      OpenRouter Settings
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">API Key</label>
                        <input
                          type="password"
                          value={openrouterApiKey}
                          onChange={(e) => updateSettings({ openrouterApiKey: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                          placeholder="sk-or-..."
                        />
                        <p className="text-xs text-macos-muted mt-2">Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenRouter</a></p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Model Name</label>
                        <input
                          type="text"
                          value={openrouterModel}
                          onChange={(e) => updateSettings({ openrouterModel: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                          placeholder="openai/gpt-4-turbo"
                        />
                        <p className="text-xs text-macos-muted mt-2">Examples: openai/gpt-4-turbo, anthropic/claude-3-opus, meta-llama/llama-3-70b</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* System Prompt Card - Only for LLM providers */}
                <div className={`bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4 transition-opacity ${!isLlmProvider ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare size={16} className="text-indigo-500" />
                      <span>Custom System Prompt</span>
                    </div>
                    {/* System Prompt Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemPromptEnabled}
                        onChange={(e) => updateSettings({ systemPromptEnabled: e.target.checked })}
                        disabled={!isLlmProvider}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 ${!isLlmProvider ? 'cursor-not-allowed' : ''}`}></div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <textarea
                      value={systemPromptDisplayValue}
                      onChange={(e) => handleSystemPromptChange(e.target.value)}
                      onBlur={handleSystemPromptBlur}
                      rows={3}
                      disabled={!isLlmProvider || !systemPromptEnabled}
                      placeholder={DEFAULT_SYSTEM_PROMPT}
                      className={`w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none resize-none shadow-sm transition-all ${!isLlmProvider || !systemPromptEnabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                        }`}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-macos-muted">
                        {!isLlmProvider
                          ? 'Select an LLM provider to customize the system prompt.'
                          : !systemPromptEnabled
                            ? 'Enable the toggle to use a custom system prompt.'
                            : 'Clear the field to restore the default prompt.'}
                      </p>
                      {isLlmProvider && systemPromptEnabled && customSystemInstruction && (
                        <button
                          onClick={() => updateSettings({ customSystemInstruction: '' })}
                          className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                        >
                          Reset to Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* === CLOUD TAB === */}
            {activeTab === 'cloud' && (
              <>
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4 text-macos-text/80">Select Cloud Provider</h3>
                  <div className="space-y-4">
                    {PROVIDERS.filter(p => p.category === 'cloud').map(p => (
                      <label key={p.id} className={`flex items-center justify-between group cursor-pointer ${!p.enabled && !p.requiresKey ? '' : (!p.enabled ? 'opacity-50 grayscale' : '')}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === p.id ? 'bg-macos-active text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {p.id === 'google' ? <Globe size={16} /> : <Cloud size={16} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-macos-text">{p.name}</div>
                              {!p.enabled && <span className="text-[10px] bg-gray-200 px-1.5 rounded text-gray-500">Desktop App Only</span>}
                            </div>
                            <div className="text-xs text-macos-muted">{p.description}</div>
                          </div>
                        </div>

                        <div className="relative">
                          <input
                            type="radio"
                            name="provider-cloud"
                            checked={provider === p.id}
                            onChange={() => p.enabled && updateSettings({ provider: p.id })}
                            disabled={!p.enabled}
                            className="sr-only toggle-checkbox"
                          />
                          <div className="toggle-label"></div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedProvider?.id === 'google' && (
                  <div className="bg-green-50/50 border border-green-100 shadow-sm rounded-xl p-5 flex items-start gap-4">
                    <div className="p-2 bg-green-100 rounded-full text-green-600">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-green-800">No API Key Required</h4>
                      <p className="text-xs text-green-700 mt-1 leading-relaxed">
                        Google Translate is accessed via the public web API. No key configuration is needed, but rate limits may apply.
                      </p>
                    </div>
                  </div>
                )}

                {selectedProvider?.id === 'deepl' && (
                  <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-macos-text text-sm font-semibold">
                      <Cloud size={16} className="text-blue-500" />
                      DeepL API Settings
                    </div>

                    <div>
                      <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">API Key</label>
                      <input
                        type="password"
                        value={deeplApiKey || ''}
                        onChange={(e) => updateSettings({ deeplApiKey: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                        placeholder="DeepL API Key"
                      />
                      <p className="text-xs text-macos-muted mt-2">Supports both Free and Pro API keys.</p>
                    </div>
                  </div>
                )}

                {selectedProvider?.id === 'microsoft' && (
                  <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-macos-text text-sm font-semibold">
                      <Cloud size={16} className="text-blue-500" />
                      Microsoft Translator Settings
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Subscription Key</label>
                        <input
                          type="password"
                          value={microsoftSubscriptionKey || ''}
                          onChange={(e) => updateSettings({ microsoftSubscriptionKey: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                          placeholder="Azure Subscription Key"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Region</label>
                        <input
                          type="text"
                          value={microsoftRegion || ''}
                          onChange={(e) => updateSettings({ microsoftRegion: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                          placeholder="eastus"
                        />
                        <p className="text-xs text-macos-muted mt-2">Azure resource region (e.g., eastus, westeurope, eastasia)</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* === SELECTION TAB === */}
            {activeTab === 'selection' && (
              <>
                {/* Keyboard Shortcut Card */}
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Keyboard size={16} className="text-gray-500" />
                    <span>Activation Shortcut</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          setIsRecordingShortcut(true);
                          setTempShortcut('');
                        }}
                        onBlur={() => {
                          if (!tempShortcut) {
                            setIsRecordingShortcut(false);
                          }
                        }}
                        className={`flex-1 px-4 py-3 rounded-lg border text-sm font-mono text-center cursor-pointer transition-all ${isRecordingShortcut
                          ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        {isRecordingShortcut
                          ? (tempShortcut ? formatShortcut(tempShortcut) : 'Press keys...')
                          : formatShortcut(selectionShortcut)}
                      </div>

                      {isRecordingShortcut && tempShortcut && (
                        <button
                          onClick={saveShortcut}
                          className="px-4 py-2 bg-macos-active text-white font-medium rounded-lg hover:bg-macos-active/90 transition-colors text-sm"
                        >
                          Save
                        </button>
                      )}

                      {isRecordingShortcut && (
                        <button
                          onClick={() => {
                            setIsRecordingShortcut(false);
                            setTempShortcut('');
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-macos-muted">
                      {isRecordingShortcut
                        ? 'Press modifier keys (Ctrl/Cmd, Alt, Shift) + a letter/key'
                        : 'Click to record a new shortcut. This triggers the pop-up window.'}
                    </p>
                  </div>
                </div>

                {/* Quick Translate Language Card */}
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Languages size={16} className="text-blue-500" />
                    <span>Translation Language</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-macos-muted mb-1">Source Language</label>
                      <select
                        value={quickSourceLang}
                        onChange={(e) => updateSettings({ quickSourceLang: e.target.value as any })}
                        className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-macos-muted mb-1">Target Language</label>
                      <select
                        value={quickTargetLang}
                        onChange={(e) => updateSettings({ quickTargetLang: e.target.value as any })}
                        className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                      >
                        {LANGUAGES.filter((lang) => lang.code !== 'auto').map((lang) => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-macos-muted">These language settings are independent from the main panel. You can also change them directly in the pop-up window.</p>
                </div>

                {/* Quick Translate Appearance Card */}
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Layout size={16} className="text-indigo-500" />
                    <span>Appearance</span>
                  </div>

                  {/* Background Opacity Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-macos-muted">Opacity</span>
                      <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">{Math.round(quickWindowOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="50" max="100" step="5"
                      value={quickWindowOpacity * 100}
                      onChange={(e) => updateSettings({ quickWindowOpacity: parseInt(e.target.value) / 100 })}
                      className="w-full"
                    />
                    <p className="text-xs text-macos-muted mt-1">Adjust the transparency of the popup window background.</p>
                  </div>

                  {/* Border Opacity Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-macos-muted">Border Depth</span>
                      <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">{Math.round(quickWindowBorderOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0" max="50" step="5"
                      value={quickWindowBorderOpacity * 100}
                      onChange={(e) => updateSettings({ quickWindowBorderOpacity: parseInt(e.target.value) / 100 })}
                      className="w-full"
                    />
                    <p className="text-xs text-macos-muted mt-1">Adjust the color depth of the popup window border.</p>
                  </div>
                </div>
              </>
            )}

            {/* === GENERAL TAB === */}
            {activeTab === 'general' && (
              <>
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-6">

                  {/* Debounce Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Zap size={16} className="text-macos-active" />
                        <span>Debounce Delay</span>
                      </div>
                      <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">{debounceMs}ms</span>
                    </div>
                    <input
                      type="range"
                      min="300" max="2000" step="100"
                      value={debounceMs}
                      onChange={(e) => updateSettings({ debounceMs: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-macos-muted mt-2">Controls how long the app waits after you stop typing to trigger translation.</p>
                  </div>

                </div>

                {/* Proxy Settings Card */}
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Network size={16} className="text-gray-500" />
                      <span>Proxy Settings</span>
                    </div>
                    {/* Proxy Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={proxyEnabled}
                        onChange={(e) => {
                          updateSettings({ proxyEnabled: e.target.checked });
                          // Notify platform to apply proxy
                          if (platform.isAvailable()) {
                            platform.setProxy({
                              enabled: e.target.checked,
                              protocol: proxyProtocol,
                              host: proxyHost,
                              port: proxyPort,
                              username: proxyUsername,
                              password: proxyPassword
                            });
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  {proxyEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Protocol</label>
                          <select
                            value={proxyProtocol}
                            onChange={(e) => updateSettings({ proxyProtocol: e.target.value as 'http' | 'https' | 'socks5' })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                          >
                            <option value="http">HTTP</option>
                            <option value="https">HTTPS</option>
                            <option value="socks5">SOCKS5</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Port</label>
                          <input
                            type="number"
                            value={proxyPort}
                            onChange={(e) => updateSettings({ proxyPort: parseInt(e.target.value) || 8080 })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                            placeholder="8080"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Host</label>
                        <input
                          type="text"
                          value={proxyHost}
                          onChange={(e) => updateSettings({ proxyHost: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                          placeholder="127.0.0.1 or proxy.example.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Username (optional)</label>
                          <input
                            type="text"
                            value={proxyUsername}
                            onChange={(e) => updateSettings({ proxyUsername: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-macos-muted ml-1 mb-1.5 block">Password (optional)</label>
                          <input
                            type="password"
                            value={proxyPassword}
                            onChange={(e) => updateSettings({ proxyPassword: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-macos-active focus:ring-2 focus:ring-macos-active/20 outline-none shadow-sm"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (platform.isAvailable()) {
                            platform.setProxy({
                              enabled: proxyEnabled,
                              protocol: proxyProtocol,
                              host: proxyHost,
                              port: proxyPort,
                              username: proxyUsername,
                              password: proxyPassword
                            });
                          }
                        }}
                        className="w-full py-2 bg-macos-active text-white font-medium rounded-lg hover:bg-macos-active/90 transition-colors text-sm"
                      >
                        Apply Proxy Settings
                      </button>
                      <p className="text-xs text-macos-muted">Configure a proxy server for all translation API requests.</p>
                    </div>
                  )}
                </div>

                {/* Auto-Launch Card */}
                <div className="bg-white/60 border border-white/50 shadow-macos-card rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Power size={16} className="text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Launch at Startup</div>
                        <p className="text-xs text-macos-muted">Automatically start when you log in</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={launchAtStartup}
                        onChange={async (e) => {
                          const enabled = e.target.checked;
                          // Notify platform to set auto-launch
                          if (platform.isAvailable()) {
                            try {
                              await platform.setAutoLaunch(enabled);
                              updateSettings({ launchAtStartup: enabled });
                            } catch (error) {
                              console.error('Failed to set auto-launch:', error);
                            }
                          } else {
                            // Not in native environment, just update local state
                            updateSettings({ launchAtStartup: enabled });
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};