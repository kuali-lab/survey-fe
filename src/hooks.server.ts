import type { Handle } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

// Asal dashboard yang boleh membingkai pratinjau draf.
//
// 🔴 **Kenapa ada default, bukan sekadar variabel.** Variabel yang lupa diset
// akan membuat pratinjau produksi mati tanpa satu pun galat: nol header, XFO
// tepi tetap `DENY`, iframe kosong, deploy sukses. Kegagalan-senyap seperti itu
// sudah dua kali memakan waktu proyek ini. Nilai produksi karena itu jadi
// bawaan, dan variabelnya cuma untuk menimpanya di dev.
const ASAL_DASHBOARD_BAWAAN = 'https://dashboard.statistika.id'

// `/pratinjau` persis, dengan atau tanpa garis miring penutup. Tidak pernah
// `/pratinjau-lain` dan tidak pernah anak jalurnya.
const JALUR_PRATINJAU = /^\/pratinjau\/?$/

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

  // Pratinjau draf dibuka sebagai `<iframe>` di dalam dashboard, dan tidak
  // pernah sebagai halaman berdiri sendiri.
  //
  // 🔴 **Ini SATU-SATUNYA jalur yang boleh dibingkai.** Halaman responden
  // membawa jawaban sungguhan; kelonggaran di sini tidak menyentuhnya.
  //
  // ⚠️ `X-Frame-Options: DENY` datang dari TEPI (Cloudflare/Traefik), bukan dari
  // repo ini — ia terpasang seragam di survey/dashboard/api.statistika.id, dan
  // kita tidak memegang konfigurasinya. `frame-ancestors` dipakai justru karena
  // ia mengalahkan XFO tanpa perlu memegangnya. Terukur di Chrome 153 pada 13
  // September 2026: dua respons httpbin yang sama-sama ber-`XFO: DENY`, yang
  // tanpa `frame-ancestors` gagal `net::ERR_BLOCKED_BY_RESPONSE`, yang dengan
  // `frame-ancestors <asal induk>` dimuat.
  if (event.request.method === 'GET' && JALUR_PRATINJAU.test(event.url.pathname)) {
    const asal = (env.DASHBOARD_ORIGIN || ASAL_DASHBOARD_BAWAAN).replace(/\/+$/, '')
    response.headers.set('Content-Security-Policy', `frame-ancestors ${asal}`)
  }

  return response
}
