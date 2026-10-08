import { describe, it, expect, vi, afterEach } from 'vitest'
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

describe('autoExpand: lebar dan nilai dari luar', () => {
  afterEach(() => vi.unstubAllGlobals())

  // ResizeObserver tiruan: menyimpan callback dan target supaya uji bisa memicu perubahan lebar.
  function stubResizeObserver() {
    const state = { callback: null as ResizeObserverCallback | null, observed: [] as unknown[], disconnected: false }
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { state.callback = cb }
      observe(node: unknown) { state.observed.push(node) }
      disconnect() { state.disconnected = true }
    })
    const resize = (width: number) =>
      state.callback?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
    return { state, resize }
  }

  it('lebar kolom berubah (resize/rotasi): tinggi dihitung ulang', () => {
    const { state, resize } = stubResizeObserver()
    const { node } = fakeTextarea(32)
    autoExpand(node as unknown as HTMLTextAreaElement)
    expect(state.observed).toEqual([node])
    resize(300)
    node.scrollHeight = 72
    resize(180)
    expect(node.style.height).toBe('72px')
  })

  it('perubahan tinggi saja (akibat penyesuaian sendiri) tidak memicu hitung ulang', () => {
    const { resize } = stubResizeObserver()
    const { node } = fakeTextarea(32)
    autoExpand(node as unknown as HTMLTextAreaElement)
    resize(300)
    node.style.height = '99px'
    resize(300)
    expect(node.style.height).toBe('99px')
  })

  it('destroy memutus ResizeObserver', () => {
    const { state } = stubResizeObserver()
    const { node } = fakeTextarea(32)
    autoExpand(node as unknown as HTMLTextAreaElement).destroy()
    expect(state.disconnected).toBe(true)
  })

  it('nilai berubah dari luar (parameter action): tinggi dihitung ulang', () => {
    const { node } = fakeTextarea(32)
    const action = autoExpand(node as unknown as HTMLTextAreaElement, 'a')
    node.scrollHeight = 52
    // Svelte memanggil update(nilaiBaru); nilainya sendiri tak dipakai, cukup pemicunya.
    action.update?.()
    expect(node.style.height).toBe('52px')
  })
})
