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
    // Ensure options carry proper types
    options: options.map((o) => ({
      id: (o.id as string) ?? '',
      label: (o.label as string) ?? '',
      value: o.value as string | undefined,
      imageUrl: o.imageUrl as string | undefined,
      sortOrder: (o.sortOrder as number) ?? 0,
      isOther: Boolean(o.isOther),
    })),
    // Only include optionImages when at least one option has an image
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
  location?: { latitude: number, longitude: number } | null,
  fingerprintHash?: string | null
): Promise<void> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, respondentEmail, location, fingerprintHash })
  })
  if (res.status === 409) throw new Error('already_submitted')
  if (res.status === 410) throw new Error('survey_closed')
  if (!res.ok) throw new Error('submit_error')
}
