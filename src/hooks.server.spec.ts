import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { handle } from './hooks.server.js'
import { env } from '$env/dynamic/private'

/**
 * Minimal stand-in for SvelteKit's `handle` arguments. Only the three things
 * the hook actually reads are modelled: method, URL, and the resolved response.
 */
function jalankan(pathname: string, opts?: { method?: string; status?: number }) {
  const response = new Response('', { status: opts?.status ?? 200 })
  const event = {
    request: new Request(`https://survey.statistika.id${pathname}`, {
      method: opts?.method ?? 'GET',
    }),
    url: new URL(`https://survey.statistika.id${pathname}`),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handle({ event, resolve: async () => response } as any) as Promise<Response>
}

const ASAL_UJI = 'https://dashboard.uji.local'

beforeEach(() => {
  env.DASHBOARD_ORIGIN = ASAL_UJI
})
afterEach(() => {
  delete env.DASHBOARD_ORIGIN
})

/**
 * 13 September 2026, terukur di Chrome 153 dari `dashboard.statistika.id`:
 * dua respons httpbin yang SAMA-SAMA membawa `X-Frame-Options: DENY`, yang satu
 * gagal `net::ERR_BLOCKED_BY_RESPONSE` dan yang satunya — dengan
 * `Content-Security-Policy: frame-ancestors <asal induk>` ditambahkan — dimuat.
 *
 * Itu sebabnya perbaikan ini muat di aplikasi: XFO `DENY` dipasang di tepi
 * (Cloudflare/Traefik) dan dikirim ke SEMUA subdomain statistika.id — kita tidak
 * memegangnya, dan `frame-ancestors` mengalahkannya tanpa perlu memegangnya.
 */
describe('hooks.server — frame-ancestors untuk /pratinjau', () => {
  it('mengizinkan asal dashboard membingkai /pratinjau', async () => {
    const res = await jalankan('/pratinjau?token=abc')
    expect(res.headers.get('Content-Security-Policy')).toBe(`frame-ancestors ${ASAL_UJI}`)
  })

  it('menerima /pratinjau dengan garis miring di belakang', async () => {
    const res = await jalankan('/pratinjau/')
    expect(res.headers.get('Content-Security-Policy')).toBe(`frame-ancestors ${ASAL_UJI}`)
  })

  it('membuang garis miring di belakang asal, supaya nilainya tetap sah', async () => {
    env.DASHBOARD_ORIGIN = 'https://dashboard.uji.local/'
    const res = await jalankan('/pratinjau')
    expect(res.headers.get('Content-Security-Policy')).toBe('frame-ancestors https://dashboard.uji.local')
  })

  it('tetap memasang X-Robots-Tag di /pratinjau', async () => {
    const res = await jalankan('/pratinjau')
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })

  // Pagar utamanya: kelonggaran ini HANYA untuk pratinjau. Halaman responden
  // membawa jawaban sungguhan dan harus tetap tidak bisa dibingkai siapa pun.
  it.each(['/', '/s/survei-apa-saja', '/s/survei-apa-saja/files/1'])(
    'tidak menyentuh %s',
    async (jalur) => {
      const res = await jalankan(jalur)
      expect(res.headers.get('Content-Security-Policy')).toBeNull()
    },
  )

  it('tidak memasangnya untuk metode selain GET', async () => {
    const res = await jalankan('/pratinjau', { method: 'POST' })
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
  })

  /**
   * Kalau variabelnya belum diset, pratinjau produksi TETAP hidup. Gerbang yang
   * gagal diam-diam adalah cacat yang berulang di proyek ini — bukan yang mau
   * ditambah satu lagi di sini.
   */
  it('jatuh ke asal dashboard produksi saat variabelnya kosong', async () => {
    delete env.DASHBOARD_ORIGIN
    const res = await jalankan('/pratinjau')
    expect(res.headers.get('Content-Security-Policy')).toBe(
      'frame-ancestors https://dashboard.statistika.id',
    )
  })
})

describe('hooks.server — perilaku yang sudah ada tidak berubah', () => {
  it('tetap meng-edge-cache render survei', async () => {
    const res = await jalankan('/s/survei-apa-saja')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=3600')
  })

  it('tidak meng-edge-cache /pratinjau', async () => {
    const res = await jalankan('/pratinjau')
    expect(res.headers.get('Cache-Control')).toBeNull()
  })
})
