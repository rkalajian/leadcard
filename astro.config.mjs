// @ts-check
import { defineConfig } from 'astro/config';

// Static site generation only. Netlify serves `dist/` as plain files, which is
// what makes Netlify Forms detection (build-time HTML scraping) work.
export default defineConfig({
  output: 'static',
  build: {
    format: 'directory',
  },
  compressHTML: false,
  devToolbar: {
    enabled: false,
  },
});
