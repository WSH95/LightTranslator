/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      },
      colors: {
        // BetterDisplay Inspired Palette
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
        }
      },
      boxShadow: {
        'macos-window': '0 24px 60px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.2) inset',
        'macos-card': '0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(255,255,255,0.5) inset',
        'macos-switch': '0 1px 2px rgba(0,0,0,0.1)',
      },
      backdropBlur: {
        'xs': '2px',
        '3xl': '50px',
      }
    }
  },
  plugins: [],
}
