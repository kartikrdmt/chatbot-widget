import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  // Dual output: `.js` (CJS) for NestJS, `.mjs` (ESM) for Next.js and tsx.
  format: ['cjs', 'esm'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.js' : '.mjs' }),
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // Consumers bring their own zod; bundling it would break `instanceof` checks.
  external: ['zod'],
});
