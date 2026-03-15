export type QuestionType =
  | 'welcome_page' | 'closing_page' | 'question_group' | 'statement'
  | 'short_text' | 'long_text'
  | 'phone' | 'email' | 'website' | 'number' | 'date'
  | 'single_choice' | 'checkbox' | 'dropdown' | 'yes_no' | 'image_choice'
  | 'nps' | 'opinion_scale' | 'rating' | 'matrix'

export interface Question {
  id: string
  type: QuestionType
  title: string
  description: string | null
  required: boolean
  sortOrder: number
  groupId: string | null
  config: Record<string, unknown>
  imageUrl: string | null
  imageLayout: string | null
}

export interface SkipRule {
  id: string
  questionId: string
  sourceQuestionId: string
  operator: 'equals' | 'not_equals' | 'empty' | 'not_empty'
  value: string
  action: 'skip_to' | 'end_survey'
  targetQuestionId: string
  logicGroup: 'AND' | 'OR'
}

export interface SurveySettings {
  showProgress: boolean
  showBranding: boolean
  showNavArrows: boolean
  showNumbers: boolean
}

export interface Survey {
  id: string
  title: string
  status?: 'draft' | 'active' | 'closed'
  settings: SurveySettings
  questions: Question[]
  skipRules: SkipRule[]
  closeMessage: string | null
  closeImageUrl: string | null
}

export type AnswerValue = string | number | string[] | Record<string, string> | null

export type Answers = Record<string, AnswerValue>

export type ViewState = 'welcome' | 'question' | 'submitting' | 'closing' | 'closed' | 'error'
