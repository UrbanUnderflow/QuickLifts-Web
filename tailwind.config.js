module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'media', // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        lime: {
          DEFAULT: '#C5FF00',
        },
        orange: {
          pulse: '#FF6B35',
        },
        black: {
          DEFAULT: '#000000',
          pulse: '#080808',
        },
        surface: {
          1: '#111111',
          2: '#181818',
          3: '#222222',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        avenir: ['Avenir', 'sans-serif'],
      },
      backdropBlur: {
        glass: '12px',
      },
      keyframes: {
        orbIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeDown: {
          '0%': {
            opacity: '0',
            transform: 'translateY(-6px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(12px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        photoZoom: {
          '0%': {
            transform: 'scale(1.06)',
          },
          '100%': {
            transform: 'scale(1)',
          },
        },
        liveDotPulse: {
          '0%, 100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '0.4',
            transform: 'scale(0.65)',
          },
        },
        tickerMove: {
          '0%': {
            transform: 'translateX(0)',
          },
          '100%': {
            transform: 'translateX(-50%)',
          },
        },
        scrollCue: {
          '0%, 100%': {
            opacity: '0.3',
            transform: 'translateY(0)',
          },
          '50%': {
            opacity: '0.7',
            transform: 'translateY(5px)',
          },
        },
      },
      animation: {
        'orb-in': 'orbIn 0.9s ease-out both',
        'fade-down': 'fadeDown 0.55s ease-out both',
        'fade-up': 'fadeUp 0.65s ease-out both',
        'photo-zoom': 'photoZoom 14s ease-out both',
        'live-dot-pulse': 'liveDotPulse 1.6s ease-in-out infinite',
        'ticker-move': 'tickerMove 20s linear infinite',
        'scroll-cue': 'scrollCue 2s ease-in-out 1.5s infinite',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}

