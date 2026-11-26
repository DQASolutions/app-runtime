import { describe, expect, it } from 'vitest'
import type { ResolvedAction, ViewContract } from '@dqa-ai-solutions/ontology-view'
import { CONTRACT } from './fixture.js'
import { registryOf } from './registry.js'
import { actionForm } from './action.js'
import { presentationOf, readersOf, undeterminedIn } from './pattern.js'

// `select` asks for decisionNo · unitId · note; `signedBy` is fixed by the declaration.
const [select] = CONTRACT.actions as [ResolvedAction]
const withTask = (task: ResolvedAction['task']): ResolvedAction => ({ ...select, task })
const complete = {
  category: 'interaction' as const, iteration: 'single' as const, reads: ['unitId'],
  filledBy: { decisionNo: 'interaction' as const, unitId: 'suggested' as const, note: 'interaction' as const, decidedAt: 'system' as const },
}

describe('presentationOf — one pattern per step, or the reason there is none', () => {
  it('refuses to guess for a step that declares nothing', () => {
    const p = presentationOf(select)
    expect(p.determined).toBe(false)
    if (!p.determined) expect(p.why).toMatch(/nobody has said how/)
  })

  it('a step the software does alone has no surface', () => {
    expect(presentationOf(withTask({ category: 'system' }))).toEqual({ determined: true, value: { surface: 'none' } })
  })

  it('a complete declaration gives exactly one pattern', () => {
    expect(presentationOf(withTask(complete))).toEqual({
      determined: true,
      value: { surface: 'action', review: ['unitId'], input: 'fields', typed: ['decisionNo', 'note'], suggested: ['unitId'], over: 'single' },
    })
  })

  it('a step done away from the software that leaves a signed paper is a document capture', () => {
    const p = presentationOf(withTask({ ...complete, category: 'user', leaves: 'document' }))
    expect(p.determined && p.value.surface === 'action' && p.value.input).toBe('document')
  })

  const undetermined: [string, ResolvedAction['task'], RegExp][] = [
    ['no category', { iteration: 'single' }, /who does/],
    ['no iteration', { ...complete, iteration: undefined }, /one record or many/],
    ['no reads', { ...complete, reads: undefined }, /must see/],
    ['a parameter nobody covered', { ...complete, filledBy: { decisionNo: 'interaction', unitId: 'interaction' } }, /"note"/],
    ['a typed field the step does not take', { ...complete, filledBy: { ...complete.filledBy, reason: 'interaction' } }, /"reason".*does not take it/],
    ['rows over a field it does not record', { ...complete, iteration: { rows: 'lines' } }, /lines of "lines"/],
    ['off-software without leaves', { ...complete, category: 'user' }, /leaves behind/],
  ]
  for (const [what, task, why] of undetermined) {
    it(`says why, never guesses: ${what}`, () => {
      const p = presentationOf(withTask(task))
      expect(p.determined).toBe(false)
      if (!p.determined) expect(p.why).toMatch(why)
    })
  }
})

describe('actionForm reads filledBy only when it is declared', () => {
  const blocks = registryOf([])

  it('changes nothing for a step with no task', () => {
    const form = actionForm(select, blocks)
    expect(form.bySoftware).toBeUndefined()
    expect(form.fields.some((f) => 'entry' in f)).toBe(false)
  })

  it('does not ask what the software fills, and marks what it only suggests', () => {
    const form = actionForm(withTask({ ...complete, filledBy: { ...complete.filledBy, note: 'system' } }), blocks)
    expect(form.fields.map((f) => [f.field.key, f.entry])).toEqual([['decisionNo', 'interaction'], ['unitId', 'suggested']])
    expect(form.bySoftware?.map((f) => f.key)).toEqual(['note'])
  })
})

describe('readersOf · undeterminedIn — the coverage question a build can ask', () => {
  const line = CONTRACT.lines![0]!
  const contract: ViewContract = {
    ...CONTRACT,
    actions: CONTRACT.actions.map((a) => ({ ...a, task: { category: 'system' as const } })),
    lines: [{ ...line, readers: Object.fromEntries(line.states.map((s) => [s.name, ['AUDITOR']])) }],
  }

  it('is empty when every step has a pattern and every state says who else sees it', () => {
    expect(undeterminedIn(contract)).toEqual([])
    expect(readersOf(contract, line.process, line.states[0]!.name)).toEqual({ determined: true, value: ['AUDITOR'] })
  })

  it('names every step and state still open on a contract that declares nothing', () => {
    const open = undeterminedIn(CONTRACT)
    expect(open.filter((x) => x.at.includes('.step:'))).toHaveLength(CONTRACT.actions.length)
    expect(open.some((x) => x.at.includes('.state:'))).toBe(true)
  })
})
