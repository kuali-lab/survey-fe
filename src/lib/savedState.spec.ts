import { describe, expect, it } from 'vitest'
import { parseSavedState, serializeSavedState, STORAGE_TTL_MS, type SavedState } from './savedState.js'

const now = 1_000_000

describe('parseSavedState — perilaku lama dipertahankan', () => {
  it('menolak JSON rusak, tanpa currentIndex, atau answers bukan objek', () => {
    expect(parseSavedState('bukan json', now)).toBeNull()
    expect(parseSavedState('null', now)).toBeNull()
    expect(parseSavedState('{"answers":{}}', now)).toBeNull()
    expect(parseSavedState('{"currentIndex":1}', now)).toBeNull()
    expect(parseSavedState('{"currentIndex":1,"answers":"x"}', now)).toBeNull()
    expect(parseSavedState('{"currentIndex":1,"answers":null}', now)).toBeNull()
    expect(parseSavedState('{"currentIndex":"1","answers":{}}', now)).toBeNull()
  })

  it('kedaluwarsa bila savedAt lebih tua dari TTL (perbandingan lama: `>` ketat)', () => {
    const raw = JSON.stringify({ answers: { q: 1 }, currentIndex: 0, savedAt: now - STORAGE_TTL_MS - 1, accumulatedTimeMs: 0 })
    expect(parseSavedState(raw, now)).toEqual({ state: null, expired: true })
  })

  it('tidak kedaluwarsa tepat di batas TTL, dan tanpa savedAt tidak pernah kedaluwarsa', () => {
    // Kode lama memakai `>` ketat: selisih persis sama dengan TTL belum dianggap kedaluwarsa.
    const edge = JSON.stringify({ answers: { q: 1 }, currentIndex: 0, savedAt: now - STORAGE_TTL_MS, accumulatedTimeMs: 0 })
    expect(parseSavedState(edge, now)?.expired).toBe(false)
    expect(parseSavedState(edge, now)?.state).not.toBeNull()
    const noSaved = JSON.stringify({ answers: { q: 1 }, currentIndex: 0, accumulatedTimeMs: 5 })
    expect(parseSavedState(noSaved, now)?.expired).toBe(false)
    expect(parseSavedState(noSaved, now)?.state?.accumulatedTimeMs).toBe(5)
    // savedAt = 0 gagal uji truthiness di kode lama → tidak pernah kedaluwarsa (dipertahankan apa adanya).
    const zeroSaved = JSON.stringify({ answers: { q: 1 }, currentIndex: 0, savedAt: 0, accumulatedTimeMs: 5 })
    expect(parseSavedState(zeroSaved, now)?.expired).toBe(false)
  })

  it('memetakan startTime lama ke accumulatedTimeMs', () => {
    const raw = JSON.stringify({ answers: { q: 1 }, currentIndex: 2, savedAt: now, startTime: 42 })
    expect(parseSavedState(raw, now)?.state?.accumulatedTimeMs).toBe(42)
    const rawNoStart = JSON.stringify({ answers: { q: 1 }, currentIndex: 2, savedAt: now })
    expect(parseSavedState(rawNoStart, now)?.state?.accumulatedTimeMs).toBe(0)
  })

  it('mengembalikan answers dan currentIndex apa adanya', () => {
    const raw = JSON.stringify({ answers: { q: 'a', r: [1, 2] }, currentIndex: 3, savedAt: now, accumulatedTimeMs: 9 })
    const r = parseSavedState(raw, now)
    expect(r?.state?.answers).toEqual({ q: 'a', r: [1, 2] })
    expect(r?.state?.currentIndex).toBe(3)
  })
})

describe('linkCode ikut draf', () => {
  it('bulat-balik lewat serializeSavedState', () => {
    const s: SavedState = { answers: { q: 1 }, currentIndex: 0, accumulatedTimeMs: 0, savedAt: now, linkCode: 'k7m2p9qa' }
    expect(parseSavedState(serializeSavedState(s), now)?.state?.linkCode).toBe('k7m2p9qa')
  })

  it('serializeSavedState tanpa linkCode tidak menulis kunci linkCode', () => {
    const s: SavedState = { answers: { q: 1 }, currentIndex: 0, accumulatedTimeMs: 0, savedAt: now }
    expect(JSON.parse(serializeSavedState(s))).not.toHaveProperty('linkCode')
  })

  it('draf lama tanpa linkCode tetap dimuat, linkCode undefined', () => {
    const raw = JSON.stringify({ answers: { q: 1 }, currentIndex: 0, savedAt: now, accumulatedTimeMs: 0 })
    const r = parseSavedState(raw, now)
    expect(r?.state).not.toBeNull()
    expect(r?.state?.linkCode).toBeUndefined()
  })

  it('linkCode bukan string diabaikan (dianggap tidak ada)', () => {
    const raw = JSON.stringify({ answers: { q: 1 }, currentIndex: 0, savedAt: now, accumulatedTimeMs: 0, linkCode: 42 })
    expect(parseSavedState(raw, now)?.state?.linkCode).toBeUndefined()
    const rawNull = JSON.stringify({ answers: { q: 1 }, currentIndex: 0, savedAt: now, accumulatedTimeMs: 0, linkCode: null })
    expect(parseSavedState(rawNull, now)?.state?.linkCode).toBeUndefined()
  })
})
