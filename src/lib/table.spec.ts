import { describe, it, expect } from 'vitest'
import type { AnswerValue, Question, TableAnswer } from './types.js'
import {
  COMPACT_BREAKPOINT, activeRows, canBreakout, columnMinRem, effectiveImageLayout, firstInvalidCellTarget, rescrollDelay, ROW_SLIDE_MS, columnWeight, filledCount, firstOpenRow, groupRows, isCellFilled, isCompactTable,
  isRowComplete, isTableTouched, pruneTableAnswer, requiredCount, requiredGridWidth, setCell, tableRecap, validateTable,
} from './table.js'
import { scalarRuleError } from './utils.js'
import { displayLabel } from './i18n/content.js'

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

describe('pruneTableAnswer (draf lama vs tabel yang sudah diubah)', () => {
  const q: Question = {
    ...table(),
    fields: [
      ...table().fields!,
      col('jenis', 'dropdown', false, { options: [{ id: 'o1', label: 'Negeri', sortOrder: 0 }, { id: 'o2', label: 'Swasta', sortOrder: 1 }] }),
    ],
  }

  it('jawaban valid tidak berubah', () => {
    const a: TableAnswer = { '1': { murid: 0, judul: 'x', jenis: 'Negeri' }, '2': { btu: '2' } }
    expect(pruneTableAnswer(q, a)).toEqual(a)
  })

  it('membuang baris dihapus/tak dikenal, kolom dihapus, dan label opsi yang sudah diganti', () => {
    const stale = { '1': { murid: '3', lama: 'x', jenis: 'Negri' }, '3': { murid: '1' }, '99': { murid: '2' }, '2': { jenis: 'Swasta' } }
    expect(pruneTableAnswer(q, stale)).toEqual({ '1': { murid: '3' }, '2': { jenis: 'Swasta' } })
  })

  it('baris yang jadi kosong dibuang; tabel yang jadi kosong = objek kosong', () => {
    expect(pruneTableAnswer(q, { '1': { lama: 'x' }, '3': { murid: '1' } })).toEqual({})
    expect(pruneTableAnswer(q, 'teks lama' as AnswerValue)).toEqual({})
  })
})

describe('scalarRuleError sebagai penilai sel (penanda sel = sel di pesan galat)', () => {
  const rules = (c: Question, v: AnswerValue) => scalarRuleError(c, v, (key, p) => `${key}:${p?.n}`)
  const q: Question = { ...table(), fields: [col('murid', 'number', true, { maxValue: 100 }), col('judul', 'short_text', true, { maxLength: 3 })] }

  it('galat rentang pada sel terisi menunjuk sel itu, bukan sel wajib kosong berikutnya', () => {
    expect(validateTable(q, { '1': { murid: '150' } }, rules)).toMatchObject({ rowKey: '1', columnId: 'murid' })
  })

  it('galat panjang teks di baris 2 menunjuk baris 2', () => {
    const issue = validateTable(q, { '1': { murid: '1', judul: 'ab' }, '2': { murid: '2', judul: 'abcd' } }, rules)
    expect(issue).toMatchObject({ rowKey: '2', columnId: 'judul', message: 'IPA — judul: errMaxLength:3' })
  })

  it('baris baru di sel teks bukan galat; panjangnya dihitung satu karakter', () => {
    const multi = { '1': { murid: '1', judul: 'a\nb' }, '2': { murid: '2', judul: 'c' } }
    expect(validateTable(q, multi, rules)).toBeNull()
    expect(validateTable(q, { ...multi, '2': { murid: '2', judul: 'a\nbc' } }, rules)).toMatchObject({ rowKey: '2', columnId: 'judul' })
  })
})

describe('tableRecap', () => {
  it('n dari m sel terisi (m = baris aktif × kolom)', () => {
    expect(tableRecap(table(), { '1': { murid: 0, judul: 'x' }, '3': { murid: 1 } })).toBe('2 dari 6 sel terisi')
    expect(tableRecap(table(), null)).toBe('0 dari 6 sel terisi')
  })
})

describe('isCompactTable (grid bila lantai kolom muat di lebar terukur)', () => {
  const num = (id: string) => col(id, 'number', false)
  const txt = (id: string) => col(id, 'short_text', false)
  const dd = (id: string, ...labels: string[]) =>
    col(id, 'dropdown', false, { options: labels.map((label, i) => ({ id: String(i), label, sortOrder: i })) })
  const pskp = [num('a'), num('b'), txt('c'), dd('d', 'Ya', 'Tidak'), dd('e', '2023', '2022 atau sebelumnya')]
  const mixed7 = [num('a'), num('b'), txt('c'), txt('d'), dd('e', 'Ya'), dd('f', 'Ya'), dd('g', 'Ya')]
  const mixed9 = [...mixed7, num('h'), txt('i')]
  const mixed10 = [...mixed9, num('j')]
  const numbers = (n: number) => Array.from({ length: n }, (_, i) => num(`n${i}`))
  // Lebar kontainer terukur: konten 672 (layar >=768 tanpa breakout), breakout min(960, viewport - 32).
  const CONTENT = 672
  const wide = (viewport: number) => Math.min(960, viewport - 32)

  it('lantai PSKP: judul baris 80 + angka 2×80 + teks 110 + dropdown 2×102 = 554px', () => {
    expect(requiredGridWidth(pskp)).toBe(554)
    expect(requiredGridWidth([])).toBe(80)
  })

  it('PSKP muat di konten 672 dengan sisa >= 100px', () => {
    expect(CONTENT - requiredGridWidth(pskp)).toBeGreaterThanOrEqual(100)
  })

  it.each<[string, Question[], number, boolean]>([
    ['PSKP 5 kolom, konten 672', pskp, CONTENT, false],
    ['PSKP 5 kolom, breakout 1280', pskp, wide(1280), false],
    ['PSKP 5 kolom, 700px (konten 660)', pskp, 660, false],
    ['7 kolom campuran (lantai 766), breakout 1280', mixed7, wide(1280), false],
    ['7 kolom campuran, breakout 1024', mixed7, wide(1024), false],
    ['7 kolom campuran, breakout 768 (736)', mixed7, wide(768), true],
    ['7 kolom campuran, konten 672', mixed7, CONTENT, true],
    ['9 kolom campuran (lantai 956), breakout 1280', mixed9, wide(1280), false],
    ['10 kolom campuran (lantai 1036), breakout 1280', mixed10, wide(1280), true],
    ['10 kolom angka (lantai 880), breakout 1280', numbers(10), wide(1280), false],
    ['lebar 640 selalu accordion', numbers(1), COMPACT_BREAKPOINT, true],
    ['belum terukur (0)', numbers(1), 0, true],
    ['0 kolom', [], 700, false],
  ])('%s → compact %s', (_, columns, width, want) => {
    expect(isCompactTable(width, columns)).toBe(want)
  })

  it('opsi dropdown panjang tidak menaikkan lantai', () => {
    expect(requiredGridWidth([dd('x', 'a'.repeat(80))])).toBe(requiredGridWidth([dd('x', 'Ya')]))
  })

  it('histeresis: grid bertahan bila lebar turun kurang dari 16px di bawah lantai (scrollbar halaman muncul)', () => {
    expect(isCompactTable(760, mixed7, false)).toBe(false)
    expect(isCompactTable(749, mixed7, false)).toBe(true)
    expect(isCompactTable(760, mixed7, true)).toBe(true)
    expect(isCompactTable(COMPACT_BREAKPOINT, numbers(1), false)).toBe(true)
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

  it('judul kelompok tampil dalam bahasa aktif; kosong/tak ada terjemahan kembali ke kelompok utama', () => {
    const q = {
      ...table(),
      tableRows: [
        { key: 1, label: 'A', group: 'Wajib', groupTranslations: { en: 'Compulsory' } },
        { key: 2, label: 'B', group: 'Wajib', groupTranslations: { en: 'Compulsory' } },
        { key: 3, label: 'C', group: 'Pilihan', groupTranslations: { en: '   ' } },
        { key: 4, label: 'D', group: 'Muatan lokal' },
      ],
    }
    const titles = (locale: string) => groupRows(q).map((g) => displayLabel({ label: g.group, translations: g.translations }, locale, 'id'))
    expect(titles('en')).toEqual(['Compulsory', 'Pilihan', 'Muatan lokal'])
    expect(titles('id')).toEqual(['Wajib', 'Pilihan', 'Muatan lokal'])
  })
})

describe('columnWeight (lebar kolom grid)', () => {
  const dropdown = (...labels: string[]) =>
    col('d', 'dropdown', false, { options: labels.map((label, i) => ({ id: String(i), label, sortOrder: i })) })

  it('dropdown mengikuti label opsi terpanjang, lebih lebar dari angka dan teks', () => {
    const tahun = dropdown('2023', '2022 atau sebelumnya')
    expect(columnWeight(tahun)).toBeGreaterThan(columnWeight(dropdown('2023', '2024')))
    expect(columnWeight(tahun)).toBeGreaterThan(columnWeight(col('j', 'short_text', false)))
    expect(columnWeight(col('n', 'number', false))).toBeLessThan(columnWeight(col('j', 'short_text', false)))
  })

  it('dibatasi bawah (opsi pendek atau tanpa opsi) dan atas (label sangat panjang)', () => {
    const min = columnWeight(dropdown())
    expect(columnWeight(dropdown('A'))).toBe(min)
    expect(columnWeight(col('d', 'dropdown', false))).toBe(min)
    expect(columnWeight(dropdown('x'.repeat(200)))).toBe(columnWeight(dropdown('x'.repeat(60))))
  })
})

describe('columnMinRem (lebar minimum kolom grid, mode padat 14px)', () => {
  const dropdown = (...labels: string[]) =>
    col('d', 'dropdown', false, { options: labels.map((label, i) => ({ id: String(i), label, sortOrder: i })) })
  // Ukur nyata Source Sans 3 14px (Chrome): "123456" 41,7px, "Kurikulum" 61px.
  // Isian padat: padding 6px kiri-kanan, batas fokus 2px kiri-kanan, spinner angka 15px.
  const chrome = 2 * 6 + 2 * 2

  it.each<[string, Question, number]>([
    ['angka: 6 digit + spinner', col('n', 'number', false), 41.7 + 15 + chrome],
    ['teks: satu kata ±"Matematika" (69px), selebihnya turun baris', col('j', 'short_text', false), 69 + chrome],
    ['dropdown: "Kurikulum" utuh + panah (padding kanan 22px)', dropdown('2023', '2024'), 61 + 6 + 22 + 4],
  ])('%s', (_, column, contentPx) => {
    const px = columnMinRem(column) * 16
    expect(px).toBeGreaterThanOrEqual(contentPx)
    expect(px - contentPx).toBeLessThan(20)
  })

  it('opsi panjang tidak menaikkan lantai dropdown (label terpilih turun baris), bobotnya yang naik', () => {
    const long = dropdown('x'.repeat(200))
    expect(columnMinRem(long)).toBe(columnMinRem(dropdown()))
    expect(columnWeight(long)).toBeGreaterThan(columnWeight(dropdown()))
  })
})

describe('firstInvalidCellTarget (gulir ke sel salah, M-5)', () => {
  const text = (id: string): Question => col(id, 'short_text', true)
  const issueOf = (q: Question) => validateTable(q, answers[q.id], noCellErrors)
  let answers: Record<string, AnswerValue> = {}

  it('tabel pertama yang salah: selektor sel lalu baris, dibatasi ke tabelnya', () => {
    answers = { t: { '1': { murid: '3', judul: 'a' }, '2': { judul: 'b' } } }
    expect(firstInvalidCellTarget([table()], { t: 'x' }, issueOf)).toEqual({
      cell: '[data-table="t"] [data-cell="2:murid"]',
      row: '[data-table="t"] [data-row="2"]',
    })
  })

  it('pertanyaan salah pertama bukan tabel → null (runner memakai .error seperti biasa)', () => {
    answers = { t: { '2': { judul: 'b' } } }
    expect(firstInvalidCellTarget([text('a'), table()], { a: 'wajib', t: 'x' }, issueOf)).toBeNull()
  })

  it('urutan halaman menang: tabel di atas pertanyaan lain yang juga salah', () => {
    answers = { t: { '2': { judul: 'b' } } }
    expect(firstInvalidCellTarget([table(), text('a')], { a: 'wajib', t: 'x' }, issueOf)?.cell).toBe('[data-table="t"] [data-cell="1:murid"]')
  })

  it('tabel wajib belum disentuh (tanpa baris) atau tanpa galat → null', () => {
    answers = { t: {} }
    expect(firstInvalidCellTarget([table(true)], { t: 'wajib' }, issueOf)).toBeNull()
    expect(firstInvalidCellTarget([table(true)], {}, issueOf)).toBeNull()
  })
})

describe('rescrollDelay (accordion: baris lain menutup sesudah gulir pertama)', () => {
  it('animasi aktif: gulir ulang sesudah slide baris selesai', () => {
    expect(rescrollDelay(false)).toBeGreaterThan(ROW_SLIDE_MS)
  })

  it('prefers-reduced-motion: slide 0ms, tak perlu gulir ulang', () => {
    expect(rescrollDelay(true)).toBeNull()
  })
})

describe('effectiveImageLayout', () => {
  const q = (type: Question['type'], imageLayout: string | null) => ({ ...table(), type, imageUrl: 'a.png', imageLayout })

  it.each([['left'], ['right']])('tabel dengan gambar %s: gambar pindah ke atas supaya tabel selebar kolom', (layout) => {
    expect(effectiveImageLayout(q('table', layout))).toBe('top')
  })

  it.each<[Question['type'], string | null]>([
    ['short_text', 'left'], ['matrix', 'right'], ['number', null], ['table', null], ['table', 'top'], ['table', 'center'],
  ])('%s dengan layout %s: tidak berubah', (type, layout) => {
    expect(effectiveImageLayout(q(type, layout))).toBe(layout)
  })
})

describe('canBreakout', () => {
  const q = (imageUrl: string | null, imageLayout: string | null) => ({ ...table(), imageUrl, imageLayout })

  it.each<[string | null, string | null]>([[null, null], ['a.png', null], ['a.png', 'top'], [null, 'left'], ['a.png', 'left'], ['a.png', 'right']])(
    'tabel (url %s, layout %s): boleh melebar, gambar inline tabel tampil di atas',
    (url, layout) => {
      expect(canBreakout(q(url, layout))).toBe(true)
    },
  )
})
