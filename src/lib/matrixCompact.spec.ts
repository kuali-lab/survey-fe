import { describe, it, expect } from 'vitest'
import type { MatrixCol, MatrixRow } from './types.js'
import {
  isRowAnswered, answeredRowCount, nextUnansweredRow, isChipScale, chipColumns,
} from './matrixCompact.js'

const rows: MatrixRow[] = [
  { id: 'r0', label: 'Kecepatan', sortOrder: 0 },
  { id: 'r1', label: 'Keramahan', sortOrder: 1 },
  { id: 'r2', label: 'Kebersihan', sortOrder: 2 },
]

const cols = (labels: string[]): MatrixCol[] =>
  labels.map((label, i) => ({ id: `c${i}`, label, sortOrder: i }))

describe('matrixCompact — answered rows', () => {
  it('counts only rows with a non-blank column label', () => {
    expect(isRowAnswered({ Kecepatan: 'Puas' }, 'Kecepatan')).toBe(true)
    expect(isRowAnswered({ Kecepatan: '' }, 'Kecepatan')).toBe(false)
    expect(isRowAnswered({ Kecepatan: '   ' }, 'Kecepatan')).toBe(false)
    expect(isRowAnswered({}, 'Kecepatan')).toBe(false)
  })

  it('answeredRowCount ignores keys that are not rows', () => {
    expect(answeredRowCount(rows, {})).toBe(0)
    expect(answeredRowCount(rows, { Kecepatan: 'Puas', Kebersihan: 'Buruk' })).toBe(2)
    // A stale key from an edited questionnaire must not inflate the count.
    expect(answeredRowCount(rows, { Kecepatan: 'Puas', Harga: 'Mahal' })).toBe(1)
  })
})

describe('matrixCompact — which row opens next', () => {
  it('opens the first row on a fresh matrix', () => {
    expect(nextUnansweredRow(rows, {})).toBe('Kecepatan')
  })

  it('opens the first still-unanswered row when resuming a partial answer', () => {
    expect(nextUnansweredRow(rows, { Kecepatan: 'Puas' })).toBe('Keramahan')
  })

  it('moves forward after the row just answered', () => {
    expect(nextUnansweredRow(rows, { Kecepatan: 'Puas' }, 0)).toBe('Keramahan')
  })

  it('skips rows already answered further down', () => {
    const value = { Kecepatan: 'Puas', Keramahan: 'Baik' }
    expect(nextUnansweredRow(rows, value, 0)).toBe('Kebersihan')
  })

  it('wraps to a gap above when revising a later row', () => {
    // Row 3 revised while row 2 is still empty → go back up to row 2.
    const value = { Kecepatan: 'Puas', Kebersihan: 'Buruk' }
    expect(nextUnansweredRow(rows, value, 2)).toBe('Keramahan')
  })

  it('returns null once every row is answered', () => {
    const value = { Kecepatan: 'Puas', Keramahan: 'Baik', Kebersihan: 'Buruk' }
    expect(nextUnansweredRow(rows, value, 1)).toBe(null)
  })

  it('returns null for a matrix with no rows', () => {
    expect(nextUnansweredRow([], {})).toBe(null)
  })
})

describe('matrixCompact — chip scale', () => {
  it('treats short labels as a chip scale', () => {
    expect(isChipScale(cols(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']))).toBe(true)
    expect(isChipScale(cols(['A', 'B', 'C', 'D', 'E']))).toBe(true)
  })

  it('keeps worded options as a stacked list', () => {
    expect(isChipScale(cols(['Sangat tidak setuju', 'Netral', 'Setuju']))).toBe(false)
    // One long label among short ones is enough to stay stacked.
    expect(isChipScale(cols(['1', '2', 'Tidak tahu']))).toBe(false)
  })

  it('is not a chip scale without columns', () => {
    expect(isChipScale([])).toBe(false)
  })

  it('caps chips at five per row, fewer for a short scale', () => {
    expect(chipColumns(cols(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']))).toBe(5)
    expect(chipColumns(cols(['1', '2', '3']))).toBe(3)
  })
})
