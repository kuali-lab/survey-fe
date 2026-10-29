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

/** Berapa lama sebuah tab mengingat kode cabang yang dipindai. Cukup untuk satu pengisian, tidak untuk esok hari. */
export const LINK_CODE_SESSION_TTL_MS = 6 * 60 * 60 * 1000

/** Selisih jam yang masih diterima antara perangkat dan waktu tersimpan sebelum catatan dianggap rusak. */
const CLOCK_SKEW_MS = 60 * 1000

/** Bagian Storage yang dipakai di sini, supaya uji cukup dengan objek biasa. */
export interface SessionStoreLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const sessionKey = (slug: string) => `survey-fe:link:${slug}`

/**
 * Ingat kode cabang di sesi TAB (sessionStorage). `?c=` sengaja dihapus dari URL begitu halaman
 * dimuat, jadi muat ulang atau pemulihan tab di tengah pengisian kehilangan kodenya dan jawaban
 * tersimpan sebagai "tanpa cabang". Per slug, tidak lintas tab, tidak lintas browser.
 * Gagal menyimpan (mode privat, penuh) diabaikan: perilaku lama tetap berlaku.
 */
export function rememberLinkCode(store: SessionStoreLike | null, slug: string, code: string, now: number): void {
  if (!store || !slug || !code) return
  try {
    store.setItem(sessionKey(slug), JSON.stringify({ c: code, t: now }))
  } catch {
    // Penyimpanan sesi mati: tanpa ingatan, kode tetap hidup di memori halaman.
  }
}

/** Kode yang diingat tab ini, atau null bila tak ada, kedaluwarsa, atau rusak (yang rusak dibuang). */
export function recallLinkCode(
  store: SessionStoreLike | null,
  slug: string,
  now: number,
  ttlMs: number = LINK_CODE_SESSION_TTL_MS,
): string | null {
  if (!store || !slug) return null
  try {
    const raw = store.getItem(sessionKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { c?: unknown; t?: unknown }
    const fresh =
      typeof parsed.c === 'string' &&
      parsed.c.length > 0 &&
      typeof parsed.t === 'number' &&
      now - parsed.t <= ttlMs &&
      parsed.t - now <= CLOCK_SKEW_MS
    if (!fresh) {
      store.removeItem(sessionKey(slug))
      return null
    }
    return parsed.c as string
  } catch {
    return null
  }
}

/** Lupakan kode cabang tab ini: sesudah kirim sukses, atau saat kodenya terbukti tidak sah. */
export function forgetLinkCode(store: SessionStoreLike | null, slug: string): void {
  if (!store || !slug) return
  try {
    store.removeItem(sessionKey(slug))
  } catch {
    // Tak ada yang bisa dilakukan; ingatan sesi mati dengan tabnya.
  }
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
