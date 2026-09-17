/**
 * Branding per survei yang dilihat responden (M2): logo, favicon, dan gambar
 * pratinjau tautan.
 *
 * Satu tempat untuk seluruh aturan "pakai aset survei atau jatuh ke aset
 * platform", karena aturannya dipakai dari empat titik render yang berbeda
 * (halaman pembuka, halaman penutup, pratinjau draf, dan tag meta halaman
 * survei). Menyebarnya sebagai `?? '/logo-...'` di tiap titik berarti satu
 * survei bisa berganti merek di tengah alurnya.
 *
 * 🔴 Ketiadaan field BERARTI aset platform, bukan kosong. `fetchSurvey`
 * menyinggahkan objek survei ke localStorage, jadi salinan lama tidak punya
 * kunci branding sama sekali — dan responden yang membawa salinan itu harus
 * melihat persis apa yang dilihatnya sebelum M2 ada.
 */
import type { SurveySettings } from './types.js'

/** Logo platform yang dipakai sebelum M2, dan yang tetap dipakai bila survei
 *  tidak memasang logonya sendiri. */
export const PLATFORM_LOGO_URL = '/logo-logika-teta.svg'

/**
 * Gambar pratinjau tautan bawaan platform, 1200×630.
 *
 * Bawaan sebelumnya adalah `/logo-logika-teta.png` yang berukuran 229×35 —
 * di bawah ambang 200×200 yang dipakai WhatsApp/Facebook, sehingga tautan yang
 * dibagikan tidak memunculkan gambar sama sekali.
 */
export const PLATFORM_OG_IMAGE_PATH = '/og-default.png'

/** Rute render survei. Rute inilah satu-satunya yang memancarkan tag gambar
 *  sosialnya sendiri (lihat `shouldEmitPlatformOgTags`). */
export const SURVEY_ROUTE_ID = '/s/[slug]'

/** Pratinjau draf, yang merender komponen responden yang sama persis. */
export const PREVIEW_ROUTE_ID = '/pratinjau'

/**
 * Bagian branding dari pengaturan survei yang masih dibaca sebagai objek.
 *
 * `logoUrl` tidak termasuk: rute sudah membongkarnya jadi string sebelum
 * mengopernya sebagai prop komponen, jadi `resolveLogoUrl` menerima nilainya
 * langsung alih-alih dirakit ulang cuma untuk dibongkar lagi.
 */
export type BrandingSettings =
  | Partial<Pick<SurveySettings, 'faviconUrl' | 'ogImageUrl'>>
  | null
  | undefined

/** Logo yang dirender di halaman pembuka & penutup. */
export function resolveLogoUrl(logoUrl?: string | null): string {
  return logoUrl || PLATFORM_LOGO_URL
}

/**
 * Apakah logo yang tampil milik survei, bukan milik platform.
 *
 * Ada supaya teks `alt` diturunkan dari aturan yang SAMA dengan `src`.
 * Kalau `alt` memeriksa sendiri prop mentahnya, keduanya akan menyimpang
 * begitu aturan logo tumbuh satu baris saja — dan penyimpangan itu tidak
 * membuat satu uji pun merah.
 */
export function isCustomLogo(logoUrl?: string | null): boolean {
  return resolveLogoUrl(logoUrl) !== PLATFORM_LOGO_URL
}

/**
 * Favicon per survei, atau `null` bila survei tidak punya.
 *
 * `null` sengaja berarti "jangan pancarkan apa pun": rantai ikon platform di
 * `+layout.svelte` sudah menangani kasus itu, dan memancarkan ikon kosong
 * justru menambah deklarasi yang harus diperebutkan peramban.
 */
export function resolveFaviconUrl(settings?: BrandingSettings): string | null {
  return settings?.faviconUrl || null
}

/**
 * Menjadikan URL absolut terhadap `base`.
 *
 * Crawler tidak mengurai path relatif — tag `og:image` berisi `/x.png` sama
 * saja dengan tidak ada gambar. URL yang sudah absolut (termasuk yang
 * berawalan `//`) dibiarkan apa adanya: itu URL CDN media, bukan aset lokal.
 */
export function toAbsoluteUrl(url: string, base: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return url
  const trimmedBase = base.replace(/\/+$/, '')
  return `${trimmedBase}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * Gambar pratinjau tautan untuk satu survei, selalu absolut.
 *
 * Urutannya: gambar OG survei → gambar sampul halaman pembuka (perilaku yang
 * sudah ada) → aset bawaan platform.
 */
export function resolveOgImageUrl(input: {
  settings?: BrandingSettings
  welcomeImageUrl?: string | null
  base: string
}): string {
  const chosen = input.settings?.ogImageUrl || input.welcomeImageUrl || PLATFORM_OG_IMAGE_PATH
  return toAbsoluteUrl(chosen, input.base)
}

/**
 * Apakah tata letak akar boleh memancarkan tag gambar sosial bawaan platform.
 *
 * 🔴 SvelteKit hanya MENGGABUNG isi `<svelte:head>`; tidak ada deduplikasi.
 * Jadi tata letak dan halaman yang sama-sama memancarkan `og:image`
 * menghasilkan dua tag, dan scraper yang berbeda mengambil yang berbeda.
 * Rute survei memancarkan gambarnya sendiri, jadi di sanalah tata letak diam.
 */
export function shouldEmitPlatformOgTags(routeId: string | null | undefined): boolean {
  return routeId !== SURVEY_ROUTE_ID
}

/**
 * Apakah rute ini benar-benar merender survei untuk responden.
 *
 * 🔴 Penjaga ini perlu karena KELIMA rute surveyor ikut memuat objek survei ke
 * `page.data`. Tanpa penjaga, favicon pelanggan menempel di cangkang surveyor
 * dan penampil berkas — permukaan yang sengaja tetap merek platform: cangkang
 * surveyor adalah perkakas petugas, bukan render survei.
 */
export function isRespondentRoute(routeId: string | null | undefined): boolean {
  return routeId === SURVEY_ROUTE_ID || routeId === PREVIEW_ROUTE_ID
}
