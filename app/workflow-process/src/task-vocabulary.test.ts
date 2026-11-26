import { describe, expect, it } from 'vitest'
import { checkTaskShape } from './task-vocabulary.js'
import { KNOWN_TRANSITION_KEYS } from './load.js'
import type { Process, Transition } from './types.js'

const proc = (transitions: Transition[], extra: Partial<Process> = {}): Process[] => [{
  process: 'order', entity: 'Order', stateProperty: 'status', roles: { buyer: 'BUYER', manager: 'MANAGER' },
  states: [{ name: 'draft' }, { name: 'submitted' }, { name: 'approved' }],
  transitions, ...extra,
}]

const approve: Transition = {
  action: 'approveOrder', label: '', role: 'manager', from: ['submitted'], to: 'approved',
  params: { target: 'orderId', required: ['orderId', 'note'] },
}

describe('checkTaskShape', () => {
  it('says nothing about a process that declares no task — absent is undeclared, not wrong', () => {
    expect(checkTaskShape(proc([approve]))).toEqual([])
  })

  it('accepts a complete declaration: every parameter covered, system fields need not be parameters', () => {
    const t = { ...approve, task: { category: 'interaction', iteration: 'records', reads: ['amount'], filledBy: { note: 'interaction', approvedAt: 'system' } } } as Transition
    expect(checkTaskShape(proc([t], { readers: { approved: ['buyer'], draft: [] } }))).toEqual([])
  })

  it('refuses a field a person types that the step does not take — the screen would ask for a value the step throws away', () => {
    const t = { ...approve, task: { category: 'interaction', filledBy: { note: 'interaction', reason: 'interaction' } } } as Transition
    const f = checkTaskShape(proc([t]))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ at: 'step:approveOrder' })
    expect(f[0]!.problem).toMatch(/"reason".*does not take it/)
  })

  it('refuses a parameter nobody said how to fill once filledBy is declared', () => {
    const t = { ...approve, task: { category: 'interaction', filledBy: {} } } as Transition
    expect(checkTaskShape(proc([t])).map((x) => x.problem)).toEqual(['nobody says how "note" gets its value'])
  })

  it('refuses values outside the closed sets, rows over an unrecorded field, and leaves on an on-screen step', () => {
    const t = { ...approve, task: { category: 'manual', iteration: { rows: 'lines' }, leaves: 'document', filledBy: { note: 'typed' }, layout: 'wide' } } as unknown as Transition
    const problems = checkTaskShape(proc([t])).map((x) => x.problem)
    expect(problems).toEqual(expect.arrayContaining([
      'unknown task key `layout`',
      'category "manual"',
      'filledBy.note "typed"',
      'repeats over lines of "lines", which the step does not record',
    ]))
  })

  it('refuses a step done away from the software that records nothing', () => {
    const t = { ...approve, params: undefined, task: { category: 'user', leaves: 'outcome', filledBy: {} } } as Transition
    expect(checkTaskShape(proc([t])).map((x) => x.problem)).toEqual(['happens away from the software and records nothing'])
  })

  it('refuses readers naming a role or a state the process does not have', () => {
    const f = checkTaskShape(proc([approve], { readers: { approved: ['auditor'], archived: [] } }))
    expect(f.map((x) => x.at).sort()).toEqual(['state:approved', 'state:archived'])
  })

  it('`task` is a key the engine owns', () => {
    expect(KNOWN_TRANSITION_KEYS).toContain('task')
  })
})
