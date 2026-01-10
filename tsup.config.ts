import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  external: [
    '@supabase/supabase-js',
    'better-sqlite3',
    'openai',
    'uuid',
    '@opencode-ai/plugin',
    'zod',
  ],
  // ESM/CJS interop
  esbuildOptions(options) {
    options.mainFields = ['module', 'main'];
  },
});
