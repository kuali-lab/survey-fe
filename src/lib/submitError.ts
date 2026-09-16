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
export const OPTION_OUT_OF_FILTER = 'OPTION_OUT_OF_FILTER'

/**
 * A filtered dropdown (Daftar Pilihan Bersaring) answer no longer matches the
 * source answers it was filtered by. `questionId` names the offending catalog
 * question so the page can jump to it; `detail` is the server's sentence.
 *
 * 🔴 Lives here, not in api.ts, because `api.ts` imports this module — the
 * reverse direction would be a cycle. `api.ts` re-exports it, so every existing
 * `import { OptionOutOfFilterError } from '$lib/api.js'` keeps working.
 */
export class OptionOutOfFilterError extends Error {
  readonly code = OPTION_OUT_OF_FILTER
  constructor(readonly questionId: string, readonly detail: string) {
    super('option_out_of_filter')
    this.name = 'OptionOutOfFilterError'
  }
}

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
  // Re-sending the identical payload is rejected identically: the stale pick is
  // part of the payload. Without this the outbox drain would spin on it forever
  // — exactly what this set exists to prevent.
  'option_out_of_filter',
])

/** The slice of fetch's Response this module needs — keeps it unit-testable. */
type JsonResponse = {
  status: number
  ok: boolean
  json: () => Promise<unknown>
}

/** What a single read of the error envelope yields. */
type ErrorEnvelope = {
  code: string | null
  message: string | null
  questionId: string | null
}

/**
 * Read the documented envelope ONCE:
 *   {"error":{"code":"…","message":"…","status":422}, "questionId":"…"}
 *
 * 🔴 One read, not two. A Response body can only be consumed once, and 422
 * now carries two different outcomes — a filtered-dropdown rejection that
 * needs `code` + `questionId`, and an answer-validation rejection that needs
 * `message`. Reading per-outcome would mean the second read always sees an
 * already-consumed stream.
 *
 * Everything is guarded and the json() rejection is swallowed: a proxy or
 * gateway can answer with HTML, an empty body, or differently shaped JSON, and
 * the caller must never see a second error raised while explaining the first.
 */
async function readErrorEnvelope(res: JsonResponse): Promise<ErrorEnvelope> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { code: null, message: null, questionId: null }
  }
  if (typeof body !== 'object' || body === null) {
    return { code: null, message: null, questionId: null }
  }
  const error = (body as { error?: unknown }).error
  const errObj = typeof error === 'object' && error !== null
    ? (error as { code?: unknown; message?: unknown })
    : null

  const rawMessage = errObj?.message
  const message = typeof rawMessage === 'string' && rawMessage.trim().length > 0
    ? rawMessage.trim()
    : null

  const rawCode = errObj?.code
  const code = typeof rawCode === 'string' && rawCode.length > 0 ? rawCode : null

  // `questionId` sits at the TOP level of the envelope, next to `error` — not
  // inside it. Contract §6.
  const rawQid = (body as { questionId?: unknown }).questionId
  const questionId = typeof rawQid === 'string' && rawQid.length > 0 ? rawQid : null

  return { code, message, questionId }
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
    const envelope = await readErrorEnvelope(res)

    // A filtered-dropdown rejection is its own outcome: the page returns to the
    // form and jumps to the named question, so it needs the id, not a sentence.
    if (envelope.code === OPTION_OUT_OF_FILTER) {
      return new OptionOutOfFilterError(
        envelope.questionId ?? '',
        envelope.message ?? 'Pilihan tidak sesuai dengan jawaban sebelumnya.',
      )
    }

    // No usable sentence — degrade to exactly what this status did before.
    if (!envelope.message) return new Error('submit_error')
    const err: SubmitError = new Error(code)
    err.serverMessage = envelope.message
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
