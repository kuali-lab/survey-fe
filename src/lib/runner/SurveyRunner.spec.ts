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
