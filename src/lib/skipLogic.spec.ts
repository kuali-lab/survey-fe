import { describe, it, expect } from 'vitest'
import { evaluateNext } from './skipLogic.js'
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
