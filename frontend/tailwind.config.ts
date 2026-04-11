import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        mist: '#f3f4f6',
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8'
        },
        secondary: '#64748B',
        background: '#ffffff',
        surface: '#F8FAFC',
        border: '#E2E8F0',
        text: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#94A3B8',
          onPrimary: '#FFFFFF'
        },
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#0284C7'
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ]
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.2' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.5' }],
        lg: ['18px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.5' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['30px', { lineHeight: '1.2' }]
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px'
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px'
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0,0,0,0.1)',
        md: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }
    }
  },
  plugins: []
};

export default config;
