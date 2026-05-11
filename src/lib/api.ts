import { PUBLIC_API_BASE_URL } from '$env/static/public'
import type { Survey, Question } from './types.js'
import type { Answers } from './types.js'

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

export async function fetchSurvey(slug: string, fetchFn: typeof fetch = fetch): Promise<Survey> {
  const res = await fetchFn(`${PUBLIC_API_BASE_URL}/s/${slug}`)
  if (res.status === 404) throw new Error('not_found')
  if (res.status === 410) throw new Error('survey_closed')
  if (!res.ok) throw new Error('server_error')
  const data = await res.json()
  return normalizeSurvey(data.survey as Record<string, unknown>)
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
): Promise<void> {
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
    })
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (res.status === 409) throw new Error('already_submitted')
  if (res.status === 410) throw new Error('survey_closed')
  if (!res.ok) throw new Error('submit_error')
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
