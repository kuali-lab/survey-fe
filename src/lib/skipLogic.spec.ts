import { describe, it, expect } from 'vitest'
import { evaluateNext, findFiredRule } from './skipLogic.js'
import type { Question, SkipRule, Answers } from './types.js'

/**
 * `number` answers now travel as the literal typed text (see numberInput.ts),
 * while drafts and outbox payloads written by earlier versions still hold real
 * numbers. Both shapes reach this engine, so both are pinned here.
 */

function numberQuestion(id: string): Question {
  return {
    id,
    type: 'number',
    title: id,
    description: null,
    required: false,
    sortOrder: 0,
    groupId: null,
    imageUrl: null,
    imageLayout: null,
  }
}

const Q_SRC = numberQuestion('q1')
const Q_HOST = numberQuestion('q2')
const Q_TARGET = numberQuestion('q3')
const QUESTIONS = [Q_SRC, Q_HOST, Q_TARGET]

function rule(operator: SkipRule['operator'], value: string): SkipRule {
  return {
    id: 'r1',
    questionId: 'q2',
    sourceQuestionId: 'q1',
    operator,
    value,
    action: 'skip_to',
    targetQuestionId: 'q3',
    logicGroup: 'AND:0',
  }
}

/** true when the rule fired (jumped to q3). */
function fires(operator: SkipRule['operator'], ruleValue: string, answer: Answers['x']): boolean {
  return evaluateNext('q2', { q1: answer }, QUESTIONS, [rule(operator, ruleValue)]) === 'q3'
}

describe('numeric operators — string answers behave like the old number answers', () => {
  const cases: Array<[SkipRule['operator'], string]> = [
    ['greater_than', '1000'],
    ['less_than', '1000'],
    ['greater_than_equals', '76359761'],
    ['less_than_equals', '76359761'],
  ]

  for (const [op, ruleValue] of cases) {
    it(`${op} matches a string answer exactly as it matched the number`, () => {
      // Same underlying quantity, one typed with leading zeros, one as a raw number.
      expect(fires(op, ruleValue, '0076359761')).toBe(fires(op, ruleValue, 76359761))
    })
  }

  it('greater_than sees through leading zeros', () => {
    expect(fires('greater_than', '1000', '0076359761')).toBe(true)
    expect(fires('greater_than', '1000', '0000999')).toBe(false)
  })

  it('less_than sees through leading zeros', () => {
    expect(fires('less_than', '1000', '0000999')).toBe(true)
  })

  it('a decimal string compares numerically', () => {
    expect(fires('greater_than', '3', '3.5')).toBe(true)
    expect(fires('less_than', '3', '2.75')).toBe(true)
  })
})

describe('emptiness — "0" is a real answer', () => {
  it('the string "0" is not empty', () => {
    expect(fires('empty', '', '0')).toBe(false)
    expect(fires('not_empty', '', '0')).toBe(true)
  })

  it('the number 0 from an older payload is not empty either', () => {
    expect(fires('empty', '', 0)).toBe(false)
    expect(fires('not_empty', '', 0)).toBe(true)
  })

  it('a cleared field (null) is empty', () => {
    expect(fires('empty', '', null)).toBe(true)
    expect(fires('not_empty', '', null)).toBe(false)
  })
})

describe('equals — compares text, so the literal now matters', () => {
  it('an ordinary number is unaffected', () => {
    expect(fires('equals', '42', '42')).toBe(true)
    expect(fires('equals', '42', 42)).toBe(true)
    expect(fires('not_equals', '42', '42')).toBe(false)
  })

  it('matches when the rule is written with the same leading zeros', () => {
    expect(fires('equals', '0076359761', '0076359761')).toBe(true)
  })

  /**
   * DELIBERATE, DOCUMENTED CHANGE. `equals` is a string comparison, so a rule
   * authored against the stripped form ("76359761") no longer matches an answer
   * typed as "0076359761" — it used to, because the leading zeros were destroyed
   * before the engine ever saw them. That destruction is precisely the defect
   * being fixed; the numeric operators (greater_than etc.) are unaffected
   * because they parseFloat first.
   */
  it('does NOT match a rule written without the leading zeros', () => {
    expect(fires('equals', '76359761', '0076359761')).toBe(false)
    expect(fires('not_equals', '76359761', '0076359761')).toBe(true)
  })

  it('a rule written against a decimal must match the typed form', () => {
    expect(fires('equals', '42', '42.0')).toBe(false)
    expect(fires('equals', '42.0', '42.0')).toBe(true)
  })
})

describe('contains — substring over the literal text', () => {
  it('finds a digit run inside the typed literal', () => {
    expect(fires('contains', '7635', '0076359761')).toBe(true)
    expect(fires('not_contains', '7635', '0076359761')).toBe(false)
  })

  it('can now find the leading zeros themselves', () => {
    expect(fires('contains', '00', '0076359761')).toBe(true)
  })
})

describe('Top of Mind answers — rules see the full selection', () => {
  const tom = { first: 'Aqua', selected: ['Aqua', 'Cleo'] }
  it('contains / equals match any selected option, including the first pick', () => {
    expect(fires('contains', 'Aqua', tom)).toBe(true)
    expect(fires('contains', 'Cleo', tom)).toBe(true)
    expect(fires('contains', 'Prima', tom)).toBe(false)
    expect(fires('equals', 'Cleo', tom)).toBe(true)
    expect(fires('not_contains', 'Prima', tom)).toBe(true)
  })
  it('empty / not_empty follow the first pick', () => {
    expect(fires('not_empty', '', tom)).toBe(true)
    expect(fires('empty', '', { first: '', selected: [] })).toBe(true)
  })
})

describe('go_back action', () => {
  const goBack: SkipRule = { ...rule('equals', 'x'), id: 'gb1', action: 'go_back', targetQuestionId: 'q1' }
  const args = ['q2', { q1: 'x' }, QUESTIONS] as const

  it('findFiredRule returns the go_back rule so callers can tell it from skip_to', () => {
    expect(findFiredRule(...args, [goBack])?.action).toBe('go_back')
    expect(findFiredRule(...args, [rule('equals', 'x')])?.action).toBe('skip_to')
  })

  it('evaluateNext keeps returning the target id (compat)', () => {
    expect(evaluateNext(...args, [goBack])).toBe('q1')
  })

  it('ignores a go_back rule already used this session', () => {
    expect(findFiredRule(...args, [goBack], new Set(['gb1']))).toBeNull()
  })

  it('the used set never mutes skip_to rules', () => {
    const skip = { ...rule('equals', 'x'), id: 'gb1' }
    expect(findFiredRule(...args, [skip], new Set(['gb1']))?.action).toBe('skip_to')
  })
})

describe('findFiredRule: sumber sel tabel', () => {
  const tableQ = { ...numberQuestion('t1'), type: 'table' as const }
  const cellRule = (id: string, operator: SkipRule['operator'], value: string, logicGroup = 'AND:0', col = 'c1'): SkipRule => ({
    ...rule(operator, value),
    id,
    sourceQuestionId: 't1',
    sourceRowKey: 'r1',
    sourceColumnId: col,
    logicGroup,
  })
  const qs = [tableQ, Q_SRC, Q_HOST, Q_TARGET]
  const fires = (rules: SkipRule[], answers: Answers) => findFiredRule('q2', answers, qs, rules) !== null

  it('angka greater_than', () => {
    expect(fires([cellRule('a', 'greater_than', '5')], { t1: { r1: { c1: 9 } } })).toBe(true)
    expect(fires([cellRule('a', 'greater_than', '5')], { t1: { r1: { c1: '3' } } })).toBe(false)
  })
  it('teks contains', () => {
    expect(fires([cellRule('a', 'contains', 'bud')], { t1: { r1: { c1: 'Pak budi' } } })).toBe(true)
  })
  it('dropdown equals / not_equals (label)', () => {
    const a: Answers = { t1: { r1: { c1: 'SMA' } } }
    expect(fires([cellRule('a', 'equals', 'SMA')], a)).toBe(true)
    expect(fires([cellRule('a', 'not_equals', 'SMA')], a)).toBe(false)
  })
  it('sel kosong, baris tak ada, tabel belum dijawab: empty true', () => {
    expect(fires([cellRule('a', 'empty', '')], { t1: { r1: { c2: 1 } } })).toBe(true)
    expect(fires([cellRule('a', 'empty', '')], { t1: { rX: { c1: 1 } } })).toBe(true)
    expect(fires([cellRule('a', 'empty', '')], {})).toBe(true)
    expect(fires([cellRule('a', 'not_empty', '')], {})).toBe(false)
  })
  it('OR campur sumber biasa dan sel', () => {
    const rules = [
      { ...rule('equals', '1'), id: 'x', logicGroup: 'OR:0' },
      cellRule('y', 'equals', 'SMA', 'OR:0'),
    ]
    expect(fires(rules, { q1: 0, t1: { r1: { c1: 'SMA' } } })).toBe(true)
    expect(fires(rules, { q1: 0, t1: { r1: { c1: 'SD' } } })).toBe(false)
  })
  it('AND campur sumber biasa dan sel', () => {
    const rules = [
      { ...rule('equals', '1'), id: 'x' },
      cellRule('y', 'equals', 'SMA'),
    ]
    expect(fires(rules, { q1: 1, t1: { r1: { c1: 'SMA' } } })).toBe(true)
    expect(fires(rules, { q1: 1, t1: { r1: { c1: 'SD' } } })).toBe(false)
  })
  it('aturan tanpa field baru tetap membaca jawaban utuh', () => {
    expect(fires([{ ...rule('equals', '4') }], { q1: 4 })).toBe(true)
  })
})

describe('findFiredRule: seluruh tabel terisi (K128)', () => {
  const tableQ = {
    ...numberQuestion('t1'), type: 'table' as const,
    tableRows: [{ key: 1, label: 'A' }, { key: 2, label: 'B' }, { key: 3, label: 'C', deleted: true }],
  }
  const matrixQ = { ...numberQuestion('m1'), type: 'matrix' as const }
  const qs = [tableQ, matrixQ, Q_HOST, Q_TARGET]
  const whole = (operator: SkipRule['operator'], src = 't1'): SkipRule => ({ ...rule(operator, ''), sourceQuestionId: src })
  const fires = (r: SkipRule, answers: Answers) => findFiredRule('q2', answers, qs, [r]) !== null

  it('satu sel berisi: terisi true, kosong false', () => {
    const a: Answers = { t1: { '1': { c1: 'x' }, '2': {} } }
    expect(fires(whole('not_empty'), a)).toBe(true)
    expect(fires(whole('empty'), a)).toBe(false)
  })
  it('angka 0 (number atau teks) berisi', () => {
    expect(fires(whole('not_empty'), { t1: { '1': { c1: 0 } } })).toBe(true)
    expect(fires(whole('not_empty'), { t1: { '1': { c1: '0' } } })).toBe(true)
  })
  it('tabel kosong, semua sel string kosong/spasi, atau belum dijawab: tidak terisi', () => {
    for (const a of [{ t1: {} }, { t1: { '1': { c1: '', c2: '  ' } } }, {}] as Answers[]) {
      expect(fires(whole('not_empty'), a)).toBe(false)
      expect(fires(whole('empty'), a)).toBe(true)
    }
  })
  it('baris di luar struktur atau deleted tidak dihitung (paritas BE)', () => {
    for (const row of ['9', '3']) {
      expect(fires(whole('not_empty'), { t1: { [row]: { c1: 'x' } } })).toBe(false)
      expect(fires(whole('empty'), { t1: { [row]: { c1: 'x' } } })).toBe(true)
    }
  })
  it('mode sel tertentu tetap membaca satu sel', () => {
    const cell = { ...whole('not_empty'), sourceRowKey: '1', sourceColumnId: 'c1' }
    expect(fires(cell, { t1: { '2': { c1: 'x' } } })).toBe(false)
    expect(fires(cell, { t1: { '1': { c1: 'x' } } })).toBe(true)
  })
  it('sumber non-tabel (matrix) tidak bergeser', () => {
    expect(fires(whole('not_empty', 'm1'), { m1: { a: 'b' } as never })).toBe(true)
    expect(fires(whole('empty', 'm1'), { m1: { a: 'b' } as never })).toBe(false)
    expect(fires(whole('empty', 'm1'), {})).toBe(true)
  })
})

describe('operator always (Selalu)', () => {
  it('cocok walau sumber tak dijawab, kosong, atau null', () => {
    const r = rule('always', '')
    for (const answers of [{}, { q1: '' }, { q1: [] }, { q1: null }] as Answers[]) {
      expect(evaluateNext('q2', answers, QUESTIONS, [r])).toBe('q3')
    }
  })

  it('grup pertama yang lolos menang: always di bawah aturan lain hanya jadi penutup', () => {
    const first = { ...rule('equals', 'x'), id: 'a', targetQuestionId: 'q1', logicGroup: 'AND:0' }
    const last = { ...rule('always', ''), id: 'b', logicGroup: 'AND:1' }
    expect(evaluateNext('q2', { q1: 'x' }, QUESTIONS, [last, first])).toBe('q1')
    expect(evaluateNext('q2', { q1: 'y' }, QUESTIONS, [last, first])).toBe('q3')
  })

  it('dalam grup AND: always + equals yang gagal tidak menyala', () => {
    const rules = [rule('always', ''), rule('equals', 'x')]
    expect(evaluateNext('q2', { q1: 'y' }, QUESTIONS, rules)).toBeNull()
    expect(findFiredRule('q2', { q1: 'y' }, QUESTIONS, rules)).toBeNull()
  })

  it('dalam grup OR: always + equals yang gagal tetap menyala', () => {
    const rules = [rule('always', ''), rule('equals', 'x')].map((r, i) => ({ ...r, id: `o${i}`, logicGroup: 'OR:0' }))
    expect(evaluateNext('q2', { q1: 'y' }, QUESTIONS, rules)).toBe('q3')
  })

  it('operator tak dikenal tidak melompat', () => {
    const unknown = rule('mirip_selalu' as SkipRule['operator'], '')
    expect(evaluateNext('q2', { q1: 'x' }, QUESTIONS, [unknown])).toBeNull()
    expect(evaluateNext('q2', {}, QUESTIONS, [unknown])).toBeNull()
  })
})

// Paritas lintas-repo dengan BE skip_eval_test.go: tabel ekspektasi IDENTIK di kedua repo.
// Q_p checkbox {kasir, marketing, C, D}; U3..U6 lalu Q6 berurutan setelah Q_p.
describe('paritas: antrean checkbox berantai dengan always', () => {
  const OPTS = ['kasir', 'marketing', 'C', 'D'] as const
  const BRANCH: Record<string, string> = { kasir: 'U3', marketing: 'U4', C: 'U5', D: 'U6' }
  const ORDER = ['Qp', 'U3', 'U4', 'U5', 'U6', 'Q6']
  const qs = ORDER.map((id) => ({ ...numberQuestion(id), type: id === 'Qp' ? ('checkbox' as const) : ('number' as const) }))

  let n = 0
  const mk = (questionId: string, operator: SkipRule['operator'], value: string, target: string, logicGroup: string): SkipRule => ({
    id: `p${n++}`, questionId, sourceQuestionId: 'Qp', operator, value, action: 'skip_to', targetQuestionId: target, logicGroup,
  })
  const rules: SkipRule[] = []
  OPTS.forEach((o, i) => rules.push(mk('Qp', 'contains', o, BRANCH[o], `AND:${i}`)))
  OPTS.forEach((o) => rules.push(mk('Qp', 'not_contains', o, 'Q6', 'AND:4')))
  ;(['U3', 'U4', 'U5'] as const).forEach((host, h) => {
    OPTS.slice(h + 1).forEach((o, i) => rules.push(mk(host, 'contains', o, BRANCH[o], `AND:${i}`)))
    rules.push(mk(host, 'always', '', 'Q6', 'AND:9'))
  })
  rules.push(mk('U6', 'always', '', 'Q6', 'AND:0'))

  // Jalur yang dikunjungi dari Qp, mengikuti evaluateNext (null = maju berurutan).
  const walk = (chosen: string[]): string[] => {
    const answers: Answers = { Qp: chosen }
    const path = ['Qp']
    let cur = 'Qp'
    while (cur !== 'Q6') {
      const next = evaluateNext(cur, answers, qs, rules)
      cur = next && next !== 'END' ? next : ORDER[ORDER.indexOf(cur) + 1]
      path.push(cur)
    }
    return path
  }

  // Tabel ekspektasi: indeks = bitmask (bit0 kasir, bit1 marketing, bit2 C, bit3 D).
  const EXPECTED: string[][] = [
    ['Qp', 'Q6'],
    ['Qp', 'U3', 'Q6'],
    ['Qp', 'U4', 'Q6'],
    ['Qp', 'U3', 'U4', 'Q6'],
    ['Qp', 'U5', 'Q6'],
    ['Qp', 'U3', 'U5', 'Q6'],
    ['Qp', 'U4', 'U5', 'Q6'],
    ['Qp', 'U3', 'U4', 'U5', 'Q6'],
    ['Qp', 'U6', 'Q6'],
    ['Qp', 'U3', 'U6', 'Q6'],
    ['Qp', 'U4', 'U6', 'Q6'],
    ['Qp', 'U3', 'U4', 'U6', 'Q6'],
    ['Qp', 'U5', 'U6', 'Q6'],
    ['Qp', 'U3', 'U5', 'U6', 'Q6'],
    ['Qp', 'U4', 'U5', 'U6', 'Q6'],
    ['Qp', 'U3', 'U4', 'U5', 'U6', 'Q6'],
  ]

  for (let mask = 0; mask < 16; mask++) {
    const chosen = OPTS.filter((_, i) => mask & (1 << i))
    it(`himpunan {${chosen.join(', ')}}`, () => {
      expect(walk([...chosen])).toEqual(EXPECTED[mask])
    })
  }

  it('findFiredRule di U6 mengembalikan aturan always', () => {
    expect(findFiredRule('U6', { Qp: ['kasir'] }, qs, rules)?.operator).toBe('always')
  })
})
