import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { render } from 'svelte/server'
import { parseExternalUrl, interceptRichLink } from './externalLink.js'
import ExternalLinkDialog from './components/ExternalLinkDialog.svelte'
import { t } from './i18n/messages.js'

describe('parseExternalUrl', () => {
  it('menerima http dan https dengan href lengkap', () => {
    expect(parseExternalUrl('https://contoh.id/a/b?x=1#h')?.href).toBe('https://contoh.id/a/b?x=1#h')
    expect(parseExternalUrl('http://contoh.id')?.protocol).toBe('http:')
  })

  it.each(['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.id', '/relatif', 'contoh.id', '', null, undefined])(
    'menolak %s',
    (href) => {
      expect(parseExternalUrl(href)).toBeNull()
    },
  )
})

// Tanpa DOM di vitest (environment node): target dan anchor ditiru seperlunya.
function fakeClick(href: string | null, insideRichText = true) {
  const anchor = { getAttribute: () => href }
  const target = {
    closest: (sel: string) => (insideRichText && sel === '[data-rich-text] a[href]' ? anchor : null),
  }
  return { target: target as unknown as EventTarget, preventDefault: vi.fn() }
}

describe('interceptRichLink', () => {
  it('tautan di [data-rich-text]: dicegah dan URL lengkap diteruskan', () => {
    const ev = fakeClick('https://contoh.id/panjang/sekali?q=1')
    const open = vi.fn()
    interceptRichLink(ev, open)
    expect(ev.preventDefault).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledOnce()
    expect(open.mock.calls[0][0].href).toBe('https://contoh.id/panjang/sekali?q=1')
  })

  it('tautan di luar [data-rich-text]: tidak dicegat', () => {
    const ev = fakeClick('https://contoh.id', false)
    const open = vi.fn()
    interceptRichLink(ev, open)
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('javascript: dicegah tanpa membuka apa pun', () => {
    const ev = fakeClick('javascript:alert(1)')
    const open = vi.fn()
    interceptRichLink(ev, open)
    expect(ev.preventDefault).toHaveBeenCalledOnce()
    expect(open).not.toHaveBeenCalled()
  })

  it('target bukan elemen (null / tanpa closest) diabaikan', () => {
    const open = vi.fn()
    interceptRichLink({ target: null, preventDefault: vi.fn() }, open)
    interceptRichLink({ target: {} as EventTarget, preventDefault: vi.fn() }, open)
    expect(open).not.toHaveBeenCalled()
  })
})

// <dialog>.showModal tidak ada di environment node; perilaku Kunjungi/Batal dijaga dari sumber.
const src = readFileSync(fileURLToPath(new URL('./components/ExternalLinkDialog.svelte', import.meta.url)), 'utf8')

describe('ExternalLinkDialog', () => {
  it('dirender SSR tanpa isi sebelum ada tautan', () => {
    const { body } = render(ExternalLinkDialog)
    expect(body).toContain('<dialog')
    expect(body).not.toContain('external-link-visit')
  })

  it('Kunjungi membuka tab baru tanpa opener lalu menutup; Batal dan latar hanya menutup', () => {
    expect(src).toContain("window.open(url.href, '_blank', 'noopener,noreferrer')")
    expect(src).toContain('dialog.showModal()')
    expect(src).toContain('onclick={() => dialog.close()}')
    expect(src).toContain('e.target === dialog')
  })

  it('mencegat klik dan klik tengah di dokumen', () => {
    expect(src).toContain('<svelte:document onclick={onLinkClick} onauxclick={onLinkClick} />')
  })

  it('teks lewat i18n untuk semua bahasa', () => {
    for (const lang of ['id', 'en']) {
      for (const key of ['extLinkTitle', 'extLinkBody', 'extLinkCancel', 'extLinkVisit'] as const) {
        expect(t(lang, key)).not.toBe('')
      }
    }
    expect(t('id', 'extLinkVisit')).toBe('Kunjungi')
  })
})
