/**
 * Pengambilan draf untuk pratinjau.
 *
 * Yang dijaga di sini adalah tiga hal yang kalau salah berakhir di layar
 * pengguna sebagai kebingungan, bukan sebagai galat:
 *
 *  1. token di-encode — tanda tangan base64url boleh memuat karakter yang
 *     punya arti di URL;
 *  2. 401 dan 404 DIBEDAKAN, karena kalimat yang harus dibaca pengguna berbeda
 *     ("buka ulang pratinjaunya" vs "drafnya tidak ada");
 *  3. nol fallback ke salinan lama — draf berubah tiap kali dikoreksi lewat
 *     percakapan, dan salinan basi membuat pengguna memeriksa pertanyaan yang
 *     sudah tidak ada lalu menyimpan sesuatu yang lain.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `api.ts` menarik modul virtual SvelteKit. Vitest di repo ini berjalan tanpa
// plugin SvelteKit (spec lain semuanya modul murni), jadi keduanya dipalsukan
// di sini — basis URL-nya dioper eksplisit ke fungsinya, jadi nilai palsu ini
// tidak pernah dipakai.
vi.mock('$env/static/public', () => ({ PUBLIC_API_BASE_URL: 'http://uji/api/v1' }))
vi.mock('$env/dynamic/public', () => ({ env: {} }))

const { fetchDrafPratinjau } = await import('./api.js')

const SURVEI = {
  survey: {
    id: 'd-1',
    title: 'Survei Kepuasan',
    settings: { displayMode: 'scroll' },
    skipRules: [],
    questions: [
      { id: 's1', type: 'rating', title: 'Seberapa puas?', required: true, sortOrder: 0 },
    ],
  },
}

function balasan(status: number, body: unknown = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response
}

let panggilan: string[] = []

beforeEach(() => {
  panggilan = []
})

function fetchPalsu(status = 200, body: unknown = SURVEI) {
  return vi.fn(async (url: string) => {
    panggilan.push(url)
    return balasan(status, body)
  }) as unknown as typeof fetch
}

describe('fetchDrafPratinjau', () => {
  it('memanggil endpoint pratinjau dengan token yang di-encode', async () => {
    await fetchDrafPratinjau('a+b/c=d', fetchPalsu(), 'http://api/v1')

    expect(panggilan).toHaveLength(1)
    expect(panggilan[0]).toBe(`http://api/v1/ai-draft-preview?token=${encodeURIComponent('a+b/c=d')}`)
  })

  it('mengembalikan survei yang sudah dinormalkan, siap dirender komponen responden', async () => {
    const survei = await fetchDrafPratinjau('t', fetchPalsu(), 'http://api/v1')

    expect(survei.title).toBe('Survei Kepuasan')
    expect(survei.questions).toHaveLength(1)
    expect(survei.questions[0].id).toBe('s1')
  })

  it('401 → `preview_invalid`, bukan `not_found`', async () => {
    // Kalimat yang harus dibaca pengguna berbeda: yang satu "buka ulang
    // pratinjaunya", yang satu "drafnya memang tidak ada".
    await expect(fetchDrafPratinjau('t', fetchPalsu(401), 'http://api/v1')).rejects.toThrow(
      'preview_invalid',
    )
  })

  it('404 → `not_found`', async () => {
    await expect(fetchDrafPratinjau('t', fetchPalsu(404), 'http://api/v1')).rejects.toThrow(
      'not_found',
    )
  })

  it('500 → `server_error`, dan TIDAK jatuh ke salinan lama', async () => {
    // Halaman responden sengaja punya fallback cache untuk petugas lapangan
    // yang offline. Pratinjau tidak boleh ikut: draf yang basi di sini membuat
    // pengguna menyetujui pertanyaan yang sudah dihapusnya.
    await expect(fetchDrafPratinjau('t', fetchPalsu(500), 'http://api/v1')).rejects.toThrow(
      'server_error',
    )
  })

  it('SATU permintaan saja — nol percobaan ulang yang diam-diam', async () => {
    const f = fetchPalsu()
    await fetchDrafPratinjau('t', f, 'http://api/v1')
    expect(panggilan).toHaveLength(1)
  })
})
