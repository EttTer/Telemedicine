import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand — trust blue
        primary: {
          50: '#EFF6FB',
          100: '#D6E9F5',
          200: '#ADD3EB',
          300: '#84BCE1',
          400: '#4E9FD0',
          500: '#1D6FA4',
          600: '#1A6293',
          700: '#154F78',
          800: '#103C5C',
          900: '#0B2940',
        },
        // Accent — teal (used sparingly)
        accent: {
          50: '#EDFAF7',
          100: '#C9F1E9',
          200: '#93E3D3',
          300: '#5DD5BD',
          400: '#3ABFA0',
          500: '#2EA88C',
          600: '#228F76',
          700: '#18735F',
          800: '#0E5848',
          900: '#073D32',
        },
        // Neutral grays — cool blue tinted
        neutral: {
          50: '#F0F4F8',
          100: '#E2EAF0',
          200: '#C5D5E1',
          300: '#A8C0D2',
          400: '#8AABBE',
          500: '#6D96AB',
          600: '#5F7A8A',
          700: '#4A5F6E',
          800: '#344452',
          900: '#1A2B3C',
        },
        // Semantic
        danger: {
          50: '#FEF2F2',
          500: '#C0392B',
          600: '#A93226',
        },
        warning: {
          50: '#FFFBEB',
          500: '#D97706',
        },
        success: {
          50: '#F0FDF4',
          500: '#16A34A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(26,43,60,0.08), 0 1px 2px -1px rgba(26,43,60,0.06)',
        'card-hover': '0 4px 12px 0 rgba(26,43,60,0.12), 0 2px 4px -1px rgba(26,43,60,0.08)',
        modal: '0 20px 60px 0 rgba(26,43,60,0.18)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
