import type { Question } from './types.js'

const STRUCTURAL = ['welcome_page', 'closing_page', 'question_group']

export function getAnswerableQuestions(questions: Question[]): Question[] {
  return [...questions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter(q => !STRUCTURAL.includes(q.type))
}

/** Returns display number like "1.1" or "2" */
export function getQuestionNumber(question: Question, questions: Question[]): string {
  const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder)
  const groups = sorted.filter(q => q.type === 'question_group')

  if (!question.groupId || groups.length === 0) {
    const answerable = sorted.filter(q => !STRUCTURAL.includes(q.type))
    const idx = answerable.findIndex(q => q.id === question.id)
    return String(idx + 1)
  }

  const groupIdx = groups.findIndex(g => g.id === question.groupId)
  const inGroup = sorted.filter(
    q => q.groupId === question.groupId && !STRUCTURAL.includes(q.type)
  )
  const qIdx = inGroup.findIndex(q => q.id === question.id)
  return `${groupIdx + 1}.${qIdx + 1}`
}
