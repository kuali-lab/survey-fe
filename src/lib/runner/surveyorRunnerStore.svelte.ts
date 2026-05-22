/**
 * Module-level singleton runner used across the surveyor route family
 * (/interview → /recap → back). SvelteKit navigation drops per-page state,
 * so keeping the runner here lets the recap page read the in-memory answers
 * the interview page just captured without re-mounting from localStorage.
 */

import { SurveyRunner } from './SurveyRunner.svelte.js'
import type { Survey, Answers } from '$lib/types.js'

let _runner: SurveyRunner | null = null
let _surveyId: string | null = null

export type AnswerSnapshot = {
  answers: Answers
  currentIndex: number
  accumulatedTimeMs: number
}

/**
 * Return the existing runner if it matches the given survey id; otherwise
 * create a fresh one. Always installs the latest onFinish callback so the
 * caller's next-step behavior takes effect.
 */
export function getSurveyorRunner(
  getSurvey: () => Survey | null,
  onFinish: () => void | Promise<void>,
): SurveyRunner {
  const survey = getSurvey()
  if (!survey) throw new Error('getSurveyorRunner called without a loaded survey')

  if (_runner && _surveyId === survey.id) {
    _runner.setOnFinish(onFinish)
    return _runner
  }
  _runner = new SurveyRunner({ getSurvey, onFinish, lastButtonLabel: 'Tinjau Jawaban' })
  _surveyId = survey.id
  _runner.lastActiveTime = Date.now()
  return _runner
}

export function peekSurveyorRunner(): SurveyRunner | null {
  return _runner
}

export function clearSurveyorRunner() {
  _runner = null
  _surveyId = null
}

// ---- Localstorage fallback (used by /recap when the in-memory runner is
//      gone — e.g. user reloaded the page). Keyed per slug. ----
const lsKey = (slug: string) => `surveyor:answers:${slug}`

export function saveSurveyorAnswers(slug: string, snap: AnswerSnapshot): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(lsKey(slug), JSON.stringify(snap))
  } catch {
    // ignore
  }
}

export function loadSurveyorAnswers(slug: string): AnswerSnapshot | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(lsKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AnswerSnapshot>
    if (typeof parsed?.currentIndex !== 'number') return null
    if (!parsed.answers || typeof parsed.answers !== 'object') return null
    
    // Fallback for legacy state
    if (typeof parsed.accumulatedTimeMs !== 'number') {
      const anyParsed = parsed as any
      parsed.accumulatedTimeMs = anyParsed.startTime || 0
    }
    return parsed as AnswerSnapshot
  } catch {
    return null
  }
}

export function clearSurveyorAnswers(slug: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(lsKey(slug))
  } catch {
    // ignore
  }
}

// ---- Rolling-buffer of recent interview durations (for "Rata-rata waktu"
//      on the ready dashboard). Stored per slug, last 10 entries. ----
const durKey = (slug: string) => `surveyor:durations:${slug}`
const MAX_DURATIONS = 10

export function pushDuration(slug: string, seconds: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(durKey(slug))
    const arr: number[] = raw ? (JSON.parse(raw) as number[]) : []
    arr.push(seconds)
    while (arr.length > MAX_DURATIONS) arr.shift()
    localStorage.setItem(durKey(slug), JSON.stringify(arr))
  } catch {
    // ignore
  }
}

export function getDurations(slug: string): number[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(durKey(slug))
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}

export function averageDuration(slug: string): number | null {
  const arr = getDurations(slug)
  if (arr.length < 3) return null
  const sum = arr.reduce((a, b) => a + b, 0)
  return Math.round(sum / arr.length)
}
