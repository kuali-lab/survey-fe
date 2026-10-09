import { describe, it, expect } from 'vitest'
import { walkVisited } from './skipLogic.js'
import type { Question, SkipRoute, SkipRule } from './types.js'

function mk(id: string, sortOrder: number, type: Question['type'] = 'short_text'): Question {
  return { id, type, title: id, description: null, required: false, sortOrder, groupId: null, imageUrl: null, imageLayout: null }
}

const QUESTIONS = [mk('Qp', 1, 'checkbox'), mk('U3', 2), mk('U4', 3), mk('U5', 4), mk('U6', 5), mk('Q6', 6)]

const cond = (v: string) => ({ sourceQuestionId: 'Qp', operator: 'contains' as const, value: v })
const R1: SkipRoute = {
  id: 'r1', hostQuestionId: 'Qp', position: 1, connector: 'AND',
  conditions: [cond('C'), cond('D')], steps: ['U4', 'U5'], joinQuestionId: 'Q6',
}
const R2: SkipRoute = {
  id: 'r2', hostQuestionId: 'Qp', position: 2, connector: 'AND',
  conditions: [cond('Kasir')], steps: ['U3'], joinQuestionId: 'Q6',
}

const walk = (routes: SkipRoute[], answers: Record<string, unknown>, rules: SkipRule[] = []) =>
  walkVisited(QUESTIONS, QUESTIONS, rules, routes, answers as never).map((s) => s.id)

describe('walkVisited — oracle rute berurutan', () => {
  const opts = ['Kasir', 'Marketing', 'C', 'D']
  const sequential = ['Qp', 'U3', 'U4', 'U5', 'U6', 'Q6']
  for (let m = 0; m < 16; m++) {
    const sel = opts.filter((_, i) => m & (1 << i))
    const has = (x: string) => sel.includes(x)
    const expected = has('C') && has('D') ? ['Qp', 'U4', 'U5', 'Q6'] : has('Kasir') ? ['Qp', 'U3', 'Q6'] : sequential
    it(`{${sel.join(',')}}`, () => {
      expect(walk([R1, R2], { Qp: sel })).toEqual(expected)
    })
  }

  it('urutan array rute tidak menentukan prioritas, position yang menentukan', () => {
    expect(walk([R2, R1], { Qp: ['Kasir', 'C', 'D'] })).toEqual(['Qp', 'U4', 'U5', 'Q6'])
  })

  it('rute always tanpa syarat, walau sumber belum dijawab', () => {
    const r: SkipRoute = { id: 'a', hostQuestionId: 'U3', position: 1, connector: 'AND', conditions: [{ sourceQuestionId: 'U3', operator: 'always' }], steps: ['U5'], joinQuestionId: 'Q6' }
    expect(walk([r], {})).toEqual(['Qp', 'U3', 'U5', 'Q6'])
  })

  it('join null: lanjut berurutan setelah langkah terakhir', () => {
    const r: SkipRoute = { ...R1, joinQuestionId: null }
    expect(walk([r], { Qp: ['C', 'D'] })).toEqual(['Qp', 'U4', 'U5', 'U6', 'Q6'])
  })

  it('connector OR', () => {
    const r: SkipRoute = { ...R1, connector: 'OR' }
    expect(walk([r], { Qp: ['D'] })).toEqual(['Qp', 'U4', 'U5', 'Q6'])
  })

  it('logika biasa langkah tidak dievaluasi selama dalam rute', () => {
    const rule: SkipRule = { id: 'x', questionId: 'U4', sourceQuestionId: 'U4', operator: 'always', value: '', action: 'end_survey', targetQuestionId: '', logicGroup: 'AND:0' }
    expect(walk([R1], { Qp: ['C', 'D'] }, [rule])).toEqual(['Qp', 'U4', 'U5', 'Q6'])
  })

  it('logika biasa host tanpa rute cocok tetap berlaku; rute menang atas logika host', () => {
    const rule: SkipRule = { id: 'x', questionId: 'Qp', sourceQuestionId: 'Qp', operator: 'always', value: '', action: 'skip_to', targetQuestionId: 'U6', logicGroup: 'AND:0' }
    expect(walk([R1], { Qp: ['Marketing'] }, [rule])).toEqual(['Qp', 'U6', 'Q6'])
    expect(walk([R1], { Qp: ['C', 'D'] }, [rule])).toEqual(['Qp', 'U4', 'U5', 'Q6'])
  })

  it('tanpa rute identik dengan logika biasa', () => {
    expect(walk([], { Qp: ['C', 'D'] })).toEqual(sequential)
  })

  it('menandai langkah yang keluarnya diatur rute', () => {
    const steps = walkVisited(QUESTIONS, QUESTIONS, [], [R1], { Qp: ['C', 'D'] })
    expect(steps.map((s) => s.routed)).toEqual([true, true, true, false])
  })
})

describe('walkVisited — rute per_option', () => {
  const QS = [mk('U2', 1, 'checkbox'), mk('U3', 2), mk('U4', 3), mk('U5', 4), mk('U6', 5), mk('U7', 6)]
  const opts = ['Marketing', 'CS', 'Kasir', 'ARO']
  const route = (over: Partial<SkipRoute> = {}): SkipRoute => ({
    id: 'p', kind: 'per_option', hostQuestionId: 'U2', position: 1, connector: 'AND', conditions: [], steps: [],
    branches: [
      { optionValue: 'Marketing', steps: ['U3'] },
      { optionValue: 'CS', steps: ['U4'] },
      { optionValue: 'Kasir', steps: ['U5'] },
      { optionValue: 'ARO', steps: ['U6'] },
    ],
    joinQuestionId: 'U7', ...over,
  })
  const w = (r: SkipRoute, answers: Record<string, unknown>, qs = QS) =>
    walkVisited(qs, qs, [], [r], answers as never).map((s) => s.id)

  for (let m = 0; m < 16; m++) {
    const sel = opts.filter((_, i) => m & (1 << i))
    const branch = ['U3', 'U4', 'U5', 'U6'].filter((_, i) => sel.includes(opts[i]))
    it(`{${sel.join(',')}}`, () => expect(w(route(), { U2: sel })).toEqual(['U2', ...branch, 'U7']))
  }

  it('urutan klik tidak menentukan urutan kunjungan', () => {
    expect(w(route(), { U2: ['ARO', 'Marketing'] })).toEqual(['U2', 'U3', 'U6', 'U7'])
  })
  it('opsi dipilih tanpa cabang diabaikan', () => {
    expect(w(route({ branches: [{ optionValue: 'CS', steps: ['U4'] }] }), { U2: ['Marketing', 'CS'] })).toEqual(['U2', 'U4', 'U7'])
  })
  it('dua cabang berbagi langkah: dedupe', () => {
    const r = route({ branches: [{ optionValue: 'Marketing', steps: ['U3', 'U4'] }, { optionValue: 'CS', steps: ['U4', 'U5'] }] })
    expect(w(r, { U2: ['Marketing', 'CS'] })).toEqual(['U2', 'U3', 'U4', 'U5', 'U7'])
  })
  it('cabang dengan lebih dari satu langkah', () => {
    expect(w(route({ branches: [{ optionValue: 'Kasir', steps: ['U3', 'U5', 'U6'] }] }), { U2: ['Kasir'] })).toEqual(['U2', 'U3', 'U5', 'U6', 'U7'])
  })
  it('pilihan tunggal memakai equals', () => {
    const qs = [mk('U2', 1, 'single_choice'), ...QS.slice(1)]
    expect(w(route(), { U2: 'CS' }, qs)).toEqual(['U2', 'U4', 'U7'])
    expect(w(route(), { U2: 'Lain' }, qs)).toEqual(['U2', 'U7'])
  })
  it('belum dijawab: antrean kosong, langsung join', () => {
    expect(w(route(), {})).toEqual(['U2', 'U7'])
  })
  it('rute per_option menang atas logika biasa host', () => {
    const rule = { id: 'x', questionId: 'U2', sourceQuestionId: 'U2', operator: 'contains', value: 'CS', action: 'skip_to', targetQuestionId: 'U6', logicGroup: 'AND:0' } as SkipRule
    expect(walkVisited(QS, QS, [rule], [route()], { U2: ['CS'] } as never).map((s) => s.id)).toEqual(['U2', 'U4', 'U7'])
  })
})
