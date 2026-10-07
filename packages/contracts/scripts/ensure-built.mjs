import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const newest = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((latest, entry) => {
    const path = join(dir, entry.name);
    return Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
  }, 0);

const built = join(root, 'dist', 'index.mjs');
if (!existsSync(built) || statSync(built).mtimeMs < newest(join(root, 'src'))) {
  if (!existsSync(join(root, 'node_modules'))) {
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
  }
  execFileSync('npx', ['tsup'], { cwd: root, stdio: 'inherit' });
}
