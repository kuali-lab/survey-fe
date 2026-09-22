/**
 * Pure helpers for "Pilihan Bertingkat" — a plain single_choice / dropdown
 * question whose inline options are narrowed by the answer to ONE earlier plain
 * choice question in the same survey (Kota → Mall → Brand). Sibling of
 * optionFilter.ts (the catalog-backed "Daftar Pilihan Bersaring"); kept free of
 * Svelte so the runner, QuestionInput and vitest share one implementation.
 *
 * Wire contract (pilihan-bertingkat-plan §0):
 *   dependsOn: { sourceQuestionId, allowed: { <dependent key>: [<source key>, …] } }
 * - Option key = trimmed `value` when non-empty, else trimmed `label`.
 * - Option O of Q is visible iff the parent is answered and
 *   key(parent answer option) ∈ allowed[key(O)]. Unmapped options never show.
 * - "Lainnya" (isOther) options are never filtered and never a source key.
 * - Unknown keys in `allowed` are ignored at use time.
 */

import type { Answers, AnswerValue, Question, QuestionOption } from './types.js'
import { getFilterDependents } from './optionFilter.js'

const DEPENDENCY_TYPES = new Set<Question['type']>(['single_choice', 'dropdown'])

/** Stable identity of an option inside the dependency map. */
export function optionKey(o: Pick<QuestionOption, 'label' | 'value'>): string {
  const v = typeof o.value === 'string' ? o.value.trim() : ''
  return v ? v : (o.label ?? '').trim()
}

/** True when `q` is a type that can carry (or be the source of) a dependency. */
function isPlainChoice(q: Pick<Question, 'type' | 'hasAsyncOptions'> | undefined): boolean {
  return !!q && DEPENDENCY_TYPES.has(q.type) && !q.hasAsyncOptions
}

// carryOver mode's TARGET type is dropdown/single_choice (whatever mapped
// mode already allows) OR inline checkbox — additive, doesn't touch mapped
// mode's own gate above.
function isCarryOverTargetType(q: Pick<Question, 'type' | 'hasAsyncOptions'> | undefined): boolean {
  return isPlainChoice(q) || (!!q && q.type === 'checkbox' && !q.hasAsyncOptions)
}

// carryOver mode (§B) allows a DIFFERENT, narrower source allowlist than
// mapped mode — dropdown and checkbox only (not single_choice) — and, unlike
// mapped mode, deliberately does NOT exclude multi-select dropdowns or
// checkbox: carryOver forwards whichever label(s) were picked directly, so a
// multi-valued source is natively fine here.
const CARRY_OVER_SOURCE_TYPES = new Set<Question['type']>(['dropdown', 'checkbox'])

/** True when `q` is a valid carryOver mode SOURCE type (§B). */
function isCarryOverSource(q: Pick<Question, 'type'> | undefined): boolean {
  return !!q && CARRY_OVER_SOURCE_TYPES.has(q.type)
}

/** Parent question id of `q`, or '' when `q` carries no usable dependency. */
export function getDependencySourceId(q: Pick<Question, 'type' | 'hasAsyncOptions' | 'dependsOn'>): string {
  // carryOver mode's target-type gate is wider (adds checkbox) than mapped
  // mode's — checked only for carryOver so mapped mode is untouched.
  const usable = q.dependsOn?.mode === 'carryOver' ? isCarryOverTargetType(q) : isPlainChoice(q)
  if (!usable) return ''
  return q.dependsOn?.sourceQuestionId ?? ''
}

/** Questions whose options depend (Pilihan Bertingkat) directly on `sourceId`. */
export function getDependencyDependents(sourceId: string, questions: Question[]): Question[] {
  if (!sourceId) return []
  return questions.filter((q) => q.id !== sourceId && getDependencySourceId(q) === sourceId)
}

/**
 * Every question whose answer becomes invalid when `sourceId` changes: the
 * transitive closure over BOTH relations (Pilihan Bertingkat dependents and
 * catalog filterConfig dependents), breadth-first, deduplicated, never
 * including `sourceId` itself.
 */
export function collectDependents(sourceId: string, questions: Question[]): string[] {
  const out: string[] = []
  const seen = new Set<string>([sourceId])
  const queue = [sourceId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const direct = [...getDependencyDependents(id, questions), ...getFilterDependents(id, questions)]
    for (const dep of direct) {
      if (seen.has(dep.id)) continue
      seen.add(dep.id)
      out.push(dep.id)
      queue.push(dep.id)
    }
  }
  return out
}

function answeredLabel(v: AnswerValue | undefined): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return ''
}

/** The non-"Lainnya" option whose label matches a stored answer, if any. */
function findStandardOption(q: Pick<Question, 'options'> | undefined, label: string): QuestionOption | undefined {
  if (!label) return undefined
  return q?.options?.find((o) => !o.isOther && o.label.trim() === label)
}

/**
 * `parent`'s true, full candidate catalog — what a stored answer of `parent`
 * should be looked up against, REGARDLESS of whether `parent`'s own
 * dependency currently happens to be satisfied.
 *
 * A plain or mapped-mode parent's `options` already IS that catalog — using
 * it directly (not a live-filtered `visibleOptions()` subset) matters:
 * resolving "which option did this stored label mean" must not depend on
 * whether the parent's own upstream chain is currently answered. Only a
 * carryOver parent's `options` are unused authoring leftovers — there, the
 * real catalog is whatever `visibleOptions()` derives from further upstream.
 */
function parentCatalog(parent: Question, answers: Answers, questions: Question[]): QuestionOption[] {
  if (parent.dependsOn?.mode === 'carryOver') return visibleOptions(parent, answers, questions).options
  return parent.options ?? []
}

/**
 * `q`'s full option catalog, ignoring live include/exclude/allowed narrowing —
 * every label `q`'s answer could ever legitimately mean, not just what is
 * currently offered. Mapped/plain mode already owns this list (`q.options`);
 * carryOver mode recurses to the parent's own full catalog, since `q.options`
 * there are unused authoring leftovers.
 *
 * Distinct from `parentCatalog` on purpose: that one tracks the LIVE, narrowed
 * catalog (what's carried right now); this one is needed only to tell "a real
 * option that simply isn't allowed right now" (stays pruned, never rescued by
 * Lainnya) apart from genuinely unrecognized free text (Lainnya-protected) —
 * see `isDependentAnswerVisible`.
 */
function fullCatalogOf(q: Question, questions: Question[]): QuestionOption[] {
  if (q.dependsOn?.mode !== 'carryOver') return q.options ?? []
  const parent = questions.find((x) => x.id === q.dependsOn?.sourceQuestionId)
  return parent ? fullCatalogOf(parent, questions).filter((o) => !o.isOther) : []
}

/**
 * Key of the parent's chosen option. Answers are stored as LABELS, so the label
 * is mapped back to its option (same identity as `resolveAttrValue`). Returns
 * null when the parent is unanswered OR answered with a "Lainnya" free text —
 * callers tell those apart with the parent answer itself.
 */
export function parentKey(q: Question, answers: Answers, questions: Question[]): string | null {
  const sourceId = getDependencySourceId(q)
  if (!sourceId) return null
  const parent = questions.find((x) => x.id === sourceId)
  if (!parent) return null
  const opt = findStandardOption({ options: parentCatalog(parent, answers, questions) }, answeredLabel(answers[sourceId]))
  return opt ? optionKey(opt) : null
}

/**
 * carryOver mode's one new primitive (§B): normalizes a raw answer to the set
 * of option keys it resolves to against `sourceOptions` — one key for a
 * single-value answer (plain dropdown), N keys for an array answer (checkbox /
 * multi-select dropdown, §A). A label that doesn't match a known option
 * (free "Lainnya" text) falls back to the label itself, same convention as
 * `resolveAttrValue` in optionFilter.ts — it then simply never coincides with
 * a real target option key instead of needing special-case handling.
 *
 * Takes the resolved options directly, not a `Question` — the caller decides
 * WHICH options are the source's true candidate pool (its own, if plain; a
 * further-upstream question's, if the source is itself a carryOver target).
 */
export function sourceAnswerKeys(sourceOptions: readonly Pick<QuestionOption, 'label' | 'value' | 'isOther'>[], answer: AnswerValue | undefined): string[] {
  const keyForLabel = (label: string): string => {
    const opt = sourceOptions.find((o) => !o.isOther && o.label.trim() === label)
    return opt ? optionKey(opt) : label
  }
  if (Array.isArray(answer)) {
    return (answer as string[])
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .map(keyForLabel)
  }
  const label = answeredLabel(answer)
  return label ? [keyForLabel(label)] : []
}

export type DependencyStatus =
  /** No dependency (or not applicable): show every option as usual. */
  | 'inactive'
  /** Parent unanswered: question disabled, hint shown, nothing selectable. */
  | 'waiting'
  /** Parent answered and at least one mapped option is visible. */
  | 'ready'
  /** Parent answered but no mapped option is allowed (only "Lainnya" may remain). */
  | 'empty'

export type VisibleOptions = {
  status: DependencyStatus
  /** Selectable options in original order ("Lainnya" included when present). */
  options: QuestionOption[]
}

/**
 * Visible option set of `q` under the current answers. A dependency pointing at
 * a missing / ineligible source is treated as inactive so a stale config can
 * never lock the respondent out. Branches on `dependsOn.mode` — absent/
 * `'mapped'` is the original authored per-option map (untouched below);
 * `'carryOver'` (§B) is dynamic, computed from the source's live answer.
 */
export function visibleOptions(q: Question, answers: Answers, questions: Question[]): VisibleOptions {
  const all = q.options ?? []
  const sourceId = getDependencySourceId(q)
  if (!sourceId || sourceId === q.id) return { status: 'inactive', options: all }
  const parent = questions.find((x) => x.id === sourceId)

  if (q.dependsOn?.mode === 'carryOver') {
    if (!isCarryOverSource(parent)) return { status: 'inactive', options: all }
    // The candidate pool is the SOURCE's own catalog (its answer becomes this
    // question's choices, per contract §B). `q.options` (`all`) only still
    // matters for this question's own "Lainnya".
    const parentOptions = parentCatalog(parent!, answers, questions)
    const keys = sourceAnswerKeys(parentOptions, answers[sourceId])
    if (keys.length === 0) return { status: 'waiting', options: [] }
    const keySet = new Set(keys)
    const exclude = q.dependsOn?.carryOverMode === 'exclude'
    const carried = parentOptions.filter((o) => {
      if (o.isOther) return false
      const picked = keySet.has(optionKey(o))
      return exclude ? !picked : picked
    })
    const ownOther = all.find((o) => o.isOther)
    const options = ownOther ? [...carried, ownOther] : carried
    return { status: carried.length > 0 ? 'ready' : 'empty', options }
  }

  if (!isPlainChoice(parent)) return { status: 'inactive', options: all }

  const label = answeredLabel(answers[sourceId])
  if (!label) return { status: 'waiting', options: [] }

  const opt = findStandardOption({ options: parentCatalog(parent!, answers, questions) }, label)
  const pKey = opt ? optionKey(opt) : null
  const allowed = q.dependsOn?.allowed ?? {}
  const options = all.filter((o) => {
    if (o.isOther) return true
    if (pKey === null) return false
    const list = allowed[optionKey(o)]
    return Array.isArray(list) && list.includes(pKey)
  })
  const hasMapped = options.some((o) => !o.isOther)
  return { status: hasMapped ? 'ready' : 'empty', options }
}

/**
 * Whether the stored answer of `q` is still selectable under `answers`.
 * Unanswered → true. Waiting → false. A standard option outside the visible set
 * → false. Free text (no matching option) stays valid only while `q` has an
 * isOther option — e.g. an option renamed since the draft is dropped.
 */
export function isDependentAnswerVisible(q: Question, answers: Answers, questions: Question[]): boolean {
  const label = answeredLabel(answers[q.id])
  if (!label) return true
  const vis = visibleOptions(q, answers, questions)
  if (vis.status === 'inactive') return true
  if (vis.status === 'waiting') return false
  // Two steps, deliberately not collapsed into one: a label that matches a
  // REAL, known option (fullCatalogOf) but isn't in the CURRENT visible set
  // (vis.options) is a stale pick — invisible, and must NOT fall through to
  // the Lainnya rescue below (that's for genuinely unrecognized free text).
  const known = fullCatalogOf(q, questions).some((o) => !o.isOther && o.label.trim() === label)
  if (known) return vis.options.some((o) => !o.isOther && o.label.trim() === label)
  return vis.options.some((o) => o.isOther)
}

/**
 * Draft self-heal (plan §2.3): walk questions in sort order and drop every
 * answer that is no longer visible under the (already pruned) earlier answers.
 * A dropped answer also drops its transitive dependents (incl. catalog filter
 * dependents). Returns the pruned copy and the cleared ids (in drop order);
 * `answers` itself is not mutated.
 */
export function pruneDependentAnswers(
  answers: Answers,
  questions: Question[],
): { answers: Answers; cleared: string[] } {
  const next: Answers = { ...answers }
  const cleared: string[] = []
  const drop = (id: string) => {
    if (!(id in next)) return
    delete next[id]
    if (!cleared.includes(id)) cleared.push(id)
  }
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const q of ordered) {
    if (!getDependencySourceId(q)) continue
    if (!(q.id in next)) continue
    if (isDependentAnswerVisible(q, next, questions)) continue
    drop(q.id)
    for (const id of collectDependents(q.id, questions)) drop(id)
  }
  return { answers: next, cleared }
}

/**
 * Parent title as plain text (titlePlain, else HTML stripped), without trailing
 * punctuation so it reads inside a sentence ("… jawaban Kota Anda." rather than
 * "… jawaban Kota Anda?.").
 */
export function dependencySourceTitle(q: Question, questions: Question[]): string {
  const parent = questions.find((x) => x.id === getDependencySourceId(q))
  if (!parent) return ''
  const plain = parent.titlePlain?.trim() || stripHtml(parent.title ?? '')
  return plain.replace(/[\s.?!:;,]+$/, '')
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Hint shown while the parent is unanswered. */
export function dependencyDisabledHint(q: Question, questions: Question[]): string {
  const title = dependencySourceTitle(q, questions)
  return title ? `Jawab pertanyaan ${title} terlebih dahulu.` : 'Jawab pertanyaan sebelumnya terlebih dahulu.'
}

/** Message shown when the parent is answered but nothing is allowed under it. */
export function dependencyEmptyMessage(q: Question, parentLabel: string, questions: Question[]): string {
  const title = dependencySourceTitle(q, questions)
  const lead = parentLabel ? `Tidak ada pilihan untuk ${parentLabel}.` : 'Tidak ada pilihan yang tersedia.'
  return title ? `${lead} Periksa kembali jawaban ${title}.` : lead
}

/** Parent answer as shown to the respondent (the stored label / free text). */
export function dependencyParentLabel(q: Question, answers: Answers): string {
  const sourceId = getDependencySourceId(q)
  return sourceId ? answeredLabel(answers[sourceId]) : ''
}
