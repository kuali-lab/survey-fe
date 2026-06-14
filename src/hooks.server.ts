import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')

  // Edge-cache the survey render: the SSR HTML is identical for every respondent
  // of a survey (per-session state — draft/submit — is client-side API calls,
  // never in this HTML). Browser revalidates (max-age=0); Cloudflare caches the
  // shared copy for s-maxage. logika-be purges this URL on EVERY render-affecting
  // edit (survey settings/status, questions, options, skip rules) with retries,
  // so freshness is guaranteed by the purge — the s-maxage is only a fallback if a
  // purge ever fails entirely. THIS IS THE SINGLE SOURCE OF THE EDGE TTL (the CF
  // Cache Rule uses edge_ttl=respect_origin). Requires that Cache Rule (/s/* eligible).
  if (
    event.request.method === 'GET' &&
    /^\/s\/[^/]+\/?$/.test(event.url.pathname) &&
    response.status === 200
  ) {
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=3600')
  }
  return response
}
