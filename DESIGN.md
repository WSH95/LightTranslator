# LightTranslator design context

## Product and reference

A desktop translation utility for short, frequent tasks. Preserve the accepted
Ubuntu/Yaru appearance from `design_handoff_ubuntu_refresh/README.md` and
`Ubuntu Redesign.dc.html`; decisions 0018–0023 describe its adoption. The
interface is English; translated content can use any supported language.
This is a global translation tool, not a Japan-specific business workflow.

## Runtime owners

`index.css` owns light/dark surfaces, semantic text, accent, border, scrollbar,
focus, radius and button rules. `src/lib/theme.ts` applies system/user theme
and accent preferences; Tailwind maps utilities onto these tokens. Typography
uses Ubuntu, Cantarell, Segoe UI and system fallbacks. Translation size uses
the existing small/medium/large tokens. No generated token copy is maintained.

Shared `LanguagePill` and its popup in `components/ui.tsx` own language menus,
including their keyboard/focus behavior and non-draggable Electron regions.
Existing `icon-btn`, `win-ctrl`, visible focus rings and Lucide icons own window
actions. Inline status text communicates operation failures; no global toast
or form system is introduced for the popup.

## Quick Translate

The popup remains frameless, rounded, translucent and automatically sized to
its content, with scrollable long translations. The header stays 44px high;
compact actions use existing 30px icon buttons. Keep provider/source metadata
in the footer. Translation errors and Move errors must preserve the content.

Move is a temporary native mode, not a translation setting. Its button is
always available, including during translation. Pressed state uses the current
accent tint and an inset outline plus `aria-pressed`; pending state disables
duplicate submissions without changing button dimensions. Blank header space
has a 24px minimum drag target. Controls, menus and text remain interactive.
At the smallest width cap, the language pill truncates its label to leave all
window controls and the drag area accessible.
Native confirmation enables the drag region. Move keeps the popup above ordinary app windows and suppresses click-away
closure until disabled; focused Escape, Close and Open in main remain explicit
closure actions. Each new opening resets the mode. The existing automatic
popup sizing is intentional, including width changes when content changes.

Offscreen size measurements reserve the renderer's scrollbar space using
clones of the actual scroll container and its padded content. The visible
container still shows a scrollbar only when needed, and short results must
display the complete final line above the footer.
