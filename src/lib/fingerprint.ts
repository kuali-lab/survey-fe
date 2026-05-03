// Computes a device fingerprint using Canvas 2D pixel output and WebGL renderer metadata.
// Returns a 64-char SHA-256 hex string, or null if the browser blocks canvas/crypto.
export async function computeFingerprint(): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 40

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#f0f'
    ctx.fillRect(0, 0, 200, 40)
    ctx.fillStyle = '#069'
    ctx.font = '14px Arial, sans-serif'
    ctx.fillText('Logika Teta — fp', 4, 24)
    ctx.fillStyle = 'rgba(100, 200, 50, 0.8)'
    ctx.font = '11px Georgia, serif'
    ctx.fillText('fingerprint', 80, 36)
    const canvasData = canvas.toDataURL()

    // WebGL renderer string only — no 3D scene render needed
    let renderer = ''
    let vendor = ''
    const glCanvas = document.createElement('canvas')
    const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl') as WebGLRenderingContext | null
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? ''
        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? ''
      } else {
        renderer = gl.getParameter(gl.RENDERER) ?? ''
        vendor = gl.getParameter(gl.VENDOR) ?? ''
      }
    }

    const signals = [
      canvasData,
      renderer,
      vendor,
      navigator.language ?? '',
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
      String(navigator.hardwareConcurrency ?? ''),
    ].join('|')

    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signals))
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}
