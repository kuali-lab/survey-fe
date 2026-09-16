/**
 * Dev-only mock survey. Returned by fetchSurvey() when running locally without
 * a backend — either by visiting `/s/mock` or by setting PUBLIC_USE_MOCK=1 in
 * .env (which makes every slug serve this fixture). Covers every question type
 * so the full respondent journey can be exercised offline.
 *
 * This file is plain data; it has no side effects and is tree-shaken out of any
 * build where it is never imported. The gate lives in api.ts.
 */
import type { Survey, Question } from './types.js'

let order = 0
const next = () => order++

function q(partial: Partial<Question> & Pick<Question, 'id' | 'type' | 'title'>): Question {
  return {
    description: null,
    required: false,
    sortOrder: next(),
    groupId: null,
    imageUrl: null,
    imageLayout: null,
    ...partial,
  } as Question
}

const opts = (labels: string[], withOther = false) => [
  ...labels.map((label, i) => ({ id: `o-${label}-${i}`, label, sortOrder: i })),
  ...(withOther ? [{ id: 'o-other', label: 'Lainnya', sortOrder: labels.length, isOther: true }] : []),
]

// ── Pilihan Bertingkat demo: Kota → Mall → Brand ─────────────────────────────
// Kota options carry a `value` (so their key is the code), Mall and Brand use
// their labels as keys. "Trans Studio Mall Makassar" has no brand mapped on
// purpose, to show the "Tidak ada pilihan untuk …" state (D-1: still passable).
const KOTA = [
  { label: 'Jakarta', value: 'JKT' },
  { label: 'Bandung', value: 'BDG' },
  { label: 'Surabaya', value: 'SBY' },
  { label: 'Medan', value: 'MDN' },
  { label: 'Makassar', value: 'MKS' },
]
const MALL_BY_KOTA: Record<string, string[]> = {
  JKT: ['Grand Indonesia', 'Plaza Senayan', 'Pondok Indah Mall'],
  BDG: ['Paris Van Java', '23 Paskal'],
  SBY: ['Tunjungan Plaza', 'Pakuwon Mall'],
  MDN: ['Sun Plaza', 'Delipark'],
  MKS: ['Trans Studio Mall Makassar'],
}
const MALLS_BY_BRAND: Record<string, string[]> = {
  Uniqlo: ['Grand Indonesia', 'Pondok Indah Mall', 'Paris Van Java', 'Tunjungan Plaza', 'Pakuwon Mall', 'Delipark'],
  Zara: ['Grand Indonesia', 'Plaza Senayan', 'Tunjungan Plaza'],
  'H&M': ['Grand Indonesia', 'Pondok Indah Mall', 'Paris Van Java', 'Tunjungan Plaza', 'Sun Plaza'],
  Starbucks: ['Grand Indonesia', 'Plaza Senayan', 'Pondok Indah Mall', 'Paris Van Java', '23 Paskal', 'Tunjungan Plaza', 'Pakuwon Mall', 'Delipark'],
  Gramedia: ['Pondok Indah Mall', '23 Paskal', 'Tunjungan Plaza', 'Sun Plaza'],
  Sephora: ['Grand Indonesia', 'Plaza Senayan', 'Tunjungan Plaza'],
}

function cascadeBlock(): Question[] {
  const malls = Object.values(MALL_BY_KOTA).flat()
  const mallAllowed: Record<string, string[]> = {}
  for (const [kota, list] of Object.entries(MALL_BY_KOTA)) {
    for (const m of list) mallAllowed[m] = [...(mallAllowed[m] ?? []), kota]
  }
  return [
    q({
      id: 'cascade-kota',
      type: 'single_choice',
      title: 'Di <b>kota</b> mana Anda paling sering berbelanja?',
      titlePlain: 'Di kota mana Anda paling sering berbelanja?',
      required: true,
      options: KOTA.map((k, i) => ({ id: `o-kota-${k.value}`, label: k.label, value: k.value, sortOrder: i })),
    }),
    q({
      id: 'cascade-mall',
      type: 'dropdown',
      title: 'Mal mana yang paling sering Anda kunjungi?',
      required: true,
      options: opts(malls, true),
      dependsOn: { sourceQuestionId: 'cascade-kota', allowed: mallAllowed },
    }),
    q({
      id: 'cascade-brand',
      type: 'single_choice',
      title: 'Gerai apa yang paling sering Anda datangi di mal tersebut?',
      required: true,
      options: opts(Object.keys(MALLS_BY_BRAND), true),
      dependsOn: { sourceQuestionId: 'cascade-mall', allowed: { ...MALLS_BY_BRAND } },
    }),
  ]
}

export function buildMockSurvey(slug: string): Survey {
  order = 0
  return {
    id: 'mock-survey-1',
    title: 'Survei Demo (Mock)',
    status: 'active',
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
    skipRules: [],
    questions: [
      q({
        id: 'welcome',
        type: 'welcome_page',
        title: 'Selamat datang di Survei Demo',
        description: 'Ini adalah survei contoh dengan data tiruan untuk menguji alur pengisian secara lokal.',
      }),
      q({
        id: 'statement-1',
        type: 'statement',
        title: 'Bagian 1: Tentang Anda',
        description: 'Beberapa pertanyaan singkat mengenai data diri.',
      }),
      // Placed first so the Pilihan Bertingkat demo is reachable right away.
      ...cascadeBlock(),
      q({ id: 'short-1', type: 'short_text', title: 'Siapa nama panggilan Anda?', placeholder: 'Misal: Budi', required: true }),
      q({ id: 'long-1', type: 'long_text', title: 'Ceritakan sedikit tentang keseharian Anda.' }),
      q({ id: 'email-1', type: 'email', title: 'Alamat email Anda?' }),
      q({ id: 'phone-1', type: 'phone', title: 'Nomor telepon Anda?' }),
      q({ id: 'website-1', type: 'website', title: 'Situs web pribadi (jika ada)?' }),
      q({ id: 'number-1', type: 'number', title: 'Berapa usia Anda?', minValue: 17, maxValue: 99, required: true }),
      q({ id: 'date-1', type: 'date', title: 'Tanggal lahir Anda?', dateFormat: 'DD/MM/YYYY' }),

      q({
        id: 'single-1',
        type: 'single_choice',
        title: 'Apa moda transportasi utama Anda?',
        required: true,
        options: opts(['Motor', 'Mobil', 'Transportasi umum', 'Jalan kaki'], true),
      }),
      q({
        id: 'checkbox-1',
        type: 'checkbox',
        title: 'Aplikasi apa yang Anda pakai? (maks 2)',
        maxSelections: 2,
        options: opts(['WhatsApp', 'Instagram', 'TikTok', 'X / Twitter'], true),
      }),
      q({
        id: 'dropdown-1',
        type: 'dropdown',
        title: 'Provinsi domisili Anda?',
        options: opts(['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur'], true),
      }),
      q({ id: 'yesno-1', type: 'yes_no', title: 'Apakah Anda pernah mengisi survei online sebelumnya?' }),
      q({
        id: 'image-1',
        type: 'image_choice',
        title: 'Pilih suasana yang paling Anda sukai.',
        showLabel: true,
        options: opts(['Pantai', 'Gunung', 'Kota', 'Desa']),
      }),

      q({ id: 'rating-1', type: 'rating', title: 'Beri nilai pengalaman Anda hari ini.', maxStars: 5 }),
      q({ id: 'nps-1', type: 'nps', title: 'Seberapa mungkin Anda merekomendasikan kami?', minLabel: 'Tidak mungkin', maxLabel: 'Sangat mungkin' }),
      q({
        id: 'scale-1',
        type: 'opinion_scale',
        title: 'Seberapa setuju: "Survei ini mudah diisi"?',
        minValue: 1,
        maxValue: 5,
        minLabel: 'Sangat tidak setuju',
        maxLabel: 'Sangat setuju',
      }),
      q({
        id: 'matrix-1',
        type: 'matrix',
        title: 'Nilai aspek berikut.',
        matrixRows: [
          { id: 'r-speed', label: 'Kecepatan', sortOrder: 0 },
          { id: 'r-clarity', label: 'Kejelasan', sortOrder: 1 },
        ],
        matrixCols: [
          { id: 'c-bad', label: 'Buruk', sortOrder: 0 },
          { id: 'c-ok', label: 'Cukup', sortOrder: 1 },
          { id: 'c-good', label: 'Baik', sortOrder: 2 },
        ],
      }),

      q({ id: 'contact-1', type: 'contact_info', title: 'Data kontak Anda' }),
      q({ id: 'file-1', type: 'file_upload', title: 'Unggah berkas pendukung (opsional)' }),
      q({ id: 'region-1', type: 'region', title: 'Di mana wilayah tempat tinggal Anda?', regionDepth: 3 }),

      q({
        id: 'closing',
        type: 'closing_page',
        title: 'Terima kasih telah berpartisipasi!',
        description: 'Jawaban Anda telah kami terima.',
      }),
    ],
  }
}
