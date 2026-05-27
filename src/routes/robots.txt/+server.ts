import { env } from '$env/dynamic/private'
import type { RequestHandler } from '@sveltejs/kit'

export const GET: RequestHandler = () => {
  const isProduction = env.APP_ENV === 'production'
  return new Response(
    `User-agent: *\nDisallow: ${isProduction ? '' : '/'}\n`,
    { headers: { 'Content-Type': 'text/plain' } }
  )
}
