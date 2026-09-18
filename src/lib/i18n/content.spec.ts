import { describe, it, expect } from 'vitest'
import type { Question } from '$lib/types.js'
import { buildBilingualMockSurvey } from '$lib/mockSurveyBilingual.js'
import { SurveyRunner } from '$lib/runner/SurveyRunner.svelte.js'
import {
  displayLabel, hasAnyTranslation, languageChoices, needsLanguageStep, pickInitialLocale,
  questionPlainText, questionText, surveyLanguages,
} from './content.js'
import { t } from './messages.js'

const q = (over: Partial<Question>): Question => ({
  id: 'q', type: 'single_choice', title: 'Judul', description: null, required: false,
  sortOrder: 0, groupId: null, imageUrl: null, imageLayout: null, ...over,
} as Question)

// 🔴 Langkah "pilih bahasa" HANYA untuk survei yang benar-benar multibahasa.
// Setiap kasus di bawah adalah satu cara sebuah survei bisa "tampak" punya bahasa
// kedua padahal tidak — dan tidak satu pun boleh memunculkan langkah itu.
describe('needsLanguageStep — only for a survey that really has two languages', () => {
  const translated = [q({ translations: { en: { title: 'Title' } } })]
  const untranslated = [q({})]

  it('is on when a second language exists AND has translations', () => {
    const survey = { languages: { primary: 'id', secondary: 'en' }, questions: translated }
    expect(needsLanguageStep(survey)).toBe(true)
    expect(languageChoices(survey)).toEqual([
      { code: 'id', name: 'Bahasa Indonesia' },
      { code: 'en', name: 'English' },
    ])
  })

  it('is off for a survey without `languages` — every survey that predates this feature', () => {
    expect(surveyLanguages({})).toEqual({ primary: 'id' })
    expect(needsLanguageStep({ questions: translated })).toBe(false)
    expect(needsLanguageStep(null)).toBe(false)
    expect(needsLanguageStep(undefined)).toBe(false)
  })

  it('is off when only a primary language is set', () => {
    expect(needsLanguageStep({ languages: { primary: 'id' }, questions: translated })).toBe(false)
  })

  it('is off when the "second" language is the primary one, or blank', () => {
    expect(needsLanguageStep({ languages: { primary: 'id', secondary: 'id' }, questions: translated })).toBe(false)
    expect(needsLanguageStep({ languages: { primary: 'id', secondary: '  ' }, questions: translated })).toBe(false)
  })

  it('is off when the second language was added but nothing is translated yet', () => {
    expect(needsLanguageStep({ languages: { primary: 'id', secondary: 'en' }, questions: untranslated })).toBe(false)
    expect(needsLanguageStep({ languages: { primary: 'id', secondary: 'en' } })).toBe(false)
  })

  it('is off when the only translations are blank or for some other language', () => {
    const blank = [q({ translations: { en: { title: ' ', description: '<b></b>' } }, options: [{ id: 'o', label: 'Ya', sortOrder: 0, translations: { en: '' } }] })]
    const other = [q({ translations: { ja: { title: 'タイトル' } } })]
    expect(needsLanguageStep({ languages: { primary: 'id', secondary: 'en' }, questions: blank })).toBe(false)
    expect(needsLanguageStep({ languages: { primary: 'id', secondary: 'en' }, questions: other })).toBe(false)
  })

  it('counts a translated option / matrix row / matrix column, not just titles', () => {
    const viaOption = [q({ options: [{ id: 'o', label: 'Ya', sortOrder: 0, translations: { en: 'Yes' } }] })]
    const viaRow = [q({ type: 'matrix', matrixRows: [{ id: 'r', label: 'Harga', sortOrder: 0, translations: { en: 'Price' } }] })]
    expect(hasAnyTranslation({ questions: viaOption }, 'en')).toBe(true)
    expect(hasAnyTranslation({ questions: viaRow }, 'en')).toBe(true)
  })

  it('keeps the demo surveys honest: the bilingual one asks, the default one does not', async () => {
    const { buildMockSurvey } = await import('$lib/mockSurvey.js')
    expect(needsLanguageStep(buildMockSurvey('mock-bilingual'))).toBe(true)
    expect(needsLanguageStep(buildMockSurvey('mock'))).toBe(false)
    expect(needsLanguageStep(buildMockSurvey('mock-matrix'))).toBe(false)
  })
})

describe('pickInitialLocale', () => {
  const langs = { primary: 'id', secondary: 'en' }

  it('prefers what the respondent chose last time', () => {
    expect(pickInitialLocale(langs, 'en', ['id-ID'])).toBe('en')
  })

  it('ignores a saved language the survey no longer offers', () => {
    expect(pickInitialLocale({ primary: 'id' }, 'en', [])).toBe('id')
  })

  it('matches the browser language by its base tag, in the browser\'s own order', () => {
    expect(pickInitialLocale(langs, null, ['en-US', 'id'])).toBe('en')
    expect(pickInitialLocale(langs, null, ['id-ID', 'en'])).toBe('id')
  })

  it('falls back to the primary language', () => {
    expect(pickInitialLocale(langs, null, ['fr-FR'])).toBe('id')
    expect(pickInitialLocale(langs, null)).toBe('id')
  })
})

describe('displayLabel', () => {
  it('shows the translation only in the secondary language', () => {
    const opt = { label: 'Jarang', translations: { en: 'Rarely' } }
    expect(displayLabel(opt, 'id', 'id')).toBe('Jarang')
    expect(displayLabel(opt, 'en', 'id')).toBe('Rarely')
  })

  it('falls back to the primary label when a translation is missing or blank', () => {
    expect(displayLabel({ label: 'Jarang' }, 'en', 'id')).toBe('Jarang')
    expect(displayLabel({ label: 'Jarang', translations: { en: '  ' } }, 'en', 'id')).toBe('Jarang')
  })

  it('renders "Lainnya" from the platform pack, since the builder does not translate it', () => {
    expect(displayLabel({ label: 'Lainnya', isOther: true }, 'en', 'id')).toBe('Other')
    expect(displayLabel({ label: 'Lainnya', isOther: true }, 'id', 'id')).toBe('Lainnya')
  })
})

describe('questionText', () => {
  const question = q({
    title: '<b>Judul</b>', titlePlain: 'Judul', minLabel: 'Rendah',
    translations: { en: { title: '<b>Title</b>', minLabel: '' } },
  })

  it('translates per field and falls back per field', () => {
    expect(questionText(question, 'title', 'en', 'id')).toBe('<b>Title</b>')
    expect(questionText(question, 'minLabel', 'en', 'id')).toBe('Rendah')
    expect(questionText(question, 'title', 'id', 'id')).toBe('<b>Judul</b>')
  })

  it('derives the plain variant of a translated title (the backend only sends titlePlain for the primary language)', () => {
    expect(questionPlainText(question, 'title', 'en', 'id')).toBe('Title')
    expect(questionPlainText(question, 'title', 'id', 'id')).toBe('Judul')
  })
})

describe('t', () => {
  it('interpolates parameters', () => {
    expect(t('id', 'errMinLength', { n: 5 })).toBe('Minimal 5 karakter.')
    expect(t('en', 'matrixProgress', { n: 1, total: 3 })).toBe('1 of 3 answered')
  })

  it('falls back to English — not Indonesian — for a language without a pack', () => {
    expect(t('ja', 'next')).toBe('Next')
  })
})

// 🔴 Penjaga aturan inti: bahasa hanya mengubah teks yang DITAMPILKAN. Jawaban,
// skip logic, dan validasi tetap bekerja pada label bahasa utama.
describe('language never touches data', () => {
  const makeRunner = (locale: string) => {
    const survey = buildBilingualMockSurvey()
    return new SurveyRunner({ getSurvey: () => survey, onFinish: () => {}, autoSubmit: false, getLocale: () => locale })
  }

  it('an English respondent tapping "Rarely" stores the primary label and still triggers the skip rule written against "Jarang"', async () => {
    const r = makeRunner('en')
    const survey = buildBilingualMockSurvey()
    const rarely = survey.questions.find((x) => x.id === 'bq2')!.options!.find((o) => o.translations?.en === 'Rarely')!

    // What the option card does on tap: onChange(opt.label) — never the displayed text.
    r.handleAnswer('bq2', rarely.label)
    await r.handleNext()

    expect(r.answers.bq2).toBe('Jarang')
    expect(r.currentPage?.questions[0].id).toBe('bq7')
  })

  it('speaks the respondent\'s language for buttons and validation, and Indonesian by default', async () => {
    const en = makeRunner('en')
    expect(en.nextButtonLabel).toBe('Next')
    await en.handleNext()
    expect(en.questionErrors.bq2).toBe('This question is required.')

    const survey = buildBilingualMockSurvey()
    const legacy = new SurveyRunner({ getSurvey: () => survey, onFinish: () => {}, autoSubmit: false })
    expect(legacy.nextButtonLabel).toBe('Selanjutnya')
    await legacy.handleNext()
    expect(legacy.questionErrors.bq2).toBe('Pertanyaan ini wajib diisi.')
  })
})
