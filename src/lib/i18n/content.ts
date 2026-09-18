/**
 * Survei dua bahasa, sisi responden — bagian KONTEN (teks yang ditulis pembuat
 * survei). Rune-free dan DOM-free supaya bisa diuji di Node.
 *
 * 🔴 Satu aturan yang menopang semuanya: terjemahan HANYA proyeksi saat merender.
 * Label pilihan adalah identitas data di aplikasi ini — jawaban, skip logic,
 * Pilihan Bertingkat, draf, dan badan kiriman menyimpan/membandingkan label
 * bahasa utama. Jadi tidak ada fungsi di sini yang mengubah survei atau jawaban;
 * semuanya hanya menjawab "teks apa yang DITAMPILKAN". Akibatnya responden boleh
 * berganti bahasa di tengah survei tanpa kehilangan apa pun, dan dataset hasil
 * tetap satu bahasa apa pun pilihan respondennya.
 */
import type { Question, QuestionTextTranslation, Survey, SurveyLanguages, TranslatedText } from '$lib/types.js'
import { LEGACY_LOCALE, t } from './messages.js'

export interface LanguageChoice {
  code: string
  /** Nama dalam bahasanya sendiri — responden harus bisa mengenalinya tanpa bisa membaca bahasa lain. */
  name: string
}

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
 * Apakah survei ini punya teks APA PUN dalam bahasa `lang`? Bahasa kedua yang
 * baru ditambahkan di builder tetapi belum diterjemahkan sama sekali akan tampil
 * persis sama dengan bahasa utama — menanyai responden untuk memilih di antara
 * dua survei yang identik hanya menambah satu langkah tanpa arti.
 */
export function hasAnyTranslation(survey: Pick<Survey, 'questions'> | null | undefined, lang: string): boolean {
  for (const q of survey?.questions ?? []) {
    const scalar = q.translations?.[lang]
    if (scalar && Object.values(scalar).some((text) => !isBlank(text))) return true
    for (const item of [...(q.options ?? []), ...(q.matrixRows ?? []), ...(q.matrixCols ?? [])]) {
      if (!isBlank(item.translations?.[lang])) return true
    }
  }
  return false
}

/**
 * Bahasa yang ditawarkan ke responden. SATU entri = survei satu bahasa.
 *
 * 🔴 Inilah satu-satunya tempat yang memutuskan "survei ini multibahasa atau
 * bukan". Langkah pilih bahasa, pil di pojok, dan pemulihan pilihan tersimpan
 * semuanya membaca dari sini, jadi ketiganya tidak bisa berselisih. Bahasa kedua
 * hanya dihitung bila: ada, tidak kosong, berbeda dari bahasa utama, DAN sudah
 * punya setidaknya satu terjemahan.
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

/** Langkah "pilih bahasa" hanya ada untuk survei yang benar-benar multibahasa. */
export function needsLanguageStep(survey: Parameters<typeof languageChoices>[0]): boolean {
  return languageChoices(survey).length > 1
}

/**
 * Bahasa awal: pilihan tersimpan → bahasa peramban → bahasa utama.
 * `en-US` cocok dengan `en`; urutan `navigator.languages` dihormati, jadi
 * peramban `['id', 'en']` tetap mendapat Indonesia.
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
 * Teks TAMPILAN sebuah pilihan / baris / kolom. Terjemahan yang kosong jatuh ke
 * bahasa utama — lebih baik satu pilihan berbahasa Indonesia daripada pilihan
 * kosong yang tidak bisa dipilih.
 */
export function displayLabel(
  item: { label: string; isOther?: boolean; translations?: TranslatedText },
  locale: string,
  primary: string,
): string {
  if (locale === primary) return item.label
  const translated = item.translations?.[locale]
  if (!isBlank(translated)) return translated as string
  // "Lainnya" tidak diterjemahkan di builder: teksnya milik platform.
  if (item.isOther) return t(locale, 'other')
  return item.label
}

/** Teks TAMPILAN field skalar sebuah pertanyaan (judul, deskripsi, label skala, …). */
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
 * Varian polos (tanpa HTML) dari judul/deskripsi, untuk `alt` dan pesan
 * petunjuk. Backend hanya mengirim `titlePlain` untuk bahasa utama, jadi versi
 * terjemahannya dibuat di sini.
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
