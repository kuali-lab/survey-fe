/**
 * Tipe Tabel, sisi responden: aturan murni (tanpa rune, tanpa DOM) supaya bisa
 * diuji di Node. Komponen `TableInput`/`TableCellInput` hanya merender.
 *
 * Aturan wajib + K108 identik dengan `tableMissingCell` di logika-be
 * (01-flow-tipe-tabel.md §6.1): tabel wajib tanpa sel terisi ditolak; begitu satu
 * sel terisi, setiap sel kolom wajib di setiap baris aktif harus terisi.
 */
import type { AnswerValue, Question, TableAnswer, TableRow } from './types.js'
import { displayLabel, questionPlainText } from './i18n/content.js'
import { LEGACY_LOCALE, t } from './i18n/messages.js'

/** Lebar pembungkus (px) yang mengubah grid jadi accordion per baris (K111). */
export const COMPACT_BREAKPOINT = 640

export type TableIssue = { message: string; rowKey: string | null; columnId: string | null }

/** Penilai satu sel terisi; runner mengisinya dengan `validateOne(kolom, nilai)`. */
export type CellValidator = (column: Question, value: AnswerValue) => string | null

// ponytail: ambang awal dari 02 §4.1; angka final ditetapkan saat live-verify.
export function isCompactTable(width: number, columnCount: number): boolean {
  return width <= COMPACT_BREAKPOINT || (columnCount > 5 && width < 900)
}

export function activeRows(q: Question): TableRow[] {
  return (q.tableRows ?? []).filter((r) => !r.deleted)
}

/** Angka 0 dan "0" adalah jawaban; kosong = null/undefined/string blank. */
export function isCellFilled(v: AnswerValue | undefined): boolean {
  if (typeof v === 'number') return !Number.isNaN(v)
  return typeof v === 'string' && v.trim() !== ''
}

/** Jawaban yang bukan objek tabel (draf rusak, cabang input teks lama) dibaca kosong. */
export function toTableAnswer(v: AnswerValue | undefined): TableAnswer {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as TableAnswer) : {}
}

function cellOf(answer: TableAnswer, rowKey: string, columnId: string): AnswerValue | undefined {
  return answer[rowKey]?.[columnId]
}

/** Salinan baru dengan satu sel diganti; sel kosong dan baris tanpa sel dibuang. */
export function setCell(answer: AnswerValue | undefined, rowKey: string, columnId: string, value: AnswerValue): TableAnswer {
  const current = toTableAnswer(answer)
  const row = { ...current[rowKey] }
  if (isCellFilled(value)) row[columnId] = value as string | number
  else delete row[columnId]

  const next = { ...current }
  if (Object.keys(row).length > 0) next[rowKey] = row
  else delete next[rowKey]
  return next
}

export function filledCount(q: Question, answer: AnswerValue | undefined, rowKey: string): number {
  const a = toTableAnswer(answer)
  return (q.fields ?? []).filter((c) => isCellFilled(cellOf(a, rowKey, c.id))).length
}

export function requiredCount(q: Question): number {
  return (q.fields ?? []).filter((c) => c.required).length
}

/** Lengkap = semua kolom wajib terisi; tabel tanpa kolom wajib: semua kolom terisi. */
export function isRowComplete(q: Question, answer: AnswerValue | undefined, rowKey: string): boolean {
  const columns = q.fields ?? []
  const a = toTableAnswer(answer)
  const needed = requiredCount(q) > 0 ? columns.filter((c) => c.required) : columns
  return needed.length > 0 && needed.every((c) => isCellFilled(cellOf(a, rowKey, c.id)))
}

/** Ada sel terisi; dengan `rows`, hanya baris itu yang dihitung (baris deleted di draf lama diabaikan). */
export function isTableTouched(answer: AnswerValue | undefined, rows?: TableRow[]): boolean {
  const a = toTableAnswer(answer)
  const keys = rows ? rows.map((r) => String(r.key)) : Object.keys(a)
  return keys.some((k) => Object.values(a[k] ?? {}).some(isCellFilled))
}

/** Baris yang dibuka accordion saat pertama tampil: baris pertama yang belum lengkap. */
export function firstOpenRow(q: Question, answer: AnswerValue | undefined): string | null {
  const rows = activeRows(q)
  const open = rows.find((r) => !isRowComplete(q, answer, String(r.key))) ?? rows[0]
  return open ? String(open.key) : null
}

/**
 * Masalah pertama, urut baris lalu kolom. Sel terisi dinilai `validateCell`
 * (pesannya diberi "Baris — Kolom"); sel kosong ditagih hanya bila kolomnya wajib
 * dan tabel sudah tersentuh.
 */
export function validateTable(
  q: Question,
  answer: AnswerValue | undefined,
  validateCell: CellValidator,
  locale = LEGACY_LOCALE,
  primary = LEGACY_LOCALE,
): TableIssue | null {
  const a = toTableAnswer(answer)
  const rows = activeRows(q)
  if (!isTableTouched(a, rows)) return q.required ? { message: t(locale, 'errRequired'), rowKey: null, columnId: null } : null

  for (const row of rows) {
    const rowKey = String(row.key)
    for (const column of q.fields ?? []) {
      const v = cellOf(a, rowKey, column.id)
      const err = isCellFilled(v) ? validateCell(column, v as AnswerValue) : null
      if (!err && (isCellFilled(v) || !column.required)) continue
      const names = { row: displayLabel(row, locale, primary), col: questionPlainText(column, 'title', locale, primary) }
      const message = err ? `${names.row} — ${names.col}: ${err}` : t(locale, 'errTableCell', names)
      return { message, rowKey, columnId: column.id }
    }
  }
  return null
}

/** Ringkasan rekap surveyor: sel terisi dari seluruh sel baris aktif × kolom. */
export function tableRecap(q: Question, answer: AnswerValue | undefined): string {
  const rows = activeRows(q)
  const filled = rows.reduce((n, r) => n + filledCount(q, answer, String(r.key)), 0)
  return `${filled} dari ${rows.length * (q.fields ?? []).length} sel terisi`
}
