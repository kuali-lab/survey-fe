import { PUBLIC_API_BASE_URL } from '$env/static/public'
import type { Survey, Answers } from './types.js'

export async function fetchSurvey(slug: string, fetchFn: typeof fetch = fetch): Promise<Survey> {
  const res = await fetchFn(`${PUBLIC_API_BASE_URL}/s/${slug}`)
  if (res.status === 404) throw new Error('not_found')
  if (!res.ok) throw new Error('server_error')
  const data = await res.json()
  return data.survey as Survey
}

export async function submitSurveyAnswers(
  slug: string,
  answers: Answers,
  respondentEmail?: string
): Promise<void> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, respondentEmail })
  })
  if (res.status === 409) throw new Error('already_submitted')
  if (res.status === 410) throw new Error('survey_closed')
  if (!res.ok) throw new Error('submit_error')
}
