import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MIN_SEARCH_CHARS, SEARCH_DEBOUNCE_MS, filterBySearch, debounce } from './optionSearch.js'

describe('filterBySearch', () => {
  const items = [
    { label: 'Kacang', en: 'Peanut' },
    { label: 'Susu', en: 'Milk' },
    { label: 'Telur', en: 'Egg' },
  ]
  const getText = (i: (typeof items)[number]) => [i.label, i.en]

  it('returns everything for an empty query', () => {
    expect(filterBySearch(items, '', getText)).toEqual(items)
    expect(filterBySearch(items, '   ', getText)).toEqual(items)
  })

  it('matches (case-insensitive) against the primary field', () => {
    expect(filterBySearch(items, 'kac', getText)).toEqual([items[0]])
    expect(filterBySearch(items, 'SUSU', getText)).toEqual([items[1]])
  })

  it('also matches against a secondary field (e.g. the i18n-translated label)', () => {
    expect(filterBySearch(items, 'egg', getText)).toEqual([items[2]])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterBySearch(items, 'zzz', getText)).toEqual([])
  })
})

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('calls fn once after the delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, SEARCH_DEBOUNCE_MS)
    debounced('a')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(fn).toHaveBeenCalledExactlyOnceWith('a')
  })

  it('cancels a pending call when invoked again before the delay elapses', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, SEARCH_DEBOUNCE_MS)
    debounced('a')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50)
    debounced('b')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('reuses the same timer across calls (the same debounced function, not a fresh one per call)', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, SEARCH_DEBOUNCE_MS)
    debounced('a')
    debounced('b')
    debounced('c')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })
})

describe('MIN_SEARCH_CHARS', () => {
  it('matches the server-side guard (public_survey_options.go minSearchChars)', () => {
    expect(MIN_SEARCH_CHARS).toBe(3)
  })
})
