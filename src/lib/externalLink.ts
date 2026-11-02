/** Tautan teks kaya buatan pengguna: hanya http(s) mutlak yang boleh dikunjungi. */
export function parseExternalUrl(href: string | null | undefined): URL | null {
  if (!href) return null
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/**
 * Mencegat klik pada tautan di dalam `[data-rich-text]`. Tautan valid diteruskan
 * ke `onOpen`; tautan tak valid (javascript:, relatif) tetap dicegah tanpa efek.
 * Elemen lain dibiarkan: navigasi survei, tombol, dan isian tidak tersentuh.
 */
export function interceptRichLink(
  event: { target: EventTarget | null; preventDefault: () => void },
  onOpen: (url: URL) => void,
): void {
  const anchor = (event.target as Element | null)?.closest?.('[data-rich-text] a[href]')
  if (!anchor) return
  event.preventDefault()
  const url = parseExternalUrl(anchor.getAttribute('href'))
  if (url) onOpen(url)
}
