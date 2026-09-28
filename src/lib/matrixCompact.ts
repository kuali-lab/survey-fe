/**
 * Matrix — pure helpers for the compact (accordion) layout.
 *
 * A matrix with many columns cannot be drawn as a table on a narrow screen
 * without pushing the respondent into horizontal scrolling, which is the one
 * gesture a survey should never ask for: the row label scrolls out of view, so
 * the respondent taps a radio without seeing which row it belongs to.
 *
 * The compact layout answers one row at a time instead — each row is an
 * accordion item, the open one shows its options as full-width buttons, and a
 * picked row collapses into a one-line summary. These helpers hold the rules
 * that decide what opens next and how the options are drawn; the measuring
 * (does the table fit?) and the DOM live in MatrixInput.svelte.
 *
 * The answer value is unchanged from the table layout: Record<rowLabel, colLabel>.
 */
import type { MatrixCol, MatrixRow } from './types.js'

export type MatrixAnswer = Record<string, string>

/** A row counts as answered only with a non-blank column label. */
export function isRowAnswered(value: MatrixAnswer, rowLabel: string): boolean {
  const cell = value[rowLabel]
  return typeof cell === 'string' && cell.trim() !== ''
}

export function answeredRowCount(rows: MatrixRow[], value: MatrixAnswer): number {
  return rows.filter((r) => isRowAnswered(value, r.label)).length
}

/**
 * The row the accordion opens next, searching forward from `after` and wrapping
 * around the end. The wrap is what makes revising an answer painless: reopening
 * row 1 of an otherwise-full matrix and changing it jumps to the single gap near
 * the bottom instead of dead-ending. `null` once every row is answered — the
 * caller then leaves the list closed so the Next button is the obvious step.
 *
 * `after` is the index just answered; -1 starts from the top (first render).
 */
export function nextUnansweredRow(rows: MatrixRow[], value: MatrixAnswer, after = -1): string | null {
  const start = after + 1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[(start + i) % rows.length]
    if (!isRowAnswered(value, row.label)) return row.label
  }
  return null
}

/**
 * Short labels — a 1–10 scale, an A–E grade — are numbers, not sentences.
 * Stacking ten full-width buttons turns one row into a scroll of its own, so
 * they go in a chip grid instead. Anything longer ("Sangat tidak setuju") stays
 * a stacked list, where the full label is readable.
 */
export const CHIP_LABEL_MAX = 3
export const CHIP_COLUMNS = 5

export function isChipScale(cols: MatrixCol[]): boolean {
  return cols.length > 0 && cols.every((c) => c.label.trim().length <= CHIP_LABEL_MAX)
}

/** Chips per row: 5, or fewer when the scale is shorter than that. */
export function chipColumns(cols: MatrixCol[]): number {
  return Math.min(cols.length, CHIP_COLUMNS)
}
