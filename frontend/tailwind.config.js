/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* Every size bumped up ~2px from before */
      fontSize: {
        xs:    ['13px', { lineHeight: '1.5'  }],
        sm:    ['15px', { lineHeight: '1.55' }],
        base:  ['17px', { lineHeight: '1.65' }],
        lg:    ['19px', { lineHeight: '1.5'  }],
        xl:    ['21px', { lineHeight: '1.45' }],
        '2xl': ['25px', { lineHeight: '1.35' }],
        '3xl': ['31px', { lineHeight: '1.25' }],
        '4xl': ['38px', { lineHeight: '1.15' }],
      },
      colors: {
        cream: '#FAF8F5',
        evergreen: {
          50:  '#edf6f1',
          100: '#d0eadc',
          500: '#2d7a56',
          700: '#1F5C45',
          900: '#143d2e',
        },
        gold: {
          300: '#e8c97a',
          500: '#C9A24B',
          700: '#a07d2e',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
