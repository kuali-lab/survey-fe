/**
 * Posisi menu SearchableDropdown mode `floating` (sel tabel): position fixed dari rect
 * pemicu, supaya tidak terpotong wadah gulir `.grid-wrap`. Murni, diuji di Node.
 */

/** Kotak pencarian + footer + batas menu (±78px terukur, dibulatkan). */
export const MENU_CHROME_PX = 90
/** Sama dengan max-height `.options-container` bawaan. */
export const MENU_LIST_MAX_PX = 240
/** Sel grid bisa 70px; menu selebar itu tak terbaca. */
export const MENU_MIN_WIDTH_PX = 280
const GAP = 4
const EDGE = 8

export type TriggerRect = { top: number; bottom: number; left: number; width: number }
/** top/bottom: tepi viewport visual (keyboard ponsel); height: tinggi viewport tata letak (clientHeight, acuan `bottom` CSS). */
export type MenuViewport = { top: number; bottom: number; width: number; height: number }
export type MenuPosition = { top: number | null; bottom: number | null; left: number; width: number; maxHeight: number; listMax: number }

/**
 * Di bawah pemicu bila muat atau lebih lega dari atas, selain itu di atas. Null hanya bila pemicu
 * keluar viewport tata letak; pemicu yang tertutup keyboard (di luar viewport visual) tetap
 * dilayani dengan menambat menu ke tepi viewport visual.
 */
export function floatingMenuPosition(trigger: TriggerRect, vp: MenuViewport): MenuPosition | null {
  if (trigger.bottom < 0 || trigger.top > vp.height) return null
  const anchorBottom = Math.max(trigger.bottom, vp.top)
  const anchorTop = Math.min(trigger.top, vp.bottom)
  const below = vp.bottom - anchorBottom - GAP - EDGE
  const above = anchorTop - vp.top - GAP - EDGE
  const placeBelow = below >= MENU_CHROME_PX + MENU_LIST_MAX_PX || below >= above
  const maxHeight = Math.max(Math.min(placeBelow ? below : above, vp.bottom - vp.top - 2 * EDGE), 0)
  const width = Math.min(Math.max(trigger.width, MENU_MIN_WIDTH_PX), vp.width - 2 * EDGE)
  return {
    top: placeBelow ? Math.max(trigger.bottom + GAP, vp.top + EDGE) : null,
    bottom: placeBelow ? null : Math.max(vp.height - trigger.top + GAP, vp.height - vp.bottom + EDGE),
    left: Math.min(Math.max(trigger.left, EDGE), vp.width - EDGE - width),
    width,
    maxHeight,
    listMax: Math.max(40, Math.min(MENU_LIST_MAX_PX, maxHeight - MENU_CHROME_PX)),
  }
}

export function floatingMenuStyle(p: MenuPosition): string {
  const px = (v: number | null) => (v === null ? 'auto' : `${v}px`)
  return `position:fixed;top:${px(p.top)};bottom:${px(p.bottom)};left:${p.left}px;right:auto;width:${p.width}px;max-height:${p.maxHeight}px;overflow-y:auto;--dd-list-max:${p.listMax}px`
}
