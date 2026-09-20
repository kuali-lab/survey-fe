import { describe, it, expect } from 'vitest'
import { readLinkCodeFromUrl, stripLinkCodeFromUrl, resolveResumeLinkCode } from './linkCode.js'

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

describe('stripLinkCodeFromUrl', () => {
  it('removes only c, keeping other params and the hash', () => {
    const input = new URL('https://s.test/s/pid?t=tok&c=k7&x=1#frag')
    const out = stripLinkCodeFromUrl(input)
    expect(out.searchParams.has('c')).toBe(false)
    expect(out.searchParams.get('t')).toBe('tok')
    expect(out.searchParams.get('x')).toBe('1')
    expect(out.hash).toBe('#frag')
    expect(out.pathname).toBe('/s/pid')
  })

  it('removes every repeated c', () => {
    const out = stripLinkCodeFromUrl(new URL('https://s.test/s/pid?c=a&c=b'))
    expect(out.searchParams.getAll('c')).toEqual([])
    expect(out.search).toBe('')
  })

  it('does not mutate its input', () => {
    const input = new URL('https://s.test/s/pid?c=k7')
    const out = stripLinkCodeFromUrl(input)
    expect(out).not.toBe(input)
    expect(input.searchParams.get('c')).toBe('k7')
  })

  it('is a no-op without c', () => {
    const out = stripLinkCodeFromUrl(new URL('https://s.test/s/pid?t=tok'))
    expect(out.href).toBe('https://s.test/s/pid?t=tok')
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
