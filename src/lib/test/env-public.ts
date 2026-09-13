// Test stand-in for SvelteKit's `$env/static/public` and `$env/dynamic/public`
// virtual modules (aliased in vitest.config.ts). Never imported by app code.
export const PUBLIC_API_BASE_URL = 'http://test.local/api/v1'
export const env: Record<string, string | undefined> = { PUBLIC_USE_MOCK: '0' }
