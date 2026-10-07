/**
 * Action: keep a textarea sized to its content. Adjusts on mount (so restored
 * values from localStorage don't clip) and on every input.
 */
export function autoExpand(node: HTMLTextAreaElement) {
  const adjust = () => {
    node.style.height = 'auto'
    node.style.height = node.scrollHeight + 'px'
  }
  adjust()
  node.addEventListener('input', adjust)
  return {
    destroy() { node.removeEventListener('input', adjust) }
  }
}
