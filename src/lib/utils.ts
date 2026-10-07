import type { AnswerValue, Question } from './types.js'
import type { MessageKey } from './i18n/messages.js'

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

/** Id elemen pesan galat pertanyaan; dirujuk `aria-describedby` sel yang tidak valid. */
export function questionErrorId(questionId: string): string {
  return `q-error-${questionId}`
}

type Msg = (key: MessageKey, params?: Record<string, string | number>) => string

/**
 * Panjang teks dan rentang angka satu nilai skalar. Satu sumber untuk runner dan
 * penanda sel TableInput, supaya sel yang ditandai selalu sel di pesan galat.
 */
export function scalarRuleError(q: Question, answer: AnswerValue, msg: Msg): string | null {
  let strVal = ''
  if (typeof answer === 'string') strVal = answer.trim()
  else if (typeof answer === 'number') strVal = String(answer)

  if (strVal !== '') {
    const len = strVal.length
    if (q.minLength && len < q.minLength) return msg('errMinLength', { n: q.minLength })
    if (q.maxLength && len > q.maxLength) return msg('errMaxLength', { n: q.maxLength })
  }

  if (q.type === 'number') {
    let answerNum: unknown = answer
    if (typeof answer === 'string' && answer.trim() !== '') answerNum = Number(answer)
    if (typeof answerNum === 'number' && !isNaN(answerNum)) {
      const minVal = q.minValue !== undefined && q.minValue !== null ? Number(q.minValue) : null
      const maxVal = q.maxValue !== undefined && q.maxValue !== null ? Number(q.maxValue) : null
      if (minVal !== null && answerNum < minVal) return msg('errMinValue', { n: minVal })
      if (maxVal !== null && answerNum > maxVal) return msg('errMaxValue', { n: maxVal })
    }
  }
  return null
}
