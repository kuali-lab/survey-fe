import { describe, it, expect } from 'vitest'
import type { QuestionOption } from './types.js'
import {
  isTopOfMindAnswer, selectionsOf, topOfMindFirst, isTopOfMindEmpty, normalizeTopOfMind,
  topOfMindRest, setTopOfMindFirst, toggleTopOfMindRest, restLimit, restAtLimit,
  remainingOptions, topOfMindOtherText, firstIsOther,
} from './topOfMind.js'

const opts: QuestionOption[] = [
  { id: 'a', label: 'Aqua', sortOrder: 0 },
  { id: 'b', label: 'Cleo', sortOrder: 1 },
  { id: 'c', label: 'Prima', sortOrder: 2 },
  { id: 'o', label: 'Lainnya', sortOrder: 3, isOther: true },
]

describe('topOfMind — answer shape', () => {
  it('recognizes the two-stage answer and nothing else', () => {
    expect(isTopOfMindAnswer({ first: 'Aqua', selected: ['Aqua'] })).toBe(true)
    expect(isTopOfMindAnswer(['Aqua'])).toBe(false)
    expect(isTopOfMindAnswer({ firstName: 'x' })).toBe(false)
    expect(isTopOfMindAnswer(null)).toBe(false)
  })

  it('selectionsOf reads a plain array and a top-of-mind answer the same way', () => {
    expect(selectionsOf(['a', 'b'])).toEqual(['a', 'b'])
    expect(selectionsOf({ first: 'a', selected: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(selectionsOf('x')).toEqual([])
    expect(selectionsOf(null)).toEqual([])
  })

  it('normalize keeps first at index 0, drops blanks and duplicates', () => {
    expect(normalizeTopOfMind('Aqua', ['Cleo', 'Aqua', '', 'Cleo', 'Prima']))
      .toEqual({ first: 'Aqua', selected: ['Aqua', 'Cleo', 'Prima'] })
    expect(normalizeTopOfMind('', ['Cleo'])).toEqual({ first: '', selected: [] })
  })

  it('an answer without a first pick is empty', () => {
    expect(isTopOfMindEmpty(normalizeTopOfMind('', []))).toBe(true)
    expect(isTopOfMindEmpty({ first: 'Aqua', selected: ['Aqua'] })).toBe(false)
    expect(isTopOfMindEmpty(['Aqua'])).toBe(true) // plain array = no stage 1
    expect(topOfMindFirst(['Aqua'])).toBe('')
  })
})

describe('topOfMind — stage transitions', () => {
  it('first pick starts a fresh answer', () => {
    expect(setTopOfMindFirst(null, 'Aqua')).toEqual({ first: 'Aqua', selected: ['Aqua'] })
  })

  it('re-picking the same first keeps stage 2 intact', () => {
    const prev = { first: 'Aqua', selected: ['Aqua', 'Cleo'] }
    expect(setTopOfMindFirst(prev, 'Aqua')).toBe(prev)
  })

  it('changing the first pick resets stage 2', () => {
    const prev = { first: 'Aqua', selected: ['Aqua', 'Cleo'] }
    expect(setTopOfMindFirst(prev, 'Prima')).toEqual({ first: 'Prima', selected: ['Prima'] })
  })

  it('toggle adds and removes from the rest, never the first', () => {
    let v = setTopOfMindFirst(null, 'Aqua')
    v = toggleTopOfMindRest(v, 'Cleo')
    expect(v.selected).toEqual(['Aqua', 'Cleo'])
    v = toggleTopOfMindRest(v, 'Prima')
    expect(topOfMindRest(v)).toEqual(['Cleo', 'Prima'])
    v = toggleTopOfMindRest(v, 'Cleo')
    expect(v.selected).toEqual(['Aqua', 'Prima'])
    v = toggleTopOfMindRest(v, 'Aqua')
    expect(v.selected).toEqual(['Aqua', 'Prima'])
  })

  it('maxSelections caps the TOTAL, so stage 2 gets max - 1', () => {
    expect(restLimit(undefined)).toBe(0)
    expect(restLimit(0)).toBe(0)
    expect(restLimit(1)).toBe(0)
    expect(restLimit(3)).toBe(2)
    let v = setTopOfMindFirst(null, 'Aqua')
    v = toggleTopOfMindRest(v, 'Cleo', 3)
    v = toggleTopOfMindRest(v, 'Prima', 3)
    expect(restAtLimit(v, 3)).toBe(true)
    v = toggleTopOfMindRest(v, 'Nestlé', 3)
    expect(v.selected).toEqual(['Aqua', 'Cleo', 'Prima'])
    v = toggleTopOfMindRest(v, 'Cleo', 3) // free a slot
    v = toggleTopOfMindRest(v, 'Nestlé', 3)
    expect(v.selected).toEqual(['Aqua', 'Prima', 'Nestlé'])
  })
})

describe('topOfMind — options and "Lainnya"', () => {
  it('stage 2 excludes the first pick and keeps Lainnya', () => {
    expect(remainingOptions(opts, 'Cleo').map((o) => o.label)).toEqual(['Aqua', 'Prima', 'Lainnya'])
    expect(remainingOptions(opts, '')).toBe(opts)
  })

  it('a free-text first pick consumes Lainnya', () => {
    expect(remainingOptions(opts, 'Vit').map((o) => o.label)).toEqual(['Aqua', 'Cleo', 'Prima'])
    expect(firstIsOther({ first: 'Vit', selected: ['Vit'] }, opts)).toBe(true)
    expect(firstIsOther({ first: 'Lainnya', selected: ['Lainnya'] }, opts)).toBe(true)
    expect(firstIsOther({ first: 'Aqua', selected: ['Aqua'] }, opts)).toBe(false)
  })

  it('finds the typed Lainnya text wherever it sits', () => {
    expect(topOfMindOtherText({ first: 'Vit', selected: ['Vit', 'Aqua'] }, opts)).toBe('Vit')
    expect(topOfMindOtherText({ first: 'Aqua', selected: ['Aqua', 'Vit'] }, opts)).toBe('Vit')
    expect(topOfMindOtherText({ first: 'Aqua', selected: ['Aqua', 'Lainnya'] }, opts)).toBe('')
    expect(topOfMindOtherText({ first: 'Aqua', selected: ['Aqua'] }, opts)).toBe('')
  })
})
