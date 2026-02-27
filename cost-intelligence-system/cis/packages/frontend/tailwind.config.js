/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#EBF5FB', 100: '#D4E6F1', 200: '#85C1E9', 300: '#5DADE2', 400: '#3498DB', 500: '#1A5276', 600: '#154360', 700: '#1B4F72', 800: '#1A3C5E', 900: '#0E2A43' },
      },
    },
  },
  plugins: [],
};
