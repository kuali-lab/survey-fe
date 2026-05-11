export type GpsFix = {
  latitude: number
  longitude: number
  accuracy: number
  capturedAt: string
}

export type GpsErrorCode =
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unsupported'

export class GpsCaptureError extends Error {
  code: GpsErrorCode
  constructor(code: GpsErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'GpsCaptureError'
  }
}

export type CaptureOpts = {
  /** Hard cutoff. Default 60s — cold-start GNSS without A-GPS assistance can take this long. */
  timeoutMs?: number
  /** Resolve early once we get a fix at least this accurate (meters). Default 50m. */
  acceptableAccuracyM?: number
  /** Fired on every improved (lower-accuracy) fix while watching. */
  onProgress?: (fix: GpsFix) => void
  signal?: AbortSignal
}

// watchPosition is preferred over getCurrentPosition because cold-start GNSS
// frequently returns an early, low-quality network-based fix (accuracy
// hundreds-of-meters) followed by a refined satellite fix seconds later.
// getCurrentPosition resolves on the first fix; watchPosition lets us pick
// the best one within our budget.
export function captureGps(opts: CaptureOpts = {}): Promise<GpsFix> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const acceptableAccuracyM = opts.acceptableAccuracyM ?? 50

  return new Promise<GpsFix>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GpsCaptureError('unsupported'))
      return
    }

    let best: GpsFix | null = null
    let settled = false
    let watchId: number | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (timer) { clearTimeout(timer); timer = null }
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }
    }

    const finishOk = () => {
      if (settled || !best) return
      settled = true
      cleanup()
      resolve(best)
    }

    const finishErr = (err: GpsCaptureError) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return
        const fix: GpsFix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
        }
        if (!best || fix.accuracy < best.accuracy) {
          best = fix
          opts.onProgress?.(fix)
        }
        if (best.accuracy <= acceptableAccuracyM) finishOk()
      },
      (err) => {
        if (settled) return
        // PERMISSION_DENIED is terminal — no point waiting.
        if (err.code === err.PERMISSION_DENIED) {
          finishErr(new GpsCaptureError('permission_denied', err.message))
          return
        }
        // POSITION_UNAVAILABLE / TIMEOUT — keep watching; the chip may recover.
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )

    timer = setTimeout(() => {
      if (best) finishOk()
      else finishErr(new GpsCaptureError('timeout'))
    }, timeoutMs)

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        finishErr(new GpsCaptureError('timeout', 'aborted'))
      })
    }
  })
}
