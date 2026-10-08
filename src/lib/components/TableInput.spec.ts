import { describe, it, expect } from 'vitest'
import { render } from 'svelte/server'
import type { Question } from '$lib/types.js'
import TableInput from './TableInput.svelte'
import TableCellInput from './TableCellInput.svelte'

// Render SSR: lebar pembungkus belum terukur (0), jadi markup awal selalu accordion
// (mobile-first, tanpa kilasan grid di ponsel). Grid desktop dibuktikan di live-verify.

function col(id: string, type: Question['type'], extra: Partial<Question> = {}): Question {
  return {
    id, type, title: id, titlePlain: id, description: null, required: false,
    sortOrder: 0, groupId: null, imageUrl: null, imageLayout: null, ...extra,
  }
}

const table: Question = {
  id: 't', type: 'table', title: 'Kelas 5', titlePlain: 'Kelas 5', description: null, required: true,
  sortOrder: 1, groupId: null, imageUrl: null, imageLayout: null,
  tableRows: [
    { key: 1, label: 'Matematika', group: 'Wajib' },
    { key: 2, label: 'IPA', group: 'Wajib' },
  ],
  fields: [
    col('Murid', 'number', { required: true, minValue: 0 }),
    col('BTU', 'number', { description: 'Isi 0 jika tidak ada' }),
    col('Judul', 'short_text', { required: true }),
  ],
}

const noop = () => {}

describe('TableCellInput', () => {
  it('angka: input number dengan rentang kolom dan label "Baris — Kolom"; 0 tampil', () => {
    const { body } = render(TableCellInput, {
      props: { column: col('Murid', 'number', { minValue: 0, maxValue: 99 }), value: 0, label: 'Matematika — Murid', onChange: noop },
    })
    expect(body).toContain('type="number"')
    expect(body).toContain('value="0"')
    expect(body).toContain('min="0"')
    expect(body).toContain('max="99"')
    expect(body).toContain('aria-label="Matematika — Murid"')
    expect(body).not.toContain('aria-invalid')
  })

  it('teks: textarea satu baris yang tumbuh (gaya .text-input existing), maxlength dari kolom; sel tidak valid membawa aria-invalid + aria-describedby', () => {
    const { body } = render(TableCellInput, {
      props: { column: col('Judul', 'short_text', { maxLength: 40 }), value: 'Baris 1\nBaris 2', label: 'IPA — Judul', invalid: true, describedBy: 'q-error-t', onChange: noop },
    })
    expect(body).toMatch(/<textarea[^>]*class="text-input grow-input[^"]*"/)
    expect(body).toMatch(/<textarea[^>]*rows="1"/)
    expect(body).not.toContain('type="text"')
    expect(body).toContain('maxlength="40"')
    expect(body).toContain('aria-label="IPA — Judul"')
    expect(body).toContain('aria-invalid="true"')
    expect(body).toContain('aria-describedby="q-error-t"')
    expect(body).toContain('Baris 1\nBaris 2</textarea>')
  })

  it.each<[string, Question]>([
    ['angka', col('n', 'number')],
    ['teks', col('j', 'short_text')],
    ['dropdown', col('d', 'dropdown', { options: [{ id: 'a', label: 'Ya', sortOrder: 0 }] })],
  ])('%s: ukuran padat hanya di grid (wrapValue), accordion memakai ukuran input biasa', (_, column) => {
    const grid = render(TableCellInput, { props: { column, value: undefined, label: 'A — B', wrapValue: true, onChange: noop } })
    expect(grid.body).toMatch(/class="text-input[^"]*cell-dense/)
    const list = render(TableCellInput, { props: { column, value: undefined, label: 'A — B', onChange: noop } })
    expect(list.body).toContain('class="text-input')
    expect(list.body).not.toContain('cell-dense')
  })

  it('dropdown: <select> bawaan, opsi bernilai label bahasa utama', () => {
    const column = col('Tahun', 'dropdown', {
      options: [{ id: 'a', label: '2022', sortOrder: 0 }, { id: 'b', label: '2023', sortOrder: 1 }],
    })
    const { body } = render(TableCellInput, { props: { column, value: '2023', label: 'IPA — Tahun', onChange: noop } })
    expect(body).toContain('<select')
    expect(body).toMatch(/<option value="2023"[^>]*selected/)
    // Placeholder pendek supaya muat di lebar kolom grid desktop.
    expect(body).toMatch(/<option value=""[^>]*>Pilih<\/option>/)
  })

  it('dropdown: tanpa title (muka sudah menampilkan nilai utuh; title menggandakannya di pembaca layar)', () => {
    const column = col('Kurikulum', 'dropdown', {
      options: [{ id: 'a', label: 'Kurikulum Merdeka', sortOrder: 0 }, { id: 'b', label: 'Kurikulum 2013', sortOrder: 1 }],
    })
    const chosen = render(TableCellInput, { props: { column, value: 'Kurikulum Merdeka', label: 'IPA — Kurikulum', onChange: noop } })
    expect(chosen.body).not.toContain('title=')
  })

  it('dropdown: label terpilih tampil utuh di muka bergaya .text-input (bisa turun baris), select transparan memegang a11y', () => {
    const column = col('Tahun', 'dropdown', {
      options: [{ id: 'a', label: '2022 atau sebelumnya', sortOrder: 0 }],
    })
    for (const wrapValue of [true, false]) {
      const chosen = render(TableCellInput, { props: { column, value: '2022 atau sebelumnya', label: 'IPA — Tahun', wrapValue, onChange: noop } })
      expect(chosen.body).toMatch(/class="text-input grow-input select-face[^"]*"[^>]*aria-hidden="true"[^>]*>2022 atau sebelumnya</)
      expect(chosen.body).toContain('aria-label="IPA — Tahun"')
      const empty = render(TableCellInput, { props: { column, value: undefined, label: 'IPA — Tahun', wrapValue, onChange: noop } })
      expect(empty.body).toMatch(/class="text-input grow-input select-face[^"]*"[^>]*>Pilih</)
    }
  })
})

describe('TableCellInput — dropdown >15 opsi memakai SearchableDropdown', () => {
  const options = (n: number, label = (i: number) => `Opsi ${i}`) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), label: label(i), sortOrder: i }))
  const render16 = (props: Record<string, unknown>) =>
    render(TableCellInput, { props: { column: col('Kab', 'dropdown', { options: options(16) }), value: undefined, label: 'IPA — Kab', onChange: noop, ...props } }).body

  it('15 opsi: tetap select bawaan; 16 opsi: pemicu SearchableDropdown tanpa select', () => {
    const fifteen = render(TableCellInput, { props: { column: col('Kab', 'dropdown', { options: options(15) }), value: undefined, label: 'IPA — Kab', onChange: noop } }).body
    expect(fifteen).toContain('<select')
    const sixteen = render16({ value: undefined })
    expect(sixteen).not.toContain('<select')
    expect(sixteen).toMatch(/<button[^>]*class="dropdown-trigger/)
    expect(sixteen).toContain('>Pilih<')
  })

  it('nama aksesibel "Baris — Kolom" (ditambah nilai terpilih), sel salah: garis merah + describedby ke pesan, aria-expanded', () => {
    const empty = render16({ value: undefined, describedBy: 'q-error-t' })
    expect(empty).toContain('aria-label="IPA — Kab"')
    expect(empty).not.toMatch(/dropdown-trigger[^"]*invalid/)
    expect(empty).not.toContain('aria-describedby')
    expect(empty).toContain('aria-expanded="false"')
    const chosen = render16({ value: 'Opsi 3', invalid: true, describedBy: 'q-error-t' })
    expect(chosen).toContain('aria-label="IPA — Kab: Opsi 3"')
    expect(chosen).toMatch(/class="dropdown-trigger[^"]*invalid/)
    expect(chosen).toContain('aria-describedby="q-error-t"')
  })

  it('nilai terpilih panjang tampil utuh di pemicu (dibungkus, bukan dipotong data)', () => {
    const long = 'Kabupaten dengan nama yang sangat panjang sekali untuk menguji turun baris'
    const body = render(TableCellInput, {
      props: { column: col('Kab', 'dropdown', { options: options(16, (i) => (i === 0 ? long : `Opsi ${i}`)) }), value: long, label: 'A — B', wrapValue: true, onChange: noop },
    }).body
    expect(body).toContain(`>${long}</span>`)
    expect(body).toMatch(/class="cell-dd[^"]*dense/)
  })
})

describe('SearchableDropdown — pemanggil lama tak berubah', () => {
  it('tanpa prop baru: tanpa aria-label/aria-invalid/aria-expanded', async () => {
    const { default: SearchableDropdown } = await import('./SearchableDropdown.svelte')
    const { body } = render(SearchableDropdown, { props: { options: [{ label: 'A' }], value: 'A', onChange: noop } })
    expect(body).toContain('class="dropdown-trigger')
    expect(body).not.toMatch(/aria-label|aria-expanded|aria-describedby|invalid/)
  })
})

describe('TableInput — markup awal (accordion)', () => {
  it('satu baris terbuka (baris pertama belum lengkap), kepala bertombol aria-expanded + aria-controls', () => {
    const { body } = render(TableInput, { props: { question: table, value: { '1': { Murid: '3', Judul: 'a' } }, onChange: noop } })
    expect(body).not.toContain('<table')
    expect(body.match(/aria-expanded="true"/g)).toHaveLength(1)
    expect(body.match(/aria-expanded="false"/g)).toHaveLength(1)
    const controls = body.match(/aria-expanded="true"[^>]*aria-controls="([^"]+)"|aria-controls="([^"]+)"[^>]*aria-expanded="true"/)
    const panelId = controls?.[1] ?? controls?.[2]
    expect(panelId).toBeTruthy()
    expect(body).toContain(`id="${panelId}"`)
    expect(body).toContain('aria-label="IPA — Murid"')
    expect(body).not.toContain('aria-label="Matematika — Murid"')
  })

  it('pengukur lebar selebar wadah grid (breakout ≥768px) ada tanpa gambar inline, kosong dan tersembunyi dari pembaca layar', () => {
    const { body } = render(TableInput, { props: { question: table, value: null, onChange: noop } })
    expect(body).toMatch(/<div class="table-span[^"]*" aria-hidden="true"><\/div>/)
  })

  it.each([['left'], ['right']])('gambar inline %s: pengukur breakout tetap ada (gambar tabel tampil di atas)', (imageLayout) => {
    const { body } = render(TableInput, { props: { question: { ...table, imageUrl: 'a.png', imageLayout }, value: null, onChange: noop } })
    expect(body).toContain('table-span')
  })

  it('badge n/m sel terisi, judul kelompok, keterangan kolom, dan tombol baris berikutnya hanya bila ada', () => {
    const { body } = render(TableInput, { props: { question: table, value: { '1': { BTU: 0 } }, onChange: noop } })
    expect(body).toContain('1/3')
    expect(body).toContain('Wajib')
    expect(body).toContain('Isi 0 jika tidak ada')
    expect(body).toContain('Baris berikutnya')
  })

  it('galat dari runner membuka baris sel wajib pertama yang kosong dan menandainya', () => {
    const value = { '1': { Murid: '3', Judul: 'a' }, '2': { Judul: 'b' } }
    const { body } = render(TableInput, {
      props: { question: table, value, onChange: noop, error: 'Lengkapi kolom «Murid» pada baris «IPA».' },
    })
    expect(body).toMatch(/aria-label="IPA — Murid"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*aria-label="IPA — Murid"/)
    expect(body.match(/aria-invalid="true"/g)).toHaveLength(1)
  })

  it('target gulir runner: tabel ber-data-table, baris ber-data-row, sel ber-data-cell "baris:kolom"', () => {
    const { body } = render(TableInput, { props: { question: table, value: null, onChange: noop } })
    expect(body).toMatch(/class="table-q[^"]*"[^>]*data-table="t"|data-table="t"[^>]*class="table-q/)
    expect(body).toContain('data-row="1"')
    expect(body).toContain('data-row="2"')
    for (const c of ['Murid', 'BTU', 'Judul']) expect(body).toContain(`data-cell="1:${c}"`)
  })
})
