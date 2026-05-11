import { outbox, type OutboxItem } from './outbox.js'
import { submitSurveyAnswers } from './api.js'

type DrainEventMap = {
  'outbox:start': () => void
  'outbox:idle': () => void
  'outbox:sent': (item: OutboxItem) => void
  'outbox:failed': (item: OutboxItem, permanent: boolean) => void
}

const drainListeners: { [K in keyof DrainEventMap]: Set<DrainEventMap[K]> } = {
  'outbox:start': new Set(),
  'outbox:idle': new Set(),
  'outbox:sent': new Set(),
  'outbox:failed': new Set(),
}

export function onDrainEvent<K extends keyof DrainEventMap>(
  event: K,
  fn: DrainEventMap[K],
): () => void {
  drainListeners[event].add(fn as never)
  return () => { drainListeners[event].delete(fn as never) }
}

function emit<K extends keyof DrainEventMap>(event: K, ...args: Parameters<DrainEventMap[K]>) {
  drainListeners[event].forEach((fn) => {
    try { (fn as (...a: unknown[]) => void)(...args) } catch { /* swallow */ }
  })
}

let started = false
let draining = false
let pollTimer: ReturnType<typeof setInterval> | null = null

const POLL_INTERVAL_MS = 30_000
const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000

// attempts=1 → 5s, 2 → 10s, 3 → 20s, ..., capped at 5min.
function backoffWindowMs(attempts: number): number {
  if (attempts <= 0) return 0
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS)
}

function isReadyForRetry(item: OutboxItem): boolean {
  if (item.attempts === 0 || !item.lastAttemptAt) return true
  return Date.now() - item.lastAttemptAt >= backoffWindowMs(item.attempts)
}

export function startOutboxDrain(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => { void drain() })
  pollTimer = setInterval(() => { void drain() }, POLL_INTERVAL_MS)
  void drain()
}

export function stopOutboxDrain(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  started = false
}

export async function drain(): Promise<void> {
  if (draining) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  draining = true
  emit('outbox:start')
  try {
    const pending = await outbox.list({ status: 'pending' })
    for (const item of pending) {
      if (!isReadyForRetry(item)) continue
      await outbox.markSending(item.id)
      try {
        await submitSurveyAnswers(
          item.slug,
          item.payload.answers,
          item.payload.respondentEmail ?? undefined,
          item.payload.location,
          item.payload.durationSeconds ?? undefined,
          item.payload.fingerprintHash ?? null,
          item.payload.selfie ?? null,
          item.payload.surveyorCode ?? undefined,
          item.submissionId,
        )
        await outbox.markSent(item.id)
        emit('outbox:sent', { ...item, status: 'sent', sentAt: Date.now() })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown_error'
        // Treat duplicate-submit as idempotent success: backend already has it.
        if (msg === 'already_submitted') {
          await outbox.markSent(item.id)
          emit('outbox:sent', { ...item, status: 'sent', sentAt: Date.now() })
          continue
        }
        const permanent = msg === 'unauthorized' || msg === 'survey_closed'
        await outbox.markFailed(item.id, msg, permanent)
        emit(
          'outbox:failed',
          { ...item, status: permanent ? 'permanent_fail' : 'pending', lastError: msg },
          permanent,
        )
        // Continue to next item — one item's failure shouldn't block others.
      }
    }
  } finally {
    draining = false
    emit('outbox:idle')
  }
}
