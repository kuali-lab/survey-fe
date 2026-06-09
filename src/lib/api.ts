import { PUBLIC_API_BASE_URL } from '$env/static/public'
import { env as publicEnv } from '$env/dynamic/public'
import type { Survey, Question } from './types.js'
import type { Answers } from './types.js'
import { buildMockSurvey } from './mockSurvey.js'

/**
 * Mock gate — PUBLIC_USE_MOCK is the single master switch. It's read at runtime
 * via $env/dynamic/public, so the SAME build behaves differently per deploy:
 *   - dev / local:  PUBLIC_USE_MOCK=1  → every survey is served from the local
 *                                        fixture (no logika-be needed)
 *   - prod:         unset / "0"        → mock fully disabled; all requests,
 *                                        including /s/mock, hit the real backend
 * Keeping it env-only (no hardcoded slug bypass) is what makes prod safe: with
 * the flag off there is no way to reach the fixture.
 */
function shouldUseMock(): boolean {
  return publicEnv.PUBLIC_USE_MOCK === '1' || publicEnv.PUBLIC_USE_MOCK === 'true'
}

/**
 * Normalize a raw API question object into the typed Question shape used by
 * survey-fe components. The backend returns per-option imageUrl inside each
 * option object; we flatten those into the optionImages[] array so that
 * QuestionInput.svelte can access question.optionImages[idx] directly.
 */
function normalizeQuestion(q: Record<string, unknown>): Question {
  const options = (q.options as Array<Record<string, unknown>> | undefined) ?? []

  // Derive optionImages[] from options[].imageUrl (parallel array)
  const optionImages = options.map((o) => (o.imageUrl as string | null | undefined) ?? '')
  const hasOptionImages = optionImages.some((url) => url !== '')

  return {
    ...(q as unknown as Question),
    options: options.map((o) => ({
      id: (o.id as string) ?? '',
      label: (o.label as string) ?? '',
      value: o.value as string | undefined,
      imageUrl: o.imageUrl as string | undefined,
      sortOrder: (o.sortOrder as number) ?? 0,
      isOther: Boolean(o.isOther),
    })),
    optionImages: hasOptionImages ? optionImages : undefined,
  } as Question
}

/**
 * Normalize the full survey payload from the public API.
 */
function normalizeSurvey(raw: Record<string, unknown>): Survey {
  const questions = (raw.questions as Array<Record<string, unknown>> | undefined) ?? []
  return {
    ...(raw as unknown as Survey),
    questions: questions.map(normalizeQuestion),
  }
}

const SURVEY_CACHE_PREFIX = 'survey-fe:surveyCache:'

function readSurveyCache(slug: string): Survey | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SURVEY_CACHE_PREFIX + slug)
    if (!raw) return null
    return JSON.parse(raw) as Survey
  } catch {
    return null
  }
}

function writeSurveyCache(slug: string, survey: Survey): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(SURVEY_CACHE_PREFIX + slug, JSON.stringify(survey)) } catch { /* quota */ }
}

// ─── Invitation tracking (best-effort, fire-and-forget) ──────────────────────
// These calls are anonymous when no `?t=` was on the URL; the runner skips
// them in that case. Failures never block the survey flow.

/** POST /api/v1/invitations/:token/track — records the click on first mount. */
export async function trackInvitationClick(token: string): Promise<void> {
  try {
    await fetch(`${PUBLIC_API_BASE_URL}/invitations/${encodeURIComponent(token)}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch {
    // Best-effort: a tracking failure must not break the survey.
  }
}

/** POST /api/v1/invitations/:token/progress — fires once per state transition. */
export async function reportInvitationProgress(token: string, status: 'started' | 'completed'): Promise<void> {
  try {
    await fetch(`${PUBLIC_API_BASE_URL}/invitations/${encodeURIComponent(token)}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  } catch {
    // Best-effort.
  }
}

/**
 * One-time-link gate (item 4): returns the invitation's fill state so the runner
 * can show a "sudah selesai / kedaluwarsa" screen instead of letting a reused or
 * expired link re-open the form. States: 'ok' | 'completed' | 'expired' | 'invalid'.
 * Network failure → 'ok' (fail-open: never block a legit respondent on a hiccup).
 */
export async function getInvitationStatus(token: string): Promise<'ok' | 'completed' | 'expired' | 'invalid'> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE_URL}/invitations/${encodeURIComponent(token)}/status`)
    if (!res.ok) return 'ok'
    const data = await res.json()
    const state = data?.state
    if (state === 'completed' || state === 'expired' || state === 'invalid') return state
    return 'ok'
  } catch {
    return 'ok'
  }
}

// ─── Region lookup (public, no auth) ─────────────────────────────────────────
// Backs the cascading "Wilayah" (region) question. BPS codes are dot-prefix
// hierarchical ("32" > "32.73" > "32.73.01" > "32.73.01.2001").
//   - omit `parent`        → top-level provinces
//   - parent=<code>        → that region's direct children
//   - q=<search>           → name search within that level
// Default limit 50. Returns [] on any failure so the UI degrades gracefully
// (an empty select rather than a crash).
export type RegionOption = { code: string; name: string; level: number }

export async function fetchRegions(parent?: string, q?: string, limit = 50): Promise<RegionOption[]> {
  try {
    const params = new URLSearchParams()
    if (parent) params.set('parent', parent)
    if (q) params.set('q', q)
    params.set('limit', String(limit))
    const res = await fetch(`${PUBLIC_API_BASE_URL}/regions?${params.toString()}`)
    if (!res.ok) return []
    const data = await res.json()
    const rows = (data?.data as Array<Record<string, unknown>> | undefined) ?? []
    return rows.map((r) => ({
      code: String(r.code ?? ''),
      name: String(r.name ?? ''),
      level: typeof r.level === 'number' ? r.level : Number(r.level ?? 0),
    }))
  } catch {
    return []
  }
}

export async function fetchAsyncOptions(slug: string, questionId: string, q: string, limit = 50): Promise<{ label: string, isOther?: boolean }[]> {
  try {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('limit', String(limit))
    const res = await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/questions/${questionId}/options?${params.toString()}`)
    if (!res.ok) return []
    const data = await res.json()
    const rows = (data?.data as Array<Record<string, unknown>> | undefined) ?? []
    return rows.map((r) => ({
      label: String(r.label ?? ''),
      isOther: Boolean(r.isOther),
    }))
  } catch {
    return []
  }
}

export async function fetchSurvey(slug: string, fetchFn: typeof fetch = fetch): Promise<Survey> {
  if (shouldUseMock()) return buildMockSurvey(slug)
  try {
    const res = await fetchFn(`${PUBLIC_API_BASE_URL}/s/${slug}`)
    if (res.status === 404) throw new Error('not_found')
    
    if (res.status === 410) {
      const data = await res.json()
      const survey = normalizeSurvey(data.survey as Record<string, unknown>)
      survey.status = 'closed'
      return survey
    }

    if (!res.ok) throw new Error('server_error')
    const data = await res.json()
    const survey = normalizeSurvey(data.survey as Record<string, unknown>)
    writeSurveyCache(slug, survey)
    return survey
  } catch (err) {
    // Network failure (TypeError from fetch) or generic server_error: fall
    // back to a cached copy if the surveyor has visited this slug while
    // online before. Real terminal states (not_found / survey_closed) must
    // surface — don't mask them with stale cache.
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'not_found' || msg === 'survey_closed') throw err
    const cached = readSurveyCache(slug)
    if (cached) return cached
    throw err
  }
}


export async function submitSurveyAnswers(
  slug: string,
  answers: Answers,
  respondentEmail?: string,
  location?: { latitude: number, longitude: number, accuracy?: number, capturedAt?: string } | null,
  durationSeconds?: number,
  fingerprintHash?: string | null,
  selfie?: { imageBase64: string } | null,
  surveyorCode?: string,
  submissionId?: string,
  invitationToken?: string | null,
): Promise<void> {
  // Dev mock: pretend the submission succeeded so the closing journey renders
  // without a backend. Mirrors the fetchSurvey() gate.
  if (shouldUseMock()) return

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (surveyorCode) headers['Authorization'] = `Bearer ${surveyorCode}`
  if (submissionId) headers['Idempotency-Key'] = submissionId

  const res = await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      answers,
      respondentEmail,
      location,
      durationSeconds,
      fingerprintHash,
      selfie,
      submissionId,
      // Pass the raw invitation token (if any) so the backend can advance the
      // invite state to 'completed' and bypass the require_login email-dedup
      // when the invite has been reopened for re-fill.
      invitationToken: invitationToken ?? undefined,
    })
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (res.status === 409) throw new Error('already_submitted')
  if (res.status === 410) throw new Error('survey_closed')
  if (!res.ok) throw new Error('submit_error')
}

export async function saveDraft(
  slug: string,
  sessionKey: string,
  answers: Answers,
  currentPageIndex: number,
): Promise<void> {
  await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionKey, answers, currentPageIndex }),
  })
}

export async function getDraft(
  slug: string,
  sessionKey: string,
): Promise<{ answers: Answers; currentPageIndex: number } | null> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/draft?sessionKey=${encodeURIComponent(sessionKey)}`)
  if (!res.ok) return null
  return res.json()
}

export async function deleteDraft(slug: string, sessionKey: string): Promise<void> {
  await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/draft?sessionKey=${encodeURIComponent(sessionKey)}`, {
    method: 'DELETE',
  })
}

export type SurveyorStatsApiResponse = {
  todayCount: number
  totalCount: number
  surveyorId: string
  slug: string
}

/**
 * Fetch the authoritative stats counters for the given surveyor code.
 * Returns null on auth failure or network error — callers fall back to
 * whatever stats are in the cached session.
 */
export async function fetchSurveyorStats(code: string): Promise<SurveyorStatsApiResponse | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE_URL}/surveyor/me/stats`, {
      headers: { Authorization: `Bearer ${code}` },
    })
    if (!res.ok) return null
    return (await res.json()) as SurveyorStatsApiResponse
  } catch {
    return null
  }
}
