/**
 * Pure helpers for "Daftar Pilihan Bersaring" — a catalog-backed dropdown whose
 * options are narrowed by the answers of earlier (source) questions. Kept free
 * of Svelte so the runner, the input components, and vitest can all share it.
 *
 * Wire shapes (see contract §3/§8): the options endpoint accepts
 * `regionCode=<BPS code>` and `attr[<key>]=<value>`; the region answer is the
 * deepest chosen BPS code string, the attr value is the selected source
 * option's `value` (falling back to its label).
 */

import type { Answers, AnswerValue, Question } from './types.js'

export type OptionFilter = {
  regionCode?: string
  attrs?: Record<string, string>
}

/** IDs of every question whose answer narrows `q`'s options (region first). */
export function getFilterSourceIds(q: Pick<Question, 'filterConfig'>): string[] {
  const fc = q.filterConfig
  if (!fc) return []
  const ids: string[] = []
  if (fc.region?.sourceQuestionId) ids.push(fc.region.sourceQuestionId)
  for (const a of fc.attrs ?? []) {
    if (a.sourceQuestionId && !ids.includes(a.sourceQuestionId)) ids.push(a.sourceQuestionId)
  }
  return ids
}

/** True when `q` carries at least one filter source. */
export function hasOptionFilter(q: Pick<Question, 'filterConfig'>): boolean {
  return getFilterSourceIds(q).length > 0
}

/** Questions whose options depend on the answer of `sourceId`. */
export function getFilterDependents(sourceId: string, questions: Question[]): Question[] {
  return questions.filter((q) => getFilterSourceIds(q).includes(sourceId))
}

function answeredString(v: AnswerValue | undefined): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return ''
}

/**
 * single_choice / dropdown answers are stored as LABELS. Map the chosen label
 * to the option's `value`; fall back to the label itself when the option has
 * no value (or the label is not a known option, e.g. an "Other" free text).
 */
export function resolveAttrValue(sourceQ: Pick<Question, 'options'> | undefined, answer: AnswerValue | undefined): string {
  const label = answeredString(answer)
  if (!label) return ''
  const opt = sourceQ?.options?.find((o) => o.label === label)
  const value = opt?.value?.trim()
  return value ? value : label
}

/**
 * Build the query filter for `q` from the current answers. Returns null when
 * any source question is still unanswered — the caller keeps the dropdown
 * disabled and does not fetch. Questions without filterConfig also yield null
 * (treat as "no filter").
 */
export function buildOptionFilter(q: Question, answers: Answers, questions: Question[]): OptionFilter | null {
  const fc = q.filterConfig
  if (!fc || !hasOptionFilter(q)) return null
  const byId = new Map(questions.map((x) => [x.id, x]))
  const out: OptionFilter = {}

  if (fc.region?.sourceQuestionId) {
    const code = answeredString(answers[fc.region.sourceQuestionId])
    if (!code) return null
    out.regionCode = code
  }

  const attrs: Record<string, string> = {}
  for (const a of fc.attrs ?? []) {
    if (!a.key || !a.sourceQuestionId) continue
    const value = resolveAttrValue(byId.get(a.sourceQuestionId), answers[a.sourceQuestionId])
    if (!value) return null
    attrs[a.key] = value
  }
  if (Object.keys(attrs).length > 0) out.attrs = attrs

  return out
}

/** Stable string identity for an OptionFilter, so effects re-run only on real changes. */
export function optionFilterKey(f: OptionFilter | null): string {
  if (!f) return ''
  const attrs = Object.entries(f.attrs ?? {}).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([f.regionCode ?? '', attrs])
}

/** "jenjang" → "Jenjang"; used for the short source names in hints. */
export function attrKeyLabel(key: string): string {
  if (!key) return ''
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Short names for the source questions of `q`, used in the disabled hint and
 * empty-state message: the region source is always "Wilayah", attr sources use
 * their capitalised key (e.g. "Jenjang").
 */
export function filterSourceNames(q: Pick<Question, 'filterConfig'>): string[] {
  const fc = q.filterConfig
  if (!fc) return []
  const names: string[] = []
  if (fc.region?.sourceQuestionId) names.push('Wilayah')
  for (const a of fc.attrs ?? []) {
    const n = attrKeyLabel(a.key)
    if (n && !names.includes(n)) names.push(n)
  }
  return names
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} dan ${names[names.length - 1]}`
}

/** Hint shown under a filtered dropdown while a source question is unanswered. */
export function filterDisabledHint(q: Pick<Question, 'filterConfig'>): string {
  const names = filterSourceNames(q)
  if (names.length === 0) return ''
  return `Jawab pertanyaan ${joinNames(names)} terlebih dahulu.`
}

/**
 * Empty-state message naming BOTH source answers, e.g.
 * "Tidak ada pilihan SLB di Kabupaten Pesawaran. Periksa kembali jawaban Wilayah dan Jenjang."
 * `regionName` is the chosen region's display name (falls back to the code);
 * `attrLabels` are the selected source option labels, in attrs order.
 */
export function filterEmptyMessage(
  q: Pick<Question, 'filterConfig'>,
  regionName: string,
  attrLabels: string[],
): string {
  const names = filterSourceNames(q)
  const attrPart = attrLabels.filter(Boolean).join(' ')
  let lead: string
  if (regionName && attrPart) lead = `Tidak ada pilihan ${attrPart} di ${regionName}.`
  else if (regionName) lead = `Tidak ada pilihan di ${regionName}.`
  else if (attrPart) lead = `Tidak ada pilihan untuk ${attrPart}.`
  else lead = 'Tidak ada pilihan yang tersedia.'
  return names.length > 0 ? `${lead} Periksa kembali jawaban ${joinNames(names)}.` : lead
}
