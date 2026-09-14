/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const SW_TEMPLATE = fileURLToPath(new URL('./src/sw/sw-template.js', import.meta.url));
// Host config files and the worker itself are never precached.
const NEVER_PRECACHE = new Set(['sw.js', '_headers', '_redirects']);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Writes dist/sw.js after every build: a hand-written service worker (src/sw/sw-template.js)
 * plus a content hash and the list of built files to precache. No Workbox, no runtime deps.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'starter-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((file) => relative(outDir, file).split(sep).join('/'))
        .filter((file) => !NEVER_PRECACHE.has(file) && !file.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      // index.html is cached under the scope root so navigations never hit a redirect.
      const precache = files.map((file) => (file === 'index.html' ? './' : file));
      const source = readFileSync(SW_TEMPLATE, 'utf8')
        .replace('__VERSION__', () => hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', () => JSON.stringify(precache));
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  build: {
    sourcemap: false,
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
