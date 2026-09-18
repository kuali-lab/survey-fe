/**
 * Demo survei dua bahasa (Indonesia utama + English), dilayani di
 * `/s/mock-bilingual` saat PUBLIC_USE_MOCK=1. Isinya sama dengan survei demo
 * `s10` di builder (dashboard-fe), jadi alurnya bersambung: terjemahkan di
 * builder → isi di sini.
 *
 * Data polos tanpa efek samping, sama seperti `mockSurvey.ts`.
 */
import type { MatrixCol, MatrixRow, Question, QuestionOption, Survey } from './types.js'

type Pair = [id: string, en: string]

const options = (pairs: Pair[], withOther = false): QuestionOption[] => [
  ...pairs.map(([label, en], i) => ({ id: `bo-${i}-${label}`, label, sortOrder: i, translations: { en } })),
  // "Lainnya" sengaja TANPA terjemahan: teksnya milik platform, bukan pembuat survei.
  ...(withOther ? [{ id: 'bo-other', label: 'Lainnya', sortOrder: pairs.length, isOther: true }] : []),
]
const rows = (pairs: Pair[]): MatrixRow[] =>
  pairs.map(([label, en], i) => ({ id: `br-${i}`, label, sortOrder: i, translations: { en } }))
const cols = (pairs: Pair[]): MatrixCol[] =>
  pairs.map(([label, en], i) => ({ id: `bc-${i}`, label, sortOrder: i, translations: { en } }))

export function buildBilingualMockSurvey(): Survey {
  let order = 0
  const q = (partial: Partial<Question> & Pick<Question, 'id' | 'type' | 'title'>): Question => ({
    description: null,
    required: false,
    sortOrder: order++,
    groupId: null,
    imageUrl: null,
    imageLayout: null,
    ...partial,
  } as Question)

  return {
    id: 'mock-survey-bilingual',
    title: 'Survei Kebiasaan Belanja Online',
    status: 'active',
    languages: { primary: 'id', secondary: 'en' },
    settings: {
      showProgress: true,
      showBranding: true,
      showNavArrows: true,
      showNumbers: true,
      requireLocation: false,
      requireSelfie: false,
      displayMode: 'one_per_page',
    },
    closeMessage: null,
    closeImageUrl: null,
    // Ditulis terhadap label BAHASA UTAMA ("Jarang"). Responden yang mengetuk
    // "Rarely" tetap harus terkena aturan ini — itulah bukti bahwa terjemahan
    // hanya proyeksi tampilan dan tidak menyentuh data.
    skipRules: [
      {
        id: 'bsr-1', questionId: 'bq2', sourceQuestionId: 'bq2', operator: 'equals', value: 'Jarang',
        action: 'skip_to', targetQuestionId: 'bq7', logicGroup: 'g1',
      },
    ],
    questions: [
      q({
        id: 'bq1', type: 'welcome_page',
        title: 'Survei Kebiasaan Belanja Online',
        titlePlain: 'Survei Kebiasaan Belanja Online',
        description: 'Hanya 3 menit. Jawaban Anda membantu kami memahami pembeli di Indonesia.',
        descriptionPlain: 'Hanya 3 menit. Jawaban Anda membantu kami memahami pembeli di Indonesia.',
        translations: { en: {
          title: 'Online Shopping Habits Survey',
          description: 'Just 3 minutes. Your answers help us understand shoppers in Indonesia.',
        } },
      }),
      q({
        id: 'bq2', type: 'single_choice', required: true,
        title: 'Seberapa sering Anda berbelanja online?',
        titlePlain: 'Seberapa sering Anda berbelanja online?',
        translations: { en: { title: 'How often do you shop online?' } },
        options: options([
          ['Setiap hari', 'Every day'], ['Setiap minggu', 'Every week'],
          ['Setiap bulan', 'Every month'], ['Jarang', 'Rarely'],
        ]),
      }),
      q({
        id: 'bq3', type: 'checkbox', required: true,
        title: 'Apa saja yang biasa Anda beli secara online?',
        titlePlain: 'Apa saja yang biasa Anda beli secara online?',
        description: 'Boleh pilih lebih dari satu.',
        translations: { en: { title: 'What do you usually buy online?', description: 'You may choose more than one.' } },
        options: options([
          ['Pakaian', 'Clothing'], ['Elektronik', 'Electronics'], ['Makanan & minuman', 'Food & beverages'],
          ['Kebutuhan rumah tangga', 'Household supplies'], ['Produk kecantikan', 'Beauty products'],
        ], true),
      }),
      q({
        id: 'bq4', type: 'dropdown', required: true,
        title: 'Metode pembayaran yang paling sering Anda pakai?',
        titlePlain: 'Metode pembayaran yang paling sering Anda pakai?',
        translations: { en: { title: 'Which payment method do you use most often?' } },
        options: options([
          ['Transfer bank', 'Bank transfer'], ['Dompet digital', 'E-wallet'],
          ['Kartu kredit', 'Credit card'], ['Bayar di tempat (COD)', 'Cash on delivery (COD)'],
        ]),
      }),
      q({
        id: 'bq5', type: 'nps', required: true,
        title: 'Seberapa besar kemungkinan Anda merekomendasikan toko online favorit Anda?',
        titlePlain: 'Seberapa besar kemungkinan Anda merekomendasikan toko online favorit Anda?',
        minLabel: 'Sangat tidak mungkin', maxLabel: 'Sangat mungkin',
        translations: { en: {
          title: 'How likely are you to recommend your favorite online store?',
          minLabel: 'Not at all likely', maxLabel: 'Extremely likely',
        } },
      }),
      q({
        id: 'bq6', type: 'matrix', required: true,
        title: 'Nilai kepuasan Anda terhadap aspek berikut:',
        titlePlain: 'Nilai kepuasan Anda terhadap aspek berikut:',
        translations: { en: { title: 'Rate your satisfaction with the following aspects:' } },
        matrixRows: rows([['Kecepatan pengiriman', 'Delivery speed'], ['Harga', 'Price'], ['Layanan pelanggan', 'Customer service']]),
        matrixCols: cols([['Tidak Puas', 'Dissatisfied'], ['Netral', 'Neutral'], ['Puas', 'Satisfied']]),
      }),
      q({
        id: 'bq7', type: 'long_text',
        title: 'Ceritakan pengalaman belanja terakhir Anda.',
        titlePlain: 'Ceritakan pengalaman belanja terakhir Anda.',
        placeholder: 'Tulis pengalaman Anda di sini...',
        translations: { en: {
          title: 'Tell us about your last shopping experience.',
          placeholder: 'Write your experience here...',
        } },
      }),
      q({
        id: 'bq8', type: 'closing_page',
        title: 'Terima Kasih!', titlePlain: 'Terima Kasih!',
        description: 'Respons Anda sangat berarti bagi kami.',
        translations: { en: { title: 'Thank You!', description: 'Your response means a lot to us.' } },
      }),
    ],
  }
}
