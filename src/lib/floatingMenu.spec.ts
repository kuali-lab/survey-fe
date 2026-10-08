import { describe, it, expect } from 'vitest'
import { MENU_CHROME_PX, MENU_LIST_MAX_PX, MENU_MIN_WIDTH_PX, floatingMenuPosition, floatingMenuStyle } from './floatingMenu.js'

const vp = { top: 0, bottom: 800, width: 1280, height: 800 }
const trigger = (top: number, left = 100, width = 96, height = 32) => ({ top, bottom: top + height, left, width })

describe('floatingMenuPosition', () => {
  it('ruang bawah cukup: menu di bawah pemicu, daftar 240px penuh', () => {
    const p = floatingMenuPosition(trigger(100), vp)
    expect(p).toMatchObject({ top: 136, bottom: null, listMax: MENU_LIST_MAX_PX })
  })

  it('ruang bawah kurang dan atas lebih lega: dibalik ke atas, ditambat ke tepi atas pemicu', () => {
    const p = floatingMenuPosition(trigger(700), vp)
    expect(p).toMatchObject({ top: null, bottom: 800 - 700 + 4 })
    expect(p!.maxHeight).toBe(700 - 4 - 8)
  })

  it('kedua ruang sempit: pilih yang lebih lega, menu dan daftar tak melebihi viewport', () => {
    const small = { top: 0, bottom: 300, width: 375, height: 300 }
    const p = floatingMenuPosition(trigger(120, 16, 343, 44), small)!
    const below = 300 - 164 - 4 - 8
    expect(p.top).toBe(168)
    expect(p.maxHeight).toBe(below)
    expect(p.listMax).toBe(Math.max(40, below - MENU_CHROME_PX))
  })

  it('lebar minimal 280px untuk sel sempit, digeser masuk viewport di tepi kanan', () => {
    const p = floatingMenuPosition(trigger(100, 1200, 70), vp)!
    expect(p.width).toBe(MENU_MIN_WIDTH_PX)
    expect(p.left).toBe(1280 - 8 - MENU_MIN_WIDTH_PX)
  })

  it('pemicu lebih lebar dari minimum: selebar pemicu; ponsel 375px: tak melebihi viewport', () => {
    expect(floatingMenuPosition(trigger(100, 16, 343), vp)!.width).toBe(343)
    const phone = floatingMenuPosition(trigger(100, 4, 400), { top: 0, bottom: 700, width: 375, height: 700 })!
    expect(phone.width).toBe(375 - 16)
    expect(phone.left).toBe(8)
  })

  it('pemicu keluar viewport (tergulir habis) → null, menu ditutup', () => {
    expect(floatingMenuPosition(trigger(-100), vp)).toBeNull()
    expect(floatingMenuPosition(trigger(900), vp)).toBeNull()
  })

  it('keyboard ponsel menutupi pemicu (di bawah viewport visual): menu tetap terbuka, ditambat di dalam 0..480', () => {
    const vv = { top: 0, bottom: 480, width: 375, height: 800 }
    const p = floatingMenuPosition(trigger(600, 16, 343, 44), vv)!
    expect(p).not.toBeNull()
    expect(p.top).toBeNull()
    const menuBottom = vv.height - p.bottom!
    expect(menuBottom).toBeLessThanOrEqual(480 - 8)
    expect(menuBottom - p.maxHeight).toBeGreaterThanOrEqual(0 + 8)
  })

  it('pemicu di atas viewport visual yang tergeser ke bawah: menu ditambat di bawah tepi atas visual', () => {
    const p = floatingMenuPosition(trigger(100), { top: 300, bottom: 700, width: 375, height: 800 })!
    expect(p.top).toBe(300 + 8)
    expect(p.top! + p.maxHeight).toBeLessThanOrEqual(700 - 8)
  })

  it('pemicu keluar viewport tata letak tetap null walau viewport visual lebih kecil', () => {
    expect(floatingMenuPosition(trigger(820), { top: 0, bottom: 480, width: 375, height: 800 })).toBeNull()
  })

  it('viewport visual tergeser (keyboard ponsel): ruang dihitung dari tepi viewport visual', () => {
    const p = floatingMenuPosition(trigger(500), { top: 300, bottom: 700, width: 375, height: 1000 })!
    expect(p.top).toBeNull()
    expect(p.maxHeight).toBe(500 - 300 - 4 - 8)
  })
})

describe('floatingMenuStyle', () => {
  it('fixed, sisi yang tak dipakai dikosongkan, batas tinggi daftar lewat variabel CSS', () => {
    expect(floatingMenuStyle({ top: 136, bottom: null, left: 100, width: 280, maxHeight: 652, listMax: 240 })).toBe(
      'position:fixed;top:136px;bottom:auto;left:100px;right:auto;width:280px;max-height:652px;overflow-y:auto;--dd-list-max:240px',
    )
    expect(floatingMenuStyle({ top: null, bottom: 104, left: 8, width: 359, maxHeight: 200, listMax: 110 })).toContain('top:auto;bottom:104px')
  })
})
