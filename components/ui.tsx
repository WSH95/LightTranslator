/**
 * Shared UI primitives for the Ubuntu/Yaru design.
 *
 * Only patterns that remove real duplication live here. The plain repeated
 * styling (.icon-btn, .btn, .pill, .card, .list, .win-ctrl, .field) is CSS in
 * index.css, because a component wrapping a single className is pure
 * indirection.
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronUp, Minus, Square, X } from 'lucide-react';
import { platform } from '../src/lib/platform';
import type { Language, LanguageCode } from '../types';

/* ------------------------------------------------------------------ */
/* Window controls                                                     */
/* ------------------------------------------------------------------ */

const withPlatform = (action: () => void) => () => {
  if (platform.isAvailable()) {
    action();
    return;
  }
  console.warn('Platform API not available; window control ignored.');
};

/**
 * GNOME order: minimise, maximise, close. `close` hides to the tray — that is
 * the backend's CloseRequested behaviour, not a bug.
 */
export const WindowControls: React.FC = () => (
  <div className="flex items-center gap-3 ml-2 shrink-0 -webkit-app-region-no-drag">
    <button type="button" className="win-ctrl" title="Minimize" aria-label="Minimize"
            onClick={withPlatform(() => platform.minimize())}>
      <Minus size={14} />
    </button>
    <button type="button" className="win-ctrl" title="Maximize" aria-label="Maximize"
            onClick={withPlatform(() => platform.maximize())}>
      <Square size={11} />
    </button>
    <button type="button" className="win-ctrl" title="Close" aria-label="Close"
            onClick={withPlatform(() => platform.close())}>
      <X size={14} />
    </button>
  </div>
);

/* ------------------------------------------------------------------ */
/* Language pill + popover                                             */
/* ------------------------------------------------------------------ */

const MENU_WIDTH = 220;
const MENU_GAP = 9; // matches the design's pill bottom 37 -> menu top 46
const VIEWPORT_MARGIN = 8;

interface LanguagePillProps {
  value: LanguageCode;
  options: Language[];
  onChange: (code: LanguageCode) => void;
  /** Lets the quick window grow itself while the menu is open. */
  onOpenChange?: (open: boolean) => void;
  /** Which pill edge the menu lines up with. */
  align?: 'left' | 'right';
  disabled?: boolean;
  title?: string;
}

/**
 * Replaces a native <select>, so it has to be keyboard-equivalent: the button
 * keeps focus and drives the list through aria-activedescendant.
 *
 * The menu is portalled to <body> because every container it would otherwise
 * sit in clips it — the translator panes and the settings boxed lists are
 * overflow:hidden, and the settings column scrolls.
 */
export const LanguagePill: React.FC<LanguagePillProps> = ({
  value, options, onChange, onOpenChange, align = 'left', disabled, title,
}) => {
  const [open, setOpen] = useState(false);
  // activeIndex is mirrored in a ref because Enter has to read the value the
  // arrow keys just wrote. Keydowns can land in one batch (key repeat), so the
  // closure's copy is stale, and putting the commit inside a state updater
  // would fire it twice under StrictMode.
  const [activeIndex, setActiveIndexState] = useState(0);
  const activeIndexRef = useRef(0);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const setActiveIndex = useCallback((next: number | ((current: number) => number)) => {
    const value = typeof next === 'function' ? next(activeIndexRef.current) : next;
    activeIndexRef.current = value;
    setActiveIndexState(value);
  }, []);

  const pillRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, options.findIndex((option) => option.code === value));
  const currentName = options[selectedIndex]?.name ?? value;

  const setOpenState = useCallback((next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);

  const updatePosition = useCallback(() => {
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + MENU_GAP;
    const rawLeft = align === 'right' ? rect.right - MENU_WIDTH : rect.left;
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN);
    setPosition({
      top,
      left: Math.min(Math.max(rawLeft, VIEWPORT_MARGIN), maxLeft),
      // Never flips above: the quick window is still at its collapsed height
      // when the menu opens and only grows a beat later, so a flip would land
      // the menu off-screen. It scrolls instead, and the resize listener below
      // re-measures once the window has grown.
      maxHeight: Math.max(96, window.innerHeight - top - VIEWPORT_MARGIN),
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const reposition = () => updatePosition();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (pillRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpenState(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    // Capture: an inner scroll container (the settings column) never bubbles
    // a scroll event to window.
    document.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, updatePosition, setOpenState]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const commit = (index: number) => {
    const option = options[index];
    setOpenState(false);
    if (option && option.code !== value) onChange(option.code);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setActiveIndex(selectedIndex);
        setOpenState(true);
      }
      return;
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setOpenState(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeIndexRef.current);
        break;
      default:
        break;
    }
  };

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className="pill -webkit-app-region-no-drag"
        data-open={open}
        disabled={disabled}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => {
          if (!open) setActiveIndex(selectedIndex);
          setOpenState(!open);
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="truncate">{currentName}</span>
        <Chevron size={14} className="text-muted shrink-0" />
      </button>

      {open && position && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={title ?? 'Language'}
          className="menu fixed z-50 overflow-y-auto"
          style={{ top: position.top, left: position.left, width: MENU_WIDTH, maxHeight: position.maxHeight }}
        >
          {options.map((option, index) => (
            <div
              key={option.code}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={option.code === value}
              className="menu-item cursor-pointer"
              style={index === activeIndex ? { background: 'var(--hover-bg)' } : undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(index)}
            >
              <span className="truncate">{option.name}</span>
              {option.code === value && <Check size={14} className="text-accent shrink-0" />}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};
