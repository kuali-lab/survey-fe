export type QuestionType =
  | 'welcome_page' | 'closing_page' | 'question_group' | 'statement'
  | 'short_text' | 'long_text'
  | 'phone' | 'email' | 'website' | 'number' | 'date'
  | 'single_choice' | 'checkbox' | 'dropdown' | 'yes_no' | 'image_choice'
  | 'nps' | 'opinion_scale' | 'rating' | 'matrix'
  | 'contact_info' | 'file_upload'

export interface QuestionOption {
  id: string
  label: string
  value?: string
  imageUrl?: string
  sortOrder: number
  isOther?: boolean
}

export interface MatrixRow {
  id: string
  label: string
  sortOrder: number
}

export interface MatrixCol {
  id: string
  label: string
  value?: string
  sortOrder: number
}

export interface Question {
  id: string
  type: QuestionType
  title: string
  description: string | null
  required: boolean
  sortOrder: number
  groupId: string | null
  imageUrl: string | null
  imageLayout: string | null

  // Scalar config
  maxStars?: number
  minValue?: number
  maxValue?: number
  maxSelections?: number
  minLabel?: string
  maxLabel?: string
  midLabel?: string
  placeholder?: string
  dateFormat?: string

  // Relational config
  options?: QuestionOption[]
  // Flat array of image URLs for image_choice options, parallel to options[].
  // Derived from options[].imageUrl when normalized from the API response.
  optionImages?: string[]
  // Image choice: when false, hide the text label below each option image.
  // Defaults to true (labels visible) when undefined or null.
  showLabel?: boolean | null
  matrixRows?: MatrixRow[]
  matrixCols?: MatrixCol[]
}

export interface SkipRule {
  id: string
  questionId: string
  sourceQuestionId: string
  operator: 'equals' | 'not_equals' | 'empty' | 'not_empty' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'greater_than_equals' | 'less_than_equals' | 'before' | 'after'
  value: string
  action: 'skip_to' | 'end_survey'
  targetQuestionId: string
  logicGroup: string
}

export interface SurveySettings {
  showProgress: boolean
  showBranding: boolean
  showNavArrows: boolean
  showNumbers: boolean
  requireLocation?: boolean
  requireSelfie?: boolean
  displayMode: 'scroll' | 'one_per_page'
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

/** Structured answer for contact_info questions */
export interface ContactInfo {
  firstName: string
  lastName: string
  phone: string
  email: string
}

export type AnswerValue = string | number | string[] | Record<string, string> | ContactInfo | null

export type Answers = Record<string, AnswerValue>

export type ViewState = 'welcome' | 'selfie_capture' | 'selfie_denied' | 'location_prompt' | 'location_denied' | 'question' | 'submitting' | 'closing' | 'closed' | 'error'
