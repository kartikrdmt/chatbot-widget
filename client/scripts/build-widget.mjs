// Builds public/widget.js: the React chat UI plus its Tailwind CSS in one self-contained file.
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

execFileSync(
  'npx',
  ['@tailwindcss/cli', '-i', 'widget/widget.css', '-o', 'widget/widget.generated.txt', '--minify'],
  { stdio: 'inherit' },
);

const options = {
  entryPoints: ['widget/entry.tsx'],
  outfile: 'public/widget.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  jsx: 'automatic',
  tsconfig: 'tsconfig.json',
  loader: { '.txt': 'text' },
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_CHAT_TRANSPORT': JSON.stringify(
      process.env.NEXT_PUBLIC_CHAT_TRANSPORT ?? 'socket',
    ),
  },
  logLevel: 'info',
};

if (watch) {
  const { context } = await import('esbuild');
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
