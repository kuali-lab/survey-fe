import type { Question, SkipRule, Answers } from './types.js'

function matchesOperator(
  answer: unknown,
  operator: SkipRule['operator'],
  value: string
): boolean {
  // Array answers (checkbox / multi-select) are kept as a discrete element list.
  // Never join-then-split on commas — an option label containing a comma
  // (e.g. "Mobil, Motor, dan Sepeda") would be torn apart, producing false
  // logic. Membership is tested against the array elements directly.
  const isArr = Array.isArray(answer)
  const answerArr: string[] = isArr ? (answer as unknown[]).map((x) => String(x)) : []
  // Scalar/string view, only used for substring + numeric + date comparisons.
  const comparisonStr = isArr ? answerArr.join(',') : String(answer ?? '')

  // Strict emptiness — `0` (rating/NPS) and `false` are valid answers and must
  // NOT be treated as empty. Only undefined, null, '', and [] count as empty.
  const isEmpty =
    answer === undefined ||
    answer === null ||
    (typeof answer === 'string' && answer === '') ||
    (isArr && answerArr.length === 0)

  const parsedComp = parseFloat(comparisonStr)
  const parsedVal = parseFloat(value)

  switch (operator) {
    case 'equals':     return isArr ? answerArr.includes(value) : comparisonStr === value
    case 'not_equals': return isArr ? !answerArr.includes(value) : comparisonStr !== value
    // For multi-select, "contains" means the option was chosen — exact element
    // membership, not substring (avoids "Mobil" matching "Mobil Listrik").
    case 'contains':   return isArr ? answerArr.includes(value) : comparisonStr.includes(value)
    case 'not_contains': return isArr ? !answerArr.includes(value) : !comparisonStr.includes(value)
    case 'greater_than': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp > parsedVal
    case 'less_than': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp < parsedVal
    case 'greater_than_equals': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp >= parsedVal
    case 'less_than_equals': return !isNaN(parsedComp) && !isNaN(parsedVal) && parsedComp <= parsedVal
    case 'before':
    case 'after':
         return operator === 'before' ? comparisonStr < value : comparisonStr > value
    case 'empty':      return isEmpty
    case 'not_empty':  return !isEmpty
    default:           return false
  }
}

// Yes/No answers are stored canonically as 'yes'/'no' by the respondent widget, but
// older saved rules (and the builder, pre-fix) used the Indonesian 'ya'/'tidak'.
// Canonicalize BOTH sides for a yes_no source so the comparison is robust to either
// form. Scoped to yes_no ONLY — it must never remap a free-text answer that happens to
// equal "ya"/"no". Keeps already-saved (previously dead) yes/no rules working.
function canonYesNo(v: unknown): unknown {
  if (typeof v !== 'string') return v
  const s = v.trim().toLowerCase()
  if (s === 'ya' || s === 'yes') return 'yes'
  if (s === 'tidak' || s === 'no') return 'no'
  return v
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
    const srcType = questions.find(q => q.id === r.sourceQuestionId)?.type
    let answer: unknown = answers[r.sourceQuestionId]
    let value = r.value ?? ''
    if (srcType === 'yes_no') {
      answer = canonYesNo(answer)
      value = String(canonYesNo(value))
    }
    return matchesOperator(answer, r.operator, value)
  }

  const groupMap = new Map<string, SkipRule[]>()
  for (const r of rules) {
    const group = r.logicGroup ?? `AND:${r.id}`
    if (!groupMap.has(group)) {
      groupMap.set(group, [])
    }
    groupMap.get(group)!.push(r)
  }

  // Priority is explicit (audit Temuan D): logicGroup is "CONNECTOR:index" where
  // the index is the creator-defined order set in the Builder (drag-to-reorder).
  // Evaluate groups by that index ascending so the first-priority rule always
  // wins the short-circuit, regardless of the order the API returned the rows.
  // Groups without a numeric index (legacy `AND:<uuid>` fallback) sort last,
  // keeping their relative insertion order stable.
  const groupOrder = (name: string): number => {
    const n = parseInt(name.slice(name.indexOf(':') + 1), 10)
    return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
  }
  const orderedGroups = [...groupMap.entries()].sort((a, b) => groupOrder(a[0]) - groupOrder(b[0]))

  for (const [groupName, groupRules] of orderedGroups) {
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
