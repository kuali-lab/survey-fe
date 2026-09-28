import { describe, it, expect } from 'vitest'
import type { Question } from './types.js'
import {
  canAddRow,
  effectiveMaxRepeat,
  questionRepeats,
  repeatValuesOf,
  toRows,
} from './repeat.js'

function q(partial: Partial<Question> & { id: string; type: Question['type'] }): Question {
  return {
    title: '',
    description: null,
    required: false,
    sortOrder: 0,
    groupId: null,
    imageUrl: null,
    imageLayout: null,
    ...partial,
  } as Question
}

describe('questionRepeats', () => {
  it('menyala hanya kalau maxRepeat ada DAN tipenya boleh berulang', () => {
    expect(questionRepeats(q({ id: 'a', type: 'short_text', maxRepeat: 3 }))).toBe(true)
    expect(questionRepeats(q({ id: 'b', type: 'short_text' }))).toBe(false)
  })

  // 🔴 Tipenya ikut diperiksa, bukan hanya maxRepeat-nya — persis seperti penjaga
  // `questionRepeats` di backend. `checkbox` SUDAH mengirim array, jadi kalau satu
  // baris checkbox entah bagaimana menyandang maxRepeat, tanpa penjagaan ini tiap
  // pilihan yang dicentang akan terbaca sebagai satu pengulangan.
  it('menolak tipe yang tidak boleh berulang walau maxRepeat terisi', () => {
    for (const type of ['checkbox', 'matrix', 'yes_no', 'region', 'contact_info'] as const) {
      expect(questionRepeats(q({ id: 'c', type, maxRepeat: 3 }))).toBe(false)
    }
  })
})

describe('effectiveMaxRepeat', () => {
  it('nol berarti pertanyaannya tidak berulang', () => {
    expect(effectiveMaxRepeat(q({ id: 'a', type: 'short_text' }))).toBe(0)
  })

  it('memakai nilai tersimpan apa adanya di dalam rentang', () => {
    expect(effectiveMaxRepeat(q({ id: 'a', type: 'number', maxRepeat: 3 }))).toBe(3)
  })

  // Plafon kerasnya ada di kode, bukan sekadar di validasi API: baris lawas atau
  // tulisan langsung ke basis data tidak boleh membuat responden bisa menambah
  // jawaban tanpa batas.
  it('memotong nilai di atas plafon', () => {
    expect(effectiveMaxRepeat(q({ id: 'a', type: 'number', maxRepeat: 50 }))).toBe(20)
  })
})

describe('repeatValuesOf', () => {
  it('nilai skalar jadi satu pengulangan', () => {
    expect(repeatValuesOf('Ani')).toEqual(['Ani'])
  })

  it('kosong jadi daftar kosong', () => {
    expect(repeatValuesOf(null)).toEqual([])
    expect(repeatValuesOf('   ')).toEqual([])
  })

  // KT-6: pengulangan kosong DI TENGAH ikut dirapatkan. Responden yang mengisi
  // baris 1 dan 3 lalu mengosongkan baris 2 mengirim dua jawaban, bukan tiga
  // dengan satu lubang — backend merapatkan dengan aturan yang sama, dan kalau
  // keduanya tidak sama, jumlah yang tervalidasi bukan jumlah yang tersimpan.
  it('merapatkan pengulangan kosong termasuk yang di tengah', () => {
    expect(repeatValuesOf(['Ani', '', 'Budi'])).toEqual(['Ani', 'Budi'])
    expect(repeatValuesOf(['  ', 'Budi'])).toEqual(['Budi'])
  })
})

// toRows dan canAddRow adalah kontrak untuk UI responden. Keduanya ditaruh di
// modul ini, bukan di dalam .svelte, karena suite survey-fe seluruhnya SSR
// (H-46): logika di dalam komponen tidak akan pernah tersentuh uji.
describe('toRows', () => {
  // Baris kosong DIPERTAHANKAN di sini, berbeda dari repeatValuesOf. Responden
  // harus bisa mengosongkan baris ke-2 lalu mengetiknya lagi; kalau barisnya
  // dirapatkan saat itu juga, kolom yang sedang diketik lenyap di bawah kursor.
  // Perapatan terjadi di backend saat submit, dengan aturan yang sama.
  it('mempertahankan baris kosong yang sedang diketik', () => {
    expect(toRows(['Ani', '', 'Budi'])).toEqual(['Ani', '', 'Budi'])
  })

  it('selalu memberi minimal satu baris supaya ada yang bisa diisi', () => {
    expect(toRows(null)).toEqual([''])
    expect(toRows([])).toEqual([''])
  })

  it('nilai skalar lama menjadi satu baris', () => {
    expect(toRows('Ani')).toEqual(['Ani'])
  })
})

describe('canAddRow', () => {
  // Penjaganya menghitung BARIS, bukan jawaban terisi: kalau yang dihitung
  // jawaban terisi, responden bisa menekan "Tambah" berkali-kali selama baris
  // barunya masih kosong dan membuat baris sebanyak yang ia mau.
  it('berhenti saat jumlah baris mencapai batas, walau sebagian kosong', () => {
    const soal = q({ id: 'a', type: 'short_text', maxRepeat: 3 })
    expect(canAddRow(soal, ['Ani', '', ''])).toBe(false)
    expect(canAddRow(soal, ['Ani', ''])).toBe(true)
  })

  it('pertanyaan yang tidak berulang tidak pernah boleh menambah baris', () => {
    expect(canAddRow(q({ id: 'a', type: 'short_text' }), [''])).toBe(false)
  })
})

