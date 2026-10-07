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

  it('teks: maxlength dari kolom; sel tidak valid membawa aria-invalid + aria-describedby', () => {
    const { body } = render(TableCellInput, {
      props: { column: col('Judul', 'short_text', { maxLength: 40 }), value: 'Buku', label: 'IPA — Judul', invalid: true, describedBy: 'q-error-t', onChange: noop },
    })
    expect(body).toContain('type="text"')
    expect(body).toContain('maxlength="40"')
    expect(body).toContain('aria-invalid="true"')
    expect(body).toContain('aria-describedby="q-error-t"')
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
})
