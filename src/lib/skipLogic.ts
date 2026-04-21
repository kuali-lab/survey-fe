import type { Question, SkipRule, Answers } from './types.js'

function matchesOperator(
  answer: unknown,
  operator: SkipRule['operator'],
  value: string
): boolean {
  let comparisonStr = ''
  
  if (Array.isArray(answer)) {
    comparisonStr = answer.join(',')
  } else {
    comparisonStr = String(answer ?? '')
  }

  const parsedComp = parseFloat(comparisonStr)
  const parsedVal = parseFloat(value)

  switch (operator) {
    case 'equals':     return comparisonStr === value || comparisonStr.split(',').includes(value)
    case 'not_equals': return comparisonStr !== value && !comparisonStr.split(',').includes(value)
    case 'contains':   return comparisonStr.includes(value)
    case 'not_contains': return !comparisonStr.includes(value)
    case 'greater_than': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp > parsedVal
    case 'less_than': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp < parsedVal
    case 'greater_than_equals': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp >= parsedVal
    case 'less_than_equals': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp <= parsedVal
    case 'before':
    case 'after':
         return operator === 'before' ? comparisonStr < value : comparisonStr > value
    case 'empty':      return !answer || comparisonStr === '' || (Array.isArray(answer) && answer.length === 0)
    case 'not_empty':  return !!answer && comparisonStr !== '' && !(Array.isArray(answer) && answer.length === 0)
    default:           return false
  }
}

/** Returns the ID of next question, 'END' to submit now, or null to advance normally */
export function evaluateNext(
  currentQuestionId: string,
  answers: Answers,
  questions: Question[],
  skipRules: SkipRule[]
): string | 'END' | null {
  const rules = skipRules.filter(r => r.questionId === currentQuestionId)
  if (rules.length === 0) return null

  const checkRule = (r: SkipRule) => {
    return matchesOperator(answers[r.sourceQuestionId], r.operator, r.value ?? '')
  }

  const groupMap = new Map<string, SkipRule[]>()
  for (const r of rules) {
    const group = r.logicGroup ?? `AND:${r.id}`
    if (!groupMap.has(group)) {
      groupMap.set(group, [])
    }
    groupMap.get(group)!.push(r)
  }

  for (const [groupName, groupRules] of groupMap.entries()) {
    const connector = groupName.startsWith('OR') ? 'OR' : 'AND'
    let isSatisfied = false
    
    if (connector === 'AND') {
      isSatisfied = groupRules.every(checkRule)
    } else {
      isSatisfied = groupRules.some(checkRule)
    }

    if (isSatisfied) {
      const rule = groupRules[0]
      return rule.action === 'end_survey' ? 'END' : (rule.targetQuestionId ?? null)
    }
  }

  return null
}
