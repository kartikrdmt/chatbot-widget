import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

try {
  process.loadEnvFile('.env.local');
} catch {}

const LOADER_BUDGET_GZIP = 16 * 1024;

const { widgetVersion: version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('package.json needs a "widgetVersion" such as "1.0.0".');
}
const major = version.split('.')[0];

const work = '.widget-build';
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

execFileSync(
  'npx',
  ['@tailwindcss/cli', '-i', 'widget/widget.css', '-o', 'widget/chat.generated.txt', '--minify'],
  { stdio: 'inherit' },
);

const common = {
  bundle: true,
  minify: true,
  target: 'es2020',
  jsx: 'automatic',
  tsconfig: 'tsconfig.json',
  loader: { '.txt': 'text' },
  legalComments: 'none',
  logLevel: 'warning',
};

const define = {
  'process.env.NODE_ENV': '"production"',
  'process.env.NEXT_PUBLIC_CHAT_TRANSPORT': JSON.stringify(
    process.env.NEXT_PUBLIC_CHAT_TRANSPORT ?? 'socket',
  ),
  'process.env.WIDGET_DEFAULT_API_URL': JSON.stringify(
    process.env.WIDGET_DEFAULT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '',
  ),
};

const chatResult = await build({
  ...common,
  entryPoints: ['widget/chat-entry.tsx'],
  outdir: work,
  entryNames: 'chat.[hash]',
  format: 'esm',
  metafile: true,
  define,
});
const chatFile = Object.keys(chatResult.metafile.outputs)
  .map((path) => path.split('/').pop())
  .find((name) => name?.startsWith('chat.') && name.endsWith('.js'));
if (!chatFile) throw new Error('The chat bundle was not produced.');

await build({
  ...common,
  entryPoints: ['widget/loader.ts'],
  outfile: `${work}/widget.js`,
  format: 'iife',
  define: { ...define, __MYRA_CHAT_PATH__: JSON.stringify(`/v${version}/${chatFile}`) },
});

const sri = (file) => `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
const versionDir = `public/v${version}`;
rmSync(versionDir, { recursive: true, force: true });
mkdirSync(versionDir, { recursive: true });
copyFileSync(`${work}/widget.js`, `${versionDir}/widget.js`);
copyFileSync(`${work}/${chatFile}`, `${versionDir}/${chatFile}`);
writeFileSync(
  `${versionDir}/integrity.json`,
  `${JSON.stringify({ version, 'widget.js': sri(`${versionDir}/widget.js`), [chatFile]: sri(`${versionDir}/${chatFile}`) }, null, 2)}\n`,
);

mkdirSync(`public/v${major}`, { recursive: true });
copyFileSync(`${work}/widget.js`, `public/v${major}/widget.js`);
copyFileSync(`${work}/widget.js`, 'public/widget.js');
rmSync(work, { recursive: true, force: true });

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const loader = readFileSync(`${versionDir}/widget.js`);
const chat = readFileSync(`${versionDir}/${chatFile}`);
const loaderGzip = gzipSync(loader).length;
console.log(`widget v${version}`);
console.log(
  `  widget.js (loader)  ${kb(loader.length)}  ${kb(loaderGzip)} gzipped  <- every page load`,
);
console.log(
  `  ${chatFile}  ${kb(chat.length)}  ${kb(gzipSync(chat).length)} gzipped  <- on first open`,
);
console.log(`  SRI  ${sri(`${versionDir}/widget.js`)}`);
if (loaderGzip > LOADER_BUDGET_GZIP) {
  console.error(
    `\nThe loader is ${kb(loaderGzip)} gzipped; the budget is ${kb(LOADER_BUDGET_GZIP)}.`,
  );
  process.exit(1);
}
