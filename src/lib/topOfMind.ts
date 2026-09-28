/**
 * Top of Mind — pure helpers for the two-stage checkbox answer.
 *
 * A checkbox question with `topOfMind: true` is answered in two stages inside
 * ONE question card (works the same in scroll and one-per-page mode, and
 * survives the slide remount on back-navigation because every bit of stage
 * state lives in the answer value, never in component state):
 *
 *   stage 1  plain-looking checkbox list → the first tap is the top-of-mind pick
 *   stage 2  that pick flips to the top, stays checked; the rest is optional,
 *            capped at maxSelections - 1
 *
 * The stage is DERIVED from the answer: no `first` → stage 1, else stage 2.
 * Changing the first pick resets stage 2 (the rest was chosen relative to the
 * first, so it is stale) — mirrors the dependent-answer cascade in the runner.
 */
import type { AnswerValue, Question, QuestionOption, TopOfMindAnswer } from './types.js'

export const TOM_STAGE2_HINT = 'Bisa pilih lebih dari satu.'
// The respondent never sees "top of mind" wording — the question looks like a
// plain checkbox — so the required message is the plain checkbox one too.
export const TOM_REQUIRED_ERROR = 'Pilih minimal satu jawaban.'

/** Checkbox + toggle on. A single-select checkbox (maxSelections 1) has no
 *  "rest" to ask for, so the toggle is inert there. */
export function isTopOfMindQuestion(q: Pick<Question, 'type' | 'topOfMind' | 'maxSelections'>): boolean {
  return q.type === 'checkbox' && q.topOfMind === true && q.maxSelections !== 1
}

export function isTopOfMindAnswer(v: unknown): v is TopOfMindAnswer {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    'first' in v &&
    'selected' in v &&
    Array.isArray((v as TopOfMindAnswer).selected)
  )
}

/**
 * The full selection of a checkbox-like answer, whatever its shape. This is
 * the ONE seam the runner, skip logic, recap and keyboard handler read, so a
 * TopOfMindAnswer looks like a plain string[] everywhere it only needs "what
 * was selected".
 */
export function selectionsOf(v: AnswerValue | undefined): string[] {
  if (Array.isArray(v)) return v as string[]
  if (isTopOfMindAnswer(v)) return v.selected
  return []
}

export function topOfMindFirst(v: AnswerValue | undefined): string {
  return isTopOfMindAnswer(v) ? v.first : ''
}

/** Stage 1 not done yet (no first pick) — the answer counts as empty. */
export function isTopOfMindEmpty(v: AnswerValue | undefined): boolean {
  return topOfMindFirst(v).trim() === ''
}

/** Normalize so `first` is always index 0 of `selected` and never duplicated. */
export function normalizeTopOfMind(first: string, rest: string[]): TopOfMindAnswer {
  const f = first
  // No first pick → no stage 2 either; the rest is only meaningful relative
  // to a first.
  if (f === '') return { first: '', selected: [] }
  const seen = new Set<string>([f])
  const selected = [f]
  for (const r of rest) {
    if (r === '' || seen.has(r)) continue
    seen.add(r)
    selected.push(r)
  }
  return { first: f, selected }
}

/** Stage 2 picks only (everything but the first). */
export function topOfMindRest(v: AnswerValue | undefined): string[] {
  if (!isTopOfMindAnswer(v)) return []
  return v.selected.filter((s, i) => !(i === 0 && s === v.first))
}

/**
 * Set / change the first pick. Same value → keep the rest (a re-emit must not
 * wipe stage 2). Different value → stage 2 resets.
 */
export function setTopOfMindFirst(prev: AnswerValue | undefined, first: string): TopOfMindAnswer {
  if (isTopOfMindAnswer(prev) && prev.first === first) return prev
  return normalizeTopOfMind(first, [])
}

/** "Ubah" — back to stage 1; the whole answer resets. */
export function clearTopOfMind(): null {
  return null
}

/**
 * Toggle one option in stage 2. `maxSelections` caps the TOTAL (first + rest),
 * 0/undefined = unlimited — same contract as a plain checkbox.
 */
export function toggleTopOfMindRest(
  prev: AnswerValue | undefined,
  label: string,
  maxSelections?: number,
): TopOfMindAnswer {
  const first = topOfMindFirst(prev)
  const rest = [...topOfMindRest(prev)]
  const idx = rest.indexOf(label)
  if (idx >= 0) {
    rest.splice(idx, 1)
  } else {
    if (label === first) return normalizeTopOfMind(first, rest)
    if (restAtLimit(prev, maxSelections)) return normalizeTopOfMind(first, rest)
    rest.push(label)
  }
  return normalizeTopOfMind(first, rest)
}

/** How many more the respondent may pick in stage 2 (0 = unlimited). */
export function restLimit(maxSelections?: number): number {
  if (!maxSelections || maxSelections <= 0) return 0
  return Math.max(0, maxSelections - 1)
}

export function restAtLimit(v: AnswerValue | undefined, maxSelections?: number): boolean {
  const lim = restLimit(maxSelections)
  return lim > 0 && topOfMindRest(v).length >= lim
}

/**
 * Options shown in stage 2: everything except the option picked first. A
 * first pick that is free text ("Lainnya") removes the isOther option too —
 * it has been used.
 */
export function remainingOptions(options: QuestionOption[], first: string): QuestionOption[] {
  if (first === '') return options
  const standardLabels = new Set(options.filter((o) => !o.isOther).map((o) => o.label))
  const firstIsOther = !standardLabels.has(first)
  return options.filter((o) => (o.isOther ? !firstIsOther : o.label !== first))
}

/**
 * The free text typed into "Lainnya", wherever it sits (first or rest), or ''.
 * Mirrors deriveInitialOtherText() for the plain checkbox.
 */
export function topOfMindOtherText(v: AnswerValue | undefined, options: QuestionOption[]): string {
  const otherOpt = options.find((o) => o.isOther)
  if (!otherOpt) return ''
  const standard = new Set(options.filter((o) => !o.isOther).map((o) => o.label))
  return selectionsOf(v).find((s) => !standard.has(s) && s !== otherOpt.label) ?? ''
}

/** Is the first pick "Lainnya" (either its label or typed text)? */
export function firstIsOther(v: AnswerValue | undefined, options: QuestionOption[]): boolean {
  const first = topOfMindFirst(v)
  if (first === '') return false
  return !options.some((o) => !o.isOther && o.label === first)
}
