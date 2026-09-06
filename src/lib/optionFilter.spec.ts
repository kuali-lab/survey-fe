import { describe, it, expect } from 'vitest'
import type { Question } from './types.js'
import {
  buildOptionFilter,
  filterDisabledHint,
  filterEmptyMessage,
  getFilterDependents,
  getFilterSourceIds,
  hasOptionFilter,
  optionFilterKey,
  resolveAttrValue,
} from './optionFilter.js'
import { buildAsyncOptionParams } from './api.js'

function q(partial: Partial<Question> & { id: string; type: Question['type'] }): Question {
  return {
    title: partial.id,
    description: null,
    required: false,
    sortOrder: 0,
    groupId: null,
    imageUrl: null,
    imageLayout: null,
    ...partial,
  }
}

const wilayah = q({ id: 'w', type: 'region', regionDepth: 2 })
const jenjang = q({
  id: 'j',
  type: 'single_choice',
  options: [
    { id: 'o1', label: 'Sekolah Dasar', value: 'SD', sortOrder: 0 },
    { id: 'o2', label: 'SLB', value: '', sortOrder: 1 },
    { id: 'o3', label: 'Lainnya', sortOrder: 2, isOther: true },
  ],
})
const sekolah = q({
  id: 's',
  type: 'dropdown',
  hasAsyncOptions: true,
  filterConfig: { region: { sourceQuestionId: 'w' }, attrs: [{ key: 'jenjang', sourceQuestionId: 'j' }] },
})
const plain = q({ id: 'p', type: 'dropdown', hasAsyncOptions: true })
const questions = [wilayah, jenjang, sekolah, plain]

describe('filter sources / dependents', () => {
  it('lists region then attr sources, deduped', () => {
    expect(getFilterSourceIds(sekolah)).toEqual(['w', 'j'])
    expect(getFilterSourceIds(plain)).toEqual([])
    expect(hasOptionFilter(sekolah)).toBe(true)
    expect(hasOptionFilter(plain)).toBe(false)
  })

  it('finds dependents of a source question', () => {
    expect(getFilterDependents('w', questions).map((x) => x.id)).toEqual(['s'])
    expect(getFilterDependents('j', questions).map((x) => x.id)).toEqual(['s'])
    expect(getFilterDependents('s', questions)).toEqual([])
  })
})

describe('resolveAttrValue — label → option.value', () => {
  it('maps a label to its option value', () => {
    expect(resolveAttrValue(jenjang, 'Sekolah Dasar')).toBe('SD')
  })
  it('falls back to the label when value is empty', () => {
    expect(resolveAttrValue(jenjang, 'SLB')).toBe('SLB')
  })
  it('falls back to the label when the option is unknown (Other free text)', () => {
    expect(resolveAttrValue(jenjang, 'Pesantren')).toBe('Pesantren')
  })
  it('returns empty for unanswered', () => {
    expect(resolveAttrValue(jenjang, null)).toBe('')
    expect(resolveAttrValue(jenjang, '  ')).toBe('')
    expect(resolveAttrValue(undefined, 'X')).toBe('X')
  })
})

describe('buildOptionFilter', () => {
  it('returns null until every source is answered', () => {
    expect(buildOptionFilter(sekolah, {}, questions)).toBeNull()
    expect(buildOptionFilter(sekolah, { w: '18.09' }, questions)).toBeNull()
    expect(buildOptionFilter(sekolah, { j: 'SLB' }, questions)).toBeNull()
    expect(buildOptionFilter(sekolah, { w: '18.09', j: '' }, questions)).toBeNull()
  })

  it('builds regionCode + attrs (value, not label) when all sources are answered', () => {
    expect(buildOptionFilter(sekolah, { w: '18.09', j: 'Sekolah Dasar' }, questions)).toEqual({
      regionCode: '18.09',
      attrs: { jenjang: 'SD' },
    })
    expect(buildOptionFilter(sekolah, { w: '18.09', j: 'SLB' }, questions)).toEqual({
      regionCode: '18.09',
      attrs: { jenjang: 'SLB' },
    })
  })

  it('yields null for questions without filterConfig', () => {
    expect(buildOptionFilter(plain, { w: '18.09', j: 'SLB' }, questions)).toBeNull()
  })

  it('region-only and attr-only configs work independently', () => {
    const regionOnly = q({ id: 'r', type: 'dropdown', filterConfig: { region: { sourceQuestionId: 'w' } } })
    expect(buildOptionFilter(regionOnly, { w: '36.03' }, questions)).toEqual({ regionCode: '36.03' })
    const attrOnly = q({ id: 'a', type: 'dropdown', filterConfig: { attrs: [{ key: 'jenjang', sourceQuestionId: 'j' }] } })
    expect(buildOptionFilter(attrOnly, { j: 'Sekolah Dasar' }, questions)).toEqual({ attrs: { jenjang: 'SD' } })
  })

  it('has a stable key that ignores attr insertion order', () => {
    expect(optionFilterKey({ regionCode: '1', attrs: { a: 'x', b: 'y' } }))
      .toBe(optionFilterKey({ regionCode: '1', attrs: { b: 'y', a: 'x' } }))
    expect(optionFilterKey(null)).toBe('')
    expect(optionFilterKey({ regionCode: '1' })).not.toBe(optionFilterKey({ regionCode: '2' }))
  })
})

describe('buildAsyncOptionParams — query string', () => {
  it('emits regionCode= and attr[<key>]=', () => {
    const p = buildAsyncOptionParams('', 50, 0, { regionCode: '18.09', attrs: { jenjang: 'SD', status: 'Negeri' } })
    expect(p.get('regionCode')).toBe('18.09')
    expect(p.get('attr[jenjang]')).toBe('SD')
    expect(p.get('attr[status]')).toBe('Negeri')
    expect(p.get('limit')).toBe('50')
    expect(p.has('q')).toBe(false)
    expect(p.has('offset')).toBe(false)
  })

  it('leaves the old query byte-identical without a filter', () => {
    expect(buildAsyncOptionParams('sd n', 50, 100).toString()).toBe('q=sd+n&limit=50&offset=100')
    expect(buildAsyncOptionParams('sd n', 50, 100, null).toString()).toBe('q=sd+n&limit=50&offset=100')
  })

  it('url-encodes the bracketed attr key', () => {
    expect(buildAsyncOptionParams('', 50, 0, { attrs: { jenjang: 'SD' } }).toString()).toBe('limit=50&attr%5Bjenjang%5D=SD')
  })
})

describe('hint / empty-state wording', () => {
  it('names the source questions in the disabled hint', () => {
    expect(filterDisabledHint(sekolah)).toBe('Jawab pertanyaan Wilayah dan Jenjang terlebih dahulu.')
    expect(filterDisabledHint(plain)).toBe('')
  })

  it('names BOTH source answers in the empty state', () => {
    expect(filterEmptyMessage(sekolah, 'Kabupaten Pesawaran', ['SLB']))
      .toBe('Tidak ada pilihan SLB di Kabupaten Pesawaran. Periksa kembali jawaban Wilayah dan Jenjang.')
  })

  it('degrades to region-only / attr-only wording', () => {
    const regionOnly = q({ id: 'r', type: 'dropdown', filterConfig: { region: { sourceQuestionId: 'w' } } })
    expect(filterEmptyMessage(regionOnly, 'Kabupaten Pesawaran', []))
      .toBe('Tidak ada pilihan di Kabupaten Pesawaran. Periksa kembali jawaban Wilayah.')
    const attrOnly = q({ id: 'a', type: 'dropdown', filterConfig: { attrs: [{ key: 'jenjang', sourceQuestionId: 'j' }] } })
    expect(filterEmptyMessage(attrOnly, '', ['SLB']))
      .toBe('Tidak ada pilihan untuk SLB. Periksa kembali jawaban Jenjang.')
  })
})
