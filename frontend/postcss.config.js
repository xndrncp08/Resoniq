/** Tailwind v4 uses a dedicated PostCSS package instead of the tailwindcss package directly. */
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};