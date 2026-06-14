import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')

  // Edge-cache the survey render: the SSR HTML is identical for every respondent
  // of a survey (per-session state — draft/submit — is client-side API calls,
  // never in this HTML). Browser revalidates (max-age=0); Cloudflare caches the
  // shared copy for s-maxage. Invalidated immediately by logika-be's purge-on-
  // publish/edit; the short TTL is a self-healing fallback. Requires a Cloudflare
  // Cache Rule marking /s/* eligible (HTML isn't cached by default).
  if (
    event.request.method === 'GET' &&
    /^\/s\/[^/]+\/?$/.test(event.url.pathname) &&
    response.status === 200
  ) {
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=120')
  }
  return response
}
