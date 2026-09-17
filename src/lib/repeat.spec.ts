import { describe, it, expect } from 'vitest'
import type { Question } from './types.js'
import { canAddRepeat, effectiveMaxRepeat, questionRepeats, repeatValuesOf } from './repeat.js'

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

describe('canAddRepeat', () => {
  it('boleh menambah selama masih di bawah batas', () => {
    const soal = q({ id: 'a', type: 'short_text', maxRepeat: 3 })
    expect(canAddRepeat(soal, ['Ani'])).toBe(true)
    expect(canAddRepeat(soal, ['Ani', 'Budi'])).toBe(true)
  })

  it('berhenti tepat di batas', () => {
    const soal = q({ id: 'a', type: 'short_text', maxRepeat: 3 })
    expect(canAddRepeat(soal, ['Ani', 'Budi', 'Cici'])).toBe(false)
  })

  it('pertanyaan yang tidak berulang tidak pernah boleh menambah', () => {
    expect(canAddRepeat(q({ id: 'a', type: 'short_text' }), [])).toBe(false)
  })
})
