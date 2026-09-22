/**
 * The platform's own interface text (buttons, hints, validation messages) per
 * language.
 *
 * Survey authors do NOT translate any of this — they only translate the text they
 * wrote themselves (titles, options, …). Rune-free and DOM-free so it can be tested
 * in Node, following `topOfMind.ts` / `optionDependency.ts`.
 *
 * 🔴 The `id` pack is the SOURCE OF TRUTH and its values must match the strings
 * that used to be embedded in the components character for character: a
 * single-language survey (and the specs that already exist) must not change at all.
 */
const id = {
  start: 'Mulai Survei',
  next: 'Selanjutnya',
  back: 'Sebelumnya',
  submit: 'Kirim Jawaban',
  autoAdvance: 'Lanjut otomatis…',
  loading: 'Memuat survei…',
  submitting: 'Mengirim jawaban…',
  requiredMark: 'wajib diisi',
  chooseLanguage: 'Pilih bahasa',

  resumeRegion: 'Lanjutkan survei',
  resumeTitle: 'Lanjutkan survei Anda',
  resumeBody: 'Jawaban sebelumnya tersimpan di perangkat ini. Anda dapat melanjutkan dari pertanyaan terakhir, atau memulai ulang dari awal.',
  resumeContinue: 'Lanjutkan',
  resumeRestart: 'Mulai dari awal',

  confirmTitle: 'Kirim jawaban Anda?',
  confirmBody: 'Jawaban yang sudah dikirim tidak bisa diubah lagi. Pastikan jawaban sudah benar.',
  confirmReview: 'Periksa lagi',
  confirmSend: 'Ya, kirim',

  closingTitle: 'Terima Kasih!',
  closingBody: 'Terima kasih telah mengisi survei ini. Jawaban Anda telah berhasil disimpan.',
  alreadySubmitted: 'Survei ini sudah pernah Anda isi sebelumnya.',
  submitFailed: 'Terjadi kesalahan saat mengirim jawaban. Silakan coba lagi.',

  errRequired: 'Pertanyaan ini wajib diisi.',
  errPickOne: 'Pilih minimal satu jawaban.',
  errContact: 'Isi minimal satu data kontak.',
  errMatrixRows: 'Mohon lengkapi semua baris.',
  errMinLength: 'Minimal {n} karakter.',
  errMaxLength: 'Maksimal {n} karakter.',
  errMinValue: 'Nilai minimal adalah {n}.',
  errMaxValue: 'Nilai maksimal adalah {n}.',
  errEmail: 'Format email belum sesuai.',
  errPhone: 'Format nomor telepon belum sesuai.',
  errUploading: 'Tunggu hingga berkas selesai diunggah.',

  other: 'Lainnya',
  otherPlaceholder: 'Tuliskan jawaban Anda...',
  yes: 'Ya',
  no: 'Tidak',
  selectLimit: 'Pilih maksimal {limit} jawaban ({n}/{limit}).',
  ratingOf: '{n} dari {max}',
  ratingStar: 'Beri nilai {n}',
  scaleDisagree: 'Sangat Tidak Setuju',
  scaleAgree: 'Sangat Setuju',
  npsUnlikely: 'Sangat Tidak Mungkin',
  npsLikely: 'Sangat Mungkin',
  numBetween: 'Antara {min} dan {max}.',
  numMin: 'Minimal {min}.',
  numMax: 'Maksimal {max}.',
  firstName: 'Nama Depan',
  lastName: 'Nama Belakang',
  phone: 'Nomor Telepon',
  email: 'Email',

  tomFirst: 'Pilihan pertama Anda:',
  tomMore: 'Ada lagi yang terlintas?',
  tomContinue: 'Lanjut',
  tomStage2Hint: 'Bisa pilih lebih dari satu.',
  tomNoMore: 'Tidak ada pilihan lain.',
  tomRestLimit: 'Bisa pilih hingga {limit} jawaban lagi ({n}/{limit}).',

  matrixProgress: '{n} dari {total} terjawab',

  ddPlaceholder: '-- Pilih salah satu --',
  ddSearch: 'Cari pilihan...',
  ddMinChars: 'Ketik minimal {n} huruf untuk mencari.',
  ddLoading: 'Memuat...',
  ddEmpty: 'Tidak ada pilihan yang cocok.',
  ddMultiCount: '{n} dipilih',
  ddTypeToSearch: 'Ketik untuk mencari…',
}

export type MessageKey = keyof typeof id

const en: Record<MessageKey, string> = {
  start: 'Start Survey',
  next: 'Next',
  back: 'Back',
  submit: 'Submit Answers',
  autoAdvance: 'Moving on…',
  loading: 'Loading survey…',
  submitting: 'Sending your answers…',
  requiredMark: 'required',
  chooseLanguage: 'Choose language',

  resumeRegion: 'Continue survey',
  resumeTitle: 'Continue your survey',
  resumeBody: 'Your earlier answers are saved on this device. You can pick up where you left off, or start over.',
  resumeContinue: 'Continue',
  resumeRestart: 'Start over',

  confirmTitle: 'Submit your answers?',
  confirmBody: 'Answers cannot be changed once submitted. Please make sure they are correct.',
  confirmReview: 'Review again',
  confirmSend: 'Yes, submit',

  closingTitle: 'Thank You!',
  closingBody: 'Thank you for completing this survey. Your answers have been saved.',
  alreadySubmitted: 'You have already completed this survey.',
  submitFailed: 'Something went wrong while sending your answers. Please try again.',

  errRequired: 'This question is required.',
  errPickOne: 'Choose at least one answer.',
  errContact: 'Fill in at least one contact detail.',
  errMatrixRows: 'Please complete every row.',
  errMinLength: 'At least {n} characters.',
  errMaxLength: 'At most {n} characters.',
  errMinValue: 'The minimum value is {n}.',
  errMaxValue: 'The maximum value is {n}.',
  errEmail: 'That email format does not look right.',
  errPhone: 'That phone number format does not look right.',
  errUploading: 'Please wait until the file has finished uploading.',

  other: 'Other',
  otherPlaceholder: 'Type your answer...',
  yes: 'Yes',
  no: 'No',
  selectLimit: 'Choose up to {limit} answers ({n}/{limit}).',
  ratingOf: '{n} of {max}',
  ratingStar: 'Rate {n}',
  scaleDisagree: 'Strongly Disagree',
  scaleAgree: 'Strongly Agree',
  npsUnlikely: 'Not at All Likely',
  npsLikely: 'Extremely Likely',
  numBetween: 'Between {min} and {max}.',
  numMin: 'At least {min}.',
  numMax: 'At most {max}.',
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone Number',
  email: 'Email',

  tomFirst: 'Your first pick:',
  tomMore: 'Anything else come to mind?',
  tomContinue: 'Continue',
  tomStage2Hint: 'You can choose more than one.',
  tomNoMore: 'No other options.',
  tomRestLimit: 'You can choose up to {limit} more ({n}/{limit}).',

  matrixProgress: '{n} of {total} answered',

  ddPlaceholder: '-- Choose one --',
  ddSearch: 'Search options...',
  ddMinChars: 'Type at least {n} characters to search.',
  ddLoading: 'Loading...',
  ddEmpty: 'No matching options.',
  ddMultiCount: '{n} selected',
  ddTypeToSearch: 'Type to search…',
}

const PACKS: Record<string, Record<MessageKey, string>> = { id, en }

/** The legacy primary language: every survey before this feature was in Indonesian. */
export const LEGACY_LOCALE = 'id'

/**
 * A language with no pack falls back to English, not Indonesian: a respondent who
 * picked 日本語 is far more likely to be helped by a "Next" button than by
 * "Selanjutnya".
 */
export function t(locale: string, key: MessageKey, params?: Record<string, string | number>): string {
  const template = (PACKS[locale] ?? PACKS.en)[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}
