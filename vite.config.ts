import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** After the build, write dist/sw.js with the list of every built file, so the whole site works offline. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'discover-canada-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const list = ['./', ...files.filter((f) => f !== 'sw.js').sort()];
      const hash = createHash('sha256');
      for (const f of files) if (f !== 'sw.js') hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const tpl = readFileSync('pwa/sw.js', 'utf8');
      writeFileSync(join(outDir, 'sw.js'), tpl.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(list)));
    },
  };
}

// base must equal the GitHub repository name, otherwise styles and images
// do not load on https://<user>.github.io/canada-test/
export default defineConfig({
  base: '/canada-test/',
  plugins: [serviceWorker()],
  // Brochure text for both languages is bundled (~1 MB, ~250 KB gzipped): raise the warning limit.
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
});
