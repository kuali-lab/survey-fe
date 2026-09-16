import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Question, SkipRule, Survey } from '$lib/types.js'
import { SurveyRunner } from './SurveyRunner.svelte.js'

/**
 * Ragam survei di luar mode tampilan. Ditaruh dalam satu objek supaya pembantu
 * `makeSurvey`/`makeRunner` tidak tumbuh jadi deret parameter posisional.
 */
type SurveyOverrides = {
  /** Dibiarkan `undefined` berarti kunci `allowBack` TIDAK ditulis sama sekali —
   *  itulah bentuk survei dari singgahan localStorage lama. */
  allowBack?: boolean
  skipRules?: SkipRule[]
}

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

function makeSurvey(
  displayMode: 'scroll' | 'one_per_page' = 'one_per_page',
  overrides: SurveyOverrides = {},
): Survey {
  return {
    id: 'sv',
    title: 'PID',
    settings: {
      showProgress: true, showBranding: true, showNavArrows: true, showNumbers: true, displayMode,
      ...(overrides.allowBack === undefined ? {} : { allowBack: overrides.allowBack }),
    },
    skipRules: overrides.skipRules ?? [],
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

function makeRunner(
  displayMode: 'scroll' | 'one_per_page' = 'one_per_page',
  onDependentsCleared?: (ids: string[]) => void,
  overrides: SurveyOverrides & { enforceAllowBack?: boolean } = {},
) {
  const survey = makeSurvey(displayMode, overrides)
  return new SurveyRunner({
    getSurvey: () => survey,
    onFinish: () => {},
    autoSubmit: false,
    onDependentsCleared,
    ...(overrides.enforceAllowBack === undefined ? {} : { enforceAllowBack: overrides.enforceAllowBack }),
  })
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

// ─── M1 No-Back: larangan kembali ke pertanyaan sebelumnya ───────────────────
// Penegakannya HARUS di runner. Tombol "Sebelumnya" cuma satu dari lima jalan
// mundur (tombol responden, tombol surveyor, roda tetikus, gestur sentuh, papan
// ketik) dan kelimanya bermuara di handleBack — menyembunyikan tombol saja lolos
// empat sisanya.

const navHistoryOf = (r: SurveyRunner) => (r as unknown as { navHistory: number[] }).navHistory

// Tiruan `window`/`document` seminimal mungkin: handleWheel dan handleTouchEnd
// memutuskan arah gestur dari posisi gulir, dan lingkungan uji `node` tidak
// menyediakan keduanya. Hanya properti yang benar-benar dibaca runner yang diisi.
function stubScrollWindow() {
  vi.stubGlobal('window', { scrollY: 0, innerHeight: 800, scrollTo: () => {} })
  vi.stubGlobal('document', { documentElement: { scrollHeight: 2000 } })
}

// Runner menolak tombol papan ketik yang datang dari kolom isian, jadi tiruannya
// wajib membawa tagName non-input.
function keyboardEvent(key: string): KeyboardEvent {
  return {
    key,
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault: () => {},
  } as unknown as KeyboardEvent
}

// Menjawab 'SD' di 'j' melompat maju ke 'n' (melewati 's'), sehingga navHistory
// terisi dan cabang pop di handleBack jadi hidup.
const skipRuleJtoN: SkipRule = {
  id: 'r1', questionId: 'j', sourceQuestionId: 'j', operator: 'equals', value: 'SD',
  action: 'skip_to', targetQuestionId: 'n', logicGroup: 'AND:0',
}

describe('SurveyRunner — No-Back guard (settings.allowBack)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows going back when allowBack is true', () => {
    const r = makeRunner('one_per_page', undefined, { allowBack: true })
    r.loadFrom({ answers: {}, currentIndex: 1 })
    expect(r.canGoBack).toBe(true)
    r.handleBack()
    expect(r.currentIndex).toBe(0)
  })

  it('blocks going back when allowBack is false', () => {
    const r = makeRunner('one_per_page', undefined, { allowBack: false })
    r.loadFrom({ answers: {}, currentIndex: 1 })
    expect(r.canGoBack).toBe(false)
    r.handleBack()
    expect(r.currentIndex).toBe(1)
  })

  it('treats a missing allowBack (old survey cache) as allowed', () => {
    const r = makeRunner('one_per_page')
    r.loadFrom({ answers: {}, currentIndex: 1 })
    expect(r.canGoBack).toBe(true)
    r.handleBack()
    expect(r.currentIndex).toBe(0)
  })

  it('reports canGoBack false in scroll mode without throwing', () => {
    const r = makeRunner('scroll', undefined, { allowBack: false })
    expect(r.canGoBack).toBe(false)
    expect(() => r.handleBack()).not.toThrow()
    expect(r.currentIndex).toBe(0)
  })

  it('does not pop navHistory after a skip-logic forward jump', () => {
    const r = makeRunner('one_per_page', undefined, { allowBack: false, skipRules: [skipRuleJtoN] })
    void r.handleNext()
    r.handleAnswer('j', 'SD')
    r.cancelAutoAdvance()
    void r.handleNext()
    expect(r.currentIndex).toBe(3)
    expect(navHistoryOf(r)).toEqual([0, 1])

    r.handleBack()

    expect(r.currentIndex).toBe(3)
    expect(navHistoryOf(r)).toEqual([0, 1])
  })

  it('keeps the restored index after loadFrom when allowBack is false', () => {
    const r = makeRunner('one_per_page', undefined, { allowBack: false })
    r.loadFrom({ answers: {}, currentIndex: 3 })
    expect(r.currentIndex).toBe(3)
    r.handleBack()
    expect(r.currentIndex).toBe(3)
  })

  it('ignores ArrowUp when allowBack is false', () => {
    const r = makeRunner('one_per_page', undefined, { allowBack: false })
    r.loadFrom({ answers: {}, currentIndex: 2 })
    r.handleKeydown(keyboardEvent('ArrowUp'))
    expect(r.currentIndex).toBe(2)
  })

  it('ignores an upward wheel at the top of the page when allowBack is false', () => {
    stubScrollWindow()
    const r = makeRunner('one_per_page', undefined, { allowBack: false })
    r.loadFrom({ answers: {}, currentIndex: 2 })
    r.handleWheel({ deltaY: -50 } as unknown as WheelEvent)
    expect(r.currentIndex).toBe(2)
  })

  it('ignores a downward swipe at the top of the page when allowBack is false', () => {
    stubScrollWindow()
    const r = makeRunner('one_per_page', undefined, { allowBack: false })
    r.loadFrom({ answers: {}, currentIndex: 2 })
    r.handleTouchStart({ touches: [{ clientY: 20 }] } as unknown as TouchEvent)
    r.handleTouchEnd({ changedTouches: [{ clientY: 220 }] } as unknown as TouchEvent)
    expect(r.currentIndex).toBe(2)
  })

  it('still moves forward when allowBack is false', () => {
    const r = makeRunner('one_per_page', undefined, { allowBack: false })
    void r.handleNext()
    expect(r.currentIndex).toBe(1)
  })

  it('keeps navigation open for the surveyor flow (enforcement off)', () => {
    // Alur surveyor memakai runner yang sama, tapi layar rekapnya justru dibangun
    // untuk koreksi saat wawancara. Larangan ini hanya untuk responden.
    const r = makeRunner('one_per_page', undefined, { allowBack: false, enforceAllowBack: false })
    r.loadFrom({ answers: {}, currentIndex: 1 })
    expect(r.canGoBack).toBe(true)
    r.handleBack()
    expect(r.currentIndex).toBe(0)
  })
})
