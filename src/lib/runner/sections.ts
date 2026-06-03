/**
 * Pure (rune-free) section builder for the survey flow. Kept out of
 * SurveyRunner.svelte.ts so it can be unit-tested in plain Node without the
 * Svelte compiler, and so the pagination algorithm is decoupled from reactive
 * state (audit: no-redundant / decoupled logic).
 */
import type { Question } from '$lib/types.js'

export type SurveyPage = {
  id: string
  title?: string
  description?: string
  questions: Question[]
}

// Builds the ordered section list: walks `questions` in sort_order, emits a
// section per question_group (members matched by groupId, kept in answerable
// order) and each standalone answerable question as its own section. A groupId
// pointing to a missing group falls back to standalone (never silently dropped).
//
// `flattenGroups` (audit Temuan F — group leak): when skip logic is active the
// render unit MUST be a single question, never a whole group. If a group were
// kept as one page, (a) answering a skip-source inside it would still show its
// later siblings on the same screen, and (b) jumping to a target mid-group would
// reveal the questions before the target. Flattening emits one page per group
// member (carrying the group's title/description for context) so skip evaluation
// is genuinely per-question and neither leak can happen.
export function buildSurveySections(
  questions: Question[],
  answerable: Question[],
  flattenGroups = false,
): SurveyPage[] {
  if (!answerable.length) return []
  const answerableIds = new Set(answerable.map((q) => q.id))
  const groupById = new Map(
    questions.filter((q) => q.type === 'question_group').map((g) => [g.id, g]),
  )
  const sections: SurveyPage[] = []
  for (const q of questions) {
    if (q.type === 'question_group') {
      const members = answerable.filter((m) => m.groupId === q.id)
      if (members.length === 0) continue
      if (flattenGroups) {
        // One page per member, keeping the group header for context.
        for (const m of members) {
          sections.push({ id: m.id, title: q.title, description: q.description ?? undefined, questions: [m] })
        }
      } else {
        sections.push({ id: q.id, title: q.title, description: q.description ?? undefined, questions: members })
      }
    } else if (answerableIds.has(q.id) && !(q.groupId && groupById.has(q.groupId))) {
      sections.push({ id: q.id, questions: [q] })
    }
  }
  return sections
}
