/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // Bare-root files: App.tsx, index.tsx, constants.ts, types.ts. The old
    // globs missed constants/types/utils, which is a landmine the moment a
    // class string moves into one of them.
    "./*.{js,ts,jsx,tsx}",
    "./{components,src,store,hooks,services,utils}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Ubuntu', 'Cantarell', 'Segoe UI', 'sans-serif'],
        mono: ['Ubuntu Mono', 'monospace'],
      },
      colors: {
        // --- Ubuntu / Yaru design tokens (see index.css) ---
        //
        // `bg` and `accent` are channel triplets so Tailwind can apply an
        // alpha modifier; everything else carries its alpha baked in and is
        // therefore TERMINAL: `bg-ctrl/50` compiles and silently renders at
        // full alpha, because Tailwind drops the modifier on a colour that
        // already has one. If you need a second alpha, add another token.
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',

        accentFg: 'var(--accent-fg)',
        tint: 'var(--accent-tint)',
        card: 'var(--card)',
        cardBorder: 'var(--card-border)',
        sep: 'var(--row-sep)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        placeholder: 'var(--placeholder)',
        ctrl: 'var(--ctrl-bg)',
        ctrlHover: 'var(--ctrl-bg-hover)',
        pill: 'var(--pill-bg)',
        pillActive: 'var(--pill-bg-active)',
        hover: 'var(--hover-bg)',
        switcher: 'var(--switcher-active)',
        seg: 'var(--seg-active)',
        segBorder: 'var(--seg-border)',
        switchOff: 'var(--switch-off)',
        knob: 'var(--knob)',
        radioBorder: 'var(--radio-border)',
        windowRing: 'var(--window-ring)',
        danger: 'var(--danger)',

        // --- legacy macOS skin, deleted once every screen is migrated ---
        macos: {
          glass: 'rgba(245, 245, 245, 0.45)',
          glassBorder: 'rgba(255, 255, 255, 0.4)',
          sidebar: 'rgba(230, 230, 230, 0.3)',
          active: '#FF9F0A',
          activeText: '#FFFFFF',
          text: '#1d1d1f',
          muted: '#86868b',
          card: 'rgba(255, 255, 255, 0.5)',
          cardBorder: 'rgba(255, 255, 255, 0.6)',
          input: 'rgba(0, 0, 0, 0.05)',
        },
      },
      boxShadow: {
        'macos-window': '0 24px 60px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.2) inset',
        'macos-card': '0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(255,255,255,0.5) inset',
        'macos-switch': '0 1px 2px rgba(0,0,0,0.1)',
      },
      backdropBlur: {
        'xs': '2px',
        '3xl': '50px',
      },
    },
  },
  plugins: [],
}
