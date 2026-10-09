import type { Question, SkipRule, SkipRoute, SkipCondition, Answers } from './types.js'
import { isTopOfMindAnswer } from './topOfMind.js'
import { activeRows, cellOf, isTableTouched, toTableAnswer } from './table.js'

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

/** Kondisi tunggal (aturan logika atau rute) terhadap jawaban saat ini. */
export function conditionMet(r: SkipCondition, answers: Answers, questions: Question[]): boolean {
  // `always` tak membaca jawaban sumber: cocok walau sumber belum dijawab/kosong.
  if (r.operator === 'always') return true
  const src = questions.find(q => q.id === r.sourceQuestionId)
  const srcType = src?.type
  // Seluruh tabel (baris & kolom kosong): "terisi" = minimal satu sel berisi.
  if (srcType === 'table' && !r.sourceRowKey && !r.sourceColumnId && (r.operator === 'empty' || r.operator === 'not_empty')) {
    const touched = isTableTouched(answers[r.sourceQuestionId], activeRows(src!))
    return r.operator === 'not_empty' ? touched : !touched
  }
  // Sel tabel: nilai sel (dropdown tersimpan sebagai label opsi), kosong bila baris/kolom tak ada.
  let answer: unknown = r.sourceRowKey && r.sourceColumnId
    ? cellOf(toTableAnswer(answers[r.sourceQuestionId]), r.sourceRowKey, r.sourceColumnId)
    : answers[r.sourceQuestionId]
  let value = r.value ?? ''
  // Top of Mind: rules see the FULL selection, exactly like a plain checkbox.
  if (isTopOfMindAnswer(answer)) answer = answer.selected
  if (srcType === 'yes_no') {
    answer = canonYesNo(answer)
    value = String(canonYesNo(value))
  }
  return matchesOperator(answer, r.operator, value)
}

/** Returns the first satisfied rule (by priority) for the question, or null to advance normally.
 *  `usedGoBackIds` are go_back rules already fired this session — ignored (anti-loop). */
export function findFiredRule(
  currentQuestionId: string,
  answers: Answers,
  questions: Question[],
  skipRules: SkipRule[],
  usedGoBackIds?: ReadonlySet<string>
): SkipRule | null {
  const rules = skipRules.filter(r => r.questionId === currentQuestionId)
  if (rules.length === 0) return null

  const checkRule = (r: SkipRule) => conditionMet(r, answers, questions)

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
      if (rule.action === 'go_back' && usedGoBackIds?.has(rule.id)) continue
      return rule
    }
  }

  return null
}

/** Returns the ID of next question, 'END' to submit now, or null to advance normally.
 *  A go_back rule yields its (earlier) target id like skip_to; callers that must tell
 *  them apart use findFiredRule. */
export function evaluateNext(
  currentQuestionId: string,
  answers: Answers,
  questions: Question[],
  skipRules: SkipRule[]
): string | 'END' | null {
  const rule = findFiredRule(currentQuestionId, answers, questions, skipRules)
  if (!rule) return null
  return rule.action === 'end_survey' ? 'END' : (rule.targetQuestionId ?? null)
}

export type WalkStep = { id: string; routed: boolean }

/**
 * Jalur kunjungan dari pertanyaan pertama dengan jawaban saat ini; urutannya identik
 * dengan visibleWalk di backend (go_back tidak diikuti). `routed` = keluar dari
 * pertanyaan itu diatur rute, bukan logika biasa. `ordered` = pertanyaan yang bisa
 * dijawab menurut urutan survei; `questions` = daftar penuh untuk mencari tipe sumber.
 */
export function walkVisited(
  ordered: Question[],
  questions: Question[],
  skipRules: SkipRule[],
  skipRoutes: SkipRoute[],
  answers: Answers
): WalkStep[] {
  const pos = new Map(ordered.map((q, i) => [q.id, i]))
  const path: WalkStep[] = []
  const seen = new Set<string>()
  let route: { remaining: string[]; join: string | null } | null = null

  for (let i = 0; i < ordered.length; ) {
    const q = ordered[i]
    if (seen.has(q.id)) break
    seen.add(q.id)

    let dest: string | null = null
    let routed = false
    if (route) {
      routed = true
      const [head, ...rest] = route.remaining
      dest = head ?? route.join
      route = head === undefined ? null : { remaining: rest, join: route.join }
    } else {
      const met = (c: SkipCondition) => conditionMet(c, answers, questions)
      const steps = (r: SkipRoute): string[] | null => {
        if (r.kind !== 'per_option') return (r.connector === 'OR' ? r.conditions.some(met) : r.conditions.every(met)) ? r.steps : null
        // per_option selalu cocok; antrean = cabang terpilih, tanpa duplikat, menurut urutan pertanyaan.
        const op = questions.find((x) => x.id === r.hostQuestionId)?.type === 'checkbox' ? 'contains' : 'equals'
        const picked = (r.branches ?? [])
          .filter((b) => met({ sourceQuestionId: r.hostQuestionId, operator: op, value: b.optionValue }))
          .flatMap((b) => b.steps)
        return [...new Set(picked)].sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0))
      }
      for (const r of skipRoutes.filter((r) => r.hostQuestionId === q.id).sort((a, b) => a.position - b.position)) {
        const st = steps(r)
        if (!st) continue
        routed = true
        dest = st[0] ?? r.joinQuestionId ?? null
        route = { remaining: st.slice(1), join: r.joinQuestionId ?? null }
        break
      }
    }
    if (!routed) {
      const next = evaluateNext(q.id, answers, questions, skipRules)
      if (next === 'END') {
        path.push({ id: q.id, routed })
        break
      }
      dest = next
    }
    path.push({ id: q.id, routed })

    const target = dest === null ? undefined : pos.get(dest)
    i = target !== undefined && target > i ? target : i + 1
  }
  return path
}
