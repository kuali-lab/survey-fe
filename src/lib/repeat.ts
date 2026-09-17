import type { AnswerValue, Question } from './types.js'

/**
 * Jawaban berulang (Ihatec M5): satu pertanyaan, jawaban jamak.
 *
 * 🔴 Aturan di berkas ini adalah CERMINAN dari `internal/service/repeat.go` di
 * `logika-be`, dan tidak ada satu pun mekanisme yang menjaga keduanya tetap sama
 * — dua repo, dua deploy. Menyimpang di satu sisi saja **tidak memunculkan galat
 * apa pun**: gerbangnya cuma bergeser. Kalau daftar tipe di sini lebih longgar,
 * responden melihat tombol "Tambah" pada pertanyaan yang jawabannya ditolak
 * backend; kalau lebih ketat, batas yang sudah diatur pembuat survei diam-diam
 * tidak pernah terpakai.
 *
 * Yang harus tetap sama persis: daftar tipe, plafon, dan aturan perapatan.
 */

// Cerminan `repeatableQuestionTypes`. Tipe skalar berisi satu nilai, yang
// pengulangannya punya makna wajar. `checkbox` sengaja TIDAK di sini: ia sudah
// jamak, dan pengulangan di atas kejamakan adalah himpunan bersarang.
const REPEATABLE_TYPES: ReadonlySet<Question['type']> = new Set([
  'short_text',
  'long_text',
  'number',
  'phone',
  'email',
  'website',
  'date',
])

// Cerminan `maxRepeatCeiling`. Plafon ini ada DI KODE, bukan hanya di validasi
// API: baris lawas atau tulisan langsung ke basis data tidak boleh membuat
// responden bisa menambah jawaban tanpa batas.
const MAX_REPEAT_CEILING = 20

/** Apakah tipe ini boleh diberi `maxRepeat` sama sekali. */
export function isRepeatableType(type: Question['type']): boolean {
  return REPEATABLE_TYPES.has(type)
}

/**
 * Apakah SEBUAH pertanyaan benar-benar berulang.
 *
 * 🔴 Tipenya ikut diperiksa, bukan hanya `maxRepeat`-nya. Kalau satu baris
 * `checkbox` entah bagaimana menyandang `maxRepeat` (data lawas, tulisan
 * langsung ke basis data), tanpa penjagaan ini tiap pilihan yang dicentang akan
 * terbaca sebagai satu pengulangan.
 */
export function questionRepeats(q: Question): boolean {
  return q.maxRepeat != null && isRepeatableType(q.type)
}

/** Batas yang benar-benar ditegakkan: nilai tersimpan, dipotong plafon. Nol = tidak berulang. */
export function effectiveMaxRepeat(q: Question): number {
  if (!questionRepeats(q)) return 0
  const n = q.maxRepeat as number
  return n < MAX_REPEAT_CEILING ? n : MAX_REPEAT_CEILING
}

/**
 * Memecah satu nilai jawaban menjadi daftar pengulangan, SUDAH DIRAPATKAN.
 *
 * Dua sifat yang wajib sama dengan backend:
 *
 *  1. Nilai SKALAR (bukan array) menjadi SATU pengulangan, sehingga menyalakan
 *     pengulangan pada pertanyaan yang sudah terbit tidak merusak jawaban lama.
 *  2. Pengulangan KOSONG dibuang, termasuk yang di tengah (KT-6). Responden yang
 *     mengisi baris 1 dan 3 lalu mengosongkan baris 2 mengirim dua jawaban —
 *     bukan tiga dengan satu lubang.
 *
 * Kalau sisi ini merapatkan dan sisi sana tidak, jumlah yang divalidasi bukan
 * jumlah yang tersimpan.
 */
export function repeatValuesOf(value: AnswerValue | undefined): string[] {
  if (value == null) return []
  const arr: unknown[] = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const v of arr) {
    // Objek (contact_info, matrix) tidak pernah sampai ke sini — tipenya tidak
    // ada di REPEATABLE_TYPES. Dilewati, bukan di-stringify, supaya kesalahan
    // pemanggilan tidak menyelinap masuk sebagai teks "[object Object]".
    if (typeof v !== 'string' && typeof v !== 'number') continue
    const s = String(v)
    if (s.trim() === '') continue
    out.push(s)
  }
  return out
}

/** Apakah responden masih boleh menambah satu jawaban lagi. */
export function canAddRepeat(q: Question, values: readonly string[]): boolean {
  const max = effectiveMaxRepeat(q)
  return max > 0 && values.length < max
}
