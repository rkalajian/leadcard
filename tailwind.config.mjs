/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      // Every token below resolves to a CSS custom property that BaseLayout
      // writes at build time from `src/content/settings/site.yml`. Editors can
      // therefore restyle the site from the CMS with no code changes.
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-text)',
        muted: 'var(--color-muted)',
        primary: 'var(--color-primary)',
        'primary-ink': 'var(--color-primary-text)',
        accent: 'var(--color-accent)',
        hairline: 'var(--color-hairline)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
      maxWidth: {
        card: '32rem',
      },
      transitionTimingFunction: {
        panel: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
