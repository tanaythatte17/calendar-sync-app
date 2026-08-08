/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ucv: {
          primary: '#5B6E3A',
          'primary-hover': '#47562D',
          'primary-light': '#F0F2E6',
          green: '#5F8B4C',
          'green-light': '#EEF3E4',
          brown: '#9C6B45',
          'brown-light': '#F3EEE3',
          gold: '#B8923E',
          terracotta: '#B08A72',
          danger: '#A94442',
          'danger-hover': '#8A3730',
          'danger-light': '#F5EDEC',
          'danger-border': '#DCC0BE',
          warning: '#9C7A2E',
          'warning-light': '#F6F1E4',
          bg: '#FFFFFF',
          surface: '#F7F6F1',
          'surface-alt': '#F7F6F2',
          border: '#E4E1D8',
          'border-light': '#F0EFE8',
          text: '#292524',
          'text-secondary': '#44403C',
          'text-muted': '#78716C',
          'text-faint': '#A8A29E',
          'text-disabled': '#D6D3CB',
        },
      },
    },
  },
  plugins: [],
} 