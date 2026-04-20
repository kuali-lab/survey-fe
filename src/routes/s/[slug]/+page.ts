import type { PageLoad } from './$types.js'
import { fetchSurvey } from '$lib/api.js'
import type { Survey } from '$lib/types.js'

export const load: PageLoad = async ({ params, fetch }) => {
  const { slug } = params

  try {
    const survey = await fetchSurvey(slug, fetch)
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
