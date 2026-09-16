import type { PageLoad } from './$types.js'
import { fetchDrafPratinjau } from '$lib/api.js'
import type { Survey } from '$lib/types.js'

// 🔴 Klien saja. Tokennya ada di query string, dan render sisi-server berarti
// ia melewati log akses server untuk halaman yang tidak butuh SEO sama sekali —
// pratinjau selalu dibuka dari dashboard yang sudah login, tidak pernah dari
// mesin pencari. Sekalian menghindari basis URL SSR yang tidak berlaku di sini.
export const ssr = false

export const load: PageLoad = async ({ url, fetch }) => {
  const token = url.searchParams.get('token') ?? ''
  if (!token) {
    return { survey: null as Survey | null, error: 'preview_invalid' as const }
  }

  try {
    return { survey: await fetchDrafPratinjau(token, fetch), error: null }
  } catch (err) {
    const pesan = err instanceof Error ? err.message : 'server_error'
    // ⚠️ Tidak ada penundaan ke jalankan-ulang di klien seperti halaman
    // responden: ini SUDAH klien. Kegagalan di sini adalah kegagalan yang
    // sebenarnya, dan menyembunyikannya di balik keadaan memuat berarti
    // pratinjau yang menggantung tanpa alasan.
    const error = pesan === 'not_found' || pesan === 'preview_invalid' ? pesan : 'server_error'
    return { survey: null as Survey | null, error: error as 'not_found' | 'preview_invalid' | 'server_error' }
  }
}
