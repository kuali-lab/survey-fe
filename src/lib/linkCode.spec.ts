import { describe, it, expect } from 'vitest'
import {
  readLinkCodeFromUrl, resolveResumeLinkCode, requiresLinkGate,
  rememberLinkCode, recallLinkCode, forgetLinkCode, LINK_CODE_SESSION_TTL_MS, type SessionStoreLike,
} from './linkCode.js'

describe('readLinkCodeFromUrl', () => {
  it('reads ?c=', () => {
    expect(readLinkCodeFromUrl(new URL('https://s.test/s/pid?c=k7'))).toBe('k7')
  })

  it('trims surrounding whitespace', () => {
    expect(readLinkCodeFromUrl(new URL('https://s.test/s/pid?c=%20k7%20'))).toBe('k7')
  })

  it('returns null for an empty value', () => {
    expect(readLinkCodeFromUrl(new URL('https://s.test/s/pid?c='))).toBeNull()
  })

  it('returns null for whitespace only', () => {
    expect(readLinkCodeFromUrl(new URL('https://s.test/s/pid?c=%20%20'))).toBeNull()
  })

  it('returns null when absent', () => {
    expect(readLinkCodeFromUrl(new URL('https://s.test/s/pid'))).toBeNull()
    expect(readLinkCodeFromUrl(new URL('https://s.test/s/pid?t=tok'))).toBeNull()
  })

  it('takes the first value when repeated', () => {
    expect(readLinkCodeFromUrl(new URL('https://s.test/s/pid?c=a&c=b'))).toBe('a')
  })
})

describe('resolveResumeLinkCode', () => {
  it.each([
    ['x', 'y', 'x'],
    [null, 'y', 'y'],
    [null, undefined, null],
    [null, '', null],
    ['x', undefined, 'x'],
    ['x', null, 'x'],
  ] as const)('(%s, %s) → %s', (current, fromDraft, expected) => {
    expect(resolveResumeLinkCode(current, fromDraft)).toBe(expected)
  })
})

describe('requiresLinkGate', () => {
  it('blocks when required and no linkCode is known from any source', () => {
    expect(requiresLinkGate(true, null)).toBe(true)
  })

  it('does not block when required but a linkCode is already known (URL or draft)', () => {
    expect(requiresLinkGate(true, 'k7')).toBe(false)
  })

  it('does not block when not required, regardless of linkCode', () => {
    expect(requiresLinkGate(false, null)).toBe(false)
    expect(requiresLinkGate(undefined, null)).toBe(false)
  })

  it('treats an absent requireLinkCode (old payload) as false', () => {
    expect(requiresLinkGate(undefined, null)).toBe(false)
  })
})

describe('ingatan sesi tab (rememberLinkCode, recallLinkCode, forgetLinkCode)', () => {
  const memory = (): SessionStoreLike & { data: Map<string, string> } => {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    }
  }
  const T0 = 1_700_000_000_000

  it('mengingat kode untuk muat ulang di tab yang sama', () => {
    const s = memory()
    rememberLinkCode(s, 'pid', 'batanghari-batanghari', T0)
    expect(recallLinkCode(s, 'pid', T0 + 5 * 60 * 1000)).toBe('batanghari-batanghari')
  })

  it('kedaluwarsa sesudah TTL dan catatannya dibuang', () => {
    const s = memory()
    rememberLinkCode(s, 'pid', 'k7', T0)
    expect(recallLinkCode(s, 'pid', T0 + LINK_CODE_SESSION_TTL_MS)).toBe('k7')
    expect(recallLinkCode(s, 'pid', T0 + LINK_CODE_SESSION_TTL_MS + 1)).toBeNull()
    expect(s.data.size).toBe(0)
  })

  it('terpisah per slug: survei lain tidak mewarisi kode', () => {
    const s = memory()
    rememberLinkCode(s, 'survei-a', 'k7', T0)
    expect(recallLinkCode(s, 'survei-b', T0)).toBeNull()
  })

  it('kode baru menimpa yang lama (QR yang baru dipindai menang)', () => {
    const s = memory()
    rememberLinkCode(s, 'pid', 'lama', T0)
    rememberLinkCode(s, 'pid', 'baru', T0 + 1000)
    expect(recallLinkCode(s, 'pid', T0 + 2000)).toBe('baru')
  })

  it('forgetLinkCode melupakan kode (sesudah kirim sukses atau kode tak sah)', () => {
    const s = memory()
    rememberLinkCode(s, 'pid', 'k7', T0)
    forgetLinkCode(s, 'pid')
    expect(recallLinkCode(s, 'pid', T0)).toBeNull()
  })

  it('catatan rusak atau berbentuk lain dianggap tidak ada dan dibuang', () => {
    const s = memory()
    for (const raw of ['bukan json', '{}', '{"c":"","t":1}', '{"c":7,"t":1}', `{"c":"k7","t":"x"}`, 'null']) {
      s.data.set('survey-fe:link:pid', raw)
      expect(recallLinkCode(s, 'pid', T0)).toBeNull()
    }
  })

  it('jam perangkat jauh di depan waktu tersimpan ditolak (catatan tak masuk akal)', () => {
    const s = memory()
    rememberLinkCode(s, 'pid', 'k7', T0 + 10 * 60 * 1000)
    expect(recallLinkCode(s, 'pid', T0)).toBeNull()
  })

  it('tanpa penyimpanan, atau penyimpanan yang melempar galat, tidak merusak apa pun', () => {
    expect(() => rememberLinkCode(null, 'pid', 'k7', T0)).not.toThrow()
    expect(recallLinkCode(null, 'pid', T0)).toBeNull()
    expect(() => forgetLinkCode(null, 'pid')).not.toThrow()
    const rusak: SessionStoreLike = {
      getItem: () => { throw new Error('diblokir') },
      setItem: () => { throw new Error('penuh') },
      removeItem: () => { throw new Error('diblokir') },
    }
    expect(() => rememberLinkCode(rusak, 'pid', 'k7', T0)).not.toThrow()
    expect(recallLinkCode(rusak, 'pid', T0)).toBeNull()
    expect(() => forgetLinkCode(rusak, 'pid')).not.toThrow()
  })

  it('kode atau slug kosong tidak disimpan', () => {
    const s = memory()
    rememberLinkCode(s, 'pid', '', T0)
    rememberLinkCode(s, '', 'k7', T0)
    expect(s.data.size).toBe(0)
  })
})
