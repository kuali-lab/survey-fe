import { describe, it, expect } from 'vitest'
import type { Question, QuestionOption } from './types.js'
import {
  collectDependents,
  dependencyDisabledHint,
  dependencyEmptyMessage,
  dependencyParentLabel,
  getDependencyDependents,
  getDependencySourceId,
  isDependentAnswerVisible,
  optionKey,
  parentKey,
  pruneDependentAnswers,
  sourceAnswerKeys,
  visibleOptions,
} from './optionDependency.js'
import { buildMockSurvey } from './mockSurvey.js'

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

let n = 0
const o = (label: string, extra: Partial<QuestionOption> = {}): QuestionOption => ({
  id: `o${n++}`, label, sortOrder: n, ...extra,
})

// Kota → Mall → Brand. Kota keys are values; Mall/Brand keys are labels.
const kota = q({
  id: 'kota', type: 'single_choice', sortOrder: 1,
  title: '<p>Kota <b>domisili</b>&nbsp;Anda</p>',
  options: [o('Jakarta', { value: ' JKT ' }), o('Bandung', { value: 'BDG' }), o('Lainnya', { isOther: true })],
})
const mall = q({
  id: 'mall', type: 'dropdown', sortOrder: 2, titlePlain: 'Mal favorit?',
  options: [o('Grand Indonesia'), o('Paris Van Java', { value: '' }), o('Plaza Senayan'), o('Unmapped Mall'), o('Lainnya', { isOther: true })],
  dependsOn: {
    sourceQuestionId: 'kota',
    allowed: {
      'Grand Indonesia': ['JKT'],
      'Paris Van Java': ['BDG'],
      'Plaza Senayan': ['JKT', 'GHOST'],
      'Ghost Mall': ['JKT'],
      'Unmapped Mall': [],
    },
  },
})
const brand = q({
  id: 'brand', type: 'single_choice', sortOrder: 3, required: true,
  options: [o('Uniqlo'), o('Zara')],
  dependsOn: { sourceQuestionId: 'mall', allowed: { Uniqlo: ['Grand Indonesia', 'Paris Van Java'], Zara: ['Grand Indonesia'] } },
})
// Catalog-filtered dropdown hanging off the brand (filterConfig relation).
const outlet = q({
  id: 'outlet', type: 'dropdown', sortOrder: 4, hasAsyncOptions: true,
  filterConfig: { attrs: [{ key: 'brand', sourceQuestionId: 'brand' }] },
})
const other = q({ id: 'nama', type: 'short_text', sortOrder: 5 })
const questions = [kota, mall, brand, outlet, other]

const labels = (xs: QuestionOption[]) => xs.map((x) => x.label)

describe('optionKey', () => {
  it('uses trimmed value, else trimmed label', () => {
    expect(optionKey({ label: 'Jakarta', value: ' JKT ' })).toBe('JKT')
    expect(optionKey({ label: ' Paris Van Java ', value: '  ' })).toBe('Paris Van Java')
    expect(optionKey({ label: 'Zara' })).toBe('Zara')
  })
})

describe('source / dependents', () => {
  it('reads the source id only for plain choice questions', () => {
    expect(getDependencySourceId(mall)).toBe('kota')
    expect(getDependencySourceId(kota)).toBe('')
    expect(getDependencySourceId({ ...mall, hasAsyncOptions: true })).toBe('')
    expect(getDependencySourceId({ ...mall, type: 'checkbox' })).toBe('')
  })

  it('lists direct dependents', () => {
    expect(getDependencyDependents('kota', questions).map((x) => x.id)).toEqual(['mall'])
    expect(getDependencyDependents('brand', questions)).toEqual([])
  })

  it('collects the transitive closure across both relations', () => {
    expect(collectDependents('kota', questions)).toEqual(['mall', 'brand', 'outlet'])
    expect(collectDependents('mall', questions)).toEqual(['brand', 'outlet'])
    expect(collectDependents('brand', questions)).toEqual(['outlet'])
    expect(collectDependents('nama', questions)).toEqual([])
  })

  it('does not loop on a (corrupt) cycle', () => {
    const a = q({ id: 'a', type: 'single_choice', dependsOn: { sourceQuestionId: 'b', allowed: {} } })
    const b = q({ id: 'b', type: 'single_choice', dependsOn: { sourceQuestionId: 'a', allowed: {} } })
    expect(collectDependents('a', [a, b])).toEqual(['b'])
  })
})

describe('parentKey', () => {
  it('maps the chosen label to its option key', () => {
    expect(parentKey(mall, { kota: 'Jakarta' }, questions)).toBe('JKT')
    expect(parentKey(brand, { mall: 'Paris Van Java' }, questions)).toBe('Paris Van Java')
  })
  it('is null for unanswered and for Lainnya free text', () => {
    expect(parentKey(mall, {}, questions)).toBeNull()
    expect(parentKey(mall, { kota: 'Bogor' }, questions)).toBeNull()
    expect(parentKey(mall, { kota: 'Lainnya' }, questions)).toBeNull()
    expect(parentKey(kota, { kota: 'Jakarta' }, questions)).toBeNull()
  })
})

describe('visibleOptions', () => {
  it('inactive without a dependency (all options)', () => {
    const v = visibleOptions(kota, {}, questions)
    expect(v.status).toBe('inactive')
    expect(v.options).toBe(kota.options)
  })

  it('inactive when the source is missing or not a plain choice', () => {
    expect(visibleOptions(mall, {}, [mall]).status).toBe('inactive')
    const asyncKota = { ...kota, hasAsyncOptions: true }
    expect(visibleOptions(mall, {}, [asyncKota, mall]).status).toBe('inactive')
  })

  it('waiting while the parent is unanswered', () => {
    expect(visibleOptions(mall, {}, questions)).toEqual({ status: 'waiting', options: [] })
    expect(visibleOptions(mall, { kota: '  ' }, questions).status).toBe('waiting')
    expect(visibleOptions(mall, { kota: null }, questions).status).toBe('waiting')
  })

  it('ready: only mapped options for the parent key, Lainnya kept, unknown keys ignored', () => {
    const v = visibleOptions(mall, { kota: 'Jakarta' }, questions)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['Grand Indonesia', 'Plaza Senayan', 'Lainnya'])
    expect(labels(visibleOptions(mall, { kota: 'Bandung' }, questions).options)).toEqual(['Paris Van Java', 'Lainnya'])
  })

  it('empty: parent answered but nothing mapped (Lainnya may remain)', () => {
    const v = visibleOptions(brand, { mall: 'Plaza Senayan' }, questions)
    expect(v).toEqual({ status: 'empty', options: [] })
    const withOther = visibleOptions(mall, { kota: 'Bogor' }, questions)
    expect(withOther.status).toBe('empty')
    expect(labels(withOther.options)).toEqual(['Lainnya'])
  })

  it('Lainnya free-text parent shows no mapped options even if the text equals a key', () => {
    // "JKT" is a key, but not a label of any Kota option → free text.
    const v = visibleOptions(mall, { kota: 'JKT' }, questions)
    expect(v.status).toBe('empty')
    expect(labels(v.options)).toEqual(['Lainnya'])
  })
})

describe('isDependentAnswerVisible', () => {
  it('handles every state', () => {
    expect(isDependentAnswerVisible(mall, { kota: 'Jakarta' }, questions)).toBe(true) // unanswered
    expect(isDependentAnswerVisible(mall, { mall: 'Grand Indonesia' }, questions)).toBe(false) // waiting
    expect(isDependentAnswerVisible(mall, { kota: 'Jakarta', mall: 'Grand Indonesia' }, questions)).toBe(true)
    expect(isDependentAnswerVisible(mall, { kota: 'Bandung', mall: 'Grand Indonesia' }, questions)).toBe(false)
    expect(isDependentAnswerVisible(mall, { kota: 'Bandung', mall: 'Mal kecil dekat rumah' }, questions)).toBe(true) // Lainnya text
    expect(isDependentAnswerVisible(brand, { mall: 'Grand Indonesia', brand: 'Custom' }, questions)).toBe(false) // unknown label, no Lainnya: not selectable
    expect(isDependentAnswerVisible(kota, { kota: 'Jakarta' }, questions)).toBe(true) // inactive
  })
})

describe('pruneDependentAnswers (draft self-heal)', () => {
  it('keeps a consistent draft untouched', () => {
    const answers = { kota: 'Jakarta', mall: 'Grand Indonesia', brand: 'Zara', outlet: 'X', nama: 'Budi' }
    const r = pruneDependentAnswers(answers, questions)
    expect(r.answers).toEqual(answers)
    expect(r.cleared).toEqual([])
  })

  it('drops a hidden answer and cascades through all levels (incl. catalog filter)', () => {
    const answers = { kota: 'Bandung', mall: 'Grand Indonesia', brand: 'Uniqlo', outlet: 'X', nama: 'Budi' }
    const r = pruneDependentAnswers(answers, questions)
    expect(r.answers).toEqual({ kota: 'Bandung', nama: 'Budi' })
    expect(r.cleared).toEqual(['mall', 'brand', 'outlet'])
    expect(answers.mall).toBe('Grand Indonesia') // input not mutated
  })

  it('drops only the deepest level when the middle is still valid', () => {
    const r = pruneDependentAnswers({ kota: 'Jakarta', mall: 'Plaza Senayan', brand: 'Zara', outlet: 'X' }, questions)
    expect(r.answers).toEqual({ kota: 'Jakarta', mall: 'Plaza Senayan' })
    expect(r.cleared).toEqual(['brand', 'outlet'])
  })

  it('drops dependents whose parent is unanswered in the draft', () => {
    const r = pruneDependentAnswers({ mall: 'Grand Indonesia', brand: 'Zara' }, questions)
    expect(r.answers).toEqual({})
    expect(r.cleared).toEqual(['mall', 'brand'])
  })

  it('walks by sortOrder, not array order', () => {
    const shuffled = [brand, outlet, mall, other, kota]
    const r = pruneDependentAnswers({ kota: 'Bandung', mall: 'Grand Indonesia', brand: 'Uniqlo' }, shuffled)
    expect(r.cleared).toEqual(['mall', 'brand'])
  })
})

describe('messages', () => {
  it('disabled hint uses the plain parent title (HTML stripped)', () => {
    expect(dependencyDisabledHint(mall, questions)).toBe('Jawab pertanyaan Kota domisili Anda terlebih dahulu.')
    expect(dependencyDisabledHint(brand, questions)).toBe('Jawab pertanyaan Mal favorit terlebih dahulu.')
  })

  it('empty message names the parent answer and parent title', () => {
    expect(dependencyParentLabel(brand, { mall: ' Plaza Senayan ' })).toBe('Plaza Senayan')
    expect(dependencyEmptyMessage(brand, 'Plaza Senayan', questions)).toBe(
      'Tidak ada pilihan untuk Plaza Senayan. Periksa kembali jawaban Mal favorit.',
    )
  })
})

describe('mock survey demo block', () => {
  const survey = buildMockSurvey('mock')
  const qs = survey.questions
  const byId = (id: string) => qs.find((x) => x.id === id)!

  it('is a three-level chain in sort order', () => {
    const [k, m, b] = ['cascade-kota', 'cascade-mall', 'cascade-brand'].map(byId)
    expect(k.sortOrder).toBeLessThan(m.sortOrder)
    expect(m.sortOrder).toBeLessThan(b.sortOrder)
    expect(collectDependents('cascade-kota', qs)).toEqual(['cascade-mall', 'cascade-brand'])
  })

  it('narrows malls by city and brands by mall (brands shared across malls)', () => {
    const m = byId('cascade-mall')
    const b = byId('cascade-brand')
    expect(labels(visibleOptions(m, { 'cascade-kota': 'Bandung' }, qs).options)).toEqual(['Paris Van Java', '23 Paskal', 'Lainnya'])
    const gi = labels(visibleOptions(b, { 'cascade-mall': 'Grand Indonesia' }, qs).options)
    const tp = labels(visibleOptions(b, { 'cascade-mall': 'Tunjungan Plaza' }, qs).options)
    expect(gi).toContain('Zara')
    expect(tp).toContain('Zara')
    expect(visibleOptions(b, { 'cascade-mall': 'Trans Studio Mall Makassar' }, qs).status).toBe('empty')
  })
})

// ── carryOver mode (§B, "Hubungkan Jawaban/Pilihan Lain") ──────────────────
// Dynamic: whatever the source answered becomes the include/exclude set for
// the target's own options, live — no authored per-option map. Source:
// dropdown / checkbox only (both natively multi-valued-friendly, unlike
// mapped mode's single-key requirement).
const alergiOpts = () => [o('Kacang'), o('Susu'), o('Telur'), o('Lainnya', { isOther: true })]
const alergi = q({ id: 'alergi', type: 'checkbox', sortOrder: 1, options: alergiOpts() })
const alergiParah = q({
  id: 'alergiParah', type: 'dropdown', sortOrder: 2, options: alergiOpts(),
  dependsOn: { sourceQuestionId: 'alergi', mode: 'carryOver', carryOverMode: 'include' },
})
const alergiAman = q({
  id: 'alergiAman', type: 'dropdown', sortOrder: 2, options: alergiOpts(),
  dependsOn: { sourceQuestionId: 'alergi', mode: 'carryOver', carryOverMode: 'exclude' },
})
const ukuran = q({
  id: 'ukuran', type: 'dropdown', sortOrder: 1,
  options: [o('S'), o('M'), o('L'), o('Lainnya', { isOther: true })],
})
const ukuranGudang = q({
  id: 'ukuranGudang', type: 'dropdown', sortOrder: 2,
  options: [o('S'), o('M'), o('L'), o('Lainnya', { isOther: true })],
  dependsOn: { sourceQuestionId: 'ukuran', mode: 'carryOver', carryOverMode: 'include' },
})
const carryOverQuestions = [alergi, alergiParah, alergiAman, ukuran, ukuranGudang]

describe('sourceAnswerKeys', () => {
  it('single-value answer → one key', () => {
    expect(sourceAnswerKeys(ukuran, 'M')).toEqual(['M'])
  })
  it('array answer (checkbox / multi-select dropdown) → N keys', () => {
    expect(sourceAnswerKeys(alergi, ['Kacang', 'Telur'])).toEqual(['Kacang', 'Telur'])
  })
  it('unanswered / empty → no keys', () => {
    expect(sourceAnswerKeys(ukuran, undefined)).toEqual([])
    expect(sourceAnswerKeys(alergi, [])).toEqual([])
  })
  it('free text ("Lainnya") falls back to the typed text itself, matching optionFilter.ts\'s resolveAttrValue fallback', () => {
    expect(sourceAnswerKeys(alergi, ['Udang'])).toEqual(['Udang'])
  })
})

describe('visibleOptions — carryOver mode', () => {
  it('include: only the picked keys are shown, Lainnya always passes through', () => {
    const v = visibleOptions(alergiParah, { alergi: ['Kacang', 'Telur'] }, carryOverQuestions)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['Kacang', 'Telur', 'Lainnya'])
  })

  it('exclude: the picked keys are hidden, everything else (+ Lainnya) stays', () => {
    const v = visibleOptions(alergiAman, { alergi: ['Kacang'] }, carryOverQuestions)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['Susu', 'Telur', 'Lainnya'])
  })

  it('a single-value dropdown source works the same way (one key)', () => {
    const v = visibleOptions(ukuranGudang, { ukuran: 'M' }, carryOverQuestions)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['M', 'Lainnya'])
  })

  it('waiting: source unanswered', () => {
    expect(visibleOptions(alergiParah, {}, carryOverQuestions)).toEqual({ status: 'waiting', options: [] })
  })

  it('waiting: checkbox source answered with an empty selection', () => {
    expect(visibleOptions(alergiParah, { alergi: [] }, carryOverQuestions)).toEqual({ status: 'waiting', options: [] })
  })

  it('empty: every picked key falls outside the target\'s own options (only Lainnya remains)', () => {
    const v = visibleOptions(alergiParah, { alergi: ['Udang'] }, carryOverQuestions)
    expect(v.status).toBe('empty')
    expect(labels(v.options)).toEqual(['Lainnya'])
  })

  it('a downstream mapped-mode question still resolves correctly when its own source uses carryOver mode', () => {
    // alergiParah (carryOver target of `alergi`) is itself the MAPPED-mode
    // source of `alergiFollow`. Mapped-mode resolution only reads
    // alergiParah's own options + stored answer, independent of how
    // alergiParah computed its own visible set.
    const alergiFollow = q({
      id: 'alergiFollow', type: 'single_choice', sortOrder: 3,
      options: [o('AmanKacang'), o('AmanTelur')],
      dependsOn: { sourceQuestionId: 'alergiParah', allowed: { AmanKacang: ['Kacang'], AmanTelur: ['Telur'] } },
    })
    const qs = [...carryOverQuestions, alergiFollow]
    const answers = { alergi: ['Kacang'], alergiParah: 'Kacang' }
    const v = visibleOptions(alergiFollow, answers, qs)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['AmanKacang'])
  })
})

// ── carryOver TARGET may now be checkbox too (inline only), not dropdown-only
// — locked cross-repo contract. The target's own type must not matter to
// visibleOptions(): same source, same answers, same result whether the
// target is a dropdown or a checkbox.
describe('visibleOptions — carryOver mode, checkbox as TARGET', () => {
  const alergiParahCheckbox = q({
    id: 'alergiParahCheckbox', type: 'checkbox', sortOrder: 2, options: alergiOpts(),
    dependsOn: { sourceQuestionId: 'alergi', mode: 'carryOver', carryOverMode: 'include' },
  })
  const alergiAmanCheckbox = q({
    id: 'alergiAmanCheckbox', type: 'checkbox', sortOrder: 2, options: alergiOpts(),
    dependsOn: { sourceQuestionId: 'alergi', mode: 'carryOver', carryOverMode: 'exclude' },
  })
  const ukuranGudangCheckbox = q({
    id: 'ukuranGudangCheckbox', type: 'checkbox', sortOrder: 2,
    options: [o('S'), o('M'), o('L'), o('Lainnya', { isOther: true })],
    dependsOn: { sourceQuestionId: 'ukuran', mode: 'carryOver', carryOverMode: 'include' },
  })
  const qs = [...carryOverQuestions, alergiParahCheckbox, alergiAmanCheckbox, ukuranGudangCheckbox]

  it('include: checkbox target, checkbox source — same result as the dropdown-target test above', () => {
    const v = visibleOptions(alergiParahCheckbox, { alergi: ['Kacang', 'Telur'] }, qs)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['Kacang', 'Telur', 'Lainnya'])
  })

  it('exclude: checkbox target, checkbox source', () => {
    const v = visibleOptions(alergiAmanCheckbox, { alergi: ['Kacang'] }, qs)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['Susu', 'Telur', 'Lainnya'])
  })

  it('include: checkbox target, dropdown source (single-value answer)', () => {
    const v = visibleOptions(ukuranGudangCheckbox, { ukuran: 'M' }, qs)
    expect(v.status).toBe('ready')
    expect(labels(v.options)).toEqual(['M', 'Lainnya'])
  })

  it('waiting / empty behave the same regardless of the target\'s own type', () => {
    expect(visibleOptions(alergiParahCheckbox, {}, qs)).toEqual({ status: 'waiting', options: [] })
    expect(visibleOptions(alergiParahCheckbox, { alergi: ['Udang'] }, qs).status).toBe('empty')
  })

  it('getDependencySourceId resolves for a checkbox target under carryOver mode', () => {
    expect(getDependencySourceId(alergiParahCheckbox)).toBe('alergi')
  })
})
