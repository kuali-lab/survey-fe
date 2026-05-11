import type { Answers } from './types.js'

export type GpsFix = {
  latitude: number
  longitude: number
  accuracy: number
  capturedAt: string
}

export type SubmissionPayload = {
  answers: Answers
  respondentEmail?: string | null
  location: GpsFix | null
  durationSeconds?: number | null
  fingerprintHash?: string | null
  selfie?: { imageBase64: string } | null
  surveyorCode: string | null
}

export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'permanent_fail'

export type OutboxItem = {
  id: number
  submissionId: string
  slug: string
  payload: SubmissionPayload
  enqueuedAt: number
  attempts: number
  lastAttemptAt: number | null
  lastError: string | null
  status: OutboxStatus
  sentAt: number | null
}

const DB_NAME = 'survey-fe-outbox'
const DB_VERSION = 1
const STORE = 'submissions'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexeddb_unsupported'))
  }
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('byStatus', 'status', { unique: false })
        store.createIndex('bySlug', 'slug', { unique: false })
        store.createIndex('bySubmissionId', 'submissionId', { unique: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexeddb_open_failed'))
  })
  return dbPromise
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('indexeddb_req_failed'))
  })
}

type ChangeListener = () => void
const listeners = new Set<ChangeListener>()

export function onOutboxChange(fn: ChangeListener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function emitChange() {
  listeners.forEach((fn) => { try { fn() } catch { /* swallow */ } })
}

async function readAll(): Promise<OutboxItem[]> {
  const db = await openDb()
  return new Promise<OutboxItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const s = tx.objectStore(STORE)
    const r = s.getAll()
    r.onsuccess = () => resolve((r.result ?? []) as OutboxItem[])
    r.onerror = () => reject(r.error)
  })
}

async function updateOne(id: number, mutate: (i: OutboxItem) => OutboxItem): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const s = tx.objectStore(STORE)
    const getR = s.get(id)
    getR.onsuccess = () => {
      const v = getR.result as OutboxItem | undefined
      if (!v) { resolve(); return }
      const next = mutate(v)
      const putR = s.put(next)
      putR.onsuccess = () => resolve()
      putR.onerror = () => reject(putR.error)
    }
    getR.onerror = () => reject(getR.error)
    tx.onerror = () => reject(tx.error)
  })
}

export const outbox = {
  async enqueue(args: {
    submissionId: string
    slug: string
    payload: SubmissionPayload
  }): Promise<OutboxItem> {
    const db = await openDb()
    const candidate: Omit<OutboxItem, 'id'> = {
      submissionId: args.submissionId,
      slug: args.slug,
      payload: args.payload,
      enqueuedAt: Date.now(),
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      status: 'pending',
      sentAt: null,
    }
    const id = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const s = tx.objectStore(STORE)
      const r = s.add(candidate as OutboxItem)
      r.onsuccess = () => resolve(r.result as number)
      r.onerror = () => reject(r.error)
    })
    emitChange()
    return { ...candidate, id }
  },

  async list(filter?: { status?: OutboxStatus; slug?: string }): Promise<OutboxItem[]> {
    const all = await readAll()
    let out = all
    if (filter?.status) out = out.filter((i) => i.status === filter.status)
    if (filter?.slug) out = out.filter((i) => i.slug === filter.slug)
    return out.sort((a, b) => a.enqueuedAt - b.enqueuedAt)
  },

  async getById(id: number): Promise<OutboxItem | null> {
    const db = await openDb()
    return new Promise<OutboxItem | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const r = tx.objectStore(STORE).get(id)
      r.onsuccess = () => resolve((r.result as OutboxItem | undefined) ?? null)
      r.onerror = () => reject(r.error)
    })
  },

  async getBySubmissionId(submissionId: string): Promise<OutboxItem | null> {
    const db = await openDb()
    return new Promise<OutboxItem | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('bySubmissionId')
      const r = idx.get(submissionId)
      r.onsuccess = () => resolve((r.result as OutboxItem | undefined) ?? null)
      r.onerror = () => reject(r.error)
    })
  },

  async markSending(id: number): Promise<void> {
    await updateOne(id, (i) => ({
      ...i,
      status: 'sending',
      attempts: i.attempts + 1,
      lastAttemptAt: Date.now(),
    }))
    emitChange()
  },

  async markSent(id: number): Promise<void> {
    await updateOne(id, (i) => ({ ...i, status: 'sent', sentAt: Date.now(), lastError: null }))
    emitChange()
  },

  async markFailed(id: number, error: string, permanent: boolean): Promise<void> {
    await updateOne(id, (i) => ({
      ...i,
      status: permanent ? 'permanent_fail' : 'pending',
      lastError: error,
    }))
    emitChange()
  },

  async purgeSent(olderThanMs: number): Promise<number> {
    const db = await openDb()
    const cutoff = Date.now() - olderThanMs
    let removed = 0
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const idx = tx.objectStore(STORE).index('byStatus')
      const cursorReq = idx.openCursor(IDBKeyRange.only('sent'))
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor) { resolve(); return }
        const v = cursor.value as OutboxItem
        if ((v.sentAt ?? v.enqueuedAt) < cutoff) {
          cursor.delete()
          removed++
        }
        cursor.continue()
      }
      cursorReq.onerror = () => reject(cursorReq.error)
    })
    if (removed > 0) emitChange()
    return removed
  },
}
