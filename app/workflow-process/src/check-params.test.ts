import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createBusinessWorkflow } from './conductor.js'
import { ProcessError } from './load.js'
import type { Hooks, Process, Record_, Session } from './types.js'

/**
 * A step parameter is judged for WHAT IT IS, not only for being there — and
 * the judgement runs before the record is read, so junk learns nothing.
 */
const budget: Process = {
  process: 'budget',
  entity: 'Line',
  stateProperty: 'status',
  sourceFile: 'app/workflow/budget.yaml',
  roles: { clerk: 'CLERK' },
  transitions: [
    { action: 'pay', label: 'Chi trả', role: 'clerk', from: ['OPEN'], to: 'PAID', params: { target: 'lineId', required: ['lineId', 'amount'] } },
  ],
}
const DIR = mkdtempSync(join(tmpdir(), 'bw-params-'))
writeFileSync(join(DIR, 'budget.yaml'), JSON.stringify(budget), 'utf8')
const open: Record_ = { id: 'l1', entityType: 'Line', data: { status: 'OPEN' } }

function harness(over: Partial<Hooks> = {}) {
  const get = vi.fn(async () => open)
  const applyAction = vi.fn(async () => [{ aggregate: 'l1' }])
  const wf = createBusinessWorkflow({
    declarationDirs: () => [DIR], provenance: () => ({}), civilDate: () => '2026-09-13', ...over,
  } as Hooks)
  const session = { actor: 'a', roles: ['CLERK'], ctx: {}, ontology: { get, neighbors: async () => [], applyAction } } as unknown as Session
  return { wf, session, get, applyAction }
}
const caught = async (p: Promise<unknown>) => { try { await p; return null } catch (e) { return e as ProcessError } }

describe('checkParams', () => {
  const checkParams = vi.fn(({ params }: { params: Record<string, unknown> }) =>
    String(params.amount).includes('.')
      ? { param: 'amount', message: 'phải là số nguyên', code: 'CONSTRAINT_VIOLATED', keyword: 'multipleOf', limit: 1 }
      : null)

  it('REFUSE: a declared parameter that breaks its rule never reaches the write', async () => {
    const { wf, session, get, applyAction } = harness({ checkParams })
    const e = await caught(wf.applyTransition(session, 'pay', { lineId: 'l1', amount: '12.5' }))
    expect(e).toBeInstanceOf(ProcessError)
    expect(e).toMatchObject({ code: 'PARAM_INVALID', param: 'amount', reason: 'CONSTRAINT_VIOLATED', keyword: 'multipleOf', limit: 1 })
    expect(applyAction).not.toHaveBeenCalled()
    // …and before the record is read: junk learns nothing about where it stands.
    expect(get).not.toHaveBeenCalled()
  })

  it('ACCEPT: a valid call goes on to the write', async () => {
    const { wf, session, applyAction } = harness({ checkParams })
    await wf.applyTransition(session, 'pay', { lineId: 'l1', amount: '12' })
    expect(applyAction).toHaveBeenCalledOnce()
  })

  it('the role is refused first — a caller without authority is not told the parameter was wrong', async () => {
    const { wf, session } = harness({ checkParams })
    session.roles = []
    expect(await caught(wf.applyTransition(session, 'pay', { lineId: 'l1', amount: '12.5' }))).toMatchObject({ code: 'ROLE_DENIED' })
  })

  it('a missing required parameter is reported as missing, not as invalid', async () => {
    const { wf, session } = harness({ checkParams })
    expect(await caught(wf.applyTransition(session, 'pay', { lineId: 'l1' }))).toMatchObject({ code: 'PARAM_MISSING', param: 'amount' })
  })

  it('the hook is asked with the process, the step and the params as sent', async () => {
    const spy = vi.fn(() => null)
    const { wf, session } = harness({ checkParams: spy })
    await wf.applyTransition(session, 'pay', { lineId: 'l1', amount: 5 })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      process: expect.objectContaining({ process: 'budget' }),
      transition: expect.objectContaining({ action: 'pay' }),
      params: { lineId: 'l1', amount: 5 },
    }))
  })
})
