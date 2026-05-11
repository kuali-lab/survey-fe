import { PUBLIC_API_BASE_URL } from '$env/static/public'

export type SurveyorStats = {
  todayCount: number
  totalCount: number
  /** Epoch ms of the last successful refresh. */
  cachedAt: number
}

export type SurveyorSession = {
  code: string
  surveyorId: string
  displayName: string
  email: string
  slug: string
  stats: SurveyorStats
}

const SESSION_KEY = 'survey-fe:surveyor'

const EMPTY_STATS: SurveyorStats = { todayCount: 0, totalCount: 0, cachedAt: 0 }

export function loadSurveyorSession(): SurveyorSession | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SurveyorSession>
    if (!parsed.code || !parsed.slug) return null
    return {
      code: parsed.code,
      surveyorId: parsed.surveyorId ?? '',
      displayName: parsed.displayName ?? '',
      email: parsed.email ?? '',
      slug: parsed.slug,
      stats: parsed.stats ?? EMPTY_STATS,
    }
  } catch {
    return null
  }
}

export function saveSurveyorSession(session: SurveyorSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSurveyorSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export type LoginResult =
  | { ok: true; session: SurveyorSession }
  | { ok: false; status: number }

export async function surveyorLogin(code: string, expectedSlug?: string): Promise<LoginResult> {
  const body: Record<string, string> = { code }
  if (expectedSlug) body.expectedSlug = expectedSlug

  const res = await fetch(`${PUBLIC_API_BASE_URL}/surveyor/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) return { ok: false, status: res.status }

  const data = await res.json()
  const session: SurveyorSession = {
    code: code.toUpperCase(),
    surveyorId: data.surveyor.id,
    displayName: data.surveyor.displayName,
    email: data.surveyor.email,
    slug: data.survey.slug,
    stats: {
      todayCount: data.stats?.todayCount ?? 0,
      totalCount: data.stats?.totalCount ?? 0,
      cachedAt: Date.now(),
    },
  }
  return { ok: true, session }
}

/**
 * Refresh the stats counters for an existing session by hitting
 * GET /surveyor/me/stats. Updates localStorage on success. Failures are
 * non-fatal — callers fall back to the cached stats already in the session.
 */
export async function refreshSurveyorStats(): Promise<SurveyorStats | null> {
  const session = loadSurveyorSession()
  if (!session) return null
  try {
    const res = await fetch(`${PUBLIC_API_BASE_URL}/surveyor/me/stats`, {
      headers: { Authorization: `Bearer ${session.code}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { todayCount: number; totalCount: number }
    const stats: SurveyorStats = {
      todayCount: data.todayCount,
      totalCount: data.totalCount,
      cachedAt: Date.now(),
    }
    saveSurveyorSession({ ...session, stats })
    return stats
  } catch {
    return null
  }
}
