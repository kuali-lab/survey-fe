/**
 * Kode cabang tautan (`?c=`, M6a) — bagian murninya.
 *
 * Kenapa modul ini ada: suite survey-fe berjalan SSR-only, jadi logika di dalam
 * .svelte tak pernah tersentuh uji. Pembacaan/pembersihan URL dan aturan
 * "siapa yang menang saat melanjutkan draf" dipindah ke sini agar terkunci uji;
 * halaman pemanggil tinggal memanggil tiga fungsi ini.
 */

/** Nama parameter URL yang membawa kode cabang. Bukan `t` (undangan). */
export const LINK_CODE_PARAM = 'c'

/**
 * Kode dari URL, sudah di-trim. Nilai kosong/absen → null. Kalau parameternya
 * berulang, yang pertama dipakai (perilaku bawaan `searchParams.get`).
 * Tidak divalidasi di sini: yang berwenang tetap endpoint status + submit.
 */
export function readLinkCodeFromUrl(url: URL): string | null {
  const raw = url.searchParams.get(LINK_CODE_PARAM)
  if (raw === null) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Salinan URL tanpa `c` — parameter lain dan hash dipertahankan. Input tidak
 * diubah. Dipakai untuk `history.replaceState` supaya tautan yang disalin
 * responden tidak menyeret kode cabang ke orang lain.
 */
export function stripLinkCodeFromUrl(url: URL): URL {
  const copy = new URL(url.href)
  copy.searchParams.delete(LINK_CODE_PARAM)
  return copy
}

/**
 * Kode yang berlaku saat responden melanjutkan draf: URL menang atas draf (QR
 * yang baru dipindai adalah kebenaran terbaru); kalau URL kosong, pakai yang
 * tersimpan di draf; kalau dua-duanya kosong, null. String kosong di draf
 * dianggap tidak ada.
 */
export function resolveResumeLinkCode(
  current: string | null,
  fromDraft: string | null | undefined,
): string | null {
  if (current) return current
  if (typeof fromDraft === 'string' && fromDraft.length > 0) return fromDraft
  return null
}

/**
 * Gerbang "hanya lewat tautan cabang" (Ihatec F1): apakah `requireLinkCode`
 * harus memblokir form karena, di titik pemeriksaan ini, TIDAK ADA linkCode
 * yang diketahui dari sumber manapun (URL atau draf) — bukan cuma `?c=`
 * mentah. `requireLinkCode` absen/false → tidak pernah menggerbang.
 */
export function requiresLinkGate(
  requireLinkCode: boolean | undefined,
  knownLinkCode: string | null,
): boolean {
  return Boolean(requireLinkCode) && !knownLinkCode
}
