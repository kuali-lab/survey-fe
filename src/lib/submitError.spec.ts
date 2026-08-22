import { describe, it, expect, vi } from 'vitest'
import {
  ANSWER_VALIDATION_ERROR,
  BAD_REQUEST_ERROR,
  submitErrorFromResponse,
  serverMessageOf,
  isPermanentSubmitFailure,
} from './submitError.js'

/**
 * Minimal stand-in for the parts of fetch's Response that the mapper reads.
 * `json` is a spy so we can assert the body is only consulted when it matters.
 */
function fakeResponse(status: number, body?: unknown, opts?: { rejectJson?: boolean }) {
  const json = opts?.rejectJson
    ? vi.fn(async () => { throw new SyntaxError('Unexpected token < in JSON at position 0') })
    : vi.fn(async () => body)
  return { status, ok: status >= 200 && status < 300, json }
}

describe('submitErrorFromResponse — status codes that must not regress', () => {
  it('returns null for a successful response', async () => {
    expect(await submitErrorFromResponse(fakeResponse(200, {}))).toBeNull()
  })

  it('maps 401 to unauthorized', async () => {
    const err = await submitErrorFromResponse(fakeResponse(401))
    expect(err?.message).toBe('unauthorized')
  })

  it('maps 409 to already_submitted', async () => {
    const err = await submitErrorFromResponse(fakeResponse(409))
    expect(err?.message).toBe('already_submitted')
  })

  it('maps 410 to survey_closed', async () => {
    const err = await submitErrorFromResponse(fakeResponse(410))
    expect(err?.message).toBe('survey_closed')
  })

  it('maps 410 to survey_closed even when the body carries a message', async () => {
    // The server widened 410 to cover owner-quota closure; the FE contract stays.
    const res = fakeResponse(410, {
      error: { code: 'SURVEY_CLOSED', message: 'Survei ini sudah ditutup.', status: 410 },
    })
    const err = await submitErrorFromResponse(res)
    expect(err?.message).toBe('survey_closed')
    expect(serverMessageOf(err)).toBeNull()
  })

  it('maps 500 to submit_error', async () => {
    const err = await submitErrorFromResponse(fakeResponse(500))
    expect(err?.message).toBe('submit_error')
  })

  it('maps 404 to submit_error', async () => {
    const err = await submitErrorFromResponse(fakeResponse(404))
    expect(err?.message).toBe('submit_error')
  })

  it('does not read the body for non message-bearing failures', async () => {
    const res = fakeResponse(401)
    await submitErrorFromResponse(res)
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('submitErrorFromResponse — 422 ANSWER_VALIDATION_ERROR', () => {
  it('carries the server message out to the caller', async () => {
    const res = fakeResponse(422, {
      error: {
        code: 'ANSWER_VALIDATION_ERROR',
        message: 'nama tidak boleh berupa angka saja',
        status: 422,
      },
    })
    const err = await submitErrorFromResponse(res)
    expect(err?.message).toBe(ANSWER_VALIDATION_ERROR)
    expect(serverMessageOf(err)).toBe('nama tidak boleh berupa angka saja')
  })
})

describe('submitErrorFromResponse — 400 BAD_REQUEST', () => {
  it('carries the server message out to the caller', async () => {
    const res = fakeResponse(400, {
      error: {
        code: 'BAD_REQUEST',
        message: 'Data yang dikirim tidak dapat dibaca server. Muat ulang halaman lalu kirim ulang.',
        status: 400,
      },
    })
    const err = await submitErrorFromResponse(res)
    expect(err?.message).toBe(BAD_REQUEST_ERROR)
    expect(serverMessageOf(err)).toBe(
      'Data yang dikirim tidak dapat dibaca server. Muat ulang halaman lalu kirim ulang.',
    )
  })

  it('is a distinct code from the 422 rejection', () => {
    expect(BAD_REQUEST_ERROR).not.toBe(ANSWER_VALIDATION_ERROR)
  })
})

// Both message-bearing statuses must degrade identically when the body is
// unusable: back to the pre-existing submit_error, never a second throw.
describe.each([400, 422])('submitErrorFromResponse — %i with an unusable body', (status) => {
  it('falls back to submit_error when the body is not JSON', async () => {
    const res = fakeResponse(status, undefined, { rejectJson: true })
    const err = await submitErrorFromResponse(res)
    expect(err?.message).toBe('submit_error')
    expect(serverMessageOf(err)).toBeNull()
  })

  it('falls back to submit_error when the body has no error.message', async () => {
    const err = await submitErrorFromResponse(fakeResponse(status, { error: { code: 'X', status } }))
    expect(err?.message).toBe('submit_error')
  })

  it('falls back to submit_error when the body has no error object at all', async () => {
    const err = await submitErrorFromResponse(fakeResponse(status, { detail: 'nope' }))
    expect(err?.message).toBe('submit_error')
  })

  it('falls back to submit_error when error.message is not a string', async () => {
    const err = await submitErrorFromResponse(fakeResponse(status, { error: { message: { id: 'x' } } }))
    expect(err?.message).toBe('submit_error')
  })

  it('falls back to submit_error when error.message is blank', async () => {
    const err = await submitErrorFromResponse(fakeResponse(status, { error: { message: '   ' } }))
    expect(err?.message).toBe('submit_error')
  })

  it('falls back to submit_error when the body is a bare JSON string', async () => {
    const err = await submitErrorFromResponse(fakeResponse(status, 'Bad Gateway'))
    expect(err?.message).toBe('submit_error')
  })

  it('falls back to submit_error when the body is JSON null', async () => {
    const err = await submitErrorFromResponse(fakeResponse(status, null))
    expect(err?.message).toBe('submit_error')
  })
})

describe('serverMessageOf', () => {
  it('returns null for a plain coded Error', () => {
    expect(serverMessageOf(new Error('submit_error'))).toBeNull()
  })

  it('returns null for a non-Error value', () => {
    expect(serverMessageOf('nope')).toBeNull()
  })

  it('returns null for null', () => {
    expect(serverMessageOf(null)).toBeNull()
  })
})

describe('isPermanentSubmitFailure', () => {
  it('treats a 422 answer validation rejection as permanent', () => {
    expect(isPermanentSubmitFailure(ANSWER_VALIDATION_ERROR)).toBe(true)
  })

  it('treats a 400 bad request rejection as permanent', () => {
    expect(isPermanentSubmitFailure(BAD_REQUEST_ERROR)).toBe(true)
  })

  it('keeps unauthorized permanent', () => {
    expect(isPermanentSubmitFailure('unauthorized')).toBe(true)
  })

  it('keeps survey_closed permanent', () => {
    expect(isPermanentSubmitFailure('survey_closed')).toBe(true)
  })

  it('keeps submit_error retryable', () => {
    expect(isPermanentSubmitFailure('submit_error')).toBe(false)
  })

  it('keeps an unknown error retryable', () => {
    expect(isPermanentSubmitFailure('unknown_error')).toBe(false)
  })

  it('keeps a network failure retryable', () => {
    expect(isPermanentSubmitFailure('Failed to fetch')).toBe(false)
  })
})
