import { describe, it, expect, vi } from 'vitest'
import type { Question, Survey } from '$lib/types.js'
import { SurveyRunner } from './SurveyRunner.svelte.js'

function q(partial: Partial<Question> & { id: string; type: Question['type']; sortOrder: number }): Question {
  return {
    title: partial.id,
    description: null,
    required: false,
    groupId: null,
    imageUrl: null,
    imageLayout: null,
    ...partial,
  }
}

function makeSurvey(displayMode: 'scroll' | 'one_per_page' = 'one_per_page'): Survey {
  return {
    id: 'sv',
    title: 'PID',
    settings: { showProgress: true, showBranding: true, showNavArrows: true, showNumbers: true, displayMode },
    skipRules: [],
    closeMessage: null,
    closeImageUrl: null,
    questions: [
      q({ id: 'w', type: 'region', sortOrder: 1, regionDepth: 2 }),
      q({
        id: 'j', type: 'single_choice', sortOrder: 2,
        options: [{ id: 'o1', label: 'SD', value: 'SD', sortOrder: 0 }, { id: 'o2', label: 'SLB', value: 'SLB', sortOrder: 1 }],
      }),
      q({
        id: 's', type: 'dropdown', sortOrder: 3, hasAsyncOptions: true,
        filterConfig: { region: { sourceQuestionId: 'w' }, attrs: [{ key: 'jenjang', sourceQuestionId: 'j' }] },
      }),
      q({ id: 'n', type: 'short_text', sortOrder: 4 }),
    ],
  }
}

function makeRunner(displayMode: 'scroll' | 'one_per_page' = 'one_per_page', onDependentsCleared?: (ids: string[]) => void) {
  const survey = makeSurvey(displayMode)
  return new SurveyRunner({ getSurvey: () => survey, onFinish: () => {}, autoSubmit: false, onDependentsCleared })
}

describe('SurveyRunner.handleAnswer — filter source invalidation', () => {
  it('clears the dependent dropdown when the region source changes', () => {
    const cleared = vi.fn()
    const r = makeRunner('one_per_page', cleared)
    r.loadFrom({ answers: { w: '18.09', j: 'SLB', s: '10800001 - SLB NEGERI PESAWARAN' }, currentIndex: 0 })

    r.handleAnswer('w', '18.10')

    expect(r.answers).toEqual({ w: '18.10', j: 'SLB' })
    expect('s' in r.answers).toBe(false)
    expect(cleared).toHaveBeenCalledWith(['s'])
  })

  it('clears the dependent dropdown when the attr source changes', () => {
    const r = makeRunner()
    r.loadFrom({ answers: { w: '18.09', j: 'SLB', s: 'X' }, currentIndex: 0 })
    r.handleAnswer('j', 'SD')
    expect(r.answers).toEqual({ w: '18.09', j: 'SD' })
  })

  it('clears the dependent when the source is emptied (null)', () => {
    const r = makeRunner()
    r.loadFrom({ answers: { w: '18.09', j: 'SLB', s: 'X' }, currentIndex: 0 })
    r.handleAnswer('w', null)
    expect(r.answers).toEqual({ w: null, j: 'SLB' })
  })

  it('does NOT clear when the same source value is re-emitted', () => {
    const cleared = vi.fn()
    const r = makeRunner('one_per_page', cleared)
    r.loadFrom({ answers: { w: '18.09', j: 'SLB', s: 'X' }, currentIndex: 0 })
    r.handleAnswer('w', '18.09')
    expect(r.answers).toEqual({ w: '18.09', j: 'SLB', s: 'X' })
    expect(cleared).not.toHaveBeenCalled()
  })

  it('leaves unrelated questions alone', () => {
    const cleared = vi.fn()
    const r = makeRunner('one_per_page', cleared)
    r.loadFrom({ answers: { w: '18.09', j: 'SLB', s: 'X' }, currentIndex: 0 })
    r.handleAnswer('n', 'hello')
    expect(r.answers).toEqual({ w: '18.09', j: 'SLB', s: 'X', n: 'hello' })
    expect(cleared).not.toHaveBeenCalled()
  })

  it('also drops a stale validation error on the cleared dependent', () => {
    const r = makeRunner()
    r.loadFrom({ answers: { w: '18.09', j: 'SLB', s: 'X' }, currentIndex: 0 })
    r.questionErrors = { s: 'Pilihan tidak sesuai.' }
    r.handleAnswer('w', '18.10')
    expect(r.questionErrors).toEqual({})
  })

  it('works the same in scroll (single page) mode', () => {
    const cleared = vi.fn()
    const r = makeRunner('scroll', cleared)
    r.loadFrom({ answers: { w: '18.09', j: 'SLB', s: 'X' }, currentIndex: 0 })
    r.handleAnswer('j', 'SD')
    expect('s' in r.answers).toBe(false)
    expect(cleared).toHaveBeenCalledWith(['s'])
  })
})

// ── Pilihan Bertingkat: Kota → Mall → Brand (+ a catalog filter off Brand) ──
function makeCascadeSurvey(opts: { brandRequired?: boolean; displayMode?: 'scroll' | 'one_per_page' } = {}): Survey {
  const opt = (label: string, i: number, extra: Record<string, unknown> = {}) => ({ id: `o-${label}`, label, sortOrder: i, ...extra })
  return {
    id: 'cascade',
    title: 'Belanja',
    settings: { showProgress: true, showBranding: true, showNavArrows: true, showNumbers: true, displayMode: opts.displayMode ?? 'one_per_page' },
    skipRules: [],
    closeMessage: null,
    closeImageUrl: null,
    questions: [
      q({ id: 'kota', type: 'single_choice', sortOrder: 1, options: [opt('Jakarta', 0, { value: 'JKT' }), opt('Makassar', 1, { value: 'MKS' })] }),
      q({
        id: 'mall', type: 'dropdown', sortOrder: 2,
        options: [opt('Grand Indonesia', 0), opt('Plaza Senayan', 1), opt('TSM Makassar', 2)],
        dependsOn: { sourceQuestionId: 'kota', allowed: { 'Grand Indonesia': ['JKT'], 'Plaza Senayan': ['JKT'], 'TSM Makassar': ['MKS'] } },
      }),
      q({
        id: 'brand', type: 'single_choice', sortOrder: 3, required: opts.brandRequired ?? false,
        options: [opt('Zara', 0), opt('Uniqlo', 1)],
        dependsOn: { sourceQuestionId: 'mall', allowed: { Zara: ['Grand Indonesia', 'Plaza Senayan'], Uniqlo: ['Grand Indonesia'] } },
      }),
      q({
        id: 'outlet', type: 'dropdown', sortOrder: 4, hasAsyncOptions: true,
        filterConfig: { attrs: [{ key: 'brand', sourceQuestionId: 'brand' }] },
      }),
      q({ id: 'nama', type: 'short_text', sortOrder: 5 }),
    ],
  }
}

function makeCascadeRunner(onDependentsCleared?: (ids: string[]) => void, opts: Parameters<typeof makeCascadeSurvey>[0] = {}) {
  const survey = makeCascadeSurvey(opts)
  return new SurveyRunner({ getSurvey: () => survey, onFinish: () => {}, autoSubmit: false, onDependentsCleared })
}

describe('SurveyRunner — Pilihan Bertingkat', () => {
  const full = { kota: 'Jakarta', mall: 'Grand Indonesia', brand: 'Uniqlo', outlet: 'Uniqlo GI Lt. 3', nama: 'Budi' }

  it('changing level 1 clears levels 2, 3 and the catalog dependent', () => {
    const cleared = vi.fn()
    const r = makeCascadeRunner(cleared)
    r.loadFrom({ answers: full, currentIndex: 0 })
    expect(cleared).not.toHaveBeenCalled()

    r.handleAnswer('kota', 'Makassar')

    expect(r.answers).toEqual({ kota: 'Makassar', nama: 'Budi' })
    expect(cleared).toHaveBeenCalledWith(['mall', 'brand', 'outlet'])
  })

  it('changing level 2 clears only the levels below it', () => {
    const r = makeCascadeRunner()
    r.loadFrom({ answers: full, currentIndex: 0 })
    r.handleAnswer('mall', 'Plaza Senayan')
    expect(r.answers).toEqual({ kota: 'Jakarta', mall: 'Plaza Senayan', nama: 'Budi' })
  })

  it('re-emitting the same parent value clears nothing', () => {
    const cleared = vi.fn()
    const r = makeCascadeRunner(cleared)
    r.loadFrom({ answers: full, currentIndex: 0 })
    r.handleAnswer('kota', 'Jakarta')
    expect(r.answers).toEqual(full)
    expect(cleared).not.toHaveBeenCalled()
  })

  it('draft resume drops no-longer-visible answers transitively and fires the callback', () => {
    const cleared = vi.fn()
    const r = makeCascadeRunner(cleared)
    // Draft saved before the researcher re-mapped Plaza Senayan away from Uniqlo.
    r.loadFrom({ answers: { kota: 'Jakarta', mall: 'Plaza Senayan', brand: 'Uniqlo', outlet: 'X', nama: 'Budi' }, currentIndex: 3 })
    expect(r.answers).toEqual({ kota: 'Jakarta', mall: 'Plaza Senayan', nama: 'Budi' })
    expect(cleared).toHaveBeenCalledWith(['brand', 'outlet'])
    expect(r.currentIndex).toBe(3)
  })

  it('draft resume drops a mall that no longer belongs to the drafted city', () => {
    const r = makeCascadeRunner()
    r.loadFrom({ answers: { kota: 'Makassar', mall: 'Grand Indonesia', brand: 'Zara' }, currentIndex: 0 })
    expect(r.answers).toEqual({ kota: 'Makassar' })
  })

  it('D-1: a required dependent with no visible option (parent answered) passes validation', async () => {
    const r = makeCascadeRunner(undefined, { brandRequired: true, displayMode: 'one_per_page' })
    r.loadFrom({ answers: { kota: 'Makassar', mall: 'TSM Makassar' }, currentIndex: 2 })
    expect(r.currentPage?.questions[0].id).toBe('brand')
    await r.handleNext()
    expect(r.questionErrors).toEqual({})
    expect(r.currentIndex).toBe(3)
  })

  it('a required dependent that still has options is enforced', async () => {
    const r = makeCascadeRunner(undefined, { brandRequired: true })
    r.loadFrom({ answers: { kota: 'Jakarta', mall: 'Plaza Senayan' }, currentIndex: 2 })
    await r.handleNext()
    expect(r.questionErrors.brand).toBe('Pertanyaan ini wajib diisi.')
    expect(r.currentIndex).toBe(2)
  })

  it('a required dependent waiting on its parent is enforced', async () => {
    const r = makeCascadeRunner(undefined, { brandRequired: true })
    r.loadFrom({ answers: {}, currentIndex: 2 })
    await r.handleNext()
    expect(r.questionErrors.brand).toBe('Pertanyaan ini wajib diisi.')
  })
})
