/**
 * Draf lokal responden (localStorage) — bagian murninya.
 *
 * Kenapa modul ini ada (H-46): seluruh suite survey-fe berjalan dalam mode SSR,
 * sehingga logika yang tinggal di dalam berkas .svelte tidak pernah tersentuh uji.
 * Parsing/serialisasi draf dipindahkan ke sini apa adanya supaya perilakunya
 * dikunci uji; pembacaan/penulisan localStorage tetap di halaman pemanggil.
 *
 * Kenapa `linkCode` menumpang draf (K60): kode cabang tautan (`?c=`) harus pulih
 * saat responden melanjutkan draf yang tersimpan, dan harus ikut hilang saat
 * draf dibuang. Kunci storage tersendiri untuk linkCode akan salah mengatribusi
 * kunjungan berikutnya lewat tautan utama ke cabang lama — maka ia bukan kunci
 * sendiri, melainkan medan opsional di dalam draf.
 */
import type { Answers } from './types.js'

/** Usia maksimum draf lokal sebelum dianggap kedaluwarsa (30 hari). */
export const STORAGE_TTL_MS = 30 * 24 * 3600 * 1000

// Selfie/lokasi sengaja TIDAK disimpan (privasi + ukuran).
export type SavedState = {
  answers: Answers
  currentIndex: number
  accumulatedTimeMs: number
  savedAt: number
  /** Kode cabang tautan (`?c=`) yang aktif saat draf disimpan; absen pada draf lama. */
  linkCode?: string
}

export type ParsedSavedState = {
  state: SavedState | null
  expired: boolean
}

/**
 * Mengurai isi mentah localStorage menjadi draf.
 *
 * - `null`                      → tidak valid (JSON rusak / bentuk salah); pemanggil diam saja.
 * - `{ state: null, expired: true }` → lebih tua dari TTL; pemanggil menghapus kuncinya.
 * - `{ state, expired: false }` → draf siap dipulihkan.
 *
 * Aturan validasi dan perbandingan TTL (`>` ketat, `savedAt` dicek truthiness)
 * dipertahankan persis seperti kode lama di +page.svelte.
 */
export function parseSavedState(raw: string, now: number): ParsedSavedState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SavedState>
    if (typeof parsed?.currentIndex !== 'number') return null
    if (!parsed.answers || typeof parsed.answers !== 'object') return null
    if (parsed.savedAt && now - parsed.savedAt > STORAGE_TTL_MS) {
      return { state: null, expired: true }
    }

    // Fallback untuk format localStorage lama yang memakai startTime
    if (typeof parsed.accumulatedTimeMs !== 'number') {
      const anyParsed = parsed as any
      parsed.accumulatedTimeMs = anyParsed.startTime || 0
    }

    // linkCode bukan string (draf lama, atau nilai rusak) dianggap tidak ada.
    if (typeof parsed.linkCode !== 'string') delete parsed.linkCode

    return { state: parsed as SavedState, expired: false }
  } catch {
    return null
  }
}

/** Serialisasi draf untuk localStorage; `linkCode` undefined otomatis tidak ditulis oleh JSON.stringify. */
export function serializeSavedState(s: SavedState): string {
  return JSON.stringify(s)
}
