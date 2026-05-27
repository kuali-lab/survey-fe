import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
