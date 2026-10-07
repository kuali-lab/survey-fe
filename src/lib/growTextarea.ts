/**
 * Action: tinggi textarea mengikuti isinya. Dihitung saat dipasang (nilai draf
 * dari localStorage tidak terpotong), tiap input, saat lebarnya berubah (resize
 * jendela, rotasi, kolom tabel melebar), dan saat parameter (nilai) berubah dari luar.
 */
export function autoExpand(node: HTMLTextAreaElement, _value?: unknown) {
  const adjust = () => {
    node.style.height = 'auto'
    node.style.height = node.scrollHeight + 'px'
  }
  adjust()
  node.addEventListener('input', adjust)
  // Hanya perubahan lebar: perubahan tinggi berasal dari adjust() sendiri.
  let lastWidth: number | undefined
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === lastWidth) return
    lastWidth = entry.contentRect.width
    adjust()
  })
  observer?.observe(node)
  return {
    update: adjust,
    destroy() {
      node.removeEventListener('input', adjust)
      observer?.disconnect()
    }
  }
}
