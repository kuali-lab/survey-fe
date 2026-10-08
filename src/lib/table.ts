/**
 * Tipe Tabel, sisi responden: aturan murni (tanpa rune, tanpa DOM) supaya bisa
 * diuji di Node. Komponen `TableInput`/`TableCellInput` hanya merender.
 *
 * Aturan wajib + K108 identik dengan `tableMissingCell` di logika-be
 * (01-flow-tipe-tabel.md §6.1): tabel wajib tanpa sel terisi ditolak; begitu satu
 * sel terisi, setiap sel kolom wajib di setiap baris aktif harus terisi.
 */
import type { AnswerValue, Question, TableAnswer, TableRow, TranslatedText } from './types.js'
import { displayLabel, questionPlainText } from './i18n/content.js'
import { LEGACY_LOCALE, t } from './i18n/messages.js'

/** Lebar pembungkus (px) yang mengubah grid jadi accordion per baris (K111). */
export const COMPACT_BREAKPOINT = 640

export type TableIssue = { message: string; rowKey: string | null; columnId: string | null }

/** Penilai satu sel terisi; runner mengisinya dengan `validateOne(kolom, nilai)`. */
export type CellValidator = (column: Question, value: AnswerValue) => string | null

/** Lantai judul baris (px, termasuk padding 12px); label panjang turun baris. */
export const ROW_HEAD_MIN_PX = 80
/** Padding horizontal `.cell` (3px kiri + 3px kanan); tabel border-collapse tanpa batas vertikal. */
const CELL_PAD_X = 6
/** Kira-kira lebar scrollbar halaman: lebar yang hilang saat grid membuat halaman bergulir. */
const GRID_HYSTERESIS_PX = 16

/** Lebar minimum grid (px, 1rem = 16px): judul baris + lantai tiap kolom + padding sel. */
export function requiredGridWidth(columns: Question[]): number {
  return columns.reduce((sum, c) => sum + columnMinRem(c) * 16 + CELL_PAD_X, ROW_HEAD_MIN_PX)
}

/**
 * Accordion bila ponsel (K111) atau lantai kolom tak muat di lebar terukur (termasuk
 * breakout ≥768px, lihat TableInput). Grid yang sedang tampil bertahan sampai 16px di
 * bawah lantai, supaya scrollbar halaman tidak membuatnya bolak-balik.
 * ponytail: lantai judul baris tetap 80px, bukan diukur dari label; ukur bila label panjang sering menyempitkan sel.
 */
export function isCompactTable(width: number, columns: Question[], wasCompact = true): boolean {
  if (width <= COMPACT_BREAKPOINT) return true
  return width < requiredGridWidth(columns) - (wasCompact ? 0 : GRID_HYSTERESIS_PX)
}

/**
 * Tata letak gambar yang dirender QuestionCard. Tabel menaruh gambar kiri/kanan di atas:
 * di samping gambar kolom isian tinggal ±516px, tabel selalu jadi accordion. TableInput
 * mengandalkan ini untuk selalu boleh breakout (kolom konten di tengah viewport).
 */
export function effectiveImageLayout(q: Question): string | null {
  return q.type === 'table' && (q.imageLayout === 'left' || q.imageLayout === 'right') ? 'top' : q.imageLayout
}


/** Bobot kolom judul baris di grid; satuan sama dengan `columnWeight`. */
export const ROW_HEAD_WEIGHT = 11

/**
 * Bobot lebar kolom grid (±1 karakter per satuan). Dropdown selebar label opsi
 * terpanjang + 7 untuk padding dan panah, supaya nilai terpilih tidak terpotong.
 */
export function columnWeight(col: Question): number {
  if (col.type === 'number') return 7
  if (col.type !== 'dropdown') return 9
  const longest = Math.max(0, ...(col.options ?? []).map((o) => o.label.length))
  return Math.min(Math.max(longest + 7, 12), 28)
}

/**
 * Lebar minimum isian sel grid padat (rem, font 14px); bobot hanya membagi sisa lebar.
 * Diukur dari Source Sans 3 14px + padding 6px + batas fokus 2px (kiri-kanan):
 * angka "123456" 41,7px + spinner 15px; dropdown "Kurikulum" 61px + panah 22px
 * (label lebih panjang turun baris); teks ±88px isi, selebihnya turun baris.
 */
export function columnMinRem(col: Question): number {
  if (col.type === 'number') return 4.625
  if (col.type === 'dropdown') return 6
  return 6.5
}

export function activeRows(q: Question): TableRow[] {
  return (q.tableRows ?? []).filter((r) => !r.deleted)
}

export type RowGroup = { group: string; translations?: TranslatedText; rows: TableRow[] }

/** Baris aktif berurutan per kelompok (K115); `group` kosong = tanpa baris judul. */
export function groupRows(q: Question): RowGroup[] {
  const out: RowGroup[] = []
  for (const row of activeRows(q)) {
    const group = row.group ?? ''
    const last = out[out.length - 1]
    if (last && last.group === group) last.rows.push(row)
    else out.push({ group, translations: row.groupTranslations, rows: [row] })
  }
  return out
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

/**
 * Draf lama vs tabel yang sudah diubah: sisakan baris aktif, kolom yang masih ada,
 * dan label dropdown yang masih ada di opsi (BE menolak selain itu); baris kosong dibuang.
 */
export function pruneTableAnswer(q: Question, answer: AnswerValue | undefined): TableAnswer {
  const a = toTableAnswer(answer)
  const out: TableAnswer = {}
  for (const row of activeRows(q)) {
    const key = String(row.key)
    const cells: TableAnswer[string] = {}
    for (const col of q.fields ?? []) {
      const v = cellOf(a, key, col.id)
      if (!isCellFilled(v)) continue
      if (col.type === 'dropdown' && !(col.options ?? []).some((o) => o.label === v)) continue
      cells[col.id] = v as string | number
    }
    if (Object.keys(cells).length > 0) out[key] = cells
  }
  return out
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

/** Durasi slide buka/tutup baris accordion (TableInput). */
export const ROW_SLIDE_MS = 180

/** Tunda gulir ulang ke sel salah: baris lain yang menutup menggeser posisinya. Null = tanpa animasi. */
export function rescrollDelay(reduceMotion: boolean): number | null {
  return reduceMotion ? null : ROW_SLIDE_MS + 20
}

/** Nilai `data-cell` yang dipasang TableInput pada sel; dicari runner saat validasi gagal. */
export const cellKey = (rowKey: string, columnId: string) => `${rowKey}:${columnId}`

/**
 * Bila pertanyaan salah pertama di halaman adalah tabel dengan sel bermasalah:
 * selektor sel (fokus) dan barisnya (cadangan bila sel belum dirender). Null = gulir ke `.error`.
 */
export function firstInvalidCellTarget(
  questions: Question[],
  errors: Record<string, string>,
  issueOf: (q: Question) => TableIssue | null,
): { cell: string; row: string } | null {
  const q = questions.find((x) => errors[x.id])
  if (q?.type !== 'table') return null
  const issue = issueOf(q)
  if (!issue?.rowKey || !issue.columnId) return null
  const scope = `[data-table="${q.id}"]`
  return { cell: `${scope} [data-cell="${cellKey(issue.rowKey, issue.columnId)}"]`, row: `${scope} [data-row="${issue.rowKey}"]` }
}

/** Ringkasan rekap surveyor: sel terisi dari seluruh sel baris aktif × kolom. */
export function tableRecap(q: Question, answer: AnswerValue | undefined): string {
  const rows = activeRows(q)
  const filled = rows.reduce((n, r) => n + filledCount(q, answer, String(r.key)), 0)
  return `${filled} dari ${rows.length * (q.fields ?? []).length} sel terisi`
}
