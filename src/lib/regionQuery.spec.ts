import { describe, expect, it } from 'vitest'
import { normalizeRegionQuery } from './regionQuery.js'

describe('normalizeRegionQuery', () => {
  it.each([
    ['DKI', 'jakarta'],
    ['DKI Jakarta', 'jakarta'],
    ['D.K.I.', 'jakarta'],
    ['diy', 'yogyakarta'],
    ['NTT', 'nusa tenggara timur'],
    ['Prov. D.K.I. Jakarta', 'jakarta'],
    ['Kab. Tangerang', 'tangerang'],
    ['kabupaten tangerang', 'tangerang'],
    ['Kota Adm. Jakarta Pusat', 'jakarta pusat'],
    ['Kab. Adm. Kep. Seribu', 'kepulauan seribu'],
    ['Kec. Gambir', 'gambir'],
    ['  bandung  ', 'bandung'],
    ['Jawa', 'jawa'],
  ])('%s → %s', (input, want) => {
    expect(normalizeRegionQuery(input)).toBe(want)
  })

  it('keeps a bare prefix so the search still narrows', () => {
    expect(normalizeRegionQuery('kota')).toBe('kota')
    expect(normalizeRegionQuery('Kab.')).toBe('Kab.')
  })

  it('returns empty for blank input', () => {
    expect(normalizeRegionQuery('   ')).toBe('')
  })
})
