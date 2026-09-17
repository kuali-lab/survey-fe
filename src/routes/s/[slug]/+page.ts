import type { PageLoad } from './$types.js'
import { browser } from '$app/environment'
import { env as publicEnv } from '$env/dynamic/public'
import { fetchSurvey } from '$lib/api.js'
import type { Survey } from '$lib/types.js'

// Saat SSR, jangkau logika-be lewat jalur internal kalau ada — menghemat satu
// perjalanan keluar-masuk Cloudflare per render. Hanya di server (`!browser`);
// peramban selalu memakai URL publik.
//
// 🔴 Nilai jatuhnya adalah `PUBLIC_API_BASE_URL`, BUKAN localhost, dan itu yang
// memperbaiki kedip merek.
//
// Sebelumnya ia jatuh ke `http://localhost:8080/api/v1` — alamat yang hampir
// tidak pernah terjangkau dari proses SSR di server mana pun. Pengambilan itu
// gagal, `survey` jadi null, dan `+layout.svelte` memancarkan cabang bawaan:
// empat ikon platform Logika Statistik plus judul bawaan ke cat PERTAMA. Baru
// kemudian `load` berjalan ulang di peramban, berhasil, dan menukarnya. Survei
// ber-white-label karena itu memamerkan merek platform lebih dulu, setiap kali.
//
// Jatuh ke URL publik membuat SSR berhasil di konfigurasi normal tanpa satu pun
// variabel tambahan. `PUBLIC_SSR_API_BASE_URL` tetap dihormati sebagai PENIMPA
// untuk lingkungan yang punya alamat internal lebih pendek — opsional, bukan
// syarat.
const SSR_API_BASE = publicEnv.PUBLIC_SSR_API_BASE_URL || publicEnv.PUBLIC_API_BASE_URL

export const load: PageLoad = async ({ params, fetch }) => {
  const { slug } = params

  try {
    const survey = await fetchSurvey(slug, fetch, browser ? undefined : SSR_API_BASE)
    return { survey, slug, error: null, deferred: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    if (message === 'not_found') {
      return { survey: null as Survey | null, slug, error: 'not_found' as const, deferred: false }
    }
    if (message === 'survey_closed') {
      return { survey: null as Survey | null, slug, error: 'survey_closed' as const, deferred: false }
    }
    // Transient/server fetch error. On the SERVER this is almost always the
    // SSR-only base-URL (localhost:8080) being unreachable, while the browser's
    // public-URL fetch succeeds. Painting a terminal 500 here causes a visible
    // flash that the client re-run then retracts. Instead defer the decision to
    // the client re-run: render a neutral loading state during SSR and let the
    // browser fetch resolve to the real survey (or a real error if it also fails).
    // not_found / survey_closed stay terminal above — only generic errors defer.
    return { survey: null as Survey | null, slug, error: 'server_error' as const, deferred: !browser }
  }
}
