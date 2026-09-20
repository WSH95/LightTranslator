# Handoff: LightTranslator — Ubuntu / Yaru UI refresh

## Overview
Restyle the LightTranslator UI (Tauri + React + Tailwind, repo `WSH95/LightTranslator`, branch `main`) from its current macOS-glass look to a modern Ubuntu 24.04 / libadwaita look: header bar with window controls on the right, flat surfaces, Ubuntu font, 12px radii, boxed lists, a neutral grey palette with a single accent (Yaru "Viridian" by default), light + dark themes, and a new Appearance settings tab. Also restyles the Quick Translate pop-up and the app icon.

## About the Design Files
`Ubuntu Redesign.dc.html` is a **design reference built in HTML** — it shows intended look and behavior; it is not production code. Recreate it inside the existing codebase (React 19, Tailwind 3, lucide-react, zustand) using its patterns. `Current UI.dc.html` is a faithful recreation of the current app, included only for before/after comparison.

The approved direction is option **2a** (main window, Settings, OCR dialog), plus **3a** (pop-up) and **3b** (app icon). Options 1a/1b/1c are earlier explorations — ignore them.

## Fidelity
**High-fidelity.** Recreate pixel-perfectly: measurements, colors and type below are final.

## Global changes
- Remove the pink→cyan gradient on `#root`, the glass/blur cards, `shadow-macos-*`, the `macos.*` Tailwind palette and the traffic-light markup in `TitleBar.tsx`.
- Font: `Ubuntu, Cantarell, 'Segoe UI', sans-serif` (Ubuntu is installed on Ubuntu; ship it as a fallback webfont if desired).
- Window: `border-radius: 12px` on all four corners (0 when maximized, keep existing `data-window-maximized` logic). Window background = `bg`.
- Header bar (`TitleBar.tsx`): height 47px, same color as window bg, **no bottom border**, padding `0 10px 0 14px`, `gap: 6px`. Left: app title "LightTranslator" 15px/700. Right, in order: Auto-translate toggle, Settings icon button, then window controls.
- Window controls (right side, GNOME order): minimize, maximize, close. Each a 24px circle, bg `ctrlBg`, icon 14px (`minus`, `square` at 11px, `x`), `gap: 12px`, `margin-left: 8px`. Hover: darken bg ~ +6% alpha. Close button on hover may use accent bg + white icon (optional).
- Icon buttons: 34×34, radius 8, flat; hover bg `hoverBg`. Icons lucide 16px.
- Text/pill buttons: height 34, radius 8, padding 0 16px, 14px/500. Flat = bg `ctrlBg`; suggested-action = bg `accent`, white text; disabled = opacity .5.
- Language chooser pill: height 30, radius 15, padding `0 8px 0 12px`, bg `pillBg`, 13px/500, trailing `chevron-down` 14px in `muted`.
- Cards / boxed lists: bg `card`, `1px solid cardBorder`, radius 12, rows padded `12px 16px`, row separators `1px solid rowSep`.
- Switch: 44×26, radius 13, knob 20px white with `0 1px 2px rgba(0,0,0,.25)`; on = `accent`, off = `switchOff`.
- Radio: 20px circle; unselected `2px solid #9a9a9a`; selected filled `accent` with white `check` icon 13px.
- Remove colored icon accents in Settings (purple/indigo/blue/green icons). Icons are `text` color or `muted`.

## Design tokens

Light
- `bg` #fafafa (window + header)
- `card` #ffffff, `cardBorder` rgba(0,0,0,.10), `rowSep` rgba(0,0,0,.08)
- `text` #2e2e2e, `muted` #6f6f6f, `placeholder` #8c8c8c
- `ctrlBg` rgba(0,0,0,.08), `pillBg` rgba(0,0,0,.06), `hoverBg` rgba(0,0,0,.06), `viewSwitcherActive` rgba(0,0,0,.10), `switchOff` rgba(0,0,0,.15)
- `accent` #03875B, `accentTint` rgba(3,135,91,.12)

Dark
- `bg` #242424
- `card` #303030, `cardBorder` rgba(255,255,255,.06), `rowSep` rgba(255,255,255,.08)
- `text` #ffffff, `muted` #b8b8b8, `placeholder` #8c8c8c
- `ctrlBg` rgba(255,255,255,.12), `pillBg` rgba(255,255,255,.10), `hoverBg` rgba(255,255,255,.08), `viewSwitcherActive` rgba(255,255,255,.12), `switchOff` rgba(255,255,255,.18)
- `accent` #3dc78f (lightened viridian for contrast), `accentTint` rgba(61,199,143,.16)

Yaru accent choices (Appearance tab): Orange #E95420, Bark #787859, Sage #657B69, Olive #4B8501, Viridian #03875B (default), Prussian Green #308280, Blue #0073E5, Purple #7764D8, Magenta #B34CB3, Red #DA3450. For dark theme, lighten the chosen accent so text on `bg` reaches 4.5:1.

Type scale: 16px translation text (line-height 1.5), 15px/700 titles, 14px body, 13px controls, 12px captions, 11px pop-up footer.
Radii: 12 (window, cards, dialogs), 8 (buttons), 15 (pills), 50% (window controls).
Spacing: 12px window content padding, 12px gap between panes, 16px card padding, 28px between settings groups.

## Screens

### Main window (2a) — 760×520 default
Replaces `TranslatorView.tsx` stacked cards with two side-by-side panes. Body: `display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:4px 12px 12px; position:relative`.
- Header: title left; right cluster = Auto-translate pill (height 34, radius 8, padding `0 12px 0 10px`, `zap` 15px + "Auto", 14px/500; ON = `accentTint` bg + `accent` text; OFF = transparent + `text`), Settings icon button, window controls.
- Source pane (card): top row 48px, padding `0 8px 0 10px`, space-between: source-language pill ("Auto Detect") left; right: OCR (`scan-text`) and Paste-and-translate (`clipboard-list`) icon buttons 32×32 (always visible — no hover-only floating buttons). Textarea below, padding `6px 16px 16px`, 16px/1.5, placeholder "Enter text..." in `placeholder`. Clear (`x`) button appears in the row when text is present.
- Target pane (card): top row with target-language pill ("Chinese (Simplified)") and Copy (`copy`) icon button. Output text 16px/1.5 with `lang={targetLang}`; placeholder "Translation will appear here...". Bottom-left status caption inside the pane: 7px dot in `accent` + "Ready · Google Translate" 12px `muted`, padding `0 16px 12px`. The old 32px footer bar and version string are removed (version moves to Settings › General › About).
- Swap button: 28px circle absolutely centered in the gap at `top:32px` (`left:50%; translateX(-50%)`), bg `card`, `1px solid rgba(0,0,0,.12)`, shadow `0 1px 3px rgba(0,0,0,.12)`, `arrow-right-left` 13px in `muted`. Disabled (opacity .3) when source is Auto Detect.
- Loading: replace the floating spinner with `loader-circle` 16px in `accent` next to the status caption ("Translating…").
- Error: text in the target pane, 14px, color #DA3450 (light) / #ff7b8a (dark), no red box.
- Drag region: header bar (`data-tauri-drag-region`), excluding buttons.

### Settings (2a) — 760×600, replaces the modal
Settings is a full-window view (not a modal over a dimmed translator). `App.tsx` swaps `TranslatorView` for `SettingsView`; resize window to 760×600 as today.
- Header: Back icon button (`arrow-left`) left; centered **view switcher**: 4 buttons, height 34, radius 8, padding 0 14px, 13px, icon 15px + label, `gap:2px` between buttons; active = bg `viewSwitcherActive`, weight 500. Tabs: Translation (`languages`), Pop-up (`mouse-pointer-2`), General (`sliders-horizontal`), Appearance (`palette`). Window controls right.
- Content: centered column 560px wide, padding-top 20px, groups spaced 28px, scrollable.
- Group = title 15px/700 + boxed list + optional 12px `muted` description with 4px horizontal padding.

Translation tab
- "Provider" list: 4 rows (radio left 20px, `gap:14px`; name 14px; description 12px `muted` 2px below). Selected row shows a badge right: "No key needed" (Google only) 12px/500 `accent` on `accentTint`, padding 3px 8px, radius 10. Description below list: "Uses two no-key Google web endpoints with automatic fallback. No key configuration is needed, but availability is not guaranteed." (varies by provider; existing copy).
- Provider-specific fields (OpenAI base URL / API key / model / presets, DeepL key, Microsoft key + region) become rows in a second boxed list: label 14px left, input right-aligned (adwaita entry-row style), inputs radius 8, `1px solid cardBorder`. Presets as pill buttons (height 30, radius 15) in one row.
- "System Prompt" group: row "Use custom prompt" with description "Only the OpenAI Compatible provider uses a system prompt." and a switch; textarea row below (14px/1.5). Whole group at opacity .5 when provider is not OpenAI-compatible.

Appearance tab (new; persist in zustand `appearanceTheme: 'system'|'light'|'dark'`, `accentColor`, `followSystemAccent`, `translationTextSize: 'small'|'medium'|'large'`)
- "Style": 3-column grid, gap 16. Each: preview 92px tall, radius 10 (System = split light/dark, Light, Dark), selected preview has `2px solid accent`; below, radio + label (System / Light / Dark) 13px.
- "Accent Color" list: row 1 — current accent name left ("Viridian"), 10 swatches right (22px circles, gap 10; selected has ring `0 0 0 2px card, 0 0 0 4px accent`). Row 2 — "Follow system accent" / "Use the accent chosen in Ubuntu Settings → Appearance" with switch (read `org.gnome.desktop.interface accent-color` via gsettings when on).
- "Text" list: row "Translation text size" with a 3-segment linked button group (Small / Medium / Large; height 30, radius 8, active = bg `viewSwitcherActive`).
- Theme "System" follows `org.gnome.desktop.interface color-scheme` (`prefers-color-scheme` in the WebView).

Pop-up and General tabs: keep existing content, restyled with the same group/list components (shortcut recorder as a row with a mono value; sliders as rows with value badge; Launch at startup as a switch row; add an "About" row with version).

### OCR dialog (2a) — 480px wide, centered over dimmed window (rgba(0,0,0,.3))
- Dialog: bg `bg`, radius 12, shadow `0 0 0 1px rgba(0,0,0,.25), 0 16px 40px rgba(0,0,0,.45)`.
- Header 47px: centered title "OCR Screenshot/Image" 15px/700; 24px circular close at right 10px.
- Body padding `6px 20px 20px`, gap 14:
  - Segmented control (bg `ctrlBg`, radius 9, padding 3, gap 3): "Screenshot Area" (`scissors`) | "Upload image" (`upload`); active segment bg `card`, radius 7, shadow `0 1px 2px rgba(0,0,0,.12)`, 13px/500.
  - Preview area 200px tall, radius 12, `1px dashed rgba(0,0,0,.25)`, subtle diagonal stripe bg; centered `scissors` 26px `muted`, "Click and drag to select region" 14px/500, mono caption "preview appears here" 12px `muted`. Shows the captured/uploaded image (`object-fit: contain`) once available, with a small circular remove button top-right. In Upload mode the area is the drop zone and shows `upload` icon + "PNG, JPG, WebP".
  - Buttons right-aligned, gap 8: "Cancel" (flat) and "Analyze & Translate" (suggested-action; disabled until an image exists).
- Missing-dependency guidance: render as a boxed list above the segmented control (icon `triangle-alert`, text 13px, command in mono with copy button, "Re-check" flat button) — no amber colors; use `text`/`muted` with the command chip on `pillBg`.

### Quick Translate pop-up (3a) — width 360, min height 80, max 500 (`QuickTranslateWindow.tsx`)
- Window: bg `bg` at `quickWindowOpacity` (rgba(250,250,250,.95) light / rgba(36,36,36,.95) dark), radius 12, shadow `0 0 0 1px rgba(0,0,0,.2), 0 14px 36px rgba(0,0,0,.4)`. The `quickWindowBorderOpacity` setting maps to the 1px ring alpha.
- Header 44px, padding 0 8px, gap 4: target-language pill (opens a popover menu); spacer; Copy (`copy`) 30×30; "Open in main window" (`app-window`) 30×30; 24px circular close with `margin-left:4px`.
- Body padding `2px 16px 14px`: translation only (no source text), 15px/1.6, `lang={quickTargetLang}`.
- Footer caption padding `0 16px 10px`: 6px `accent` dot + "Google Translate · Auto Detect" 11px `muted` (provider name · source language).
- Language menu: popover 220px wide at `left:8px; top:46px`, bg `card`, radius 12, padding 6, shadow `0 0 0 1px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.18)`; items 32px tall, radius 8, 13px; selected item bg `pillBg`, weight 500, `check` 14px in `accent` at right. Pop-up window grows to 300px tall while open (existing resize logic). Body dims to opacity .4 while open.
- Loading: header shows only the pill and close; body shows `loader-circle` 16px `accent` (spinning) + "Translating…" 14px `muted`.
- Remove the old "Powered by …" header bar and "Translate to" label bar.

### App icon (3b) — `src-tauri/icons/*`
- Base: rounded square, radius 22% of size (56px at 256), vertical gradient #14A374 → #03875B, inner highlight `inset 0 1px 0 rgba(255,255,255,.25)`, inner bottom shade `inset 0 -2px 0 rgba(0,0,0,.12)`.
- Mark (at 256): white horizontal bar `left 56, top 66, 150×30, radius 15`; white stem `left 114, top 66, 30×124, radius 15`; mint dot #B9F0D8 `left 172, top 46, 36×36`. Scale proportionally for 128/64/32; at 32 use flat #03875B and bar/stem thickness 4px.
- Tray (symbolic, 16px): same mark in a single color (white on dark panel, #2e2e2e on light), bar 14×2.5, stem 2.5×12, dot 3.5. Provide `lighttranslator-symbolic.svg` so GNOME recolors it.
- Regenerate all `src-tauri/icons/*.png`, `icon.ico`, `tray-24x24.png` and Android/iOS sets from the 1024px master.

## Interactions & behavior
- All existing behavior is preserved (auto-translate debounce, Ctrl+Enter, paste-image OCR, clipboard translate, tray, shortcut registration, settings sync across windows).
- Transitions: 150ms ease for hover/active bg; view switcher and settings tab change instant; pop-up menu 120ms fade.
- Focus: 2px `accent` outline offset 2px on keyboard focus.
- Theme switch: set `data-theme` on `<html>` (`light`/`dark`) and swap Tailwind CSS variables; accent set via a `--accent` CSS variable computed from `accentColor`.

## State (additions to `useAppStore`)
`appearanceTheme`, `accentColor`, `followSystemAccent`, `translationTextSize` — persisted via `partialize`, defaults `'system'`, `'#03875B'`, `false`, `'medium'`.

## Assets
- Icons: lucide-react (already a dependency). Names used: zap, settings, minus, square, x, chevron-down, chevron-up, arrow-right-left, arrow-left, scan-text, clipboard-list, copy, languages, mouse-pointer-2, sliders-horizontal, palette, check, scissors, upload, app-window, loader-circle, triangle-alert.
- Font: Ubuntu (system on Ubuntu; Google Fonts fallback).
- App icon: rebuild from the spec above (no external asset).

## Files
- `Ubuntu Redesign.dc.html` — design reference. Sections top to bottom: Turn 3 (3a pop-up, 3b icon), Turn 2 (2a — approved), Turn 1 (1a/1b/1c — superseded).
- `Current UI.dc.html` — recreation of the current app for comparison.
- `github.md` — source repo association and screen map.
