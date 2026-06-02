import type { Question } from './types.js'

const STRUCTURAL = ['welcome_page', 'closing_page', 'question_group']

export function getAnswerableQuestions(questions: Question[]): Question[] {
  return [...questions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter(q => !STRUCTURAL.includes(q.type))
}

/**
 * Flat display number (1..N) over all answerable questions in sort order.
 * Groups (and welcome/closing) are structural → never numbered; their member
 * questions are numbered inline in the same continuous sequence as ungrouped
 * ones. Mirrors the builder's `buildQuestionNumbers` so the number a respondent
 * sees always matches the builder — no desync, and a group never consumes a
 * number. Display-only; skip-logic keys off question ids / sortOrder.
 */
export function getQuestionNumber(question: Question, questions: Question[]): string {
  const idx = getAnswerableQuestions(questions).findIndex(q => q.id === question.id)
  return idx >= 0 ? String(idx + 1) : ''
}
