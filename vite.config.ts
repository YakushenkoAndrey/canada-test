import { defineConfig } from 'vite';

// base must equal the GitHub repository name, otherwise styles and images
// do not load on https://<user>.github.io/canada-test/
export default defineConfig({
  base: '/canada-test/',
  // Brochure text for both languages is bundled (~1 MB, ~250 KB gzipped): raise the warning limit.
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
});
