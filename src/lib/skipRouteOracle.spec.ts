import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { walkVisited } from './skipLogic.js'
import type { Question, SkipRoute, SkipRule } from './types.js'
import oracle from './__fixtures__/skipRouteOracle.json'

// Salinan blok JSON dari docs/Ihatec/Dev v1.0/Logika Cabang Antrean/fixture-oracle-rute.md,
// tabel yang sama dengan uji backend (skip_route_eval_test.go). Backend benar bila selisih.
const DOC = new URL(
  '../../../../../docs/Ihatec/Dev v1.0/Logika Cabang Antrean/fixture-oracle-rute.md',
  import.meta.url
)

const questions = oracle.questions.map(
  (q) => ({ id: q.id, type: q.type, title: q.id, description: null, required: false, sortOrder: q.sortOrder, groupId: null, imageUrl: null, imageLayout: null }) as Question
)

const run = (routes: unknown, rules: unknown, answers: unknown) =>
  walkVisited(questions, questions, rules as SkipRule[], routes as SkipRoute[], answers as never).map((s) => s.id)

// Backend menyaring rute rusak dari muatan publik, jadi survey-fe tak pernah menerimanya.
const SKIPPED: Record<string, string> = {
  'rute rusak (langkah tak ada) diabaikan': 'disaring backend sebelum sampai ke survey-fe',
}

describe('oracle rute berurutan (fixture backend)', () => {
  it('salinan fixture sama dengan docs', () => {
    if (!existsSync(DOC)) return // repo dipakai tanpa folder docs
    const json = readFileSync(DOC, 'utf8').split('```json')[1].split('```')[0]
    expect(oracle).toEqual(JSON.parse(json))
  })

  it('memuat 16 himpunan bagian', () => expect(oracle.subsets).toHaveLength(16))

  for (const s of oracle.subsets) {
    it(`{${s.answer.join(',')}}`, () => {
      expect(run(oracle.routes, [], { qp: s.answer })).toEqual(s.visited)
    })
  }

  for (const c of oracle.additional as Array<{ name: string; routes: unknown; rules: unknown; answers: unknown; visited: string[] }>) {
    const reason = SKIPPED[c.name]
    if (reason) {
      it.skip(`${c.name} (${reason})`, () => {})
      continue
    }
    it(c.name, () => expect(run(c.routes, c.rules, c.answers)).toEqual(c.visited))
  }

  it('bentuk rute publik cocok dengan tipe SkipRoute', () => {
    const typed: SkipRoute[] = oracle.routes as SkipRoute[]
    for (const r of typed) {
      expect(Object.keys(r).filter((k) => k !== 'kind' && k !== 'branches').sort()).toEqual(['conditions', 'connector', 'hostQuestionId', 'id', 'joinQuestionId', 'position', 'steps'])
      for (const c of r.conditions) expect(typeof c.sourceQuestionId).toBe('string')
    }
  })
})
