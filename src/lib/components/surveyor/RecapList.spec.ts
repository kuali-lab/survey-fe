import { describe, it, expect } from 'vitest'
import { render } from 'svelte/server'
import type { Question } from '$lib/types.js'
import RecapList from './RecapList.svelte'

const base = { description: null, required: false, groupId: null, imageUrl: null, imageLayout: null }

const table: Question = {
  ...base, id: 't', type: 'table', title: 'Kelas 5', titlePlain: 'Kelas 5', sortOrder: 1,
  tableRows: [{ key: 1, label: 'Matematika' }, { key: 2, label: 'IPA' }],
  fields: [
    { ...base, id: 'murid', type: 'number', title: 'Murid', sortOrder: 0 },
    { ...base, id: 'judul', type: 'short_text', title: 'Judul', sortOrder: 1 },
  ],
}

describe('RecapList — tipe tabel', () => {
  it('menampilkan "n dari m sel terisi", bukan [object Object]', () => {
    const { body } = render(RecapList, {
      props: { questions: [table], answers: { t: { '1': { murid: 0, judul: 'Buku' }, '2': { murid: '4' } } }, onEdit: () => {} },
    })
    expect(body).toContain('3 dari 4 sel terisi')
    expect(body).not.toContain('[object Object]')
  })
})
