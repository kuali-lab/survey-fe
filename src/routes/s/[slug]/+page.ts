import type { PageLoad } from './$types.js'
import { browser } from '$app/environment'
import { env as publicEnv } from '$env/dynamic/public'
import { fetchSurvey } from '$lib/api.js'
import type { Survey } from '$lib/types.js'

// During SSR, reach logika-be directly on the same host instead of looping back
// out through Cloudflare via the public API URL — removes an external round-trip
// per render. Server-side only (!browser); the browser always uses the public URL.
const SSR_API_BASE = publicEnv.PUBLIC_SSR_API_BASE_URL || 'http://localhost:8080/api/v1'

export const load: PageLoad = async ({ params, fetch }) => {
  const { slug } = params

  try {
    const survey = await fetchSurvey(slug, fetch, browser ? undefined : SSR_API_BASE)
    return { survey, slug, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    if (message === 'not_found') {
      return { survey: null as Survey | null, slug, error: 'not_found' as const }
    }
    if (message === 'survey_closed') {
      return { survey: null as Survey | null, slug, error: 'survey_closed' as const }
    }
    return { survey: null as Survey | null, slug, error: 'server_error' as const }
  }
}
