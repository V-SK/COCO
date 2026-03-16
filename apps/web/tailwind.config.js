/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
    },
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-slow': 'pulse 2s infinite',
        'bounce-subtle': 'bounceSubtle 0.3s ease-out',
        'toast-in': 'toastIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
        },
        toastIn: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      colors: {
        primary: {
          DEFAULT: '#F0B90B',
          hover: '#FFD43B',
          dark: '#C99A00',
        },
        background: {
          DEFAULT: '#0D1321',
          secondary: '#1A2332',
          tertiary: '#243042',
        },
        surface: {
          DEFAULT: '#1E2A3A',
          hover: '#2A3A4D',
        },
        border: {
          DEFAULT: '#2D3748',
          light: '#4A5568',
        },
        success: '#00E676',
        error: '#FF5252',
        warning: '#FFB300',
      },
    },
  },
  plugins: [],
};
