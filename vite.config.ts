import { defineConfig } from 'vite';

// base must equal the GitHub repository name, otherwise styles and images
// do not load on https://<user>.github.io/canada-test/
export default defineConfig({
  base: '/canada-test/',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
