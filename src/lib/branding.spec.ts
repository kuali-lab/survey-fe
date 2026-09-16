import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { render } from 'svelte/server'
import type { Snippet } from 'svelte'

import {
  PLATFORM_LOGO_URL,
  PLATFORM_OG_IMAGE_PATH,
  resolveLogoUrl,
  resolveFaviconUrl,
  resolveOgImageUrl,
  toAbsoluteUrl,
  shouldEmitPlatformOgTags,
  isRespondentRoute,
} from './branding.js'
import WelcomePage from './components/WelcomePage.svelte'
import ClosingPage from './components/ClosingPage.svelte'
import RootLayout from '../routes/+layout.svelte'
import { page } from './test/app-state.js'

/** Berkas sumber dibaca apa adanya: sebagian invarian M2 adalah "hanya ada SATU
 *  pemancar tag ini di seluruh dokumen", dan SvelteKit cuma menggabung isi
 *  `<svelte:head>` tanpa deduplikasi — jadi jumlah pemancar di sumber adalah
 *  jumlah tag yang benar-benar sampai ke scraper. */
function readSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** `render()` memanggil `children` dengan payload-nya sendiri; tata letak akar
 *  hanya butuh snippet yang tidak menulis apa-apa. Snippet adalah tipe buram
 *  yang hanya bisa dibuat kompilator Svelte, jadi di uji ia dicetak paksa. */
const noChildren = (() => {}) as unknown as Snippet

const welcomeProps = {
  title: 'Survei PID',
  titlePlain: 'Survei PID',
  description: null,
  imageUrl: null,
  ctaText: 'Mulai Survei',
  onStart: () => {},
}

const closingProps = {
  title: 'Terima Kasih!',
  titlePlain: 'Terima Kasih!',
  description: null,
  imageUrl: null,
}

describe('resolveLogoUrl', () => {
  it('memakai logo survei ketika logoUrl terisi', () => {
    expect(resolveLogoUrl({ logoUrl: 'https://cdn.test/logo-klien.png' }))
      .toBe('https://cdn.test/logo-klien.png')
  })

  it('jatuh ke aset platform ketika logoUrl null', () => {
    expect(resolveLogoUrl({ logoUrl: null })).toBe(PLATFORM_LOGO_URL)
  })

  it('jatuh ke aset platform ketika field-nya tidak ada sama sekali', () => {
    // Bentuk survei dari singgahan localStorage lama: kunci brandingnya belum
    // pernah ada. Ketiadaan field harus berarti aset platform, bukan kosong.
    expect(resolveLogoUrl({})).toBe(PLATFORM_LOGO_URL)
    expect(resolveLogoUrl(undefined)).toBe(PLATFORM_LOGO_URL)
    expect(resolveLogoUrl(null)).toBe(PLATFORM_LOGO_URL)
  })
})

describe('resolveFaviconUrl', () => {
  it('memakai favicon survei ketika terisi', () => {
    expect(resolveFaviconUrl({ faviconUrl: 'https://cdn.test/fav.png' }))
      .toBe('https://cdn.test/fav.png')
  })

  it('mengembalikan null ketika tidak diatur, supaya rantai ikon platform yang dipakai', () => {
    expect(resolveFaviconUrl({ faviconUrl: null })).toBeNull()
    expect(resolveFaviconUrl({})).toBeNull()
    expect(resolveFaviconUrl(undefined)).toBeNull()
  })
})

describe('toAbsoluteUrl', () => {
  it('menempelkan basis pada path relatif', () => {
    expect(toAbsoluteUrl('/og-default.png', 'https://survey.test'))
      .toBe('https://survey.test/og-default.png')
  })

  it('membuang garis miring berlebih di ujung basis', () => {
    expect(toAbsoluteUrl('/og-default.png', 'https://survey.test///'))
      .toBe('https://survey.test/og-default.png')
  })

  it('membiarkan URL yang sudah absolut apa adanya', () => {
    expect(toAbsoluteUrl('https://cdn.test/a.png', 'https://survey.test'))
      .toBe('https://cdn.test/a.png')
    expect(toAbsoluteUrl('//cdn.test/a.png', 'https://survey.test'))
      .toBe('//cdn.test/a.png')
  })
})

describe('resolveOgImageUrl', () => {
  const base = 'https://survey.test'

  it('memakai ogImageUrl survei ketika terisi', () => {
    const url = resolveOgImageUrl({
      settings: { ogImageUrl: 'https://cdn.test/og-klien.png' },
      welcomeImageUrl: 'https://cdn.test/sampul.png',
      base,
    })
    expect(url).toBe('https://cdn.test/og-klien.png')
  })

  it('jatuh ke gambar sampul welcome ketika ogImageUrl kosong', () => {
    const url = resolveOgImageUrl({
      settings: { ogImageUrl: null },
      welcomeImageUrl: 'https://cdn.test/sampul.png',
      base,
    })
    expect(url).toBe('https://cdn.test/sampul.png')
  })

  it('jatuh ke og-default.png ketika keduanya kosong', () => {
    const url = resolveOgImageUrl({ settings: {}, welcomeImageUrl: null, base })
    expect(url).toBe(`${base}${PLATFORM_OG_IMAGE_PATH}`)
  })

  it('selalu menghasilkan URL absolut, termasuk untuk sampul welcome yang relatif', () => {
    // Crawler tidak mengurai path relatif; hasilnya wajib absolut apa pun sumbernya.
    const fromCover = resolveOgImageUrl({
      settings: {}, welcomeImageUrl: '/media/sampul.png', base,
    })
    const fromDefault = resolveOgImageUrl({ settings: {}, welcomeImageUrl: null, base })
    for (const url of [fromCover, fromDefault]) {
      expect(url.startsWith('https://')).toBe(true)
    }
    expect(fromCover).toBe('https://survey.test/media/sampul.png')
  })
})

describe('WelcomePage — logo per survei (P1)', () => {
  it('memakai logo survei ketika logoUrl terisi', () => {
    const { body } = render(WelcomePage, {
      props: { ...welcomeProps, logoUrl: 'https://cdn.test/logo-klien.png' },
    })
    expect(body).toContain('https://cdn.test/logo-klien.png')
    expect(body).not.toContain(PLATFORM_LOGO_URL)
  })

  it('jatuh ke logo platform ketika logoUrl tidak diberikan', () => {
    const { body } = render(WelcomePage, { props: welcomeProps })
    expect(body).toContain(PLATFORM_LOGO_URL)
  })
})

describe('ClosingPage — logo per survei (P2)', () => {
  it('memakai logo survei ketika logoUrl terisi', () => {
    const { body } = render(ClosingPage, {
      props: { ...closingProps, logoUrl: 'https://cdn.test/logo-klien.png' },
    })
    expect(body).toContain('https://cdn.test/logo-klien.png')
    expect(body).not.toContain(PLATFORM_LOGO_URL)
  })

  it('jatuh ke logo platform ketika logoUrl tidak diberikan', () => {
    const { body } = render(ClosingPage, { props: closingProps })
    expect(body).toContain(PLATFORM_LOGO_URL)
  })
})

describe('shouldEmitPlatformOgTags', () => {
  it('menahan tag bawaan pada rute survei, yang memancarkannya sendiri', () => {
    expect(shouldEmitPlatformOgTags('/s/[slug]')).toBe(false)
  })

  it('memancarkan tag bawaan pada rute lain', () => {
    expect(shouldEmitPlatformOgTags('/')).toBe(true)
    expect(shouldEmitPlatformOgTags('/surveyor')).toBe(true)
    expect(shouldEmitPlatformOgTags(null)).toBe(true)
  })
})

describe('tata letak akar — satu sumber tag OG', () => {
  beforeEach(() => {
    page.route.id = null
    page.data = {}
  })

  it('memancarkan tepat satu og:image, twitter:image, dan twitter:card di rute non-survei', () => {
    page.route.id = '/'
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(countOccurrences(head, 'property="og:image"')).toBe(1)
    expect(countOccurrences(head, 'name="twitter:image"')).toBe(1)
    expect(countOccurrences(head, 'name="twitter:card"')).toBe(1)
  })

  it('memakai og-default.png sebagai gambar bawaan platform, bukan logo 229x35', () => {
    page.route.id = '/'
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(head).toContain(PLATFORM_OG_IMAGE_PATH)
    expect(head).not.toContain('logo-logika-teta.png')
  })

  it('tidak memancarkan satu pun tag gambar di rute survei', () => {
    // Rute survei punya gambarnya sendiri. Kalau tata letak ikut memancarkan,
    // scraper yang berbeda mengambil kemunculan yang berbeda (H-32 cacat 2).
    page.route.id = '/s/[slug]'
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(countOccurrences(head, 'og:image')).toBe(0)
    expect(countOccurrences(head, 'twitter:image')).toBe(0)
    expect(countOccurrences(head, 'twitter:card')).toBe(0)
  })
})

describe('tata letak akar — favicon per survei (P3)', () => {
  beforeEach(() => {
    page.route.id = null
    page.data = {}
  })

  it('memancarkan tepat satu rel="icon" milik survei ketika faviconUrl terisi', () => {
    page.route.id = '/s/[slug]'
    page.data = { survey: { settings: { faviconUrl: 'https://cdn.test/fav.png' } } }
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(countOccurrences(head, 'rel="icon"')).toBe(1)
    expect(head).toContain('https://cdn.test/fav.png')
    expect(head).not.toContain('/icons/favicon.svg')
  })

  it('memancarkan rantai ikon platform ketika survei tidak punya favicon', () => {
    page.route.id = '/s/[slug]'
    page.data = { survey: { settings: {} } }
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(head).toContain('/icons/favicon.svg')
    expect(head).toContain('/icons/favicon-96x96.png')
    expect(head).toContain('/icons/favicon.ico')
    expect(head).toContain('/icons/apple-touch-icon.png')
  })

  it('memancarkan rantai ikon platform di rute non-survei', () => {
    page.route.id = '/'
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(head).toContain('/icons/favicon.svg')
  })

  it('memakai favicon survei di pratinjau, yang mencerminkan tampilan responden', () => {
    page.route.id = '/pratinjau'
    page.data = { survey: { settings: { faviconUrl: 'https://cdn.test/fav.png' } } }
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(countOccurrences(head, 'rel="icon"')).toBe(1)
    expect(head).toContain('https://cdn.test/fav.png')
  })

  it('tidak memakai favicon survei di cangkang surveyor, yang tetap merek platform', () => {
    // Kelima rute surveyor ikut memuat objek survei ke `page.data`, jadi tanpa
    // penjaga rute favicon pelanggan akan menempel di perkakas petugas —
    // permukaan yang sengaja tetap merek platform (§2.1).
    page.route.id = '/surveyor/s/[slug]/interview'
    page.data = { survey: { settings: { faviconUrl: 'https://cdn.test/fav.png' } } }
    const { head } = render(RootLayout, { props: { children: noChildren } })
    expect(head).not.toContain('https://cdn.test/fav.png')
    expect(head).toContain('/icons/favicon.svg')
  })
})

describe('isRespondentRoute', () => {
  it('mengenali rute render survei dan pratinjaunya', () => {
    expect(isRespondentRoute('/s/[slug]')).toBe(true)
    expect(isRespondentRoute('/pratinjau')).toBe(true)
  })

  it('menolak cangkang surveyor, penampil berkas, dan rute non-survei', () => {
    expect(isRespondentRoute('/surveyor/s/[slug]/interview')).toBe(false)
    expect(isRespondentRoute('/s/[slug]/files/[fileId]')).toBe(false)
    expect(isRespondentRoute('/')).toBe(false)
    expect(isRespondentRoute(null)).toBe(false)
  })
})

describe('invarian sumber — nol pemancar kembar', () => {
  it('app.html tidak lagi mendeklarasikan ikon sendiri', () => {
    // Opsi B (§4.4): satu tempat deklarasi. Selama app.html masih memancarkan
    // rantai ikonnya, ikon per-survei hanya BERDAMPINGAN dengannya — dan
    // peramban tidak menjamin yang belakangan menang (Spike S-1).
    const appHtml = readSource('../app.html')
    expect(countOccurrences(appHtml, 'rel="icon"')).toBe(0)
    expect(countOccurrences(appHtml, 'rel="apple-touch-icon"')).toBe(0)
  })

  it('app.html tidak lagi menetapkan twitter:card sendiri', () => {
    // app.html:30 dulu menetapkan `summary` tanpa syarat, beradu dengan tag
    // bersyarat milik halaman survei (H-32 cacat 3).
    // Dicocokkan dalam bentuk beratribut: yang dilarang adalah TAG kedua,
    // bukan komentar yang menyebut namanya.
    const appHtml = readSource('../app.html')
    expect(countOccurrences(appHtml, 'name="twitter:card"')).toBe(0)
    expect(countOccurrences(appHtml, 'property="og:image"')).toBe(0)
    expect(countOccurrences(appHtml, 'name="twitter:image"')).toBe(0)
  })

  it('halaman survei memancarkan tepat satu dari tiap tag gambar', () => {
    const pageSource = readSource('../routes/s/[slug]/+page.svelte')
    expect(countOccurrences(pageSource, 'property="og:image"')).toBe(1)
    expect(countOccurrences(pageSource, 'name="twitter:image"')).toBe(1)
    expect(countOccurrences(pageSource, 'name="twitter:card"')).toBe(1)
  })
})
