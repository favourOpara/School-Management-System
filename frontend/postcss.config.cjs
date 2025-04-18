module.exports = {
  plugins: [
    require('@tailwindcss/postcss')({
      config: './tailwind.config.cjs', // or .js if using ESM
    }),
  ],
};
