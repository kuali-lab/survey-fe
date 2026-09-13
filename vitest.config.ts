// The SvelteKit plugin does not apply its `$lib` / `$env/*` aliases under
// vitest, so specs that import the runner or api.ts could not resolve without
// the aliases below. The svelte plugin compiles the runes in `*.svelte.ts`
// modules (SurveyRunner). `vite.config.ts` (dev/build) is untouched.
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [svelte({ configFile: false, compilerOptions: { runes: true } })],
  resolve: {
    alias: {
      $lib: here('./src/lib'),
      '$env/static/public': here('./src/lib/test/env-public.ts'),
      '$env/dynamic/public': here('./src/lib/test/env-public.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'build/**'],
  },
})
