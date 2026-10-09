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
