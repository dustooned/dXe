import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Build version, shown as a small low-key label (main.js, .dx-build-info).
// commitCount is the auto-incrementing part — "math per new version" with
// no manual bumping, since every commit on the branch increases it by one.
// package.json's version stays the human-controlled major.minor.patch;
// commitCount + commitHash are what make each build individually
// identifiable. Requires full git history to be present at build time —
// .github/workflows/deploy.yml's checkout step sets fetch-depth: 0 for
// exactly this reason; a shallow clone would make commitCount always 1.
function git(cmd, fallback) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_NUMBER__: JSON.stringify(git('git rev-list --count HEAD', '0')),
    __COMMIT_HASH__: JSON.stringify(git('git rev-parse --short HEAD', 'dev')),
  },
});
