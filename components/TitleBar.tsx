import React from 'react';
import { Settings, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { WindowControls } from './ui';

interface TitleBarProps {
  onOpenSettings: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenSettings }) => {
  const { autoTranslate, toggleAutoTranslate } = useAppStore();

  return (
    // Tauri's drag shim reads data-tauri-drag-region off the event target
    // itself, not an ancestor — so the title and the spacer carry it too, or
    // the largest drag-looking area of the header would do nothing.
    <div
      className="h-[47px] shrink-0 box-border flex items-center gap-[6px] pl-[14px] pr-[10px] select-none -webkit-app-region-drag relative z-20"
      data-tauri-drag-region
    >
      <div className="text-[15px] font-bold text-text shrink-0" data-tauri-drag-region>
        LightTranslator
      </div>

      <div className="flex-1 self-stretch" data-tauri-drag-region />

      <button
        type="button"
        onClick={toggleAutoTranslate}
        className={`h-[34px] rounded-lg pl-[10px] pr-3 inline-flex items-center gap-[6px] text-sm font-medium shrink-0 transition-colors duration-150 -webkit-app-region-no-drag ${
          autoTranslate ? 'bg-tint text-accent' : 'text-text hover:bg-hover'
        }`}
        title={autoTranslate ? 'Auto-translate is on' : 'Auto-translate is off'}
        aria-pressed={autoTranslate}
      >
        <Zap size={15} />
        Auto
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="icon-btn -webkit-app-region-no-drag"
        title="Settings"
        aria-label="Settings"
      >
        <Settings size={16} />
      </button>

      <WindowControls />
    </div>
  );
};
