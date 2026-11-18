/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: { config: './tailwind.config.mts' },
    autoprefixer: {},
  },
};

export default config;
