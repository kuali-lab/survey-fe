import { PUBLIC_API_BASE_URL } from '$env/static/public'

/**
 * Menjadikan URL media dari backend bisa dipakai di sisi responden.
 *
 * 🔴 Kenapa ini perlu ada, dan kenapa ketiadaannya tidak pernah terlihat:
 *
 * `logika-be` mengirim URL media dalam DUA bentuk, tergantung konfigurasi:
 *   - `MEDIA_CDN_URL` diset  → absolut, mis. `https://cdn.statistika.id/media/<key>`
 *   - `MEDIA_CDN_URL` kosong → RELATIF, `/api/v1/media/<id>/file`  ← bawaannya
 *
 * Bentuk relatif itu diselesaikan peramban terhadap origin HALAMAN, yaitu
 * survey-fe — bukan terhadap origin API. Jadi logo pelanggan menunjuk ke
 * `https://survey.…/api/v1/media/…` yang tidak ada, dan favicon-nya menerima
 * cangkang SPA alih-alih gambar.
 *
 * `dashboard-fe` sudah punya penyelesai ini (`media.service.ts::resolveMediaUrl`);
 * survey-fe tidak, dan selisih itu tertutupi selama CDN aktif. Begitu CDN mati
 * atau belum diset di sebuah lingkungan, branding pelanggan rusak tanpa satu pun
 * galat di log — hanya gambar yang tidak muncul.
 *
 * Aset PLATFORM (`/logo-logika-teta.svg`, `/icons/…`) sengaja TIDAK lewat sini:
 * ia memang milik origin survey-fe. Fungsi ini hanya untuk URL yang datang dari
 * backend.
 */

// Origin API tanpa sufiks `/api/v1`. Pola yang sama dipakai
// `routes/s/[slug]/files/[fileId]/+page.ts` dan `dashboard-fe`.
const API_ORIGIN = (PUBLIC_API_BASE_URL || '').replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '')

/**
 * URL media yang siap dipasang di `src`/`href`.
 *
 * Kosong/null dikembalikan apa adanya supaya pemanggil tetap bisa memakai
 * `||` untuk jatuh ke aset platform — mengubah `null` jadi string di sini akan
 * mematikan seluruh rantai cadangan itu.
 */
export function resolveMediaUrl<T extends string | null | undefined>(url: T): T | string {
  if (!url) return url
  // Sudah absolut (termasuk `//cdn…`) berarti CDN aktif — jangan disentuh.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return url
  if (!API_ORIGIN) return url
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}
