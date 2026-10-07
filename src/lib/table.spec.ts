import { describe, it, expect } from 'vitest'
import type { AnswerValue, Question, TableAnswer } from './types.js'
import {
  COMPACT_BREAKPOINT, activeRows, filledCount, firstOpenRow, groupRows, isCellFilled, isCompactTable,
  isRowComplete, isTableTouched, requiredCount, setCell, tableRecap, validateTable,
} from './table.js'

function col(id: string, type: Question['type'], required: boolean, extra: Partial<Question> = {}): Question {
  return {
    id, type, title: `<p>${id}</p>`, titlePlain: id, description: null, required,
    sortOrder: 0, groupId: null, imageUrl: null, imageLayout: null, ...extra,
  }
}

function table(required = false): Question {
  return {
    id: 't', type: 'table', title: 'Kelas 5', description: null, required,
    sortOrder: 1, groupId: null, imageUrl: null, imageLayout: null,
    tableRows: [
      { key: 1, label: 'Matematika', translations: { en: 'Mathematics' } },
      { key: 2, label: 'IPA' },
      { key: 3, label: 'Dihapus', deleted: true },
    ],
    fields: [
      col('murid', 'number', true, { translations: { en: { title: 'Pupils' } } }),
      col('btu', 'number', false),
      col('judul', 'short_text', true),
    ],
  }
}

const noCellErrors = () => null

describe('activeRows', () => {
  it('membuang baris deleted dan tahan tableRows kosong', () => {
    expect(activeRows(table()).map((r) => r.key)).toEqual([1, 2])
    expect(activeRows({ ...table(), tableRows: undefined })).toEqual([])
  })
})

describe('isCellFilled', () => {
  it.each<[AnswerValue | undefined, boolean]>([
    [0, true], ['0', true], ['abc', true], [12, true],
    ['', false], ['   ', false], [null, false], [undefined, false],
  ])('%j → %s', (v, want) => {
    expect(isCellFilled(v)).toBe(want)
  })
})

describe('setCell', () => {
  it('imutabel: objek asal tidak berubah', () => {
    const before: TableAnswer = { '1': { murid: '3' } }
    const after = setCell(before, '1', 'btu', '0')
    expect(before).toEqual({ '1': { murid: '3' } })
    expect(after).toEqual({ '1': { murid: '3', btu: '0' } })
  })

  it.each<[string, AnswerValue]>([['kosong', ''], ['spasi', '  '], ['null', null]])(
    'nilai %s menghapus kunci sel',
    (_, v) => {
      expect(setCell({ '1': { murid: '3', btu: '1' } }, '1', 'btu', v)).toEqual({ '1': { murid: '3' } })
    },
  )

  it('menghapus kunci baris saat sel terakhirnya dikosongkan', () => {
    expect(setCell({ '1': { murid: '3' }, '2': { murid: '4' } }, '1', 'murid', '')).toEqual({ '2': { murid: '4' } })
  })

  it('0 adalah jawaban, tidak dihapus', () => {
    expect(setCell({}, '2', 'btu', 0)).toEqual({ '2': { btu: 0 } })
  })

  it('jawaban bukan objek tabel diperlakukan kosong', () => {
    expect(setCell('teks lama' as AnswerValue, '1', 'murid', '5')).toEqual({ '1': { murid: '5' } })
  })
})

describe('hitungan per baris', () => {
  const answer: TableAnswer = { '1': { murid: 0, btu: '', judul: 'Buku' } as TableAnswer[string], '2': { btu: '2' } }

  it('filledCount menghitung sel terisi di semua kolom', () => {
    expect(filledCount(table(), answer, '1')).toBe(2)
    expect(filledCount(table(), answer, '2')).toBe(1)
    expect(filledCount(table(), answer, '9')).toBe(0)
  })

  it('requiredCount = jumlah kolom wajib', () => {
    expect(requiredCount(table())).toBe(2)
  })

  it('isRowComplete: semua kolom wajib terisi', () => {
    expect(isRowComplete(table(), answer, '1')).toBe(true)
    expect(isRowComplete(table(), answer, '2')).toBe(false)
  })

  it('isRowComplete tanpa kolom wajib: lengkap bila semua kolom terisi', () => {
    const q = { ...table(), fields: [col('a', 'short_text', false), col('b', 'number', false)] }
    expect(isRowComplete(q, { '1': { a: 'x' } }, '1')).toBe(false)
    expect(isRowComplete(q, { '1': { a: 'x', b: 1 } }, '1')).toBe(true)
  })
})

describe('isTableTouched', () => {
  it.each<[AnswerValue | undefined, boolean]>([
    [undefined, false], [null, false], [{}, false], [{ '1': {} }, false],
    [{ '1': { btu: '' } }, false], [{ '1': { btu: 0 } }, true], [{ '2': { judul: 'x' } }, true],
  ])('%j → %s', (v, want) => {
    expect(isTableTouched(v)).toBe(want)
  })
})

describe('firstOpenRow', () => {
  it('baris aktif pertama yang belum lengkap, atau baris pertama bila semua lengkap', () => {
    const full = { murid: 1, judul: 'x' }
    expect(firstOpenRow(table(), {})).toBe('1')
    expect(firstOpenRow(table(), { '1': full })).toBe('2')
    expect(firstOpenRow(table(), { '1': full, '2': full })).toBe('1')
    expect(firstOpenRow({ ...table(), tableRows: [] }, {})).toBeNull()
  })
})

describe('validateTable — wajib dan K108 (paritas 01 §6.1)', () => {
  const full = { murid: '30', judul: 'Buku' }

  it.each<[string, boolean, AnswerValue, ReturnType<typeof validateTable>]>([
    ['opsional tanpa sentuhan lolos', false, {}, null],
    ['opsional null lolos', false, null, null],
    ['wajib tanpa sentuhan → pesan wajib existing', true, {}, { message: 'Pertanyaan ini wajib diisi.', rowKey: null, columnId: null }],
    ['wajib dengan jawaban bukan objek → pesan wajib', true, 'x', { message: 'Pertanyaan ini wajib diisi.', rowKey: null, columnId: null }],
    ['opsional tersentuh sebagian (K108) → sel wajib pertama yang kosong', false, { '1': { btu: '1' } },
      { message: 'Lengkapi kolom «murid» pada baris «Matematika».', rowKey: '1', columnId: 'murid' }],
    ['urut baris lalu kolom: baris 1 kolom judul sebelum baris 2', true, { '1': { murid: '3' }, '2': full },
      { message: 'Lengkapi kolom «judul» pada baris «Matematika».', rowKey: '1', columnId: 'judul' }],
    ['baris 2 belum diisi sama sekali tetap ditagih', true, { '1': full },
      { message: 'Lengkapi kolom «murid» pada baris «IPA».', rowKey: '2', columnId: 'murid' }],
    ['kolom tidak wajib boleh kosong', true, { '1': full, '2': full }, null],
    ['angka 0 dan "0" terisi', true, { '1': { murid: 0, judul: 'a' }, '2': { murid: '0', judul: 'b' } }, null],
    ['sel di baris deleted / tak dikenal diabaikan', false, { '3': { murid: '1' }, '99': { murid: '2' } }, null],
  ])('%s', (_, required, answer, want) => {
    expect(validateTable(table(required), answer, noCellErrors)).toEqual(want)
  })

  it('sel terisi dicek validateCell; pesannya diberi nama baris dan kolom', () => {
    const calls: [string, AnswerValue][] = []
    const issue = validateTable(table(), { '1': { murid: '-1', judul: 'x' } }, (c, v) => {
      calls.push([c.id, v])
      return c.id === 'murid' ? 'Nilai minimal adalah 0.' : null
    })
    expect(issue).toEqual({ message: 'Matematika — murid: Nilai minimal adalah 0.', rowKey: '1', columnId: 'murid' })
    expect(calls).toEqual([['murid', '-1']])
  })

  it('galat sel lebih awal menang atas sel wajib kosong di belakangnya', () => {
    const issue = validateTable(table(), { '1': { murid: '5' } }, (c) => (c.id === 'murid' ? 'X.' : null))
    expect(issue?.columnId).toBe('murid')
  })

  it('label baris dan kolom mengikuti bahasa aktif', () => {
    expect(validateTable(table(), { '2': full }, noCellErrors, 'en', 'id')).toEqual({
      message: 'Fill in the «Pupils» column in the «Mathematics» row.', rowKey: '1', columnId: 'murid',
    })
  })
})

describe('tableRecap', () => {
  it('n dari m sel terisi (m = baris aktif × kolom)', () => {
    expect(tableRecap(table(), { '1': { murid: 0, judul: 'x' }, '3': { murid: 1 } })).toBe('2 dari 6 sel terisi')
    expect(tableRecap(table(), null)).toBe('0 dari 6 sel terisi')
  })
})

describe('isCompactTable', () => {
  it.each<[number, number, boolean]>([
    [0, 3, true], [COMPACT_BREAKPOINT, 3, true], [COMPACT_BREAKPOINT + 1, 3, false],
    [720, 5, false], [720, 6, true], [900, 6, false],
  ])('lebar %d, %d kolom → %s', (w, n, want) => {
    expect(isCompactTable(w, n)).toBe(want)
  })
})

describe('groupRows (K115: baris judul kelompok)', () => {
  it('memecah baris aktif berurutan per kelompok; tanpa kelompok = satu blok tanpa judul', () => {
    const q = {
      ...table(),
      tableRows: [
        { key: 1, label: 'A', group: 'Kelas 1' }, { key: 2, label: 'B', group: 'Kelas 1' },
        { key: 9, label: 'X', group: 'Kelas 1', deleted: true },
        { key: 3, label: 'C', group: 'Kelas 2' }, { key: 4, label: 'D' },
      ],
    }
    expect(groupRows(q).map((g) => [g.group, g.rows.map((r) => r.key)])).toEqual([
      ['Kelas 1', [1, 2]], ['Kelas 2', [3]], ['', [4]],
    ])
    expect(groupRows(table()).map((g) => g.group)).toEqual([''])
  })
})
