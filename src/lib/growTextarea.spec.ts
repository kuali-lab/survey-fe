import { describe, it, expect } from 'vitest'
import { autoExpand } from './growTextarea.js'

// Vitest berjalan tanpa DOM; textarea tiruan cukup untuk height/scrollHeight/listener.
function fakeTextarea(scrollHeight: number) {
  const listeners = new Map<string, () => void>()
  const node = {
    style: { height: '' },
    scrollHeight,
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener: (type: string, fn: () => void) => {
      if (listeners.get(type) === fn) listeners.delete(type)
    },
  }
  return { node, listeners }
}

describe('autoExpand', () => {
  it('menyamakan tinggi dengan isi saat dipasang (nilai draf tidak terpotong)', () => {
    const { node } = fakeTextarea(32)
    autoExpand(node as unknown as HTMLTextAreaElement)
    expect(node.style.height).toBe('32px')
  })

  it.each([[32, 52], [52, 92], [92, 32]])('tumbuh dan menyusut mengikuti isi: %ipx → %ipx', (from, to) => {
    const { node, listeners } = fakeTextarea(from)
    autoExpand(node as unknown as HTMLTextAreaElement)
    node.scrollHeight = to
    listeners.get('input')?.()
    expect(node.style.height).toBe(`${to}px`)
  })

  it('destroy melepas listener input', () => {
    const { node, listeners } = fakeTextarea(32)
    autoExpand(node as unknown as HTMLTextAreaElement).destroy()
    expect(listeners.has('input')).toBe(false)
  })
})
