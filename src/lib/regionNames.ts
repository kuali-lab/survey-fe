/**
 * Tiny in-memory cache of BPS region code → display name.
 *
 * The region ("Wilayah") answer is stored as a bare code (e.g. "18.09"); the
 * chosen name lives only inside RegionInput's UI state. Filtered dropdowns need
 * that name for their empty-state message ("Tidak ada pilihan SLB di Kabupaten
 * Pesawaran…"), so RegionInput records every option it loads/picks here and
 * consumers resolve a code back to a name — falling back to one fetch of the
 * parent's children when the code was restored from a draft and never listed.
 */

import { fetchRegions, type RegionOption } from './api.js'

const names = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

export function rememberRegionNames(rows: RegionOption[]): void {
  for (const r of rows) if (r.code && r.name) names.set(r.code, r.name)
}

export function getRegionName(code: string): string | undefined {
  return names.get(code)
}

/** Parent code by dot-prefix ("18.09.03" → "18.09"); undefined for a province. */
function parentCode(code: string): string | undefined {
  const i = code.lastIndexOf('.')
  return i > 0 ? code.slice(0, i) : undefined
}

/** Resolve a code to its name; returns '' when it cannot be found. */
export async function resolveRegionName(code: string): Promise<string> {
  if (!code) return ''
  const cached = names.get(code)
  if (cached) return cached
  const pending = inflight.get(code)
  if (pending) return pending
  const p = (async () => {
    try {
      const rows = await fetchRegions(parentCode(code), undefined, 500)
      rememberRegionNames(rows)
      return names.get(code) ?? ''
    } finally {
      inflight.delete(code)
    }
  })()
  inflight.set(code, p)
  return p
}
