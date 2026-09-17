export type QuestionType =
  | 'welcome_page' | 'closing_page' | 'question_group' | 'statement'
  | 'short_text' | 'long_text'
  | 'phone' | 'email' | 'website' | 'number' | 'date'
  | 'single_choice' | 'checkbox' | 'dropdown' | 'yes_no' | 'image_choice'
  | 'nps' | 'opinion_scale' | 'rating' | 'matrix'
  | 'contact_info' | 'file_upload' | 'region'
  // Repeat group (Ihatec M5): pertanyaan yang memuat beberapa field, dan yang
  // berulang adalah KARTU-nya. Induk tidak menyimpan jawaban sendiri — field-nya
  // yang menyimpan, masing-masing dengan `repeat_index` = nomor kartu.
  | 'repeat_group'

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

/**
 * Catalog-backed dropdown whose options are narrowed by the answers of earlier
 * questions ("Daftar Pilihan Bersaring"). `region` points at a Wilayah question
 * (its BPS code answer becomes `regionCode=`); each `attrs[]` entry points at a
 * single_choice/dropdown question whose selected option `value` (or label)
 * becomes `attr[<key>]=`. Present in the public payload only when the
 * question has filter rows.
 */
export interface FilterSource {
  sourceQuestionId: string
}

export interface FilterAttr {
  key: string
  sourceQuestionId: string
}

export interface FilterConfig {
  region?: FilterSource
  attrs?: FilterAttr[]
}

/**
 * "Pilihan Bertingkat" (plan §0): a plain single_choice / dropdown question
 * whose inline options are narrowed by the answer to ONE earlier plain choice
 * question. `allowed` maps a dependent option key to the parent option keys it
 * is shown under (key = trimmed `value`, else trimmed `label`). Absent = no
 * dependency.
 */
export interface OptionDependency {
  sourceQuestionId: string
  allowed: Record<string, string[]>
}

export interface Question {
  id: string
  type: QuestionType
  title: string
  description: string | null
  // Plain-text variants from the backend (HTML stripped). Use for alt text, SEO
  // meta (rendered server-side), and any non-display label. title/description stay
  // HTML for rich display via {@html}.
  titlePlain?: string
  descriptionPlain?: string | null
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
  maxLength?: number
  minLength?: number
  minLabel?: string
  maxLabel?: string
  midLabel?: string
  placeholder?: string
  dateFormat?: string
  // Region ("Wilayah") question: how many administrative levels to ask for.
  // 1=Provinsi, 2=+Kabupaten/Kota, 3=+Kecamatan, 4=+Desa. Undefined → treat as 2.
  regionDepth?: number
  // Berapa banyak jawaban yang boleh diberikan satu responden untuk pertanyaan ini
  // (Ihatec M5). undefined = pertanyaannya TIDAK berulang; >= 2 = boleh menambah
  // sampai sebanyak itu.
  //
  // 🔴 undefined di sini berarti kebalikan dari tetangganya di atas: pada
  // maxLength/maxSelections undefined berarti "tak dibatasi", di sini ia berarti
  // FITURNYA MATI. Pengulangan tanpa batas tidak boleh ada sama sekali — satu
  // kiriman akan menulis baris sebanyak yang ditentukan pengirim.
  maxRepeat?: number

  // Field di dalam satu KARTU repeat group (Ihatec M5). Kosong/absen untuk
  // setiap pertanyaan biasa.
  //
  // 🔴 Bersarang, dan itu yang menjaga sisa runner tidak perlu tahu apa-apa soal
  // repeat group: `answerableQuestions` diturunkan dari daftar `questions`
  // tingkat atas, jadi field TIDAK pernah ikut dihitung paginasi, progress bar,
  // auto-advance, maupun skip-logic. Meratakan field jadi pertanyaan tingkat atas
  // akan membuat kelimanya salah sekaligus — dan salahnya senyap.
  fields?: Question[]

  // Relational config
  hasAsyncOptions?: boolean
  filterConfig?: FilterConfig
  dependsOn?: OptionDependency
  // Top of Mind (checkbox only): ask the respondent for the ONE option that
  // comes to mind first, then for the rest with that option excluded. The
  // answer becomes a TopOfMindAnswer instead of a plain string[].
  topOfMind?: boolean
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
  oneResponsePerDevice?: boolean
  /**
   * Responden boleh kembali ke pertanyaan sebelumnya (M1 No-Back).
   *
   * 🔴 Opsional dengan sengaja: `fetchSurvey` menyinggahkan objek survei ke
   * localStorage, dan salinan lama tidak punya field ini. Ketiadaan field
   * berarti BOLEH kembali — bukan dilarang.
   */
  allowBack?: boolean
  /**
   * Branding per survei yang dilihat responden (M2): logo di halaman
   * pembuka/penutup, favicon tab, dan gambar pratinjau tautan.
   *
   * 🔴 Ketiganya opsional dengan alasan yang sama seperti `allowBack`:
   * `fetchSurvey` menyinggahkan objek survei ke localStorage, dan salinan lama
   * tidak punya kunci ini. Ketiadaan field berarti PAKAI ASET PLATFORM — bukan
   * kosong. Aturannya dipusatkan di `$lib/branding.ts`.
   */
  logoUrl?: string | null
  faviconUrl?: string | null
  ogImageUrl?: string | null
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

/**
 * Answer for a checkbox question with `topOfMind` on. `first` is the option
 * label picked in stage 1; `selected` is the FULL selection (stage 1 + stage
 * 2), always with `first` at index 0. "Lainnya" free text follows the plain
 * checkbox convention: the typed text is the label. `first === ''` means the
 * respondent has not picked yet (the answer is treated as empty).
 */
export interface TopOfMindAnswer {
  first: string
  selected: string[]
}

/**
 * Jawaban sebuah repeat group (Ihatec M5): SATU objek per kartu, berkunci id
 * field.
 *
 * 🔴 Bentuk ini dipilih di atas alternatif "satu array per field"
 * (`answers[fieldId] = [n1, n2, n3]`), dan alasannya soal kebenaran, bukan
 * selera. Backend merapatkan array pengulangan — nilai kosong DIBUANG. Kalau
 * responden mengosongkan satu field di kartu ke-2, array field itu menyusut
 * sementara array field lain tidak, dan seluruh record sesudahnya bergeser satu
 * posisi: warna kartu 3 menempel pada merek kartu 2. Tidak ada galat yang
 * muncul; datanya hanya diam-diam salah.
 *
 * Dengan kartu sebagai objek, keselarasan antar-field dijamin BENTUKNYA, bukan
 * oleh kebetulan urutan. Field yang dikosongkan tetap hadir sebagai nilai kosong
 * di kartunya sendiri.
 */
export type RepeatGroupAnswer = Record<string, string>[]

export type AnswerValue = string | number | string[] | Record<string, string> | RepeatGroupAnswer | ContactInfo | TopOfMindAnswer | null

export type Answers = Record<string, AnswerValue>

export type ViewState = 'loading' | 'welcome' | 'selfie_capture' | 'selfie_denied' | 'location_prompt' | 'location_denied' | 'question' | 'submitting' | 'closing' | 'closed' | 'error'
