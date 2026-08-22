/**
 * Submit failure classification for POST /s/:slug/submit.
 *
 * Errors are thrown as plain `Error` objects whose `message` is a stable code —
 * the convention already used across api.ts, so every existing consumer
 * (`err.message === 'already_submitted'`, …) keeps working unchanged.
 *
 * Two of those responses additionally carry a respondent-facing sentence
 * written by the backend in Bahasa Indonesia. Those sentences are attached to
 * the Error as `serverMessage` and are meant to be shown verbatim, because the
 * corrective action differs per case and no generic client-side copy can stand
 * in for them:
 *
 *   422 ANSWER_VALIDATION_ERROR → the answers themselves are rejected
 *                                 ("nama tidak boleh berupa angka saja")
 *   400 BAD_REQUEST             → the payload could not be decoded at all
 *                                 ("… Muat ulang halaman lalu kirim ulang.")
 *
 * Both are terminal for the payload as sent: retrying the identical body can
 * never succeed.
 */

export const ANSWER_VALIDATION_ERROR = 'answer_validation_error'
export const BAD_REQUEST_ERROR = 'bad_request_error'

/** An Error carrying a backend sentence meant for the respondent's eyes. */
export type SubmitError = Error & { serverMessage?: string }

/** Statuses whose body holds a message we surface instead of generic copy. */
const MESSAGE_BEARING_CODES: Record<number, string> = {
  400: BAD_REQUEST_ERROR,
  422: ANSWER_VALIDATION_ERROR,
}

/** Codes for which re-sending the same payload can never succeed. */
const PERMANENT_CODES = new Set([
  'unauthorized',
  'survey_closed',
  ANSWER_VALIDATION_ERROR,
  BAD_REQUEST_ERROR,
])

/** The slice of fetch's Response this module needs — keeps it unit-testable. */
type JsonResponse = {
  status: number
  ok: boolean
  json: () => Promise<unknown>
}

/**
 * Pull `error.message` out of the documented envelope:
 *   {"error":{"code":"…","message":"…","status":422}}
 * Returns null for anything unexpected. A proxy or gateway can answer with
 * HTML, an empty body, or a differently shaped JSON, so every step is guarded
 * and the json() rejection is swallowed — the caller must never see a second
 * error raised while trying to explain the first one.
 */
async function readServerMessage(res: JsonResponse): Promise<string | null> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  const message = (error as { message?: unknown }).message
  if (typeof message !== 'string') return null
  const trimmed = message.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Map a submit response onto the Error to throw, or null when it succeeded.
 * The 401 / 409 / 410 / fallback mappings are the long-standing contract and
 * must not shift; only 400 and 422 gained behaviour here.
 */
export async function submitErrorFromResponse(res: JsonResponse): Promise<Error | null> {
  if (res.status === 401) return new Error('unauthorized')
  if (res.status === 409) return new Error('already_submitted')
  if (res.status === 410) return new Error('survey_closed')

  const code = MESSAGE_BEARING_CODES[res.status]
  if (code) {
    const serverMessage = await readServerMessage(res)
    // No usable sentence — degrade to exactly what this status did before.
    if (!serverMessage) return new Error('submit_error')
    const err: SubmitError = new Error(code)
    err.serverMessage = serverMessage
    return err
  }

  if (!res.ok) return new Error('submit_error')
  return null
}

/**
 * The backend sentence attached to an error, or null when there is none.
 * Callers use a non-null result as the signal to show it verbatim instead of
 * the generic "please try again" copy.
 */
export function serverMessageOf(err: unknown): string | null {
  if (!(err instanceof Error)) return null
  const message = (err as SubmitError).serverMessage
  return typeof message === 'string' && message.length > 0 ? message : null
}

/**
 * Whether a failure code means "stop retrying this payload".
 * Used by the offline outbox drain so a rejected submission does not spin in
 * the retry loop forever.
 */
export function isPermanentSubmitFailure(code: string): boolean {
  return PERMANENT_CODES.has(code)
}
