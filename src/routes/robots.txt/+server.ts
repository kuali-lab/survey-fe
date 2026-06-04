import type { RequestHandler } from '@sveltejs/kit'

export const GET: RequestHandler = () => {
  // Always allow crawling so Googlebot can read noindex signals.
  // Survey forms are always private — deindexing is handled by
  // <meta name="robots" content="noindex, nofollow"> in each +page.svelte
  // and X-Robots-Tag header in hooks.server.ts.
  return new Response(
    'User-agent: *\nDisallow: \n',
    { headers: { 'Content-Type': 'text/plain' } }
  )
}
