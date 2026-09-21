/**
 * Two-language surveys, respondent side — the CONTENT half (text the survey author
 * wrote). Rune-free and DOM-free so it can be tested in Node.
 *
 * 🔴 The one rule everything rests on: a translation is only a projection at render
 * time. In this app an option label is the data identity — answers, skip logic,
 * Pilihan Bertingkat, drafts and the submit body all store and compare the
 * primary-language label. So no function here mutates a survey or an answer; every
 * one of them only answers "what text is DISPLAYED". The result is that a respondent
 * may switch language mid-survey without losing anything, and the resulting dataset
 * stays in one language whatever they chose.
 */
import type { Question, QuestionTextTranslation, Survey, SurveyLanguages, TranslatedText } from '$lib/types.js'
import { LEGACY_LOCALE, t } from './messages.js'

export interface LanguageChoice {
  code: string
  /** The name in its own language — a respondent must recognise it without being able to read the others. */
  name: string
}

/**
 * 🔴 This list is mirrored in two other repos — `SurveyLanguageCodes` (logika-be)
 * and `SURVEY_LANGUAGES` (dashboard-fe). Adding a language means touching all three.
 */
const NATIVE_NAMES: Record<string, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
  ms: 'Bahasa Melayu',
  zh: '中文',
  ja: '日本語',
  ar: 'العربية',
}

export function languageName(code: string): string {
  return NATIVE_NAMES[code] ?? code.toUpperCase()
}

export function surveyLanguages(survey: Pick<Survey, 'languages'> | null | undefined): SurveyLanguages {
  return survey?.languages?.primary ? survey.languages : { primary: LEGACY_LOCALE }
}

/**
 * Does this survey carry ANY text in `lang`? A second language that was just added
 * in the builder but not yet translated at all renders exactly like the primary
 * language — asking a respondent to choose between two identical surveys just adds
 * a meaningless step.
 */
export function hasAnyTranslation(survey: Pick<Survey, 'questions'> | null | undefined, lang: string): boolean {
  for (const q of survey?.questions ?? []) {
    const scalar = q.translations?.[lang]
    if (scalar && Object.values(scalar).some((text) => !isBlank(text))) return true
    // Isian di dalam Grup Jawaban membawa terjemahannya sendiri; survei yang HANYA
    // menerjemahkan isian kartu tetap survei dua bahasa.
    for (const f of q.fields ?? []) {
      const own = f.translations?.[lang]
      if (own && Object.values(own).some((text) => !isBlank(text))) return true
    }
    for (const item of [...(q.options ?? []), ...(q.matrixRows ?? []), ...(q.matrixCols ?? [])]) {
      if (!isBlank(item.translations?.[lang])) return true
    }
  }
  return false
}

/**
 * The languages offered to a respondent. ONE entry = a single-language survey.
 *
 * 🔴 This is the only place that decides "is this survey multilingual or not". The
 * language step, the corner pill and the restore of a saved choice all read from
 * here, so the three cannot disagree. A second language only counts when it is
 * present, non-blank, different from the primary one, AND already has at least one
 * translation.
 */
export function languageChoices(
  survey: (Pick<Survey, 'languages'> & Partial<Pick<Survey, 'questions'>>) | null | undefined,
): LanguageChoice[] {
  const { primary, secondary } = surveyLanguages(survey)
  const second = secondary?.trim()
  const offered = second && second !== primary && hasAnyTranslation({ questions: survey?.questions ?? [] }, second)
  const codes = offered ? [primary, second] : [primary]
  return codes.map((code) => ({ code, name: languageName(code) }))
}

/** The "choose language" step exists only for a genuinely multilingual survey. */
export function needsLanguageStep(survey: Parameters<typeof languageChoices>[0]): boolean {
  return languageChoices(survey).length > 1
}

/**
 * The starting language: saved choice → browser language → primary.
 * `en-US` matches `en`; the order of `navigator.languages` is respected, so a
 * browser set to `['id', 'en']` still gets Indonesian.
 */
export function pickInitialLocale(
  languages: SurveyLanguages,
  saved: string | null | undefined,
  browserLanguages: readonly string[] = [],
): string {
  const offered = [languages.primary, ...(languages.secondary ? [languages.secondary] : [])]
  if (saved && offered.includes(saved)) return saved
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0]
    if (offered.includes(base)) return base
  }
  return languages.primary
}

function isBlank(text: string | null | undefined): boolean {
  return !text || text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

/**
 * The DISPLAY text of an option / row / column. An empty translation falls back to
 * the primary language — one Indonesian option beats an empty one nobody can pick.
 */
export function displayLabel(
  item: { label: string; isOther?: boolean; translations?: TranslatedText },
  locale: string,
  primary: string,
): string {
  if (locale === primary) return item.label
  const translated = item.translations?.[locale]
  if (!isBlank(translated)) return translated as string
  // "Lainnya" is not translated in the builder: that text belongs to the platform.
  if (item.isOther) return t(locale, 'other')
  return item.label
}

/** The DISPLAY text of a question's scalar field (title, description, scale labels, …). */
export function questionText(
  question: Question,
  field: keyof QuestionTextTranslation,
  locale: string,
  primary: string,
): string {
  const source = (question[field] as string | null | undefined) ?? ''
  if (locale === primary) return source
  const translated = question.translations?.[locale]?.[field]
  return isBlank(translated) ? source : (translated as string)
}

/**
 * The plain (HTML-free) variant of a title/description, for `alt` text and hints.
 * The backend only sends `titlePlain` for the primary language, so the translated
 * version is derived here.
 */
export function questionPlainText(
  question: Question,
  field: 'title' | 'description',
  locale: string,
  primary: string,
): string {
  const plainSource = field === 'title' ? question.titlePlain : question.descriptionPlain
  const translated = locale === primary ? undefined : question.translations?.[locale]?.[field]
  if (isBlank(translated)) return plainSource ?? stripTags(question[field] ?? '')
  return stripTags(translated as string)
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}
