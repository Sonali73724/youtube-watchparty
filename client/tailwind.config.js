/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Fraunces"', '"Iowan Old Style"', 'Georgia', 'serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        ink: '#1A130C',
        'ink-2': '#241A0F',
        panel: '#2A1F13',
        'panel-2': '#33240F',
        'panel-3': '#241A0F',
        paper: '#F5EBD8',
        'paper-dim': '#D3BE9A',
        'paper-faint': '#8E7A5C',
        gold: '#E7B84B',
        'gold-dim': '#A98A3F',
        'gold-deep': '#8A6D2F',
      },
    },
  },
  plugins: [],
}
