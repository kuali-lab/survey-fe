import type { Question, SkipRule, Answers } from './types.js'

function matchesOperator(
  answer: unknown,
  operator: SkipRule['operator'],
  value: string
): boolean {
  const str = Array.isArray(answer) ? answer.join(',') : String(answer ?? '')
  switch (operator) {
    case 'equals':     return str === value
    case 'not_equals': return str !== value
    case 'empty':      return !answer || str === '' || (Array.isArray(answer) && answer.length === 0)
    case 'not_empty':  return !!answer && str !== '' && !(Array.isArray(answer) && answer.length === 0)
    default:           return false
  }
}

/** Returns the ID of next question, 'END' to submit now, or null to advance normally */
export function evaluateNext(
  currentQuestionId: string,
  answers: Answers,
  _questions: Question[],
  skipRules: SkipRule[]
): string | 'END' | null {
  const rules = skipRules.filter(r => r.questionId === currentQuestionId)
  if (rules.length === 0) return null

  // Group by logicGroup type
  const andRules = rules.filter(r => r.logicGroup === 'AND')
  const orRules  = rules.filter(r => r.logicGroup === 'OR')

  // Check AND group: all rules must match
  if (andRules.length > 0) {
    const allMatch = andRules.every(r => matchesOperator(answers[r.sourceQuestionId], r.operator, r.value))
    if (allMatch) {
      const rule = andRules[0]
      return rule.action === 'end_survey' ? 'END' : rule.targetQuestionId
    }
  }

  // Check OR group: any rule matches
  for (const rule of orRules) {
    if (matchesOperator(answers[rule.sourceQuestionId], rule.operator, rule.value)) {
      return rule.action === 'end_survey' ? 'END' : rule.targetQuestionId
    }
  }

  return null
}
