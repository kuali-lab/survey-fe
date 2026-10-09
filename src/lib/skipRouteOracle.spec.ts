import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { walkVisited } from './skipLogic.js'
import type { Question, SkipRoute, SkipRule } from './types.js'
import oracle from './__fixtures__/skipRouteOracle.json'

// Salinan semua blok ```json dari docs/Ihatec/Dev v1.0/Logika Cabang Antrean/fixture-oracle-rute.md,
// tabel yang sama dengan uji backend (skip_route_eval_test.go). Backend benar bila selisih.
const DOC = new URL(
  '../../../../../docs/Ihatec/Dev v1.0/Logika Cabang Antrean/fixture-oracle-rute.md',
  import.meta.url
)

interface RawQuestion { id: string; type: string; sortOrder: number }
interface Case { name: string; questions?: RawQuestion[]; routes: unknown; rules: unknown; answers: unknown; visited: string[] }
interface Block {
  host?: string
  questions: RawQuestion[]
  routes: unknown[]
  subsets: { answer: string[]; visited: string[] }[]
  additional: Case[]
}

const toQuestions = (raw: RawQuestion[]) =>
  raw.map(
    (q) => ({ id: q.id, type: q.type, title: q.id, description: null, required: false, sortOrder: q.sortOrder, groupId: null, imageUrl: null, imageLayout: null }) as Question
  )

const run = (raw: RawQuestion[], routes: unknown, rules: unknown, answers: unknown) => {
  const qs = toQuestions(raw)
  return walkVisited(qs, qs, rules as SkipRule[], routes as SkipRoute[], answers as never).map((s) => s.id)
}

// Backend menyaring rute rusak dari muatan publik, jadi survey-fe tak pernah menerimanya.
const SKIPPED: Record<string, string> = {
  'rute rusak (langkah tak ada) diabaikan': 'disaring backend sebelum sampai ke survey-fe',
}

const blocks = oracle as Block[]

describe('oracle rute (fixture backend)', () => {
  it('salinan fixture sama dengan docs', () => {
    if (!existsSync(DOC)) return // repo dipakai tanpa folder docs
    const md = readFileSync(DOC, 'utf8')
    const docBlocks = [...md.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]))
    expect(oracle).toEqual(docBlocks)
  })

  it('memuat blok sequence dan per_option, masing-masing 16 himpunan bagian', () => {
    expect(blocks).toHaveLength(2)
    for (const b of blocks) expect(b.subsets).toHaveLength(16)
  })

  blocks.forEach((b, i) => {
    const host = b.host ?? b.questions[0].id
    describe(`blok ${i + 1} (host ${host})`, () => {
      for (const s of b.subsets) {
        it(`{${s.answer.join(',')}}`, () => {
          expect(run(b.questions, b.routes, [], { [host]: s.answer })).toEqual(s.visited)
        })
      }

      for (const c of b.additional) {
        const reason = SKIPPED[c.name]
        if (reason) {
          it.skip(`${c.name} (${reason})`, () => {})
          continue
        }
        it(c.name, () => expect(run(c.questions ?? b.questions, c.routes, c.rules, c.answers)).toEqual(c.visited))
      }
    })
  })

  it('bentuk rute publik cocok dengan tipe SkipRoute', () => {
    const routes = blocks.flatMap((b) => [...(b.routes as SkipRoute[]), ...b.additional.flatMap((c) => c.routes as SkipRoute[])])
    expect(routes.length).toBeGreaterThan(0)
    for (const r of routes) {
      // kind & branches opsional di fixture; di payload BE kind selalu ada.
      expect(Object.keys(r).filter((k) => k !== 'kind' && k !== 'branches').sort()).toEqual(['conditions', 'connector', 'hostQuestionId', 'id', 'joinQuestionId', 'position', 'steps'])
      for (const c of r.conditions) expect(typeof c.sourceQuestionId).toBe('string')
      if (r.kind === 'per_option') {
        expect(r.branches?.length).toBeGreaterThan(0)
        for (const br of r.branches!) expect([typeof br.optionValue, Array.isArray(br.steps)]).toEqual(['string', true])
      }
    }
  })
})
