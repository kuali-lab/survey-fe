// Test stand-in for SvelteKit's `$env/dynamic/private` virtual module (aliased
// in vitest.config.ts). Mutable on purpose: specs set a key, run, and reset.
export const env: Record<string, string | undefined> = {}
