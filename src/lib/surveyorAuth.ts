import { PUBLIC_API_BASE_URL } from '$env/static/public'

export type SurveyorSession = {
  code: string
  surveyorId: string
  displayName: string
  email: string
  slug: string
}

const SESSION_KEY = 'survey-fe:surveyor'

export function loadSurveyorSession(): SurveyorSession | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SurveyorSession
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
  }
  return { ok: true, session }
}
