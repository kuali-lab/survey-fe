/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

declare const self: ServiceWorkerGlobalScope

const CACHE = `survey-fe-v${version}`

// Precache the build manifest assets (JS bundles, CSS) and static files
// (icons, fonts referenced from /static). Versioned per build via
// $service-worker so deploys roll over cleanly.
const PRECACHE_ASSETS = [...build, ...files]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // addAll fails fast — fall back to per-asset adds so a single hiccup
      // (e.g., a font from a CDN behind a redirect) doesn't kill install.
      await Promise.all(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch(() => { /* skip; will fetch on demand */ }),
        ),
      )
    }),
  )
  // Activate on first install without waiting for old tabs to close.
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Cross-origin (e.g., the API subdomain) → don't touch. The outbox
  // drain handles offline submit retry; intercepting here would just cause
  // confusing failure modes.
  if (url.origin !== self.location.origin) return

  // SvelteKit's version probe — let it fail naturally when offline.
  if (url.pathname === '/_app/version.json') return

  event.respondWith(handle(event.request))
})

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const cache = await caches.open(CACHE)

  // Cache-first for precached, content-hashed build assets. They're
  // immutable per deploy, so cache is always correct.
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    const cached = await cache.match(request)
    if (cached) return cached
  }

  // Network-first for everything else (HTML navigations + runtime asset
  // fetches). On success, cache the response — HTML keyed by pathname so
  // /done?sid=A and /done?sid=B share one cached shell, since the page
  // re-reads sid from window.location at runtime anyway.
  try {
    const response = await fetch(request)
    if (response.ok) {
      const ct = response.headers.get('content-type') ?? ''
      if (ct.includes('text/html')) {
        const key = new Request(url.origin + url.pathname)
        await cache.put(key, response.clone())
      } else {
        await cache.put(request, response.clone())
      }
    }
    return response
  } catch {
    // Offline: try cache. For HTML, look up by pathname only.
    const accept = request.headers.get('accept') ?? ''
    if (accept.includes('text/html')) {
      const key = new Request(url.origin + url.pathname)
      const cached = await cache.match(key)
      if (cached) return cached
    }
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response('Offline dan tidak tersedia di cache', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

export {}
