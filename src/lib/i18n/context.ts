/**
 * The active language for the respondent component tree, via Svelte context.
 *
 * Why context rather than a prop: the same components (QuestionCard, QuestionInput,
 * MatrixInput, …) are used by three routes — respondent, `/pratinjau` and surveyor —
 * reached by different paths. A `locale` prop would have to be threaded through ALL
 * of them, and any path that was missed would silently render the primary language.
 * With context, a route that provides none automatically gets the default below:
 * Indonesian, text as written — exactly the behaviour before this feature existed.
 */
import { getContext, setContext } from 'svelte'
import type { Question, QuestionTextTranslation, TranslatedText } from '$lib/types.js'
import { displayLabel, questionPlainText, questionText } from './content.js'
import { LEGACY_LOCALE, t, type MessageKey } from './messages.js'

const KEY = Symbol('survey-i18n')

export interface I18n {
  readonly locale: string
  readonly primary: string
  /** The platform's interface text. */
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  /** The DISPLAY text of an option/row/column. Never use it as an answer value. */
  label: (item: { label: string; isOther?: boolean; translations?: TranslatedText }) => string
  text: (question: Question, field: keyof QuestionTextTranslation) => string
  plain: (question: Question, field: 'title' | 'description') => string
}

function build(getLocale: () => string, getPrimary: () => string): I18n {
  return {
    // A getter, not a value: re-read on every render, so switching language (a
    // `$state` on the page) propagates to every component immediately.
    get locale() { return getLocale() },
    get primary() { return getPrimary() },
    t: (key, params) => t(getLocale(), key, params),
    label: (item) => displayLabel(item, getLocale(), getPrimary()),
    text: (question, field) => questionText(question, field, getLocale(), getPrimary()),
    plain: (question, field) => questionPlainText(question, field, getLocale(), getPrimary()),
  }
}

const LEGACY = build(() => LEGACY_LOCALE, () => LEGACY_LOCALE)

export function provideI18n(getLocale: () => string, getPrimary: () => string): I18n {
  const i18n = build(getLocale, getPrimary)
  setContext(KEY, i18n)
  return i18n
}

export function useI18n(): I18n {
  return getContext<I18n | undefined>(KEY) ?? LEGACY
}
