/**
 * Bahasa aktif untuk pohon komponen responden, lewat Svelte context.
 *
 * Kenapa context, bukan prop: komponen yang sama (QuestionCard, QuestionInput,
 * MatrixInput, …) dipakai tiga rute — responden, `/pratinjau`, dan surveyor —
 * lewat jalur yang berbeda-beda. Prop `locale` harus dirangkai di SEMUA jalur
 * itu, dan jalur yang terlewat akan diam-diam merender bahasa utama. Dengan
 * context, rute yang tidak menyediakannya otomatis mendapat bawaan di bawah:
 * bahasa Indonesia, teks apa adanya — persis perilaku sebelum fitur ini ada.
 */
import { getContext, setContext } from 'svelte'
import type { Question, QuestionTextTranslation, TranslatedText } from '$lib/types.js'
import { displayLabel, questionPlainText, questionText } from './content.js'
import { LEGACY_LOCALE, t, type MessageKey } from './messages.js'

const KEY = Symbol('survey-i18n')

export interface I18n {
  readonly locale: string
  readonly primary: string
  /** Teks antarmuka platform. */
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  /** Teks TAMPILAN pilihan/baris/kolom. Jangan pernah dipakai sebagai nilai jawaban. */
  label: (item: { label: string; isOther?: boolean; translations?: TranslatedText }) => string
  text: (question: Question, field: keyof QuestionTextTranslation) => string
  plain: (question: Question, field: 'title' | 'description') => string
}

function build(getLocale: () => string, getPrimary: () => string): I18n {
  return {
    // Getter, bukan nilai: dibaca ulang di setiap render sehingga pergantian
    // bahasa (sebuah `$state` di halaman) langsung merambat ke semua komponen.
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
