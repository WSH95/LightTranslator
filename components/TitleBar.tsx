import React from 'react';
import { Settings, ArrowRightLeft, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { LANGUAGES } from '../constants';
import { platform } from '../src/lib/platform';

interface TitleBarProps {
  onOpenSettings: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenSettings }) => {
  const { 
    sourceLang, 
    targetLang, 
    setSourceLang, 
    setTargetLang, 
    autoTranslate, 
    toggleAutoTranslate 
  } = useAppStore();

  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleMinimize = () => {
    console.log('Minimize clicked');
    if (platform.isAvailable()) {
      platform.minimize();
    } else {
      alert('Platform API not available. Please restart the app.');
    }
  };

  const handleMaximize = () => {
    console.log('Maximize clicked');
    if (platform.isAvailable()) {
      platform.maximize();
    } else {
      alert('Platform API not available. Please restart the app.');
    }
  };

  const handleClose = () => {
    console.log('Close clicked');
    if (platform.isAvailable()) {
      platform.close();
    } else {
      alert('Platform API not available. Please restart the app.');
    }
  };

  return (
    <div
      className="h-14 flex items-center justify-between px-5 select-none -webkit-app-region-drag relative z-20"
      data-tauri-drag-region
    >

      {/* Left: Traffic Lights (macOS Style SVGs) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 group traffic-light-group -webkit-app-region-no-drag p-1">
          {/* Red: Close (x) */}
          <div 
            onClick={handleClose}
            className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-sm border border-black/5 flex items-center justify-center cursor-pointer hover:brightness-90 active:brightness-75"
          >
            <svg viewBox="0 0 10 10" className="traffic-icon w-2 h-2 text-black/60 fill-current opacity-0 transition-opacity">
              <path d="M2.5 2.5 L7.5 7.5 M7.5 2.5 L2.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          {/* Yellow: Minimize (-) */}
          <div 
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-sm border border-black/5 flex items-center justify-center cursor-pointer hover:brightness-90 active:brightness-75"
          >
            <svg viewBox="0 0 10 10" className="traffic-icon w-2 h-2 text-black/60 fill-current opacity-0 transition-opacity">
               <path d="M2 5 L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          {/* Green: Fullscreen/Zoom (+) */}
          <div 
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full bg-[#28C840] shadow-sm border border-black/5 flex items-center justify-center cursor-pointer hover:brightness-90 active:brightness-75"
          >
            <svg viewBox="0 0 10 10" className="traffic-icon w-2 h-2 text-black/60 fill-current opacity-0 transition-opacity">
               <path d="M2 5 L8 5 M5 2 L5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Center: Language Pills - iOS Segmented Control Style */}
      <div className="flex items-center bg-black/5 rounded-lg p-1 -webkit-app-region-no-drag shadow-inner">
         <div className="relative group">
            <select 
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as any)}
              className="appearance-none bg-transparent pl-3 pr-2 py-1 text-xs font-semibold text-macos-text hover:text-black focus:outline-none cursor-pointer text-center min-w-[60px]"
            >
              {LANGUAGES.map(lang => (
                <option key={`src-${lang.code}`} value={lang.code}>{lang.name}</option>
              ))}
            </select>
         </div>

         <button 
            onClick={handleSwap}
            disabled={sourceLang === 'auto'}
            className="p-1 text-macos-muted hover:text-macos-active transition-colors disabled:opacity-30"
         >
           <ArrowRightLeft size={10} className={sourceLang === 'auto' ? '' : 'hover:rotate-180 transition-transform duration-300'} />
         </button>

         <div className="relative group">
            <select 
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as any)}
              className="appearance-none bg-transparent pl-2 pr-3 py-1 text-xs font-semibold text-macos-text hover:text-black focus:outline-none cursor-pointer text-center min-w-[60px]"
            >
              {LANGUAGES.filter(l => l.code !== 'auto').map(lang => (
                <option key={`tgt-${lang.code}`} value={lang.code}>{lang.name}</option>
              ))}
            </select>
         </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 -webkit-app-region-no-drag">
        <button
          onClick={toggleAutoTranslate}
          className={`p-1.5 rounded-md transition-all ${
            autoTranslate 
              ? 'text-macos-active bg-orange-100' 
              : 'text-macos-muted hover:text-macos-text'
          }`}
          title={autoTranslate ? "Auto-Translate On" : "Auto-Translate Off"}
        >
          <Zap size={16} fill={autoTranslate ? "currentColor" : "none"} />
        </button>

        <button 
          onClick={onOpenSettings}
          className="text-macos-muted hover:text-macos-text transition-colors duration-200"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
};